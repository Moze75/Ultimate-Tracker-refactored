import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MarkdownLite } from '../lib/markdownLite';
import {
  Plus,
  Trash2,
  BookOpen,
  Book,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  analyzeSpellDamage,
  calculateSlotDamage,
  calculateCantripDamage,
  getAvailableCastLevels,
} from '../utils/spellDamageParser';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { SpellbookModal } from './SpellbookModal';
import { getSpellSlotsByLevel } from '../utils/spellSlots2024';
import {
  getArcaneRecoveryInfo,
  canRecoverSlot,
  updateArcaneRecoveryUsage,
} from '../utils/arcaneRecovery';
import { combineSpellSlots } from '../utils/multiclassUtils';

// Hook pour mesurer et animer la hauteur du contenu
const useMeasuredHeight = (ref: React.RefObject<HTMLDivElement>, isExpanded: boolean) => {
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (!ref.current) return;

    const updateHeight = () => {
      if (ref.current) {
        const contentHeight = ref.current.scrollHeight;
        setHeight(contentHeight);
      }
    };

    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref, isExpanded]);

  return height;
};

interface KnownSpell {
  id: string;
  player_id: string;
  spell_id: string;
  spell_name: string;
  spell_level: number;
  spell_school: string;
  spell_description: string;
  spell_casting_time: string;
  spell_range: string;
  spell_duration: string;
  spell_components: {
    V: boolean;
    S: boolean;
    M: string | null;
  };
  spell_higher_levels?: string;
  is_prepared: boolean;
  created_at: string;
}

interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: {
    V: boolean;
    S: boolean;
    M: string | null;
  };
  duration: string;
  description: string;
  higher_levels?: string;
  classes: string[];
}

interface KnownSpellsSectionProps {
  player: Player;
  onUpdate: (player: Player) => void;
}

// Utilitaire pour formater les composantes de sort
const getComponentsText = (components: { V: boolean; S: boolean; M: string | null }) => {
  const parts: string[] = [];
  if (components.V) parts.push('V');
  if (components.S) parts.push('S');
  if (components.M) parts.push(`M (${components.M})`);
  return parts.join(', ');
};

// Helpers D&D (DD des sorts)
const getModifier = (score: number): number => Math.floor((score - 10) / 2);
const getProficiencyBonusForLevel = (level: number): number => {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
};

const getSpellcastingAbilityName = (
  cls?: string
): 'Charisme' | 'Sagesse' | 'Intelligence' | null => {
  if (!cls) return null;
  const c = cls.toLowerCase();
  if (c.includes('barde') || c.includes('bard')) return 'Charisme';
  if (c.includes('clerc') || c.includes('cleric')) return 'Sagesse';
  if (c.includes('druide') || c.includes('druid')) return 'Sagesse';
  if (c.includes('ensorceleur') || c.includes('sorcerer')) return 'Charisme';
  if (c.includes('magicien') || c.includes('wizard')) return 'Intelligence';
  if (c.includes('paladin')) return 'Charisme';
  if (c.includes('rôdeur') || c.includes('rodeur') || c.includes('ranger')) return 'Sagesse';
  if (c.includes('occultiste') || c.includes('warlock')) return 'Charisme';
  return null;
};

// PATCH: robuste aux formats abilities variés (array | map | null)
const getAbilityModFromPlayer = (
  player: Player,
  abilityNameFr: 'Charisme' | 'Sagesse' | 'Intelligence'
): number => {
  const abilities: any = (player as any).abilities;

  // 1) Format tableau [{ name, score, modifier, ... }]
  const fromArray =
    Array.isArray(abilities)
      ? abilities.find?.((a: any) => a?.name === abilityNameFr)
      : undefined;

  // 2) Format map: { "Sagesse": { score: 12 } } ou { "Sagesse": 12 }
  let fromMap: any = undefined;
  if (!fromArray && abilities && typeof abilities === 'object' && !Array.isArray(abilities)) {
    const direct = abilities[abilityNameFr] ?? abilities[abilityNameFr.toLowerCase()];
    if (typeof direct === 'number') {
      fromMap = { score: direct };
    } else if (direct && typeof direct === 'object') {
      fromMap = direct;
    }
  }

  const ability = fromArray ?? fromMap;
  if (!ability) return 0;

  if (typeof ability.modifier === 'number') return ability.modifier;
  if (typeof ability.score === 'number') return getModifier(ability.score);
  return 0;
};

// Animations CSS (injectées dynamiquement)
const magicalAnimationCSS = ` 
  @keyframes magical-explosion {
    0% { transform: translate(-50%, -50%) scale(0); opacity: 1; background: radial-gradient(circle, #8b5cf6 0%, #3b82f6 50%, transparent 70%); border-radius: 50%; }
    50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.8; box-shadow: 0 0 20px #8b5cf6, 0 0 40px #3b82f6; }
    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
  }
`;

const smoothAnimationCSS = `
  /* Animation pour les cartes de sorts */
  .spell-card-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .spell-card-content.expanded {
    grid-template-rows: 1fr;
  }
  
  .spell-card-content > div {
    overflow: hidden;
  }
  
  /* Animation du chevron */
  .chevron-icon {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .chevron-icon.rotated {
    transform: rotate(180deg);
  }
`;

/* ===== Règles d’affichage des niveaux de slots D&D 5e (bornage par classe/niveau) ===== */
type CasterType = 'full' | 'half' | 'warlock' | 'none';
const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const getCasterType = (cls?: string): CasterType => {
  if (!cls) return 'none';
  const c = normalize(cls);
  if (['wizard', 'magicien', 'mage'].some((k) => c.includes(k))) return 'full';
  if (['sorcerer', 'ensorceleur'].some((k) => c.includes(k))) return 'full';
  if (['cleric', 'clerc'].some((k) => c.includes(k))) return 'full';
  if (['druid', 'druide'].some((k) => c.includes(k))) return 'full';
  if (['bard', 'barde'].some((k) => c.includes(k))) return 'full';
  if (['paladin'].some((k) => c.includes(k))) return 'half';
  if (['ranger', 'rodeur', 'rôdeur'].some((k) => c.includes(k))) return 'half';
  if (['artificer', 'artificier'].some((k) => c.includes(k))) return 'half';
  if (['warlock', 'occultiste'].some((k) => c.includes(k))) return 'warlock';
  return 'none';
};
const getWarlockPactSlotLevel = (level: number): number => {
  if (level <= 2) return 1;
  if (level <= 4) return 2;
  if (level <= 6) return 3;
  if (level <= 8) return 4;
  return 5;
};
const getHighestAllowedSlotLevel = (casterType: CasterType, level: number): number => {
  if (casterType === 'warlock') return getWarlockPactSlotLevel(level);
  if (casterType === 'full') return Math.min(9, Math.ceil(level / 2));
  if (casterType === 'half') {
    // ✅ CORRIGÉ : Pour les semi-lanceurs (Paladin, Rôdeur) en 2024
    // Niveau 1-2 : Niveau 1
    // Niveau 3-4 : Niveau 1
    // Niveau 5-8 : Niveau 2
    // Niveau 9-12 : Niveau 3
    // Niveau 13-16 : Niveau 4
    // Niveau 17-20 : Niveau 5
    if (level < 1) return 0;  // ✅ Changé de "level < 2" à "level < 1"
    if (level <= 4) return 1;
    if (level <= 8) return 2;
    if (level <= 12) return 3;
    if (level <= 16) return 4;
    return 5;
  }
  return 0;
};
const getCharacterLevel = (player: Player): number => Number((player as any).level ?? 1) || 1;

