import { Monster } from '../../types/campaign';
import { Shield, Heart, Zap, Eye, MessageSquare, Star, Swords, BookOpen } from 'lucide-react';

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

const ABILITY_LABELS = [
  { key: 'str' as const, label: 'FOR' },
  { key: 'dex' as const, label: 'DEX' },
  { key: 'con' as const, label: 'CON' },
  { key: 'int' as const, label: 'INT' },
  { key: 'wis' as const, label: 'SAG' },
  { key: 'cha' as const, label: 'CHA' },
];

function SectionDivider() {
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-700/60 to-transparent" />
    </div>
  );
}

function EntryList({ entries }: { entries: Array<{ name: string; description: string }> }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="text-sm text-gray-200 leading-relaxed">
          <span className="font-semibold text-amber-200 italic">{entry.name}.</span>{' '}
          {entry.description}
        </div>
      ))}
    </div>
  );
}

interface MonsterStatBlockProps {
  monster: Monster;
  compact?: boolean;
}

export function MonsterStatBlock({ monster, compact }: MonsterStatBlockProps) {
  const speedText = Object.entries(monster.speed || {})
    .map(([k, v]) => (k === 'marche' ? v : `${k} ${v}`))
    .join(', ');

  return (
    <div className="bg-gradient-to-b from-[#1a1510] to-[#15120d] border border-amber-900/40 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/40 px-5 py-4 border-b border-amber-900/30">
        <h3 className="text-xl font-bold text-amber-100 tracking-wide">{monster.name}</h3>
        <p className="text-sm text-amber-300/70 italic mt-0.5">
          {monster.type} de taille {monster.size}
          {monster.alignment ? `, ${monster.alignment}` : ''}
        </p>
      </div>

      <div className="px-5 py-4 space-y-0">
        <div className="grid grid-cols-3 gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-amber-500 shrink-0" />
            <span className="text-sm text-gray-400">CA</span>
            <span className="text-sm font-semibold text-gray-100">
              {monster.armor_class}
              {monster.armor_desc ? ` (${monster.armor_desc})` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-red-500 shrink-0" />
            <span className="text-sm text-gray-400">PV</span>
            <span className="text-sm font-semibold text-gray-100">
              {monster.hit_points}
              {monster.hit_points_formula ? ` (${monster.hit_points_formula})` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-sky-400 shrink-0" />
            <span className="text-sm text-gray-400">VIT</span>
            <span className="text-sm font-semibold text-gray-100">{speedText || '-'}</span>
          </div>
        </div>

        <SectionDivider />

        <div className="grid grid-cols-6 gap-1 text-center">
          {ABILITY_LABELS.map(({ key, label }) => (
            <div key={key} className="bg-black/30 rounded-lg py-2 px-1">
              <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-wider">{label}</div>
              <div className="text-lg font-bold text-gray-100">{monster.abilities[key]}</div>
              <div className="text-xs text-gray-400">{mod(monster.abilities[key])}</div>
            </div>
          ))}
        </div>

        <SectionDivider />

        {!compact && (
          <div className="space-y-1.5 text-sm">
            {monster.saving_throws && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">JdS</span>
                <span className="text-gray-300">{monster.saving_throws}</span>
              </div>
            )}
            {monster.skills && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">Comp.</span>
                <span className="text-gray-300">{monster.skills}</span>
              </div>
            )}
            {monster.vulnerabilities && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">Vuln.</span>
                <span className="text-gray-300">{monster.vulnerabilities}</span>
              </div>
            )}
            {monster.resistances && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">Rés.</span>
                <span className="text-gray-300">{monster.resistances}</span>
              </div>
            )}
            {monster.damage_immunities && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">Imm. dégâts</span>
                <span className="text-gray-300">{monster.damage_immunities}</span>
              </div>
            )}
            {monster.condition_immunities && (
              <div className="flex gap-2">
                <span className="text-amber-400 font-medium shrink-0">Imm. états</span>
                <span className="text-gray-300">{monster.condition_immunities}</span>
              </div>
            )}
            {monster.senses && (
              <div className="flex gap-2">
                <Eye size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-300">{monster.senses}</span>
              </div>
            )}
            {monster.languages && (
              <div className="flex gap-2">
                <MessageSquare size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-gray-300">{monster.languages}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Star size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <span className="text-gray-300">
                FP {monster.challenge_rating}
                {monster.xp ? ` (${monster.xp.toLocaleString('fr-FR')} XP)` : ''}
              </span>
            </div>
          </div>
        )}

        {!compact && monster.traits && monster.traits.length > 0 && (
          <>
            <SectionDivider />
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} className="text-amber-500" />
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Traits</h4>
            </div>
            <EntryList entries={monster.traits} />
          </>
        )}

        {monster.actions && monster.actions.length > 0 && (
          <>
            <SectionDivider />
            <div className="flex items-center gap-2 mb-2">
              <Swords size={14} className="text-red-500" />
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Actions</h4>
            </div>
            <EntryList entries={monster.actions} />
          </>
        )}

        {!compact && monster.bonus_actions && monster.bonus_actions.length > 0 && (
          <>
            <SectionDivider />
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-sky-500" />
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">Actions bonus</h4>
            </div>
            <EntryList entries={monster.bonus_actions} />
          </>
        )}

        {!compact && monster.reactions && monster.reactions.length > 0 && (
          <>
            <SectionDivider />
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-emerald-500" />
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Reactions</h4>
            </div>
            <EntryList entries={monster.reactions} />
          </>
        )}

        {!compact && monster.legendary_actions && monster.legendary_actions.length > 0 && (
          <>
            <SectionDivider />
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} className="text-yellow-500" />
              <h4 className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Actions legendaires</h4>
            </div>
            {monster.legendary_description && (
              <p className="text-sm text-gray-400 italic mb-2">{monster.legendary_description}</p>
            )}
            <EntryList entries={monster.legendary_actions} />
          </>
        )}

        <div className="h-2" />
      </div>
    </div>
  );
}
