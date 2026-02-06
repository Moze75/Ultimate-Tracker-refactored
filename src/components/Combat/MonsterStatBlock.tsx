import { Monster } from '../../types/campaign';

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

function TaperRule() {
  return (
    <svg className="w-full h-[5px] my-2" viewBox="0 0 400 5" preserveAspectRatio="none">
      <polyline points="0,0 400,2.5 0,5" fill="#922610" />
    </svg>
  );
}

function EntryList({ entries }: { entries: Array<{ name: string; description: string }> }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => (
        <p key={i} className="text-[13px] leading-[1.5] text-[#1a1a1a]">
          <span className="font-bold italic text-[#1a1a1a]">{entry.name}.</span>{' '}
          <span dangerouslySetInnerHTML={{ __html: entry.description }} />
        </p>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <>
      <svg className="w-full h-[5px] mt-3 mb-1" viewBox="0 0 400 5" preserveAspectRatio="none">
        <polyline points="0,0 400,2.5 0,5" fill="#922610" />
      </svg>
      <h4 className="text-[15px] font-normal text-[#922610] border-b border-[#922610] pb-0.5 mb-1.5"
        style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}
      >
        {children}
      </h4>
    </>
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

  const initMod = Math.floor((monster.abilities.dex - 10) / 2);
  const initText = initMod >= 0 ? `+${initMod}` : `${initMod}`;
  const initPassive = 10 + initMod;

  return (
    <div
      className="border-2 border-[#922610] rounded-sm overflow-hidden"
      style={{
        background: '#fdf1dc',
        boxShadow: '0 0 8px rgba(0,0,0,0.3)',
      }}
    >
      <div className="px-4 pt-3 pb-0">
        <h3
          className="text-[20px] font-bold text-[#922610] leading-tight"
          style={{ fontVariant: 'small-caps', letterSpacing: '0.05em' }}
        >
          {monster.name}
        </h3>
        <p className="text-[12px] italic text-[#58180d] mb-0.5">
          {monster.type} de taille {monster.size}
          {monster.alignment ? `, ${monster.alignment}` : ''}
        </p>
      </div>

      <div className="px-4">
        <TaperRule />

        <div className="space-y-0.5 text-[13px] text-[#58180d]">
          <div className="flex justify-between">
            <div>
              <span className="font-bold">CA</span> {monster.armor_class}
              {monster.armor_desc ? ` (${monster.armor_desc})` : ''}
            </div>
            <div>
              <span className="font-bold">Initiative</span> {initText} ({initPassive})
            </div>
          </div>
          <div>
            <span className="font-bold">PV</span> {monster.hit_points}
            {monster.hit_points_formula ? ` (${monster.hit_points_formula})` : ''}
          </div>
          <div>
            <span className="font-bold">Vitesse</span> {speedText || '—'}
          </div>
        </div>

        <TaperRule />

        <div className="grid grid-cols-6 gap-0.5 text-center text-[11px] mb-0.5">
          {ABILITY_LABELS.map(({ key, label }) => {
            const score = monster.abilities[key];
            const modValue = Math.floor((score - 10) / 2);
            const modText = modValue >= 0 ? `+${modValue}` : `${modValue}`;
            const saveText = modValue >= 0 ? `+${modValue}` : `${modValue}`;

            return (
              <div key={key} className="border border-[#922610]/20 bg-[#f5e8d0]">
                <div className="font-bold text-[#58180d] border-b border-[#922610]/20 py-0.5">
                  {label}
                </div>
                <div className="py-1">
                  <div className="font-bold text-[#58180d] text-[15px]">
                    {score}
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-0.5 px-1">
                    <div>
                      <div className="text-[9px] text-[#922610] uppercase" style={{ letterSpacing: '0.02em' }}>
                        Mod
                      </div>
                      <div className="font-semibold text-[#58180d]">
                        {modText}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-[#922610] uppercase" style={{ letterSpacing: '0.02em' }}>
                        JS
                      </div>
                      <div className="font-semibold text-[#58180d]">
                        {saveText}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <TaperRule />

        {!compact && (
          <div className="space-y-0.5 text-[13px] text-[#58180d]">
            {monster.saving_throws && (
              <div><span className="font-bold">JdS</span> {monster.saving_throws}</div>
            )}
            {monster.skills && (
              <div><span className="font-bold">Comp.</span> {monster.skills}</div>
            )}
            {monster.vulnerabilities && (
              <div><span className="font-bold">Vuln.</span> {monster.vulnerabilities}</div>
            )}
            {monster.resistances && (
              <div><span className="font-bold">Res.</span> {monster.resistances}</div>
            )}
            {monster.damage_immunities && (
              <div><span className="font-bold">Imm. degats</span> {monster.damage_immunities}</div>
            )}
            {monster.condition_immunities && (
              <div><span className="font-bold">Imm. etats</span> {monster.condition_immunities}</div>
            )}
            {monster.senses && (
              <div><span className="font-bold">Sens</span> {monster.senses}</div>
            )}
            {monster.languages && (
              <div><span className="font-bold">Langues</span> {monster.languages}</div>
            )}
            <div>
              <span className="font-bold">FP</span> {monster.challenge_rating}
              {monster.xp ? ` (PX ${monster.xp.toLocaleString('fr-FR')}` : ''}
              {monster.xp && monster.challenge_rating ? ` ; BM +${Math.max(2, Math.ceil(parseFloat(monster.challenge_rating) / 4) + 1)})` : ''}
            </div>
          </div>
        )}

        {!compact && monster.traits && monster.traits.length > 0 && (
          <>
            <SectionTitle>Traits</SectionTitle>
            <EntryList entries={monster.traits} />
          </>
        )}

        {monster.actions && monster.actions.length > 0 && (
          <>
            <SectionTitle>Actions</SectionTitle>
            <EntryList entries={monster.actions} />
          </>
        )}

        {!compact && monster.bonus_actions && monster.bonus_actions.length > 0 && (
          <>
            <SectionTitle>Actions bonus</SectionTitle>
            <EntryList entries={monster.bonus_actions} />
          </>
        )}

        {!compact && monster.reactions && monster.reactions.length > 0 && (
          <>
            <SectionTitle>Reactions</SectionTitle>
            <EntryList entries={monster.reactions} />
          </>
        )}

        {!compact && monster.legendary_actions && monster.legendary_actions.length > 0 && (
          <>
            <SectionTitle>Actions legendaires</SectionTitle>
            {monster.legendary_description && (
              <p className="text-[12px] italic text-[#58180d] mb-1.5">{monster.legendary_description}</p>
            )}
            <EntryList entries={monster.legendary_actions} />
          </>
        )}

        <div className="h-3" />
      </div>
    </div>
  );
}
