import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ListChecks,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Settings,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

import type { ClassResources, Player, CustomClassData } from '../types/dnd';
import {
  AbilitySection,
  PlayerLike,
  canonicalClass,
  sentenceCase,
  getSubclassFromPlayerLike,
  getChaModFromPlayerLike,
} from './ClassesTab/modals/ClassUtilsModal';

function getCustomClassData(player: PlayerLike | null | undefined): CustomClassData | null {
  if (!player) return null;
  if (player.custom_class_data?.isCustom) return player.custom_class_data;
  const stats = (player as any)?.stats;
  if (stats?.creator_meta?.custom_class?.isCustom) return stats.creator_meta.custom_class;
  return null;
}
import { ScreenRipple, createScreenRippleHandler } from './ClassesTab/modals/ClassEffectsModal';
import { AbilityCard } from './ClassesTab/modals/ClassAbilitiesModal';
import {
  ClassResourcesCard,
  mirrorMonkKeys,
  buildDefaultsForClass,
} from './ClassesTab/modals/ClassResourcesModal';
import { loadSectionsSmart } from './ClassesTab/modals/ClassDataModal';
import { loadFeatureChecks, upsertFeatureCheck } from '../services/featureChecks';
import { CustomClassSettingsModal } from './CustomClassSettingsModal';

type Props = {
  player?: (PlayerLike & Partial<Player>) | null;
  playerClass?: string;
  className?: string;
  subclassName?: string | null;
  characterLevel?: number;
  onUpdate?: (player: Player) => void;
  sections?: AbilitySection[] | null;
};

const DEBUG = typeof window !== 'undefined' && (window as any).UT_DEBUG === true;

