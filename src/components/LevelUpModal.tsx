import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, Heart, Dices, BookOpen, Eye, ChevronDown, ChevronUp, Plus, AlertTriangle } from 'lucide-react';
import { Player, DndClass } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { getSpellSlotsByLevel, getSpellKnowledgeInfo } from '../utils/spellSlots2024';
import { loadSectionsSmart } from './ClassesTab/modals/ClassDataModal';
import { AbilitySection, sentenceCase, slug } from './ClassesTab/modals/ClassUtilsModal';
import { MarkdownLite } from '../lib/markdownLite';

interface LevelUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player;
  onUpdate: (player: Player) => void;
  classType?: 'primary' | 'secondary';
}

/* ============================ Helpers ============================ */

const getHitDieSize = (playerClass: DndClass | null | undefined): number => {
  switch (playerClass) {
    case 'Barbare': return 12;
    case 'Guerrier':
    case 'Paladin':
    case 'Rodeur': return 10;
    case 'Barde':
    case 'Clerc':
    case 'Druide':
    case 'Moine':
    case 'Roublard':
    case 'Occultiste': return 8; 
    case 'Magicien':
    case 'Ensorceleur': return 6;
    default: return 8;
  }
};

const getAverageHpGain = (hitDieSize: number): number => {
  return Math.floor((hitDieSize / 2) + 1);
};

// Modificateurs de caractéristiques depuis StatsTab (player.abilities) — robustes
const extractAbilityMod = (player: Player, keys: string[]) => {
  const abilities: any = (player as any)?.abilities;
  if (Array.isArray(abilities)) {
    const found = abilities.find((a: any) => {
      const n = (a?.name || a?.abbr || a?.key || a?.code || '').toString().toLowerCase();
      return keys.some(k => n === k);
    });
    if (found) {
      if (typeof found.modifier === 'number' && Number.isFinite(found.modifier)) return found.modifier;
      if (typeof found.score === 'number' && Number.isFinite(found.score)) return Math.floor((found.score - 10) / 2);
      if (typeof found.modifier === 'string') {
        const n = Number(found.modifier.replace(/[^\d+-]/g, ''));
        if (Number.isFinite(n)) return n;
      }
      if (typeof found.score === 'string') {
        const n = Number(found.score.replace(/[^\d+-]/g, ''));
        if (Number.isFinite(n)) return Math.floor((n - 10) / 2);
      }
    }
  }
  return 0;
};

const getChaModFromPlayer = (player: Player): number =>
  extractAbilityMod(player, ['charisme', 'charisma', 'cha', 'car']);

/* ============================ Sous-classes (helpers) ============================ */

// Canonicalisation minimale pour RPC (même logique que PlayerProfileSettingsModal)
function mapClassForRpc(pClass: DndClass | null | undefined): string | null | undefined {
  if (pClass === 'Occultiste') return 'Occultiste';
  return pClass;
}

/* ============================ Composant AbilityCard simplifié (sans badge) ============================ */

