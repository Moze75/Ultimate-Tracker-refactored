import React, { useState } from 'react';
import {
  Sparkles,
  Flame,
  Music,
  Cross,
  Leaf,
  Wand2,
  Swords,
  HandHeart,
  Target,
  Skull,
  BookOpen,
  Save,
  X,
  Plus,
  Minus,
  Sun,
  Moon,
} from 'lucide-react';
import type { ClassResources, Player, CustomClassResource, CustomClassData } from '../../../types/dnd';
import { getIconComponent } from '../../CustomClassSettingsModal';
import { canonicalClass, getChaModFromPlayerLike } from './ClassUtilsModal';
import { useDiceSettings } from '../../../hooks/useDiceSettings';

// ✅ Import du contexte pour lancer les dés
import { useContext } from 'react';
import { DiceRollContext } from '../../ResponsiveGameLayout';

// Utiliser le type Player du fichier types/dnd.ts au lieu de créer PlayerLike
type PlayerLike = Player;

function getCustomClassData(player: Player | null | undefined): CustomClassData | null {
  if (!player) return null;
  if (player.custom_class_data?.isCustom) return player.custom_class_data;
  const stats = (player as any)?.stats;
  if (stats?.creator_meta?.custom_class?.isCustom) return stats.creator_meta.custom_class;
  return null;
}

/* ===========================================================
   Ressources de classe
   =========================================================== */

export function ResourceEditModal({
  label,
  total,
  onSave,
  onCancel,
}: {
  label: string;
  total: number;
  onSave: (newTotal: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<string>(total.toString());
  const handleSave = () => {
    const newValue = parseInt(value) || 0;
    if (newValue >= 0) onSave(newValue);
  };
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md"
        />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSave} className="btn-primary flex-1 px-4 py-2 rounded-lg flex items-center justify-center gap-2">
          <Save size={16} />
          Sauvegarder
        </button>
        <button onClick={onCancel} className="btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2">
          <X size={16} />
          Annuler
        </button>
      </div>
    </div>
  );
}