/* ====== Composants ====== */

const SpellLevelStats = React.memo(
  ({
    levelName,
    player,
    onUpdate,
    usedSlots,
    maxSlots,
  }: {
    levelName: string;
    player: Player;
    onUpdate: (player: Player) => void;
    usedSlots: number;
    maxSlots: number;
  }) => {
    const level = parseInt(levelName.split(' ')[1]);
    const remainingSlots = Math.max(0, maxSlots - usedSlots);
    const isMagicien = player.class === 'Magicien';
    const arcaneRecoveryInfo = useMemo(() =>
      isMagicien ? getArcaneRecoveryInfo(player) : null,
      [isMagicien, player]
    );

const handleSlotUse = useCallback(
  async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (remainingSlots <= 0) return;

    const button = e.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.top}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    const anim = document.createElement('div');
    anim.style.position = 'absolute';
    anim.style.left = '50%';
    anim.style.top = '50%';
    anim.style.width = '200px';
    anim.style.height = '200px';
    anim.style.animation = 'magical-explosion 0.6s ease-out forwards';
    container.appendChild(anim);
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 600);

    try {
      // ✅ NOUVEAU : Décrémenter en priorité la classe principale, puis la secondaire
      const usedKey = `used${level}` as keyof typeof player.spell_slots;
      const levelKey = `level${level}` as keyof typeof player.spell_slots;
      
      // Emplacements disponibles par classe
      const primaryMax = (player.spell_slots?.[levelKey] || 0) as number;
      const primaryUsed = (player.spell_slots?.[usedKey] || 0) as number;
      const primaryRemaining = Math.max(0, primaryMax - primaryUsed);
      
      const secondaryMax = (player.secondary_spell_slots?.[levelKey] || 0) as number;
      const secondaryUsed = (player.secondary_spell_slots?.[usedKey] || 0) as number;
      const secondaryRemaining = Math.max(0, secondaryMax - secondaryUsed);

      // Décider quelle classe décrémenter
      let newSpellSlots = { ...player.spell_slots };
      let newSecondarySpellSlots = { ...player.secondary_spell_slots };
      
      if (primaryRemaining > 0) {
        // Décrémenter la classe principale
        newSpellSlots = {
          ...player.spell_slots,
          [usedKey]: primaryUsed + 1,
        };
      } else if (secondaryRemaining > 0) {
        // Décrémenter la classe secondaire
        newSecondarySpellSlots = {
          ...player.secondary_spell_slots,
          [usedKey]: secondaryUsed + 1,
        };
      } else {
        toast.error('Aucun emplacement disponible');
        return;
      }

      const { error } = await supabase
        .from('players')
        .update({ 
          spell_slots: newSpellSlots,
          secondary_spell_slots: newSecondarySpellSlots,
        })
        .eq('id', player.id);
      
      if (error) throw error;

      onUpdate({ 
        ...player, 
        spell_slots: newSpellSlots,
        secondary_spell_slots: newSecondarySpellSlots,
      });
      
      toast.success(`✨ Emplacement de niveau ${level} utilisé`);
    } catch (err) {
      console.error('Erreur slots:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  },
  [level, remainingSlots, player, onUpdate]
);

    const handleArcaneRecovery = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        const validation = canRecoverSlot(player, level, usedSlots);
        if (!validation.canRecover) {
          toast.error(validation.reason || 'Impossible de récupérer cet emplacement');
          return;
        }

        try {
          const updates = updateArcaneRecoveryUsage(player, level);

          const { error } = await supabase
            .from('players')
            .update({
              spell_slots: updates.spell_slots,
              class_resources: updates.class_resources,
            })
            .eq('id', player.id);

          if (error) throw error;

          onUpdate({
            ...player,
            spell_slots: updates.spell_slots,
            class_resources: updates.class_resources,
          });

          const newInfo = getArcaneRecoveryInfo({
            ...player,
            class_resources: updates.class_resources,
          });

          toast.success(
            `🔮 Emplacement de niveau ${level} récupéré ! (${newInfo.remaining} niveau${newInfo.remaining > 1 ? 'x' : ''} restant${newInfo.remaining > 1 ? 's' : ''})`
          );
        } catch (err) {
          console.error('Erreur récupération arcanique:', err);
          toast.error('Erreur lors de la récupération');
        }
      },
      [player, level, usedSlots, onUpdate]
    );

    if (maxSlots === 0) return null;

    const recoveryValidation = isMagicien ? canRecoverSlot(player, level, usedSlots) : null;

    return (
      <div className="flex items-center gap-2 ml-auto">
        {isMagicien && arcaneRecoveryInfo && (
          <button
            onClick={handleArcaneRecovery}
            disabled={!recoveryValidation?.canRecover}
            className={`w-9 h-9 rounded border flex items-center justify-center transition-all duration-200 ${
              recoveryValidation?.canRecover
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 hover:bg-blue-500/30 hover:border-blue-500/60'
                : 'bg-gray-700/50 border-gray-600/50 text-gray-500 cursor-not-allowed'
            }`}
            title={
              recoveryValidation?.canRecover
                ? `Récupération Arcanique : récupérer un emplacement (${arcaneRecoveryInfo.remaining} niveaux restants)`
                : recoveryValidation?.reason || 'Récupération Arcanique indisponible'
            }
          >
            <Plus size={16} />
          </button>
        )}
        <div className="flex gap-0.5">
          {Array.from({ length: maxSlots }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm border transition-all duration-300 ${
                i < usedSlots
                  ? 'bg-gray-600 border-gray-500 opacity-50'
                  : 'bg-purple-500 border-purple-400 shadow-sm'
              }`}
            />
          ))}
        </div>
        <span
          className={`text-xs ${
            remainingSlots === 0
              ? 'text-red-400'
              : remainingSlots <= 2
              ? 'text-yellow-400'
              : 'text-gray-400'
          }`}
        >
          {remainingSlots}/{maxSlots}
        </span>
        <button
          onClick={handleSlotUse}
          className={`w-12 h-12 rounded border flex items-center justify-center text-xs font-bold transition-all duration-200 ${
            remainingSlots > 0
              ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 hover:border-red-500/60'
              : 'bg-gray-700/50 border-gray-600/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={remainingSlots <= 0}
          title={`Consommer un emplacement de niveau ${level}`}
        >
          <Zap size={20} />
        </button>
      </div>
    );
  }
);
SpellLevelStats.displayName = 'SpellLevelStats';

const PactSlotStats = React.memo(
  ({
    player,
    onUpdate,
  }: {
    player: Player;
    onUpdate: (player: Player) => void;
  }) => {
    const maxSlots = player.spell_slots?.pact_slots || 0;
    const usedSlots = player.spell_slots?.used_pact_slots || 0;
    const pactLevel = player.spell_slots?.pact_level || 1;
    const remainingSlots = Math.max(0, maxSlots - usedSlots);

 const handlePactSlotUse = useCallback(
  async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (remainingSlots <= 0) return;

    const button = e.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.top}px`;
    container.style.width = `${rect.width}px`;
    container.style.height = `${rect.height}px`;
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9999';
    const anim = document.createElement('div');
    anim.style.position = 'absolute';
    anim.style.left = '50%';
    anim.style.top = '50%';
    anim.style.width = '200px';
    anim.style.height = '200px';
    anim.style.animation = 'magical-explosion 0.6s ease-out forwards';
    container.appendChild(anim);
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 600);

    try {
      // ✅ NOUVEAU : Décrémenter les pact slots de la bonne classe
      const primaryIsWarlock = player.class === 'Occultiste';
      const secondaryIsWarlock = player.secondary_class === 'Occultiste';
      
      const primaryMax = primaryIsWarlock ? (player.spell_slots?.pact_slots || 0) : 0;
      const primaryUsed = primaryIsWarlock ? (player.spell_slots?.used_pact_slots || 0) : 0;
      const primaryRemaining = Math.max(0, primaryMax - primaryUsed);
      
      const secondaryMax = secondaryIsWarlock ? (player.secondary_spell_slots?.pact_slots || 0) : 0;
      const secondaryUsed = secondaryIsWarlock ? (player.secondary_spell_slots?.used_pact_slots || 0) : 0;
      const secondaryRemaining = Math.max(0, secondaryMax - secondaryUsed);

      let newSpellSlots = { ...player.spell_slots };
      let newSecondarySpellSlots = { ...player.secondary_spell_slots };
      
      if (primaryRemaining > 0) {
        newSpellSlots = {
          ...player.spell_slots,
          used_pact_slots: primaryUsed + 1,
        };
      } else if (secondaryRemaining > 0) {
        newSecondarySpellSlots = {
          ...player.secondary_spell_slots,
          used_pact_slots: secondaryUsed + 1,
        };
      } else {
        toast.error('Aucun emplacement de pacte disponible');
        return;
      }

      const { error } = await supabase
        .from('players')
        .update({ 
          spell_slots: newSpellSlots,
          secondary_spell_slots: newSecondarySpellSlots,
        })
        .eq('id', player.id);
      
      if (error) throw error;

      onUpdate({ 
        ...player, 
        spell_slots: newSpellSlots,
        secondary_spell_slots: newSecondarySpellSlots,
      });
      
      toast.success(`✨ Emplacement de pacte (niveau ${pactLevel}) utilisé`);
    } catch (err) {
      console.error('Erreur pact slots:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  },
  [remainingSlots, player, onUpdate, pactLevel]
);

    if (maxSlots === 0) return null;

    return (
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex gap-0.5">
          {Array.from({ length: maxSlots }, (_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm border transition-all duration-300 ${
                i < usedSlots
                  ? 'bg-gray-600 border-gray-500 opacity-50'
                  : 'bg-red-500 border-red-400 shadow-sm'
              }`}
            />
          ))}
        </div>
        <span
          className={`text-xs ${
            remainingSlots === 0
              ? 'text-red-400'
              : remainingSlots <= 1
              ? 'text-yellow-400'
              : 'text-gray-400'
          }`}
        >
          {remainingSlots}/{maxSlots}
        </span>
        <button
          onClick={handlePactSlotUse}
          className={`w-12 h-12 rounded border flex items-center justify-center text-xs font-bold transition-all duration-200 ${
            remainingSlots > 0
              ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30 hover:border-red-500/60'
              : 'bg-gray-700/50 border-gray-600/50 text-gray-500 cursor-not-allowed'
          }`}
          disabled={remainingSlots <= 0}
          title={`Consommer un emplacement de pacte de niveau ${pactLevel}`}
        >
          <Zap size={20} />
        </button>
      </div>
    );
  }
);
PactSlotStats.displayName = 'PactSlotStats';