function CompactAbilityCard({
  section,
  defaultOpen,
  ctx,
}: {
  section: AbilitySection;
  defaultOpen?: boolean;
  ctx: any;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const contentId = `ability-preview-${section.origin}-${section.level ?? 'x'}-${slug(section.title)}`;
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>(0);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (open) {
      setMaxHeight(el.scrollHeight);
      const ro = new ResizeObserver(() => {
        setMaxHeight(el.scrollHeight);
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      setMaxHeight(0);
    }
  }, [open, section.content]);

  return (
    <article
      className={[
        'rounded-xl border ring-1 ring-black/5 shadow-lg shadow-black/20',
        'border-gray-700/30',
        'bg-gray-800/50',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={contentId}
        className="w-full text-left"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            {/* Titre SANS le badge pour gagner de la place */}
            <h3 className="text-white font-semibold text-sm sm:text-base">
              {sentenceCase(section.title)}
            </h3>
          </div>
          <div className="ml-2 mt-0.5 text-white/80 shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      <div
        id={contentId}
        className="overflow-hidden transition-[max-height,opacity] duration-300"
        style={{ maxHeight: open ? maxHeight : 0, opacity: open ? 1 : 0 }}
      >
        <div ref={innerRef} className="px-4 pt-1 pb-4">
          <div className="text-sm text-white/90 leading-relaxed space-y-2">
            <MarkdownLite
              text={section.content}
              ctx={{
                ...ctx,
                section: { level: Number(section.level) || 0, origin: section.origin, title: section.title },
              }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ============================ Nouveau composant : Prévisualisation Sous-classe ============================ */

interface SubclassPreviewProps {
  subclassName: string;
  className: string;
  level: number;
  isSelected: boolean;
  onSelect: () => void;
}

function SubclassPreview({ subclassName, className, level, isSelected, onSelect }: SubclassPreviewProps) {
  const [sections, setSections] = useState<AbilitySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    const loadSections = async () => {
      setLoading(true);
      try {
        const res = await loadSectionsSmart({
          className,
          subclassName,
          level,
        });
        if (!mounted) return;
        
        // Filtrer uniquement les aptitudes de sous-classe de niveau 3
        const subclassSections = res.filter(
          s => s.origin === 'subclass' && (typeof s.level === 'number' ? s.level <= level : true)
        );
        setSections(subclassSections);
      } catch (e) {
        console.debug('[SubclassPreview] loadSectionsSmart error:', e);
        if (!mounted) return;
        setSections([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSections();
    return () => { mounted = false; };
  }, [className, subclassName, level]);

  return (
    <div 
      className={`
        rounded-lg border-2 p-4 cursor-pointer transition-all
        ${isSelected 
          ? 'border-amber-500 bg-amber-500/10' 
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
        }
      `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div 
              className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-600'}
              `}
            >
              {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            <h4 className="font-semibold text-gray-100">{subclassName}</h4>
          </div>
          
          {sections.length > 0 && (
            <p className="text-sm text-gray-400 mt-2">
              {sections.length} aptitude{sections.length > 1 ? 's' : ''} au niveau {level}
            </p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDetails(!showDetails);
          }}
          className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors shrink-0"
          title="Voir les détails"
        >
          {showDetails ? <ChevronUp size={20} /> : <Eye size={20} />}
        </button>
      </div>

      {/* Détails des aptitudes */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <img
                src="/icons/wmremove-transformed.png"
                alt="Chargement..."
                className="animate-spin h-6 w-6 object-contain"
                style={{ backgroundColor: 'transparent' }}
              />
            </div>
          ) : sections.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              Aucune aptitude trouvée
            </p>
          ) : (
            <div className="space-y-3">
              {sections.map((s, i) => (
                <CompactAbilityCard
                  key={`${s.origin}-${s.level ?? 'x'}-${i}`}
                  section={s}
                  defaultOpen={false}
                  ctx={{
                    characterId: null,
                    className: className,
                    subclassName: subclassName,
                    checkedMap: new Map(),
                    onToggle: () => {},
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ Composant ============================ */

const DND_CLASSES: DndClass[] = [
  '',
  'Barbare',
  'Barde',
  'Clerc',
  'Druide',
  'Ensorceleur',
  'Guerrier',
  'Magicien',
  'Moine',
  'Paladin',
  'Rôdeur',
  'Roublard',
  'Occultiste',
];

export function LevelUpModal({ isOpen, onClose, player, onUpdate, classType = 'primary' }: LevelUpModalProps) {
  const [hpGain, setHpGain] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Sous-classes (comme dans PlayerProfileSettingsModal)
  const [availableSubclasses, setAvailableSubclasses] = useState<string[]>([]);
  const [selectedSubclass, setSelectedSubclass] = useState<string>('');

  // État pour la classe secondaire (seulement pour classType === 'secondary')
  const [selectedSecondaryClass, setSelectedSecondaryClass] = useState<DndClass | null>(null);
  const [classChangeWarningShown, setClassChangeWarningShown] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    // Init valeur choisie depuis le joueur en fonction de classType
    if (classType === 'secondary') {
      setSelectedSubclass(player.secondary_subclass || '');
      setSelectedSecondaryClass(player.secondary_class || null);
      setClassChangeWarningShown(false);
    } else {
      setSelectedSubclass(player.subclass || '');
      setSelectedSecondaryClass(null);
    }
  }, [isOpen, player.subclass, player.secondary_subclass, player.secondary_class, classType]);

  useEffect(() => {
    if (!isOpen) return;
    const loadSubclasses = async () => {
      // Charger les sous-classes pour la classe appropriée (primaire ou secondaire)
      // Pour la classe secondaire, utiliser selectedSecondaryClass si défini
      const targetClass = classType === 'secondary'
        ? (selectedSecondaryClass || player.secondary_class)
        : player.class;
      const cls = mapClassForRpc(targetClass);
      if (!cls) {
        setAvailableSubclasses([]);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('get_subclasses_by_class', {
          p_class: cls,
        });
        if (error) throw error;
        setAvailableSubclasses((data as any) || []);
      } catch (error) {
        console.error('Erreur lors du chargement des sous-classes:', error);
        setAvailableSubclasses([]);
      }
    };
    loadSubclasses();
  }, [isOpen, player.class, player.secondary_class, selectedSecondaryClass, classType]);

  if (!isOpen) return null;

  const currentClass = classType === 'secondary' ? player.secondary_class : player.class;
  const currentLevel = classType === 'secondary' ? (player.secondary_level || 1) : player.level;
  const hitDieSize = getHitDieSize(currentClass);
  const averageHpGain = getAverageHpGain(hitDieSize);
  const constitutionModifier = player.abilities?.find(a => (a.name || a.abbr)?.toString().toLowerCase() === 'constitution')?.modifier || 0;
  const theoreticalHpGain = averageHpGain + constitutionModifier;
  const newLevel = currentLevel + 1;

  // Vérification de la sous-classe selon le classType
  const currentSubclass = classType === 'secondary' ? player.secondary_subclass : player.subclass;
  const requiresSubclassSelection = newLevel === 3 && !currentSubclass && availableSubclasses.length > 0;

  const handleLevelUpWithAutoSave = async () => {
    const hpGainValue = parseInt(hpGain) || 0;

    if (hpGainValue < 1) {
      toast.error('Les PV supplémentaires doivent être d\'au moins 1');
      return;
    }

    if (hpGainValue > (hitDieSize + constitutionModifier)) {
      toast.error(`Les PV supplémentaires ne peuvent pas dépasser ${hitDieSize + constitutionModifier}`);
      return;
    }

    // Sous-classe obligatoire à l'arrivée au niveau 3 (si non encore choisie et options dispo)
    if (requiresSubclassSelection && !selectedSubclass) {
      toast.error('Veuillez sélectionner une sous-classe pour le niveau 3.');
      return;
    }

    setIsProcessing(true);

    try {
      // Détecter si on change de classe secondaire
      const isClassChange = classType === 'secondary' && selectedSecondaryClass && selectedSecondaryClass !== player.secondary_class;

      // Calculer le bon hitDieSize en fonction de la classe (actuelle ou nouvelle)
      const effectiveClass = isClassChange ? selectedSecondaryClass : currentClass;
      const effectiveHitDieSize = getHitDieSize(effectiveClass);

      const newMaxHp = player.max_hp + hpGainValue;
      const newCurrentHp = player.current_hp + hpGainValue;

      const dieType = `d${effectiveHitDieSize}`;
      let newHitDiceByType = { ...(player.hit_dice_by_type || {}) };

      // Si changement de classe, gérer les dés de vie
      if (isClassChange && player.secondary_class) {
        // Retirer les dés de vie de l'ancienne classe secondaire
        const oldHitDieSize = getHitDieSize(player.secondary_class);
        const oldDieType = `d${oldHitDieSize}`;
        const oldSecondaryLevel = player.secondary_level || 0;

        if (newHitDiceByType[oldDieType]) {
          const remaining = Math.max(0, newHitDiceByType[oldDieType].total - oldSecondaryLevel);
          const usedRemaining = Math.min(newHitDiceByType[oldDieType].used, remaining);

          if (remaining > 0) {
            newHitDiceByType[oldDieType] = {
              total: remaining,
              used: usedRemaining,
            };
          } else {
            delete newHitDiceByType[oldDieType];
          }
        }

        // Ajouter les dés de vie de la nouvelle classe (niveau actuel + 1 pour le level up)
        newHitDiceByType[dieType] = {
          total: (newHitDiceByType[dieType]?.total || 0) + newLevel,
          used: newHitDiceByType[dieType]?.used || 0,
        };
      } else {
        // Pas de changement de classe, juste ajouter un dé
        newHitDiceByType[dieType] = {
          total: (newHitDiceByType[dieType]?.total || 0) + 1,
          used: newHitDiceByType[dieType]?.used || 0,
        };
      }

      // Ressources de classe — inclut Paladin Conduits divins (N3+)
      const getClassResourcesByLevel = (playerClass: string | null | undefined, level: number, resetAll: boolean = false) => {
        const resources: any = resetAll ? {} : { ...player.class_resources };

        switch (playerClass) {
          case 'Barbare':
            resources.rage = Math.min(6, Math.floor((level + 3) / 4) + 2);
            resources.used_rage = 0;
            break;
          case 'Barde': {
            const raw = resources?.bardic_inspiration;
            if (typeof raw === 'string' && raw.trim() === '') {
              delete resources.bardic_inspiration;
            }
            const upper = Math.max(0, getChaModFromPlayer(player));
            resources.bardic_inspiration = upper;
            resources.used_bardic_inspiration = 0;
            break;
          }
          case 'Clerc':
            resources.channel_divinity = level >= 6 ? 2 : 1;
            resources.used_channel_divinity = 0;
            break;
          case 'Druide':
                       resources.wild_shape = level >= 17 ? 4 : level >= 6 ? 3 : 2;
            break;
          case 'Ensorceleur':
            resources.sorcery_points = level;
            resources.used_sorcery_points = 0;
            resources.innate_sorcery = 2;
            resources.used_innate_sorcery = 0;
            break;
          case 'Guerrier':
            resources.action_surge = level >= 17 ? 2 : 1;
            resources.used_action_surge = 0;
            break;
          case 'Magicien':
            resources.arcane_recovery = true;
            resources.used_arcane_recovery = false;
            break;
          case 'Moine':
            resources.ki_points = level;
            resources.credo_points = level;
            resources.used_ki_points = 0;
            resources.used_credo_points = 0;
            if (level >= 2) {
              resources.supernatural_metabolism = 1;
              resources.used_supernatural_metabolism = 0;
            }
            break;
          case 'Paladin': {
            resources.lay_on_hands = level * 5;
            resources.used_lay_on_hands = 0;
            if (level >= 3) {
              const cap = level >= 11 ? 3 : 2;
              resources.channel_divinity = cap;
              resources.used_channel_divinity = 0;
            } else {
              delete resources.channel_divinity;
              delete resources.used_channel_divinity;
            }
            break;
          }
          case 'Rôdeur':
            resources.favored_foe = Math.max(1, Math.floor((level + 3) / 4));
            resources.used_favored_foe = 0;
            break;
          case 'Roublard':
            resources.sneak_attack = `${Math.ceil(level / 2)}d6`;
            break;
          case 'Occultiste':
            resources.pact_magic = true;
            break;
        }

        return resources;
      };

      const newSpellSlots = classType === 'primary'
        ? getSpellSlotsByLevel(player.class, newLevel, player.spell_slots)
        : player.spell_slots;

      // Pour la classe secondaire: si changement de classe, réinitialiser les slots, sinon mettre à jour
      const newSecondarySpellSlots = classType === 'secondary'
        ? (isClassChange
            ? getSpellSlotsByLevel(selectedSecondaryClass, newLevel, null)
            : getSpellSlotsByLevel(player.secondary_class, newLevel, player.secondary_spell_slots))
        : player.secondary_spell_slots;

      const newClassResources = classType === 'primary'
        ? getClassResourcesByLevel(player.class, newLevel, false)
        : player.class_resources;

      // Pour la classe secondaire: si changement de classe, réinitialiser les ressources
      const newSecondaryClassResources = classType === 'secondary'
        ? (isClassChange
            ? getClassResourcesByLevel(selectedSecondaryClass, newLevel, true)
            : getClassResourcesByLevel(player.secondary_class, newLevel, false))
        : player.secondary_class_resources;

      const nextSubclass =
        newLevel === 3
          ? (selectedSubclass || currentSubclass || null)
          : (currentSubclass || null);

      const updateData: any = {
        max_hp: newMaxHp,
        current_hp: newCurrentHp,
        hit_dice_by_type: newHitDiceByType,
      };

      if (classType === 'primary') {
        updateData.level = newLevel;
        updateData.spell_slots = newSpellSlots;
        updateData.class_resources = newClassResources;
        updateData.subclass = nextSubclass;
      } else {
        updateData.secondary_level = newLevel;
        updateData.secondary_spell_slots = newSecondarySpellSlots;
        updateData.secondary_class_resources = newSecondaryClassResources;
        updateData.secondary_subclass = nextSubclass;

        // Si changement de classe, mettre à jour la classe elle-même
        if (isClassChange) {
          updateData.secondary_class = selectedSecondaryClass;
        }
      }

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;

      const updatedPlayer: Player = {
        ...player,
        max_hp: newMaxHp,
        current_hp: newCurrentHp,
        hit_dice_by_type: newHitDiceByType,
      };

      if (classType === 'primary') {
        updatedPlayer.level = newLevel;
        updatedPlayer.spell_slots = newSpellSlots;
        updatedPlayer.class_resources = newClassResources;
        updatedPlayer.subclass = nextSubclass || undefined;
      } else {
        updatedPlayer.secondary_level = newLevel;
        updatedPlayer.secondary_spell_slots = newSecondarySpellSlots;
        updatedPlayer.secondary_class_resources = newSecondaryClassResources;
        updatedPlayer.secondary_subclass = nextSubclass || undefined;

        // Si changement de classe, mettre à jour la classe elle-même dans l'objet player
        if (isClassChange) {
          updatedPlayer.secondary_class = selectedSecondaryClass;
        }
      }

      onUpdate(updatedPlayer);

      const displayClassName = classType === 'secondary'
        ? (isClassChange ? selectedSecondaryClass : player.secondary_class)
        : player.class;

      const changeMessage = isClassChange
        ? ` (Classe changée: ${player.secondary_class} → ${selectedSecondaryClass})`
        : '';

      toast.success(`Félicitations ! ${displayClassName} niveau ${newLevel} (+${hpGainValue} PV)${changeMessage}`);
      onClose();

      setTimeout(() => {
        if ((window as any).closeSettings) {
          (window as any).closeSettings();
        }
      }, 500);
    } catch (error) {
      console.error('Erreur lors du passage de niveau:', error);
      toast.error('Erreur lors du passage de niveau');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calcul des informations de sorts
  const currentSpellInfo = getSpellKnowledgeInfo(player.class, player.level);
  const newSpellInfo = getSpellKnowledgeInfo(player.class, newLevel);
  const isCaster = newSpellInfo.kind !== 'none';

  // Calcul des nouveaux sorts à apprendre
  const cantripsGain = 
    (newSpellInfo.kind === 'prepared' && typeof newSpellInfo.cantrips === 'number' && 
     currentSpellInfo.kind === 'prepared' && typeof currentSpellInfo.cantrips === 'number')
      ? newSpellInfo.cantrips - currentSpellInfo.cantrips
      : 0;

  const preparedGain = 
    (newSpellInfo.kind === 'prepared' && currentSpellInfo.kind === 'prepared')
      ? newSpellInfo.prepared - currentSpellInfo.prepared
      : 0;

  const modalContent = (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overscroll-contain">
      <div
        className="
          bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl shadow-2xl
          max-w-3xl w-full border border-gray-700/50 overflow-hidden
          flex flex-col max-h-[90vh]
        "
        role="dialog"
        aria-modal="true"
      >
        {/* Header (non scrollable) */}
        <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-gray-700/50 p-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-100">
                  Passage de niveau - {currentClass}
                </h3>
                <p className="text-sm text-gray-400">
                  Niveau {currentLevel} → {newLevel}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content (scrollable) */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Character Info */}
          <div className="text-center">
            <h4 className="text-xl font-bold text-gray-100 mb-2">
              {player.adventurer_name || player.name}
            </h4>
            <p className="text-gray-400">
              {currentClass} niveau {currentLevel}
            </p>
          </div>

          {/* HP Calculation */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-red-500" />
              <h5 className="font-medium text-gray-200">Points de vie supplémentaires</h5>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Dices className="w-4 h-4" />
                <span>
                  Dé de vie : 1d{hitDieSize} (ou {averageHpGain}) + modificateur de Constitution ({constitutionModifier >= 0 ? '+' : ''}{constitutionModifier})
                </span>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">
                  PV théoriques : <span className="text-green-400 font-medium">{theoreticalHpGain}</span>
                </p>
                <p className="text-xs text-gray-500">
                  (Vous pouvez choisir la valeur moyenne ou lancer le dé)
                </p>
              </div>
            </div>
          </div>

          {/* HP Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PV supplémentaires à appliquer
            </label>
            <input
              type="number"
              min="1"
              max={hitDieSize + constitutionModifier}
              value={hpGain}
              onChange={(e) => setHpGain(e.target.value)}
              className="input-dark w-full px-3 py-2 rounded-md text-center text-lg font-bold"
              placeholder={theoreticalHpGain.toString()}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              Minimum : 1 • Maximum : {hitDieSize + constitutionModifier}
            </p>
          </div>

          {/* Current HP Display */}
          <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">PV actuels :</span>
              <span className="text-gray-200">{player.current_hp} / {player.max_hp}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span className="text-gray-400">Après passage de niveau :</span>
              <span className="text-green-400 font-medium">
                {player.current_hp + (parseInt(hpGain) || 0)} / {player.max_hp + (parseInt(hpGain) || 0)}
              </span>
            </div>
          </div>

          {/* Sélection de la classe secondaire (seulement pour classType === 'secondary') */}
          {classType === 'secondary' && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h5 className="font-medium text-gray-200">Classe secondaire</h5>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Classe
                  </label>
                  <select
                    value={selectedSecondaryClass || ''}
                    onChange={(e) => {
                      const newClass = e.target.value as DndClass;

                      // Détecter un changement de classe
                      if (newClass !== player.secondary_class && player.secondary_class && !classChangeWarningShown) {
                        const confirmed = window.confirm(
                          `Attention : Changer de classe secondaire réinitialisera vos ressources de classe et emplacements de sorts pour ${newClass}. Voulez-vous continuer ?`
                        );
                        if (!confirmed) {
                          return;
                        }
                        setClassChangeWarningShown(true);
                      }

                      setSelectedSecondaryClass(newClass);
                      // Réinitialiser la sous-classe sélectionnée si la classe change
                      if (newClass !== player.secondary_class) {
                        setSelectedSubclass('');
                      }
                    }}
                    className="input-dark w-full px-3 py-2 rounded-md"
                  >
                    {DND_CLASSES.map((dndClass) => (
                      <option key={dndClass} value={dndClass}>
                        {dndClass || 'Sélectionnez une classe'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Avertissement de changement de classe */}
                {selectedSecondaryClass && selectedSecondaryClass !== player.secondary_class && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-200">
                      <p className="font-medium mb-1">Changement de classe détecté</p>
                      <p className="text-xs text-orange-300">
                        Les ressources de classe et emplacements de sorts seront réinitialisés pour {selectedSecondaryClass}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sous-classe (niveau 3) - VERSION COMPACTE */}
          {newLevel === 3 && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h5 className="font-medium text-gray-200">
                  Choix de sous-classe {classType === 'secondary' ? '(classe secondaire)' : ''}
                </h5>
              </div>

              <div className="space-y-3">
                {availableSubclasses.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">
                    Aucune sous-classe disponible. Vous pourrez la définir plus tard dans les paramètres du personnage.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-300 mb-3">
                      Cliquez sur <Eye className="inline w-4 h-4" /> pour consulter les aptitudes de chaque sous-classe :
                    </p>

                    {availableSubclasses.map((subclass) => (
                      <SubclassPreview
                        key={subclass}
                        subclassName={subclass}
                        className={classType === 'secondary' ? (selectedSecondaryClass || player.secondary_class || '') : (player.class || '')}
                        level={newLevel}
                        isSelected={selectedSubclass === subclass}
                        onSelect={() => setSelectedSubclass(subclass)}
                      />
                    ))}

                    {((classType === 'primary' && !player.subclass) || (classType === 'secondary' && !player.secondary_subclass)) && (
                      <p className="text-xs text-gray-500 mt-4 text-center">
                        La sous-classe est requise au niveau 3. Consultez les aptitudes ci-dessus pour faire votre choix.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sorts à ajouter - VERSION AMÉLIORÉE */}
          {isCaster && newSpellInfo.kind === 'prepared' && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h5 className="font-medium text-gray-200">Nouveaux sorts à apprendre</h5>
              </div>

              <div className="space-y-3">
                {/* Sorts mineurs */}
                {typeof newSpellInfo.cantrips === 'number' && newSpellInfo.cantrips > 0 && (
                  <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-200 mb-1">
                          Sorts mineurs
                        </p>
                        <p className="text-xs text-gray-400">
                          {currentSpellInfo.kind === 'prepared' && typeof currentSpellInfo.cantrips === 'number'
                            ? `${currentSpellInfo.cantrips} → ${newSpellInfo.cantrips}`
                            : `Total : ${newSpellInfo.cantrips}`
                          }
                        </p>
                      </div>
                      {cantripsGain > 0 && (
                        <div className="flex items-center gap-1 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                          <Plus className="w-4 h-4" />
                          <span className="text-sm font-bold">{cantripsGain}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Sorts préparés/connus */}
                <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-200 mb-1">
                        Sorts préparés
                      </p>
                      <p className="text-xs text-gray-400">
                        {currentSpellInfo.kind === 'prepared'
                          ? `${currentSpellInfo.prepared} → ${newSpellInfo.prepared}`
                          : `Total : ${newSpellInfo.prepared}`
                        }
                      </p>
                    </div>
                    {preparedGain > 0 && (
                      <div className="flex items-center gap-1 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-bold">{preparedGain}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Message d'aide */}
                <p className="text-xs text-gray-500 text-center">
                  {cantripsGain > 0 || preparedGain > 0
                    ? 'Ajoutez vos nouveaux sorts dans l\'onglet Sorts après la montée de niveau.'
                    : 'Aucun nouveau sort à apprendre à ce niveau.'
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons (non scrollable) */}
        <div className="p-4 border-t border-gray-700/50 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={handleLevelUpWithAutoSave}
              disabled={isProcessing || !hpGain || parseInt(hpGain) < 1 || (requiresSubclassSelection && !selectedSubclass)}
              className={`flex-1 px-6 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                isProcessing || !hpGain || parseInt(hpGain) < 1 || (requiresSubclassSelection && !selectedSubclass)
                  ? 'bg-gray-700 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Passage en cours...
                </>
              ) : (
                <>
                  <TrendingUp size={18} />
                  Passer au niveau {newLevel}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded-lg font-medium transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}