export function ResourceBlock({
  icon,
  label,
  total,
  used,
  onUse,
  onRestore,
  onUpdateTotal,
  onUpdateUsed,
  useNumericInput = false,
  color = 'purple',
  hideEdit = false,
  onGlobalPulse,
  shortRest,
  longRest,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  used: number;
  onUse: () => void;
  onRestore?: () => void;
  onUpdateTotal: (newTotal: number) => void;
  onUpdateUsed?: (value: number) => void;
  useNumericInput?: boolean;
  color?: 'red' | 'purple' | 'yellow' | 'green' | 'blue';
  hideEdit?: boolean;
  onGlobalPulse?: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  shortRest?: boolean;
  longRest?: boolean;
}) {
  const remaining = Math.max(0, total - used);
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState<string>('');

  // Etat pour l'effet pulse local
   const { settings } = useDiceSettings();

  // Etat pour l'effet pulse local
  const [pulse, setPulse] = useState(false);
  const triggerLocalPulse = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 260);
  };

    // 🔊 Son lors de la consommation d'une ressource de classe (modale ClassesTab)
  const playClassResourceSound = () => {
    if (!settings.soundsEnabled) return;
    try {
      const audio = new Audio('/Sounds/soundeffects/spell_slot_court.mp3');
      audio.volume = (settings.fxVolume ?? 50) / 100;
      void audio.play();
    } catch (e) {
      console.warn('[ClassResourcesModal.ResourceBlock] Impossible de jouer le son de ressource de classe:', e);
    }
  };

  const ringColorClasses: Record<NonNullable<typeof color>, string> = {
    red: 'ring-red-400/60',
    purple: 'ring-purple-400/60',
    yellow: 'ring-yellow-400/60',
    green: 'ring-green-400/60',
    blue: 'ring-blue-400/60',
  };

  const colorClasses = {
    red: 'text-red-500 hover:bg-red-900/30',
    purple: 'text-purple-500 hover:bg-purple-900/30',
    yellow: 'text-yellow-500 hover:bg-yellow-900/30',
    green: 'text-green-500 hover:bg-green-900/30',
    blue: 'text-blue-500 hover:bg-blue-900/30',
  };

  return (
    <div
      className={[
        'resource-block bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-gray-700/30 rounded-lg p-3',
        'transition-shadow duration-200',
        pulse ? `ring-2 ${ringColorClasses[color]}` : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`${colorClasses[color]}`}>{icon}</div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">{label}</span>
            {(shortRest || longRest) && (
              <div className="flex items-center gap-1">
                {shortRest && (
                  <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400" title="Se regenere au repos court">
                    <Sun size={10} />
                  </span>
                )}
                {longRest && (
                  <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400" title="Se regenere au repos long">
                    <Moon size={10} />
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div
          className={[
            'text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded-md min-w-[64px] text-center',
            'transition-transform duration-200',
            pulse ? `scale-105 ring-1 ${ringColorClasses[color]} shadow-md` : '',
          ].join(' ')}
        >
          {remaining}/{total}
        </div>
      </div>

      {useNumericInput ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input-dark flex-1 px-3 py-1 rounded-md text-center"
            placeholder="0"
          />
          <button
            onClick={(e) => {
              const value = parseInt(amount) || 0;
              if (value > 0) {
                playClassResourceSound();
                onUpdateUsed?.(used + value);
                setAmount('');
                triggerLocalPulse();
                onGlobalPulse?.(e);
              }
            }}
            className="p-1 text-red-500 hover:bg-red-900/30 rounded-md transition-colors"
            title="Dépenser"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => {
              const value = parseInt(amount) || 0;
              if (value > 0) {
                onUpdateUsed?.(Math.max(0, used - value));
                setAmount('');
              }
            }}
            className="p-1 text-green-500 hover:bg-green-900/30 rounded-md transition-colors"
            title="Récupérer"
          >
            <Plus size={18} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              const remainingNow = Math.max(0, total - used);
              if (remainingNow <= 0) return;
              playClassResourceSound();
              onUse();
              triggerLocalPulse();
              onGlobalPulse?.(e);
            }}
            disabled={Math.max(0, total - used) <= 0}
            className={`flex-1 h-8 flex items-center justify-center rounded-md transition-colors ${
              Math.max(0, total - used) > 0 ? colorClasses[color] : 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
            }`}
          >
            <Minus size={16} className="mx-auto" />
          </button>
          <button
            onClick={() => {
              if (used <= 0) return;
              onRestore?.(); // sécurisé
            }}
            disabled={used <= 0}
            className={`flex-1 h-8 flex items-center justify-center rounded-md transition-colors ${
              used > 0 ? colorClasses[color] : 'text-gray-600 bg-gray-800/50 cursor-not-allowed'
            }`}
          >
            <Plus size={16} className="mx-auto" />
          </button>
        </div>
      )}
    </div>
  );
}

export function mirrorMonkKeys(resource: keyof ClassResources, value: any, into: Record<string, any>) {
  const r = String(resource);
  if (r === 'credo_points') {
    into.ki_points = value;
  } else if (r === 'used_credo_points') {
    into.used_ki_points = value;
  } else if (r === 'ki_points') {
    into.credo_points = value;
  } else if (r === 'used_ki_points') {
    into.used_credo_points = value;
  }
}

function getModifierFromPlayer(player: any, abilityName: string): number {
  const abilities = player?.abilities;
  if (!abilities) return 0;

  const abilityMap: Record<string, string[]> = {
    'Force': ['Force', 'force', 'strength', 'STR', 'str'],
    'Dexterite': ['Dextérité', 'Dexterite', 'dexterite', 'dexterity', 'DEX', 'dex'],
    'Constitution': ['Constitution', 'constitution', 'CON', 'con'],
    'Intelligence': ['Intelligence', 'intelligence', 'INT', 'int'],
    'Sagesse': ['Sagesse', 'sagesse', 'wisdom', 'WIS', 'wis'],
    'Charisme': ['Charisme', 'charisme', 'charisma', 'CHA', 'cha'],
  };

  const keys = abilityMap[abilityName] || [abilityName];

  if (Array.isArray(abilities)) {
    const found = abilities.find((a: any) => keys.some(k => a?.name === k));
    if (found) {
      if (typeof found.modifier === 'number') return found.modifier;
      if (typeof found.score === 'number') return Math.floor((found.score - 10) / 2);
    }
  } else if (typeof abilities === 'object') {
    for (const k of keys) {
      const val = abilities[k];
      if (typeof val === 'number') return Math.floor((val - 10) / 2);
      if (val && typeof val === 'object') {
        if (typeof val.modifier === 'number') return val.modifier;
        if (typeof val.score === 'number') return Math.floor((val.score - 10) / 2);
      }
    }
  }

  return 0;
}