function SpellCard({
  spell,
  expandedSpell,
  setExpandedSpell,
  onTogglePrepared,
  onRemoveSpell,
  spellAttackBonus,          // ✅ NOUVEAU
  maxPlayerSpellLevel,       // ✅ NOUVEAU
  characterLevel,            // ✅ NOUVEAU
  abilityModifier,           // ✅ NOUVEAU
}: {
  spell: KnownSpell;
  expandedSpell: string | null;
  setExpandedSpell: (id: string | null) => void;
  onTogglePrepared: (id: string, isPrepared: boolean) => void;
  onRemoveSpell: (id: string) => void;
  spellAttackBonus: number | null;    // ✅ NOUVEAU
  maxPlayerSpellLevel: number;        // ✅ NOUVEAU
  characterLevel: number;             // ✅ NOUVEAU
  abilityModifier: number;            // ✅ NOUVEAU
}) {
  const isExpanded = expandedSpell === spell.id;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

 // ✅ NOUVEAU : État pour le niveau de lancement sélectionné
  const [selectedCastLevel, setSelectedCastLevel] = useState<number>(spell.spell_level);
  
  // ✅ NOUVEAU : Analyser les dégâts du sort
  const damageInfo = useMemo(() => {
    const result = analyzeSpellDamage(
      spell.spell_description,
      spell.spell_higher_levels,
      spell.spell_level
    );
    
    // ✅ DEBUG : Afficher l'analyse du sort
    console.log(`[SpellCard] Analyse de "${spell.spell_name}":`, {
      isDamageSpell: result.isDamageSpell,
      baseDamage: result.baseDamage,
      upgradeType: result.upgradeType,
      upgradePattern: result.upgradePattern,
      characterLevelThresholds: result.characterLevelThresholds,
    });
    
    return result;
  }, [spell.spell_description, spell.spell_higher_levels, spell.spell_level, spell.spell_name]);
  
  // ✅ NOUVEAU : Calculer les dégâts totaux selon le niveau sélectionné
  const totalDamage = useMemo(() => {
    if (!damageInfo.isDamageSpell) return null;
    
    // Tours de magie : basé sur niveau du personnage
    if (spell.spell_level === 0) {
      return calculateCantripDamage(damageInfo, characterLevel, abilityModifier);
    }
    
    // Sorts à emplacements : basé sur niveau de lancement
    return calculateSlotDamage(
      damageInfo,
      spell.spell_level,
      selectedCastLevel,
      abilityModifier
    );
  }, [damageInfo, spell.spell_level, selectedCastLevel, characterLevel, abilityModifier]);
  
  // ✅ NOUVEAU : Niveaux de lancement disponibles
  const availableLevels = useMemo(() => {
    const hasUpgrade = damageInfo.upgradeType === 'per_slot_level';
    return getAvailableCastLevels(spell.spell_level, maxPlayerSpellLevel, hasUpgrade);
  }, [spell.spell_level, maxPlayerSpellLevel, damageInfo.upgradeType]);
  
  // ✅ NOUVEAU : Réinitialiser le niveau sélectionné si le sort change
  useEffect(() => {
    setSelectedCastLevel(spell.spell_level);
  }, [spell.spell_level]);
  
  const handleRemoveSpell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };
  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveSpell(spell.id);
    setShowDeleteConfirm(false);
  };
  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div
      className={`bg-gray-800/50 border border-gray-700/50 rounded-lg overflow-hidden transition-all duration-300 relative ${
        isExpanded ? 'ring-2 ring-purple-500/30 shadow-lg shadow-purple-900/20' : 'hover:bg-gray-700/50'
      } ${spell.is_prepared ? 'border-green-500/30 bg-green-900/10' : ''}`}
    >
      <button
        onClick={() => setExpandedSpell(isExpanded ? null : spell.id)}
        className="w-full text-left p-2 transition-all duration-200"
      >
        {/* Ligne 1 : Nom + badges niveau/préparé + chevron */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h4 className={`font-medium ${spell.is_prepared ? 'text-green-100' : 'text-gray-100'} truncate`}>
              {spell.spell_name}
            </h4>
            {spell.is_prepared && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`text-xs px-2 py-1 rounded-full ${
                spell.spell_level === 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
              }`}
            >
              {spell.spell_level === 0 ? 'Tour' : `Niv. ${spell.spell_level}`}
            </div>
            {spell.is_prepared && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                <Check size={10} />
                Préparé
              </span>
            )}
            <div className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : École + Portée */}
        <div className="text-sm text-gray-400 mb-2 flex items-center gap-2">
          <span className="capitalize">{spell.spell_school}</span>
          <span>•</span>
          <span>{spell.spell_range}</span>
        </div>
        
        {/* Ligne 3 : Badges attaque/dégâts + Boutons préparation/poubelle */}
        <div className="flex items-center justify-between gap-3">
          {/* Partie gauche : Badges */}
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {/* Badge bonus d'attaque */}
            {damageInfo.isAttackRoll && spellAttackBonus !== null && (
              <div 
                className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full border border-red-500/30 font-medium"
                title="Bonus d'attaque de sort"
                onClick={(e) => e.stopPropagation()}
              >
                att. {spellAttackBonus >= 0 ? '+' : ''}{spellAttackBonus}
              </div>
            )}
            
            {/* Badge dégâts avec sélecteur de niveau */}
            {damageInfo.isDamageSpell && totalDamage && (
              <>
                {availableLevels.length > 1 && spell.spell_level > 0 ? (
                  <select
                    value={selectedCastLevel}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedCastLevel(Number(e.target.value));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded border border-orange-500/30 font-mono font-bold cursor-pointer hover:bg-orange-500/30 transition-colors"
                    title={`Lancer au niveau ${selectedCastLevel}`}
                  >
                    {availableLevels.map(lvl => {
                      const lvlDamage = calculateSlotDamage(
                        damageInfo,
                        spell.spell_level,
                        lvl,
                        abilityModifier
                      );
                      return (
                        <option key={lvl} value={lvl}>
                          {lvlDamage} (Niv. {lvl})
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div 
                    className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded border border-orange-500/30 font-mono font-bold"
                    title="Dégâts du sort"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {totalDamage}
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Partie droite : Boutons préparation + poubelle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePrepared(spell.id, spell.is_prepared);
              }}
              className={`w-6 h-6 rounded-lg ${
                spell.is_prepared
                  ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50'
              } flex items-center justify-center transition-colors`}
              title={spell.is_prepared ? 'Dépréparer' : 'Préparer'}
            >
              <Check size={16} />
            </button>

            <button
              onClick={handleRemoveSpell}
              className="w-6 h-6 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded-lg flex items-center justify-center transition-colors"
              title="Supprimer"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </button>

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm rounded-lg">
          <div className="bg-gray-900 border border-red-500/50 rounded-lg p-4 shadow-xl min-w-[250px] mx-4">
            <div className="text-sm text-gray-200 mb-4 text-center">
              Supprimer <span className="font-medium text-red-400">"{spell.spell_name}"</span> ?
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={cancelDelete}
                className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenu dépliable avec animation smooth */}
      <div className={`spell-card-content ${isExpanded ? 'expanded' : ''}`}>
        <div className="border-t border-gray-700/50 bg-gray-900/50">
          <div className="p-3 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                <div className="text-xs font-medium text-gray-400 mb-1">Temps d'incantation</div>
                <div className="text-sm text-gray-200 font-medium">{spell.spell_casting_time}</div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                <div className="text-xs font-medium text-gray-400 mb-1">Portée</div>
                <div className="text-sm text-gray-200 font-medium">{spell.spell_range}</div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                <div className="text-xs font-medium text-gray-400 mb-1">Composantes</div>
                <div className="text-sm text-gray-200 font-medium">{getComponentsText(spell.spell_components)}</div>
              </div>
              <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                <div className="text-xs font-medium text-gray-400 mb-1">Durée</div>
                <div className="text-sm text-gray-200 font-medium">{spell.spell_duration}</div>
              </div>
            </div>

            <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/20">
              <h5 className="font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-blue-400" />
                Description
              </h5>
              <div className="text-gray-300 space-y-2">
                <MarkdownLite 
                  text={spell.spell_description || ''} 
                  ctx={{}}
                />
                
                {spell.spell_higher_levels && (
                  <div className="mt-4">
                    <MarkdownLite 
                      text={
                        spell.spell_higher_levels.trim().startsWith('**') 
                          ? spell.spell_higher_levels 
                          : `**Aux niveaux supérieurs :** ${spell.spell_higher_levels}`
                      } 
                      ctx={{}}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant pour gérer l'animation smooth des sections de niveau
// Composant pour gérer l'affichage des sections de niveau (sans animation de hauteur)
function SpellLevelSection({
  isExpanded,
  children,
}: {
  isExpanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <div 
      className="overflow-hidden transition-all duration-500 ease-in-out"
      style={{
        maxHeight: isExpanded ? '10000px' : '0',
        opacity: isExpanded ? 1 : 0,
        marginTop: isExpanded ? '0.5rem' : '0',
      }}
    >
      {children}
    </div>
  );
}

export function KnownSpellsSection({ player, onUpdate }: KnownSpellsSectionProps) {
  const [knownSpells, setKnownSpells] = useState<KnownSpell[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSpellbook, setShowSpellbook] = useState(false);
  const [selectedSpells, setSelectedSpells] = useState<Spell[]>([]);
  const [expandedSpell, setExpandedSpell] = useState<string | null>(null);
const [collapsedLevels, setCollapsedLevels] = useState<Set<string>>(() => {
  const saved = localStorage.getItem(`spell-levels-state-${player.id}`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return new Set(parsed.collapsed || []);
    } catch {
      return new Set();
    }
  }
  return new Set();
});

const [searchTerm, setSearchTerm] = useState('');

const [filterPrepared, setFilterPrepared] = useState<'all' | 'prepared' | 'unprepared'>('all');
const spellSlotsInitialized = useRef(false);

const combinedSpellSlots = useMemo(() => combineSpellSlots(player), [player]);

  // Inject animations CSS
  useEffect(() => {
    const id = 'magical-animations';
    const existingStyle = document.getElementById(id);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    const style = document.createElement('style');
    style.id = id;
    style.textContent = magicalAnimationCSS + smoothAnimationCSS;
    document.head.appendChild(style);
  }, []);

const toggleLevelCollapse = useCallback((levelName: string) => {
  setCollapsedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(levelName)) {
        next.delete(levelName);
      } else {
        next.add(levelName);
      }
      
      localStorage.setItem(
        `spell-levels-state-${player.id}`,
        JSON.stringify({ collapsed: Array.from(next) })
      );
      
      return next;
    });
  }, [player.id]);




useEffect(() => {
  fetchKnownSpells();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [player.id]);

// ✅ AJOUTER CE NOUVEAU useEffect ICI :
useEffect(() => {
  const initializeSecondarySpellSlots = async () => {
    // Si pas de classe secondaire ou pas de niveau, rien à faire
    if (!player.secondary_class || !player.secondary_level || !player.id) return;

    const spellcasters = ['Magicien', 'Ensorceleur', 'Barde', 'Clerc', 'Druide', 'Paladin', 'Rôdeur', 'Occultiste'];
    
    // Si la classe secondaire n'est pas un lanceur de sorts, rien à faire
    if (!spellcasters.includes(player.secondary_class)) return;

    // Vérifier si secondary_spell_slots existe et a des emplacements
    const hasSecondarySpellSlots = player.secondary_spell_slots && Object.keys(player.secondary_spell_slots).some(key => {
      if (key.startsWith('level') && !key.startsWith('used')) {
        return (player.secondary_spell_slots as any)[key] > 0;
      }
      return false;
    });

    // Si pas d'emplacements, les initialiser
    if (!hasSecondarySpellSlots) {
      try {
        const newSecondarySpellSlots = getSpellSlotsByLevel(
          player.secondary_class,
          player.secondary_level,
          player.secondary_spell_slots
        );

        const { error } = await supabase
          .from('players')
          .update({ secondary_spell_slots: newSecondarySpellSlots })
          .eq('id', player.id);

        if (error) throw error;

        onUpdate({ ...player, secondary_spell_slots: newSecondarySpellSlots });
        console.log('[KnownSpellsSection] Emplacements de sorts secondaires initialisés:', newSecondarySpellSlots);
      } catch (err) {
        console.error('[KnownSpellsSection] Erreur initialisation secondary_spell_slots:', err);
      }
    }
  };

  initializeSecondarySpellSlots();
}, [player.id, player.secondary_class, player.secondary_level, player.secondary_spell_slots, onUpdate]);
  
 // Initialiser automatiquement les spell_slots si nécessaire
useEffect(() => {
  const initializeAllSpellSlots = async () => {
    if (!player.id) return;

    const spellcasters = ['Magicien', 'Ensorceleur', 'Barde', 'Clerc', 'Druide', 'Paladin', 'Rôdeur', 'Occultiste'];
    let needsUpdate = false;
    const updates: any = {};

    // 1️⃣ Initialiser spell_slots pour la classe principale
    if (player.class && spellcasters.includes(player.class)) {
      const hasSpellSlots = player.spell_slots && Object.keys(player.spell_slots).some(key => {
        if (key.startsWith('level') && !key.startsWith('used')) {
          return (player.spell_slots as any)[key] > 0;
        }
        return false;
      });

      if (!hasSpellSlots && !spellSlotsInitialized.current) {
        const newSpellSlots = getSpellSlotsByLevel(player.class, player.level || 1, player.spell_slots);
        updates.spell_slots = newSpellSlots;
        needsUpdate = true;
        console.log('[KnownSpellsSection] Initialisation spell_slots:', newSpellSlots);
      }
    }

    // 2️⃣ ✅ NOUVEAU : Initialiser secondary_spell_slots pour la classe secondaire
    if (player.secondary_class && spellcasters.includes(player.secondary_class)) {
      const hasSecondarySpellSlots = player.secondary_spell_slots && Object.keys(player.secondary_spell_slots).some(key => {
        if (key.startsWith('level') && !key.startsWith('used')) {
          return (player.secondary_spell_slots as any)[key] > 0;
        }
        return false;
      });

      if (!hasSecondarySpellSlots) {
        const newSecondarySpellSlots = getSpellSlotsByLevel(
          player.secondary_class,
          player.secondary_level || 1,
          player.secondary_spell_slots
        );
        updates.secondary_spell_slots = newSecondarySpellSlots;
        needsUpdate = true;
        console.log('[KnownSpellsSection] Initialisation secondary_spell_slots:', newSecondarySpellSlots);
      }
    }

    // 3️⃣ Effectuer la mise à jour si nécessaire
    if (needsUpdate) {
      spellSlotsInitialized.current = true;
      try {
        const { error } = await supabase
          .from('players')
          .update(updates)
          .eq('id', player.id);

        if (error) throw error;

        onUpdate({ ...player, ...updates });
        toast.success('Emplacements de sorts initialisés');
      } catch (err) {
        console.error('[KnownSpellsSection] Erreur initialisation:', err);
        spellSlotsInitialized.current = false;
      }
    }
  };

  initializeAllSpellSlots();
}, [player.id, player.class, player.level, player.secondary_class, player.secondary_level, player.spell_slots, player.secondary_spell_slots, onUpdate]);



const fetchKnownSpells = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase 
        .from('player_spells')
        .select(
          `
          id,
          player_id,
          spell_id,
          is_prepared,
          created_at,
          spells ( id, name, level, school, casting_time, range, components, duration, description, higher_levels )
        `
        )
        .eq('player_id', player.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const transformed: KnownSpell[] = (data || []).map((item: any) => ({
        id: item.id,
        player_id: item.player_id,
        spell_id: item.spell_id,
        spell_name: item.spells.name,
        spell_level: item.spells.level,
        spell_school: item.spells.school,
        spell_description: item.spells.description,
        spell_casting_time: item.spells.casting_time,
        spell_range: item.spells.range,
        spell_duration: item.spells.duration,
        spell_components: item.spells.components,
        spell_higher_levels: item.spells.higher_levels,
        is_prepared: item.is_prepared,
        created_at: item.created_at,
      }));
      setKnownSpells(transformed);
    } catch (err) {
      console.error('Erreur sorts connus:', err);
      toast.error('Erreur lors de la récupération des sorts connus');
    } finally {
      setLoading(false);
    }
  };

  const handleSpellsSelected = async (spells: Spell[]) => {
    try {
      const spellIds = spells.map((s) => s.id);
      const { data: existing } = await supabase.from('spells').select('id').in('id', spellIds);
      const existIds = new Set((existing || []).map((s: any) => s.id));
      const toInsert = spells
        .filter((spell) => !existIds.has(spell.id))
        .map((spell) => ({
          id: spell.id,
          name: spell.name,
          level: spell.level,
          school: spell.school,
          casting_time: spell.casting_time,
          range: spell.range,
          components: spell.components,
          duration: spell.duration,
          description: spell.description,
          higher_levels: spell.higher_levels || null,
        }));
      if (toInsert.length > 0) {
        await supabase.from('spells').upsert(toInsert, { onConflict: 'id', ignoreDuplicates: true });
      }
      const links = spells.map((spell) => ({
        player_id: player.id,
        spell_id: spell.id,
        is_prepared: false,
      }));
      const { error: linkErr } = await supabase
        .from('player_spells')
        .upsert(links, { onConflict: 'player_id,spell_id', ignoreDuplicates: true });
      if (linkErr) throw linkErr;

      await fetchKnownSpells();
      toast.success(`✨ ${spells.length} sort${spells.length > 1 ? 's' : ''} ajouté${spells.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error("Erreur d'ajout des sorts:", err);
      toast.error("Erreur lors de l'ajout des sorts");
    }
  };

  const removeKnownSpell = useCallback(async (spellId: string) => {
    try {
      const { error } = await supabase.from('player_spells').delete().eq('id', spellId);
      if (error) throw error;
      setKnownSpells((prev) => prev.filter((s) => s.id !== spellId));
      toast.success('Sort retiré de vos sorts connus');
    } catch (err) {
      console.error('Erreur suppression sort:', err);
      toast.error('Erreur lors de la suppression du sort');
    }
  }, []);

  const togglePrepared = useCallback(async (spellId: string, isPrepared: boolean) => {
    try {
      const { error } = await supabase.from('player_spells').update({ is_prepared: !isPrepared }).eq('id', spellId);
      if (error) throw error;
      setKnownSpells((prev) => prev.map((s) => (s.id === spellId ? { ...s, is_prepared: !isPrepared } : s)));
      toast.success(`✨ Sort ${isPrepared ? 'dépréparé' : 'préparé'}`);
    } catch (err) {
      console.error('Erreur MAJ préparation:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  }, []);

  // Filtre / groupe
  const { filteredSpells, preparedCount } = useMemo(() => {
    let filtered = knownSpells;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) => s.spell_name.toLowerCase().includes(q) || s.spell_school.toLowerCase().includes(q)
      );
    }
    if (filterPrepared !== 'all') {
      filtered = filtered.filter((s) =>
        filterPrepared === 'prepared' ? s.is_prepared : !s.is_prepared
      );
    }
    return {
      filteredSpells: filtered,
      preparedCount: knownSpells.filter((s) => s.is_prepared).length,
    };
  }, [knownSpells, searchTerm, filterPrepared]);

  const groupedSpells = useMemo(() => {
    return filteredSpells.reduce((groups, spell) => {
      const level = spell.spell_level;
      const key = level === 0 ? 'Tours de magie' : `Niveau ${level}`;
      if (!groups[key]) groups[key] = [];
      (groups[key] as KnownSpell[]).push(spell);
      return groups;
    }, {} as Record<string, KnownSpell[]>);
  }, [filteredSpells]);

// DD des sorts + Bonus d'attaque des sorts
// ✅ MODIFIÉ : Prendre en compte la classe secondaire
const spellcastingAbilityName = useMemo(() => {
  const primaryAbility = getSpellcastingAbilityName(player.class as any);
  const secondaryAbility = player.secondary_class 
    ? getSpellcastingAbilityName(player.secondary_class as any) 
    : null;
  
  // Retourner la première capacité de lanceur de sorts trouvée
  return primaryAbility || secondaryAbility;
}, [player.class, player.secondary_class]);

const abilityMod = useMemo(
  () => (spellcastingAbilityName ? getAbilityModFromPlayer(player, spellcastingAbilityName) : 0),
  [player, spellcastingAbilityName]
);

const proficiencyBonus = useMemo(
  () =>
    player.stats?.proficiency_bonus && player.stats.proficiency_bonus > 0
      ? player.stats.proficiency_bonus
      : getProficiencyBonusForLevel(player.level || 1),
  [player.stats?.proficiency_bonus, player.level]
);

const spellSaveDC = useMemo(
  () => (spellcastingAbilityName ? 8 + proficiencyBonus + abilityMod : null),
  [spellcastingAbilityName, proficiencyBonus, abilityMod]
);

const spellAttackBonus = useMemo(
  () => (spellcastingAbilityName ? proficiencyBonus + abilityMod : null),
  [spellcastingAbilityName, proficiencyBonus, abilityMod]
);

  // ✅ MODIFIÉ : Vérifier AUSSI la classe secondaire pour le casterType
  const casterType = useMemo(() => {
    const primaryCaster = getCasterType(player.class);
    const secondaryCaster = player.secondary_class ? getCasterType(player.secondary_class) : 'none';
    
    // Si l'une des deux classes est un lanceur, retourner ce type
    if (primaryCaster !== 'none') return primaryCaster;
    if (secondaryCaster !== 'none') return secondaryCaster;
    return 'none';
  }, [player.class, player.secondary_class]);

  // ✅ MODIFIÉ : Utiliser le niveau de la classe qui est effectivement un lanceur
const characterLevel = useMemo(() => {
  const primaryCaster = getCasterType(player.class);
  const secondaryCaster = player.secondary_class ? getCasterType(player.secondary_class) : 'none';
  
  let level = 1;
  if (primaryCaster !== 'none') {
    level = getCharacterLevel(player);
  } else if (secondaryCaster !== 'none') {
    level = player.secondary_level || 1;
  }
  
  // ✅ DEBUG : Afficher le niveau du personnage
  console.log('[KnownSpellsSection] Niveau du personnage:', level, '| Classe:', player.class, '| player.level:', player.level);
  
  return level;
}, [player.class, player.secondary_class, player.level, player.secondary_level]);

  const allowedLevelsSet = useMemo(() => {
    const set = new Set<number>();
    if (casterType === 'none') return set;
    if (casterType === 'warlock') {
      const pact = getWarlockPactSlotLevel(characterLevel);
      if (pact > 0) set.add(pact);
      return set;
    }
    const highest = getHighestAllowedSlotLevel(casterType, characterLevel);
    for (let l = 1; l <= highest; l++) set.add(l);
    return set;
  }, [casterType, characterLevel]);

  // Niveaux à rendre: cantrips si présents, + niveaux autorisés ayant slots>0 OU ayant des sorts présents
const levelsToRender = useMemo(() => {
  console.log('🔍 DEBUG levelsToRender:', {
    combinedSpellSlots,
    groupedSpells,
    allowedLevelsSet: Array.from(allowedLevelsSet),
    casterType
  });
  
  const levels: string[] = [];
    if (groupedSpells['Tours de magie']?.length) levels.push('Tours de magie');

    if (casterType === 'warlock') {
      const hasPactSlots = (combinedSpellSlots?.pact_slots || 0) > 0;
      const pactLevel = combinedSpellSlots?.pact_level || 1;
      const hasSpellsAtPactLevel = Object.keys(groupedSpells).some(key => {
        if (key === 'Tours de magie') return false;
        const lvl = parseInt(key.split(' ')[1]);
        return lvl <= pactLevel && groupedSpells[key]?.length > 0;
      });

      if (hasPactSlots || hasSpellsAtPactLevel) {
        levels.push('Emplacements de Pacte');
      }
    } else {
      for (let lvl = 1; lvl <= 9; lvl++) {
        if (!allowedLevelsSet.has(lvl)) continue;
        const key = `level${lvl}`;
        const hasSlots = (combinedSpellSlots?.[key] || 0) > 0;
        const hasSpells = !!groupedSpells[`Niveau ${lvl}`];
        if (hasSlots || hasSpells) levels.push(`Niveau ${lvl}`);
      }
    }
    return levels;
  }, [combinedSpellSlots, groupedSpells, allowedLevelsSet, casterType]);


  
  // Dépliage global: bouton livre à droite
  const allExpanded = useMemo(() => {
    if (levelsToRender.length === 0) return false;
    return levelsToRender.every((name) => !collapsedLevels.has(name));
  }, [levelsToRender, collapsedLevels]);

  const toggleAllLevels = useCallback(() => {
    setCollapsedLevels((prev) => {
      if (levelsToRender.length === 0) return prev;
      // Si tout est déplié actuellement -> replier tout. Sinon -> déplier tout.
      if (levelsToRender.every((name) => !prev.has(name))) {
        return new Set(levelsToRender);
      }
      return new Set();
    });
  }, [levelsToRender]);

  const arcaneRecoveryInfo = useMemo(() =>
    player.class === 'Magicien' ? getArcaneRecoveryInfo(player) : null,
    [player]
  );

  return (
    <div className="stats-card">
      <div className="stat-header flex items-center justify-between gap-3">
        {/* Partie gauche: titre + indicateurs (forcés sur lignes séparées) */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-100 truncate">
            Sorts connus ({knownSpells.length})
          </h3>
          <div className="mt-1 space-y-1">
            {spellSaveDC !== null && (
              <div className="text-sm text-purple-300">DD des sorts: {spellSaveDC}</div>
            )}
            {spellAttackBonus !== null && (
              <div className="text-sm text-purple-300">
                Bonus d&apos;attaque : {spellAttackBonus >= 0 ? '+' : ''}
                {spellAttackBonus}
              </div>
            )}
            {preparedCount > 0 && (
              <div className="text-sm text-green-400">
                {preparedCount} préparé{preparedCount > 1 ? 's' : ''}
              </div>
            )}
            {arcaneRecoveryInfo && arcaneRecoveryInfo.canRecover && (
              <div className="text-sm text-blue-400 flex items-center gap-1">
                
                Restauration magique : {arcaneRecoveryInfo.remaining} niveau{arcaneRecoveryInfo.remaining > 1 ? 'x' : ''} disponible{arcaneRecoveryInfo.remaining > 1 ? 's' : ''}
              </div>
            )}
            {arcaneRecoveryInfo && !arcaneRecoveryInfo.canRecover && player.class_resources?.used_arcane_recovery && (
              <div className="text-sm text-gray-500">
                Restauration magique utilisée (repos court)
              </div>
            )}
          </div>
        </div>

        {/* Partie droite: bouton Livre (toggle all) + bouton Ajouter (plus d'espace) */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={toggleAllLevels}
            title={allExpanded ? 'Replier tous les niveaux' : 'Déplier tous les niveaux'}
            aria-label={allExpanded ? 'Replier tous les niveaux' : 'Déplier tous les niveaux'}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-blue-400 hover:text-blue-300 border border-gray-700/50 transition-colors"
          >
            {allExpanded ? <BookOpen className="w-5 h-5" /> : <Book className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setShowSpellbook(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg shadow-blue-900/20 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Ajouter
          </button>
        </div>
      </div>

      <div className="p-3">
        {/* Recherche / filtres */}
        {knownSpells.length > 0 && (
          <div className="mb-3 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher un sort..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-3 py-1.5 text-gray-100 placeholder-gray-400 focus:outline-none focus:border-blue-500/50"
                />
              </div>
              <select
                value={filterPrepared}
                onChange={(e) =>
                  setFilterPrepared(e.target.value as 'all' | 'prepared' | 'unprepared')
                }
                className="bg-gray-800/50 border border-gray-700/50 rounded-lg px-2 py-1.5 text-gray-100 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">Tous les sorts</option>
                <option value="prepared">Préparés</option>
                <option value="unprepared">Non préparés</option>
              </select>
            </div>
          </div>
        )}

 {loading ? (
  <div className="flex items-center justify-center py-6">
    <img 
      src="/icons/wmremove-transformed.png" 
      alt="Chargement..." 
      className="animate-spin h-5 w-5 object-contain"
      style={{ backgroundColor: 'transparent' }}
    />
  </div>
        ) : knownSpells.length === 0 && levelsToRender.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 mb-2">Aucun sort connu</p>
            <p className="text-gray-500 text-sm">Cliquez sur "Ajouter" pour choisir vos sorts</p>
          </div>
        ) : filteredSpells.length === 0 && levelsToRender.length === 0 ? (
          <div className="text-center py-6">
            <Search className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 mb-2">Aucun sort trouvé</p>
            <p className="text-gray-500 text-sm">Essayez de modifier vos critères de recherche</p>
          </div>
        ) : (
          <div className="space-y-3">
            {levelsToRender.map((levelName) => {
              if (levelName === 'Emplacements de Pacte') {
                const pactLevel = combinedSpellSlots?.pact_level || 1;
                const pactSpells = Object.keys(groupedSpells)
                  .filter(key => {
                    if (key === 'Tours de magie') return false;
                    const lvl = parseInt(key.split(' ')[1]);
                    return lvl <= pactLevel;
                  })
                  .flatMap(key => groupedSpells[key] || []);

return (
  <div
    key={levelName}
    className="space-y-2"
    data-spell-level="pact"
    id="spell-level-pact"
  >
<button
  onClick={() => toggleLevelCollapse(levelName)}
  className="w-full flex items-center justify-between text-left hover:bg-gray-800/30 rounded-lg p-2 transition-all duration-200 group"
>
      <div className="flex items-center gap-3 flex-1 pr-2">
        <h4 className="text-sm font-semibold text-white group-hover:text-white">
          {levelName} - Niveau {pactLevel} ({pactSpells.length})
        </h4>
        <PactSlotStats
          player={player}
          onUpdate={onUpdate}
        />
      </div>
      <div className="flex items-center pl-1">
        {collapsedLevels.has(levelName) ? (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
        )}
      </div>
    </button>

<SpellLevelSection isExpanded={!collapsedLevels.has(levelName)}>
      <div className="space-y-2 mx-0 py-2">
        {pactSpells.map((spell) => ( 
          <SpellCard
            key={spell.id}
            spell={spell}
            expandedSpell={expandedSpell}
            setExpandedSpell={setExpandedSpell}
            onTogglePrepared={togglePrepared}
            onRemoveSpell={removeKnownSpell}
            spellAttackBonus={spellAttackBonus}
            maxPlayerSpellLevel={Math.max(...Array.from(allowedLevelsSet), 1)}
            characterLevel={characterLevel}
            abilityModifier={abilityMod}
          />
        ))}
      </div>
    </SpellLevelSection>
  </div>
);
              }

              const level = levelName === 'Tours de magie' ? 0 : parseInt(levelName.split(' ')[1]);
              const levelKey = `level${level}`;
              const usedKey = `used${level}`;
              const spells = groupedSpells[levelName] || [];
              const maxSlots = level === 0 ? 0 : (combinedSpellSlots?.[levelKey] || 0);
              const usedSlots = level === 0 ? 0 : (combinedSpellSlots?.[usedKey] || 0);

return (
  <div
    key={levelName}
    className="space-y-2"
    data-spell-level={level}
    id={`spell-level-${level}`}
  >
<button
  onClick={() => toggleLevelCollapse(levelName)}
  className="w-full flex items-center justify-between text-left hover:bg-gray-800/30 rounded-lg p-2 transition-all duration-200 group min-h-[60px]"
>
  <div className="flex items-center gap-3 flex-1 pr-2">
    <h4 className="text-sm font-semibold text-white group-hover:text-white">
      {levelName} ({spells.length})
    </h4>
    {levelName !== 'Tours de magie' && (
          <SpellLevelStats
            levelName={levelName}
            player={player}
            onUpdate={onUpdate}
            usedSlots={usedSlots}
            maxSlots={maxSlots}
          />
        )}
      </div>
      <div className="flex items-center pl-1">
        {collapsedLevels.has(levelName) ? (
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-300" />
        )}
      </div>
    </button>

<SpellLevelSection isExpanded={!collapsedLevels.has(levelName)}>
      <div className="space-y-2 mx-0 py-2">
        {spells.map((spell) => (
          <SpellCard
            key={spell.id}
            spell={spell}
            expandedSpell={expandedSpell}
            setExpandedSpell={setExpandedSpell}
            onTogglePrepared={togglePrepared}
            onRemoveSpell={removeKnownSpell}
            spellAttackBonus={spellAttackBonus}
            maxPlayerSpellLevel={Math.max(...Array.from(allowedLevelsSet), 1)}
            characterLevel={characterLevel}
            abilityModifier={abilityMod}
          />
        ))}
      </div>
    </SpellLevelSection>
  </div>
);
            })}
          </div>
        )}
      </div>

      {showSpellbook && (
        <SpellbookModal
          isOpen={showSpellbook}
          onClose={() => {
            setShowSpellbook(false);
            setSelectedSpells([]);
          }}
          playerClasses={player.secondary_class ? [player.class, player.secondary_class] : [player.class]}
          selectionMode={true}
          onSpellSelect={(spell) => {
            setSelectedSpells((prev) => {
              const exists = prev.find((s) => s.id === spell.id);
              return exists ? prev.filter((s) => s.id !== spell.id) : [...prev, spell];
            });
          }}
          selectedSpells={selectedSpells}
          onConfirm={handleSpellsSelected}
        />
      )}
    </div>
  );
} 