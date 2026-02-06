import { useState } from 'react';
import {
  ChevronRight,
  SkipForward,
  Square,
  Heart,
  Shield,
  Skull,
  Minus,
  Plus,
  X,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import {
  CampaignEncounter,
  EncounterParticipant,
  DND_CONDITIONS,
} from '../../types/campaign';

interface InitiativeTrackerProps {
  encounter: CampaignEncounter;
  participants: EncounterParticipant[];
  onNextTurn: () => void;
  onEndCombat: () => void;
  onUpdateParticipant: (id: string, updates: Partial<EncounterParticipant>) => void;
  onRemoveParticipant: (id: string) => void;
  onViewMonster: (monsterId: string) => void;
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  let color = 'bg-emerald-500';
  if (pct <= 25) color = 'bg-red-500';
  else if (pct <= 50) color = 'bg-amber-500';

  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300 rounded-full`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ConditionBadges({
  conditions,
  onToggle,
}: {
  conditions: string[];
  onToggle: (condition: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center">
        {conditions.map((c) => (
          <span
            key={c}
            onClick={() => onToggle(c)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-900/40 text-orange-300 text-[10px] rounded cursor-pointer hover:bg-orange-900/60 transition-colors"
          >
            {c}
            <X size={8} />
          </span>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-amber-400 border border-dashed border-gray-700 rounded transition-colors"
        >
          +
        </button>
      </div>
      {showPicker && (
        <div className="absolute z-20 mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 w-48 max-h-48 overflow-y-auto">
          {DND_CONDITIONS.map((c) => {
            const active = conditions.includes(c);
            return (
              <button
                key={c}
                onClick={() => {
                  onToggle(c);
                  setShowPicker(false);
                }}
                className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                  active
                    ? 'bg-orange-900/40 text-orange-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {active ? '- ' : '+ '}
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InitiativeTracker({
  encounter,
  participants,
  onNextTurn,
  onEndCombat,
  onUpdateParticipant,
  onRemoveParticipant,
  onViewMonster,
}: InitiativeTrackerProps) {
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({});

  const applyHp = (p: EncounterParticipant, mode: 'damage' | 'heal') => {
    const val = parseInt(hpDelta[p.id] || '0', 10);
    if (!val || val <= 0) return;

    const newHp =
      mode === 'damage'
        ? Math.max(0, p.current_hp - val)
        : Math.min(p.max_hp, p.current_hp + val);

    onUpdateParticipant(p.id, { current_hp: newHp });
    setHpDelta((prev) => ({ ...prev, [p.id]: '' }));
  };

  const toggleCondition = (p: EncounterParticipant, condition: string) => {
    const current = p.conditions || [];
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    onUpdateParticipant(p.id, { conditions: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider">Initiative</h3>
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
            Round {encounter.round_number}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onNextTurn}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <SkipForward size={12} /> Tour suivant
          </button>
          <button
            onClick={onEndCombat}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg border border-red-800/50 transition-colors"
          >
            <Square size={12} /> Fin
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {participants.map((p, idx) => {
          const isCurrentTurn = idx === encounter.current_turn_index;
          const isDead = p.current_hp <= 0;
          const isMonster = p.participant_type === 'monster';

          return (
            <div
              key={p.id}
              className={`rounded-lg border transition-all ${
                isCurrentTurn
                  ? 'bg-amber-900/20 border-amber-600/60 shadow-lg shadow-amber-900/20'
                  : isDead
                  ? 'bg-gray-900/50 border-gray-800 opacity-60'
                  : 'bg-gray-900/30 border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-black/40 text-xs font-bold text-gray-400 shrink-0">
                    {isCurrentTurn ? (
                      <ChevronRight size={14} className="text-amber-400" />
                    ) : (
                      <span>{p.initiative_roll}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium truncate ${
                          isDead ? 'text-gray-500 line-through' : isMonster ? 'text-red-300' : 'text-sky-300'
                        }`}
                      >
                        {p.display_name}
                      </span>
                      {isDead && <Skull size={12} className="text-gray-500 shrink-0" />}
                      {isMonster && p.monster_id && (
                        <button
                          onClick={() => onViewMonster(p.monster_id!)}
                          className="text-gray-500 hover:text-amber-400 transition-colors"
                          title="Voir les stats"
                        >
                          <Eye size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1 text-xs">
                        <Heart size={10} className={isDead ? 'text-gray-600' : 'text-red-500'} />
                        <span className={isDead ? 'text-gray-600' : 'text-gray-400'}>
                          {p.current_hp}/{p.max_hp}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <Shield size={10} className="text-gray-500" />
                        <span className="text-gray-400">{p.armor_class}</span>
                      </div>
                      <div className="flex-1">
                        <HpBar current={p.current_hp} max={p.max_hp} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      className="w-14 px-1.5 py-1 bg-black/40 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-amber-600 focus:outline-none"
                      placeholder="0"
                      value={hpDelta[p.id] || ''}
                      onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyHp(p, 'damage');
                      }}
                    />
                    <button
                      onClick={() => applyHp(p, 'damage')}
                      className="p-1 text-red-500 hover:bg-red-900/30 rounded transition-colors"
                      title="Infliger degats"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      onClick={() => applyHp(p, 'heal')}
                      className="p-1 text-emerald-500 hover:bg-emerald-900/30 rounded transition-colors"
                      title="Soigner"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => onRemoveParticipant(p.id)}
                      className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                      title="Retirer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {(p.conditions?.length > 0 || isCurrentTurn) && (
                  <div className="mt-1.5 ml-10">
                    <ConditionBadges
                      conditions={p.conditions || []}
                      onToggle={(c) => toggleCondition(p, c)}
                    />
                  </div>
                )}

                {p.conditions?.includes('Concentration') && isCurrentTurn && (
                  <div className="mt-1 ml-10 flex items-center gap-1 text-[10px] text-amber-400">
                    <AlertTriangle size={10} />
                    Concentration active
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {participants.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Ajoutez des participants pour commencer le combat
        </div>
      )}
    </div>
  );
}