function ClassesTab({
  player,
  playerClass,
  className,
  subclassName,
  characterLevel,
  onUpdate,
  sections: preloadedSections,
}: Props) {

  const [sections, setSections] = useState<AbilitySection[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkedMap, setCheckedMap] = useState<Map<string, boolean>>(new Map());
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [classResources, setClassResources] = useState<ClassResources | null | undefined>(player?.class_resources);
  const [screenRipple, setScreenRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const triggerScreenRippleFromEvent = createScreenRippleHandler(setScreenRipple);

  const [classHeaderOpen, setClassHeaderOpen] = useState(true);
  const [showCustomClassSettings, setShowCustomClassSettings] = useState(false);

  const customClassData = getCustomClassData(player);
  const isCustomClass = !!customClassData?.isCustom;

  const rawClass = (player?.class ?? playerClass ?? className ?? '').trim();
  const rawSubclass = (getSubclassFromPlayerLike(player) ?? subclassName) ?? null;

  const displayClass = rawClass ? sentenceCase(rawClass) : '';
  const displaySubclass = rawSubclass ? sentenceCase(rawSubclass) : null;

  const finalLevelRaw = player?.level ?? characterLevel ?? 1;
  const finalLevel = Math.max(1, Number(finalLevelRaw) || 1);
  const characterId = player?.id ?? null;

  /* Sync class resources */
  useEffect(() => {
    setClassResources(player?.class_resources);
  }, [player?.class_resources, player?.id]);

  /* Load sections */
  useEffect(() => {
    let mounted = true;

    if (!rawClass) {
      setSections([]);
      setLoading(false);
      return () => { mounted = false; };
    }

    if (preloadedSections) {
      setSections(preloadedSections);
      setLoading(false);
      return () => { mounted = false; };
    }

    if (preloadedSections === null) {
      setLoading(true);
      return () => { mounted = false; };
    }

    (async () => {
      setLoading(true);
      try {
        const res = await loadSectionsSmart({
          className: rawClass,
          subclassName: rawSubclass,
          level: finalLevel,
          player: player as Player | null,
        });
        if (!mounted) return;
        setSections(res);
      } catch (e) {
        if (DEBUG) console.debug('[ClassesTab] loadSectionsSmart error:', e);
        if (!mounted) return;
        setSections([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [preloadedSections, rawClass, rawSubclass, finalLevel, player?.custom_class_data]);

  /* Load feature checks */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!characterId) {
        setCheckedMap(new Map());
        return;
      }
      setLoadingChecks(true);
      try {
        const map = await loadFeatureChecks(characterId);
        if (!mounted) return;
        setCheckedMap(map);
      } catch (e) {
        if (DEBUG) console.debug('[ClassesTab] loadFeatureChecks error:', e);
        if (!mounted) return;
        setCheckedMap(new Map());
      } finally {
        if (mounted) setLoadingChecks(false);
      }
    })();
    return () => { mounted = false; };
  }, [characterId]);

  /* Auto init missing resources */
  const initKeyRef = useRef<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!player?.id || !displayClass) return;

      const cls = canonicalClass(displayClass);
      if (!cls) return;

      const ensureKey = `${player.id}:${cls}:${finalLevel}`;
      if (initKeyRef.current === ensureKey) return;

      const current: Record<string, any> = { ...(classResources || {}) };
      const defaults = buildDefaultsForClass(cls, finalLevel, player);

      let changed = false;
      for (const [k, v] of Object.entries(defaults)) {
        if (current[k] === undefined || current[k] === null) {
          current[k] = v;
          changed = true;
        }
      }
      if (!changed) return;

      initKeyRef.current = ensureKey;
      try {
        const { error } = await supabase.from('players').update({ class_resources: current }).eq('id', player.id);
        if (error) throw error;

        setClassResources(current as ClassResources);

        if (onUpdate && player) {
          onUpdate({ ...(player as any), class_resources: current } as Player);
        }
      } catch (e) {
        initKeyRef.current = null;
        console.error('[ClassesTab] auto-init class_resources error:', e);
      }
    })();
  }, [player?.id, displayClass, finalLevel, classResources, player, onUpdate]);

  /* Bardic inspiration dynamic cap */
  const bardCapRef = useRef<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!player?.id || !displayClass) return;
      if (canonicalClass(displayClass) !== 'Barde') return;

      const cap = Math.max(0, getChaModFromPlayerLike(player));
      const total = (classResources as any)?.bardic_inspiration;
      const used = (classResources as any)?.used_bardic_inspiration || 0;
      const key = `${player.id}:${cap}:${total ?? 'u'}:${used}`;
      if (bardCapRef.current === key) return;

      if (typeof total !== 'number' || total !== cap || used > cap) {
        const next = {
          ...(classResources || {}),
          bardic_inspiration: cap,
          used_bardic_inspiration: Math.min(used, cap),
        };
        try {
          const { error } = await supabase.from('players').update({ class_resources: next }).eq('id', player.id);
          if (error) throw error;
          setClassResources(next as ClassResources);
          bardCapRef.current = key;
          if (onUpdate && player) {
            onUpdate({ ...(player as any), class_resources: next } as Player);
          }
        } catch (e) {
          console.error('[ClassesTab] bard cap update error:', e);
          bardCapRef.current = null;
        }
      } else {
        bardCapRef.current = key;
      }
    })();
  }, [
    player?.id,
    displayClass,
    player?.stats?.charisma,
    player?.stats?.CHA,
    player?.charisma,
    player?.CHA,
    player?.ability_scores?.cha,
    player?.abilities,
    classResources?.bardic_inspiration,
    classResources?.used_bardic_inspiration,
    onUpdate,
    player,
  ]);
 /* Monk credo points dynamic sync */
  const monkCredoRef = useRef<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!player?.id || !displayClass) return;
      if (canonicalClass(displayClass) !== 'Moine') return;

      const expectedTotal = finalLevel;
      const currentTotal = (classResources as any)?.credo_points ?? (classResources as any)?.ki_points;
      const used = (classResources as any)?.used_credo_points ?? (classResources as any)?.used_ki_points ?? 0;
      
      const key = `${player.id}:${finalLevel}:${currentTotal ?? 'u'}:${used}`;
      if (monkCredoRef.current === key) return;

      // Si le total ne correspond pas au niveau, on corrige
      if (typeof currentTotal !== 'number' || currentTotal !== expectedTotal) {
        const next = {
          ...(classResources || {}),
          credo_points: expectedTotal,
          ki_points: expectedTotal,
          used_credo_points: Math.min(used, expectedTotal),
          used_ki_points: Math.min(used, expectedTotal),
        };
        
        try {
          const { error } = await supabase
            .from('players')
            .update({ class_resources: next })
            .eq('id', player.id);
          
          if (error) throw error;
          
          setClassResources(next as ClassResources);
          monkCredoRef.current = key;
          
          if (onUpdate && player) {
            onUpdate({ ...(player as any), class_resources: next } as Player);
          }
        } catch (e) {
          console.error('[ClassesTab] monk credo sync error:', e);
          monkCredoRef.current = null;
        }
      } else {
        monkCredoRef.current = key;
      }
    })();
  }, [
    player?.id,
    displayClass,
    finalLevel,
    classResources,
    onUpdate,
    player,
  ]);
  /* Toggle ability check */
  async function handleToggle(featureKey: string, checked: boolean) {
    setCheckedMap(prev => {
      const next = new Map(prev);
      next.set(featureKey, checked);
      return next;
    });
    try {
      await upsertFeatureCheck({
        characterId,
        className: displayClass,
        subclassName: displaySubclass ?? null,
        featureKey,
        checked,
      });
    } catch (e) {
      if (DEBUG) console.debug('[ClassesTab] upsertFeatureCheck error:', e);
    }
  }

  const visible = useMemo(
    () =>
      sections
        .filter(s => (typeof s.level === 'number' ? s.level <= finalLevel : true))
        .sort((a, b) => (Number(a.level) || 0) - (Number(b.level) || 0)),
    [sections, finalLevel]
  );

  const hasClass = !!displayClass;
  const hasSubclass = !!displaySubclass;

  return (
    <div className="space-y-4">{/* --- spacing tweak (6->4) */}
      {/* Header card identical style to StatsTab */}
      <div className="stats-card">
        <div
          className="stat-header flex items-center justify-between cursor-pointer select-none"
          role="button"
          tabIndex={0}
          aria-expanded={classHeaderOpen}
          onClick={() => setClassHeaderOpen(o => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setClassHeaderOpen(o => !o);
            }
          }}
        >
          <div className="flex items-center gap-2">
         
            <h3 className="text-ml font-semibold text-gray-100">
              {hasClass ? displayClass : '—'}
              {hasClass && hasSubclass && (
                <span className="ml-2 font-normal text-gray-300">- {displaySubclass}</span>
              )}
              {hasClass && !hasSubclass && finalLevel >= 3 && (
                <span className="ml-2 font-normal text-red-400">
                  (Sélectionnez votre sous-classe)
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-4">
            {hasClass && (
              <span className="text-sm text-gray-400">
                Niveau {finalLevel}
              </span>
            )}
            {isCustomClass && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCustomClassSettings(true);
                }}
                className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded-md transition-colors"
                title="Parametres de la classe"
              >
                <Settings size={18} />
              </button>
            )}
            {classHeaderOpen ? (
              <ChevronDown size={20} className="text-gray-400" />
            ) : (
              <ChevronRight size={20} className="text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {classHeaderOpen && (
        <div className="space-y-4 mt-2">{/* --- spacing tweak (6->4 + mt-2) */}
          {!hasClass && (
            <div className="stats-card">
              <div className="p-4 text-center text-gray-400">
                Sélectionne une classe pour afficher les aptitudes.
              </div>
            </div>
          )}

{hasClass && (
  <div className="stats-card">
    <div className="p-1 space-y-1 pb-0">{/* Suppression du padding-bottom */}
      <div className="flex items-center gap-1 mt-1">
        <Sparkles className="w-5 h-5 text-yellow-400" />
        <span className="text-base font-semibold text-gray-200">
          Ressources de classe
        </span> 
      </div>
      <div className="[&_.stat-header]:hidden">
        <ClassResourcesCard
          playerClass={displayClass}
          resources={classResources || undefined}
          onUpdateResource={updateClassResource}
          player={player ?? undefined}
          level={finalLevel}
          onPulseScreen={triggerScreenRippleFromEvent}
        />
      </div> 
    </div>
  </div>
)}

            {hasClass && (
            <div className="stats-card">
              <div className="p-3 space-y-5">{/* --- spacing tweak */}
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-sky-500" />
                  <span className="text-base font-semibold text-gray-200">
                    Compétences de classe et sous-classe
                  </span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10">{/* --- spacing tweak (py-12->10) */}
                    <img
                      src="/icons/wmremove-transformed.png"
                      alt="Chargement..."
                      className="animate-spin h-8 w-8 object-contain" /* smaller spinner */
                      style={{ backgroundColor: 'transparent' }}
                    />
                  </div>
                ) : visible.length === 0 ? (
                  <div className="text-center text-gray-400 py-6">
                    Aucune aptitude trouvée pour "{displayClass}{displaySubclass ? ` - ${displaySubclass}` : ''}".
                    {DEBUG && (
                      <pre className="mt-2 text-xs text-white/60">{/* --- spacing tweak (mt-3->2) */}
                        Activez window.UT_DEBUG = true pour debug.
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">{/* --- spacing tweak (space-y-4->3) */}
                    {visible.map((s, i) => (
                      <AbilityCard
                        key={`${s.origin}-${s.level ?? 'x'}-${i}`}
                        section={s}
                        defaultOpen={false}
                        ctx={{
                          characterId,
                          className: displayClass,
                          subclassName: displaySubclass,
                          checkedMap,
                          onToggle: handleToggle,
                        }}
                        disableContentWhileLoading={loadingChecks}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {screenRipple && (
        <ScreenRipple
          key={screenRipple.key}
          x={screenRipple.x}
          y={screenRipple.y}
          onDone={() => setScreenRipple(null)}
        />
      )}

      {isCustomClass && player && (
        <CustomClassSettingsModal
          open={showCustomClassSettings}
          onClose={() => setShowCustomClassSettings(false)}
          player={player as Player}
          onUpdate={(updatedPlayer) => {
            if (onUpdate) onUpdate(updatedPlayer);
          }}
        />
      )}
    </div>
  );

  async function updateClassResource(
    resource: keyof ClassResources,
    value: ClassResources[keyof ClassResources]
  ) {
    if (!player?.id) return;

    if ((resource as any) === 'pact_slots' && typeof value === 'object' && value !== null) {
      try {
        const { error } = await supabase.from('players').update({ spell_slots: value }).eq('id', player.id);
        if (error) throw error;

        if (onUpdate && player) {
          onUpdate({ ...(player as any), spell_slots: value } as Player);
        }

        const prevUsed = (player.spell_slots?.used_pact_slots || 0);
        const newUsed = (value as any).used_pact_slots || 0;
        const action = newUsed > prevUsed ? 'utilisé' : 'récupéré';
        const diff = Math.abs(newUsed - prevUsed);
        toast.success(`${diff} emplacement${diff > 1 ? 's' : ''} de pacte ${action}`);
      } catch (err) {
        console.error('Erreur lors de la mise à jour des emplacements de pacte:', err);
        toast.error('Erreur lors de la mise à jour');
      }
      return;
    }

    // ✅ Intercepter la mise à jour de l'affinité draconique (pas une class_resource)
    if ((resource as string) === '_refresh_draconic' && typeof value === 'object' && value !== null) {
      const newElement = (value as any).__draconic_element ?? null;
      if (onUpdate && player) {
        onUpdate({ ...(player as any), draconic_element: newElement } as Player);
      }
      return;
    }

    
    if (resource === 'bardic_inspiration') {
      toast.error("Le total d'Inspiration bardique est calculé automatiquement (modificateur de Charisme).");
      return;
    }
    if (resource === 'lay_on_hands') {
      toast.error("Le total d'Imposition des mains est calculé automatiquement (5 × niveau de Paladin).");
      return;
    }

    const next: any = { ...(classResources || {}) };

    if (resource === 'used_bardic_inspiration' && typeof value === 'number') {
      const cap = Math.max(0, getChaModFromPlayerLike(player));
      next.used_bardic_inspiration = Math.min(Math.max(0, value), cap);
    } else if (resource === 'used_lay_on_hands' && typeof value === 'number') {
      const lvl = Number(player?.level || 0);
      const cap = Math.max(0, lvl * 5);
      next.used_lay_on_hands = Math.min(Math.max(0, value), cap);
    } else {
      next[resource] = value;
    }

    mirrorMonkKeys(resource, value, next);

    try {
      const { error } = await supabase.from('players').update({ class_resources: next }).eq('id', player.id);
      if (error) throw error;

      setClassResources(next as ClassResources);

      if (onUpdate && player) {
        onUpdate({ ...(player as any), class_resources: next } as Player);
      }

      if (typeof value === 'boolean') {
        toast.success(`Récupération arcanique ${value ? 'utilisée' : 'disponible'}`);
      } else {
        const resourceNames: Record<string, string> = {
          rage: 'Rage',
          bardic_inspiration: 'Inspiration bardique',
            channel_divinity: 'Conduit divin',
          wild_shape: 'Forme sauvage',
          sorcery_points: 'Points de sorcellerie',
          action_surge: "Second souffle",
          credo_points: 'Points de crédo',
          ki_points: 'Points de crédo',
          lay_on_hands: 'Imposition des mains',
          favored_foe: 'Ennemi juré',
          sneak_attack: 'Attaque sournoise',
          pact_magic: 'Magie de pacte',
          supernatural_metabolism: 'Métabolisme surnaturel',
          innate_sorcery: 'Sorcellerie innée',
        };

        const key = String(resource);
        const displayKey = key.replace('used_', '');
        const resourceName = resourceNames[displayKey] || displayKey;
        const isUsed = key.startsWith('used_');
        const previous = (classResources as any)?.[resource];
        const action =
          isUsed && typeof previous === 'number' && typeof value === 'number'
            ? value > previous
              ? 'utilisé'
              : 'récupéré'
            : 'mis à jour';

        if (isUsed && typeof previous === 'number' && typeof value === 'number') {
          const diff = Math.abs((value as number) - (previous as number));
          toast.success(`${diff} ${resourceName} ${action}`);
        } else {
          toast.success(`${resourceName} ${action}`);
        }
      }
    } catch (err) {
      console.error('Erreur lors de la mise à jour des ressources:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  }
}

export default ClassesTab;
export { ClassesTab };