function getCustomResourceMax(resource: CustomClassResource, level: number, player: any): number {
  if (typeof resource.maxValue === 'number') {
    return resource.maxValue;
  }
  if (resource.maxValue === 'level') {
    return level;
  }
  if (resource.maxValue === 'modifier' && resource.modifierAbility) {
    return Math.max(1, getModifierFromPlayer(player, resource.modifierAbility));
  }
  return 1;
}

export function ClassResourcesCard({
  playerClass,
  resources,
  onUpdateResource,
  player,
  level,
  onPulseScreen,
}: {
  playerClass: string;
  resources?: ClassResources;
  onUpdateResource: (resource: keyof ClassResources, value: any) => void;
  player?: PlayerLike;
  level?: number;
  onPulseScreen?: (ev: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (!resources || !playerClass) return null;

    // ✅ Récupération de la fonction de lancer de dés
  const { rollDice } = useContext(DiceRollContext);

  const cls = canonicalClass(playerClass);
  const items: React.ReactNode[] = [];

  switch (cls) {
    case 'Barbare':
      if (typeof resources.rage === 'number') {
        items.push(
          <ResourceBlock
            key="rage"
            icon={<Flame size={20} />}
            label="Rage"
            total={resources.rage}
            used={resources.used_rage || 0}
            onUse={() => onUpdateResource('used_rage', (resources.used_rage || 0) + 1)}
            onUpdateTotal={(n) => onUpdateResource('rage', n)}
            onRestore={() => onUpdateResource('used_rage', Math.max(0, (resources.used_rage || 0) - 1))}
            color="red"
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;

    case 'Barde': {
      const cap = Math.max(0, getChaModFromPlayerLike(player));
      const used = Math.min(resources.used_bardic_inspiration || 0, cap);

      items.push(
        <ResourceBlock
          key="bardic_inspiration"
          icon={<Music size={20} />}
          label="Inspiration bardique"
          total={cap}
          used={used}
          onUse={() => onUpdateResource('used_bardic_inspiration', Math.min(used + 1, cap))}
          onUpdateTotal={() => { /* no-op */ }}
          onRestore={() => onUpdateResource('used_bardic_inspiration', Math.max(0, used - 1))}
          color="purple"
          hideEdit
          onGlobalPulse={onPulseScreen}
        />
      );
      break;
    }

    case 'Clerc':
      if (typeof resources.channel_divinity === 'number') {
        items.push(
          <ResourceBlock
            key="channel_divinity"
            icon={<Cross size={20} />}
            label="Conduit divin"
            total={resources.channel_divinity}
            used={resources.used_channel_divinity || 0}
            onUse={() => onUpdateResource('used_channel_divinity', (resources.used_channel_divinity || 0) + 1)}
            onUpdateTotal={(n) => onUpdateResource('channel_divinity', n)}
            onRestore={() => onUpdateResource('used_channel_divinity', Math.max(0, (resources.used_channel_divinity || 0) - 1))}
            color="yellow"
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;

    case 'Druide':
      if (typeof resources.wild_shape === 'number') {
        items.push(
          <ResourceBlock
            key="wild_shape"
            icon={<Leaf size={20} />}
            label="Forme sauvage"
            total={resources.wild_shape}
            used={resources.used_wild_shape || 0}
            onUse={() => onUpdateResource('used_wild_shape', (resources.used_wild_shape || 0) + 1)}
            onUpdateTotal={(n) => onUpdateResource('wild_shape', n)}
            onRestore={() => onUpdateResource('used_wild_shape', Math.max(0, (resources.used_wild_shape || 0) - 1))}
            color="green"
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;

      case 'Ensorceleur':
        // Points de sorcellerie (existant)
        if (typeof resources.sorcery_points === 'number') {
          items.push(
            <ResourceBlock
              key="sorcery_points"
              icon={<Wand2 size={20} />}
              label="Points de sorcellerie"
              total={resources.sorcery_points}
              used={resources.used_sorcery_points || 0}
              onUse={() =>
                onUpdateResource(
                  'used_sorcery_points',
                  (resources.used_sorcery_points || 0) + 1
                )
              }
              onUpdateTotal={(n) => onUpdateResource('sorcery_points', n)}
              onRestore={() =>
                onUpdateResource(
                  'used_sorcery_points',
                  Math.max(0, (resources.used_sorcery_points || 0) - 1)
                )
              }
              color="purple"
              onGlobalPulse={onPulseScreen}
            />
          );
        }
      
        // Sorcellerie innée (2 charges, reset au repos long)
        {
          const innateTotal =
            typeof resources.innate_sorcery === 'number' ? resources.innate_sorcery : 2;
          const innateUsed = Math.min(
            resources.used_innate_sorcery || 0,
            innateTotal
          );
      
          items.push(
            <ResourceBlock
              key="innate_sorcery"
              icon={<Flame size={20} />}
              label="Sorcellerie innée"
              total={innateTotal}
              used={innateUsed}
              onUse={() =>
                onUpdateResource(
                  'used_innate_sorcery',
                  Math.min((resources.used_innate_sorcery || 0) + 1, innateTotal)
                )
              }
              // tu peux laisser éditable le total si tu veux l'ajuster un jour
              onUpdateTotal={(n) => onUpdateResource('innate_sorcery', n)}
              onRestore={() =>
                onUpdateResource(
                  'used_innate_sorcery',
                  Math.max(0, (resources.used_innate_sorcery || 0) - 1)
                )
              }
              color="purple"
              onGlobalPulse={onPulseScreen}
            />
          );
        }

        // ✅ Sélecteur Affinité Élémentaire (Sorcellerie Draconique niv.6+)
        if (player && (level || 1) >= 6) {
          const sub = (
            (player as any).subclass ||
            (player as any).sub_class ||
            (player as any).sousClasse ||
            ''
          ).toString().toLowerCase();

          if (sub.includes('dracon')) {
            const DRACONIC_ELEMENTS = [
              { value: 'feu', label: '🔥 Feu' },
              { value: 'froid', label: '❄️ Froid' },
              { value: 'foudre', label: '⚡ Foudre' },
              { value: 'acide', label: '🧪 Acide' },
              { value: 'poison', label: '☠️ Poison' },
            ];

            items.push(
              <div
                key="draconic_element"
                className="resource-block bg-gradient-to-br from-orange-900/20 to-red-900/10 border border-orange-500/30 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame size={20} className="text-orange-500" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-orange-300">Affinité élémentaire</span>
                      <span className="text-xs text-gray-400">Sorcellerie draconique</span>
                    </div>
                  </div>
                  <select
                    value={(player as any).draconic_element || ''}
                    onChange={async (e) => {
                      const newElement = e.target.value || null;
                      try {
                        const { default: supabase } = await import('../../../lib/supabase').then(m => ({ default: m.supabase }));
                        const { error } = await supabase
                          .from('players')
                          .update({ draconic_element: newElement })
                          .eq('id', player.id);
                        if (error) throw error;
                        // Notifier le parent via onUpdateResource avec une clé spéciale
                        onUpdateResource('draconic_element' as any, newElement);
                      } catch (err) {
                        console.error('Erreur mise à jour affinité:', err);
                      }
                    }}
                    className="input-dark px-3 py-1.5 rounded-lg text-sm"
                  >
                    <option value="">— Choisir —</option>
                    {DRACONIC_ELEMENTS.map(el => (
                      <option key={el.value} value={el.value}>{el.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          }
        }

        break;

    case 'Guerrier':
      if (typeof resources.action_surge === 'number') {
        items.push(
          <ResourceBlock
            key="action_surge"
            icon={<Swords size={20} />}
            label="Second souffle"
            total={resources.action_surge}
            used={resources.used_action_surge || 0}
            onUse={() => onUpdateResource('used_action_surge', (resources.used_action_surge || 0) + 1)}
            onUpdateTotal={(n) => onUpdateResource('action_surge', n)}
            onRestore={() => onUpdateResource('used_action_surge', Math.max(0, (resources.used_action_surge || 0) - 1))}
            color="red"
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;

case 'Magicien':
  if (resources.arcane_recovery !== undefined) {
    // ✅ Calculer le total et les niveaux restants
    const lvl = Number(level || 1);
    const recoveryTotal = Math.max(1, Math.ceil(lvl / 2));
    const recoveryUsed = (resources as any).arcane_recovery_slots_used || 0;
    const recoveryRemaining = Math.max(0, recoveryTotal - recoveryUsed);

    items.push(
      <div
        key="arcane_recovery"
        className="resource-block bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-gray-700/30 rounded-lg p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-blue-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-300">Restauration magique</span>
              {/* ✅ Afficher le compteur */}
              <span className="text-xs text-gray-400">
                {recoveryRemaining}/{recoveryTotal} niveau{recoveryTotal > 1 ? 'x' : ''} disponible{recoveryTotal > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              const nextValue = !resources.used_arcane_recovery;
              
              // ✅ Si on réactive (passe de "Utilisé" à "Disponible"), réinitialiser le compteur
              if (!nextValue) {
                onUpdateResource('arcane_recovery_slots_used' as any, 0);
              }
              
              onUpdateResource('used_arcane_recovery', nextValue);
            }}
            className={`h-8 px-3 flex items-center justify-center rounded-md transition-colors ${
              resources.used_arcane_recovery
                ? 'bg-gray-800/50 text-gray-500'
                : 'text-blue-500 hover:bg-blue-900/30'
            }`}
          >
            {resources.used_arcane_recovery ? 'Utilisé' : 'Disponible'}
          </button>
        </div>
      </div>
    );
  }
  break;

      case 'Moine': {
        const total = (resources as any).credo_points ?? (resources as any).ki_points;
        const used = (resources as any).used_credo_points ?? (resources as any).used_ki_points ?? 0;
      
        if (typeof total === 'number') {
          items.push(
            <ResourceBlock
              key="credo_points"
              icon={<Sparkles size={20} />}
              label="Points de crédo"
              total={total}
              used={used}
              onUse={() => onUpdateResource('used_credo_points', used + 1)}
              onUpdateTotal={(n) => onUpdateResource('credo_points', n)}
              onRestore={() => onUpdateResource('used_credo_points', Math.max(0, used - 1))}
              color="purple"
              onGlobalPulse={onPulseScreen}
            />
          );
        }
      
        // Métabolisme surnaturel (N2+): 1 charge, reset repos long (manuellement avec +)
        if ((level || 0) >= 2) {
          const metaTotal = (resources as any).supernatural_metabolism ?? 1;
          const usedMeta = Math.min((resources as any).used_supernatural_metabolism || 0, metaTotal);
      
          items.push(
            <ResourceBlock
              key="supernatural_metabolism"
              icon={<HandHeart size={20} />}
              label="Métabolisme surnaturel"
              total={metaTotal}
              used={usedMeta}
              onUse={() =>
                onUpdateResource(
                  'used_supernatural_metabolism',
                  Math.min(usedMeta + 1, metaTotal)
                )
              }
              // total fixe → pas d'édition (no-op)
              onUpdateTotal={() => { /* no-op */ }}
              onRestore={() =>
                onUpdateResource(
                  'used_supernatural_metabolism',
                  Math.max(0, usedMeta - 1)
                )
              }
              color="purple"
              hideEdit
              onGlobalPulse={onPulseScreen}
            />
          );
        }
      
        break;
      }

        case 'Occultiste': {
      if ((resources as any)?.pact_magic && player) {
        // 🔍 Déterminer si on édite l'occultiste principal ou secondaire
        const isPrimaryWarlock = player.class === playerClass;
        const isSecondaryWarlock = player.secondary_class === playerClass;

        // Choisir la bonne source de slots
        const warlockSlots = isPrimaryWarlock
          ? ((player as any).spell_slots || {})
          : isSecondaryWarlock
          ? ((player as any).secondary_spell_slots || {})
          : null;

        if (warlockSlots) {
          const pactSlots = warlockSlots.pact_slots || 0;
          const usedPactSlots = warlockSlots.used_pact_slots || 0;
          const pactLevel = warlockSlots.pact_level || 1;

          if (pactSlots > 0) {
            items.push(
              <ResourceBlock
                key="pact_slots"
                icon={<Sparkles size={20} />}
                label={`Emplacements de pacte (Niv. ${pactLevel})`}
                total={pactSlots}
                used={usedPactSlots}
                onUse={() => {
                  const nextSlots = {
                    ...warlockSlots,
                    used_pact_slots: Math.min(usedPactSlots + 1, pactSlots),
                  };

                  if (isPrimaryWarlock) {
                    onUpdateResource('pact_slots' as any, {
                      ...(player as any).spell_slots,
                      ...nextSlots,
                    });
                  } else if (isSecondaryWarlock) {
                    onUpdateResource('pact_slots' as any, {
                      ...(player as any).secondary_spell_slots,
                      ...nextSlots,
                    });
                  }
                }}
                onRestore={() => {
                  const nextSlots = {
                    ...warlockSlots,
                    used_pact_slots: Math.max(0, usedPactSlots - 1),
                  };

                  if (isPrimaryWarlock) {
                    onUpdateResource('pact_slots' as any, {
                      ...(player as any).spell_slots,
                      ...nextSlots,
                    });
                  } else if (isSecondaryWarlock) {
                    onUpdateResource('pact_slots' as any, {
                      ...(player as any).secondary_spell_slots,
                      ...nextSlots,
                    });
                  }
                }}
                onUpdateTotal={() => {
                  /* no-op: total géré par le niveau d'occultiste */
                }}
                color="purple"
                hideEdit
                onGlobalPulse={onPulseScreen}
              />
            );
          }
        }
      }
      break;
    }

    case 'Paladin': {
      // Total auto = 5 × niveau
      const lvl = Number(level || 0);
      const totalPoints = Math.max(0, lvl * 5);
      const used = Math.min(Math.max(0, resources.used_lay_on_hands || 0), totalPoints);

      items.push(
        <ResourceBlock
          key="lay_on_hands"
          icon={<HandHeart size={20} />}
          label="Imposition des mains"
          total={totalPoints}
          used={used}
          onUse={() => onUpdateResource('used_lay_on_hands', Math.min(used + 1, totalPoints))}
          onRestore={() => onUpdateResource('used_lay_on_hands', Math.max(0, used - 1))}
          onUpdateTotal={() => { /* no-op: total auto */ }}
          color="yellow"
          useNumericInput
          hideEdit
          onGlobalPulse={onPulseScreen}
          onUpdateUsed={(v) => {
            const clamped = Math.min(Math.max(0, v), totalPoints);
            onUpdateResource('used_lay_on_hands', clamped);
          }}
        />
      );

      // Conduits divins (N3+) — total calculé → pas d'édition
      if (lvl >= 3) {
        const cap = lvl >= 11 ? 3 : 2;
        const usedCd = resources.used_channel_divinity || 0;
        items.push(
          <ResourceBlock
            key="paladin_channel_divinity"
            icon={<Cross size={20} />}
            label="Conduits divins"
            total={cap}
            used={usedCd}
            onUse={() => onUpdateResource('used_channel_divinity', Math.min(usedCd + 1, cap))}
            onUpdateTotal={() => { /* cap calculé par niveau -> non éditable */ }}
            onRestore={() => onUpdateResource('used_channel_divinity', Math.max(0, usedCd - 1))}
            color="yellow"
            hideEdit
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;
    }

    case 'Rôdeur':
      if (typeof resources.favored_foe === 'number') {
        items.push(
          <ResourceBlock
            key="favored_foe"
            icon={<Target size={20} />}
            label="Ennemi juré"
            total={resources.favored_foe}
            used={resources.used_favored_foe || 0}
            onUse={() => onUpdateResource('used_favored_foe', (resources.used_favored_foe || 0) + 1)}
            onUpdateTotal={(n) => onUpdateResource('favored_foe', n)}
            onRestore={() => onUpdateResource('used_favored_foe', Math.max(0, (resources.used_favored_foe || 0) - 1))}
            color="green"
            onGlobalPulse={onPulseScreen}
          />
        );
      }
      break;

    case 'Roublard':
      if (resources.sneak_attack) {
        items.push(
          <button
            key="sneak_attack"
            onClick={() => {
              // Lancer les dés de l'attaque sournoise
              rollDice({
                type: 'damage',
                attackName: 'Attaque sournoise',
                diceFormula: (resources.sneak_attack || '1d6').toString(),
                modifier: 0
              });
              if (onPulseScreen) onPulseScreen({} as any);
            }}
            className="w-full text-left resource-block bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-gray-700/30 hover:border-red-500/50 hover:bg-red-900/10 transition-all duration-200 rounded-lg p-3 group"
            title="Cliquer pour lancer les dégâts d'attaque sournoise"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skull size={20} className="text-red-500 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Attaque sournoise</span>
              </div>
              <div className="text-sm text-gray-400 bg-gray-800/50 border border-gray-700 group-hover:border-red-500/30 group-hover:text-red-200 px-3 py-1 rounded-md font-mono">
                {resources.sneak_attack}
              </div>
            </div>
          </button>
        );
      }
      break;
  }

  const customClassData = getCustomClassData(player);
  if (customClassData?.isCustom && customClassData.resources?.length > 0) {
    const customResources = customClassData.resources;
    const customState = resources?.custom_resources || {};

    for (const res of customResources) {
      const Icon = getIconComponent(res.icon);
      const total = getCustomResourceMax(res, level || 1, player);
      const used = customState[res.id]?.used || 0;

      items.push(
        <ResourceBlock
          key={`custom-${res.id}`}
          icon={<Icon size={20} />}
          label={res.name}
          total={total}
          used={used}
          onUse={() => {
            const newCustomState = {
              ...customState,
              [res.id]: { current: total, used: Math.min(used + 1, total) },
            };
            onUpdateResource('custom_resources' as any, newCustomState);
          }}
          onRestore={() => {
            const newCustomState = {
              ...customState,
              [res.id]: { current: total, used: Math.max(0, used - 1) },
            };
            onUpdateResource('custom_resources' as any, newCustomState);
          }}
          onUpdateTotal={() => {}}
          color={res.color}
          hideEdit
          onGlobalPulse={onPulseScreen}
          shortRest={res.shortRest}
          longRest={res.longRest}
        />
      );
    }
  }

  if (!items.length) return null;

  return (
    <div className="stats-card">
      <div className="stat-header flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-gray-100">Ressources de classe</h3>
      </div>
      <div className="p-4 space-y-4">{items}</div>
    </div>
  );
}

/* ===========================================================
   Helpers spécifiques – init ressources par classe
   =========================================================== */

export function buildDefaultsForClass(cls: string, level: number, player?: PlayerLike | any): Partial<ClassResources> {
  switch (cls) {
    case 'Barbare':
      return { rage: Math.min(6, Math.floor((level + 3) / 4) + 2), used_rage: 0 };
    case 'Barde':
      return { used_bardic_inspiration: 0 };
    case 'Clerc':
      return { channel_divinity: level >= 6 ? 2 : 1, used_channel_divinity: 0 };
     case 'Druide':
      return { wild_shape: level >= 17 ? 4 : level >= 6 ? 3 : 2, used_wild_shape: 0 };
    case 'Ensorceleur': {
      return {
        sorcery_points: level,
        used_sorcery_points: 0,
        innate_sorcery: 2,
        used_innate_sorcery: 0,
      } as any;
    }
    case 'Guerrier':
      return { action_surge: level >= 17 ? 2 : 1, used_action_surge: 0 };
    case 'Magicien':
      return { arcane_recovery: true, used_arcane_recovery: false, arcane_recovery_slots_used: 0, };

    case 'Moine': {
      const base: any = {
        credo_points: level,
        used_credo_points: 0,
        ki_points: level,
        used_ki_points: 0,
      };
      // Métabolisme surnaturel: disponible à partir du niveau 2, 1 charge
      if (level >= 2) {
        base.supernatural_metabolism = 1;
        base.used_supernatural_metabolism = 0;
      }
      return base;
    }

    case 'Occultiste':
      // Drapeau simple pour signaler Pact Magic (UI minimale)
      return { pact_magic: true };
    case 'Paladin': {
      const base: any = { lay_on_hands: level * 5, used_lay_on_hands: 0 };
      if (level >= 3) {
        base.channel_divinity = level >= 11 ? 3 : 2;
        base.used_channel_divinity = 0;
      }
      return base;
    }
    case 'Rôdeur':
      return { favored_foe: Math.max(1, Math.floor((level + 3) / 4)), used_favored_foe: 0 };
    case 'Roublard':
      return { sneak_attack: `${Math.ceil(level / 2)}d6` };
    default: {
      const customData = getCustomClassData(player);
      if (customData?.isCustom && customData.resources?.length > 0) {
        const customResources = customData.resources;
        const customState: Record<string, { current: number; used: number }> = {};

        for (const res of customResources) {
          const maxVal = getCustomResourceMax(res, level, player);
          customState[res.id] = { current: maxVal, used: 0 };
        }

        return { custom_resources: customState };
      }
      return {};
    }
  }
}