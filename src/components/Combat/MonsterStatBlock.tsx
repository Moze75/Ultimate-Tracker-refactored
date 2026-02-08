import { Monster } from '../../types/campaign';

export interface DiceRollData {
  type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
  attackName: string;
  diceFormula: string;
  modifier: number;
}

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

const ABILITY_LABELS = [
  { key: 'str' as const, label: 'FOR', fullName: 'Force' },
  { key: 'dex' as const, label: 'DEX', fullName: 'Dexterite' },
  { key: 'con' as const, label: 'CON', fullName: 'Constitution' },
  { key: 'int' as const, label: 'INT', fullName: 'Intelligence' },
  { key: 'wis' as const, label: 'SAG', fullName: 'Sagesse' },
  { key: 'cha' as const, label: 'CHA', fullName: 'Charisme' },
];

function TaperRule() {
  return (
    <svg className="w-full h-[5px] my-2" viewBox="0 0 400 5" preserveAspectRatio="none">
      <polyline points="0,0 400,2.5 0,5" fill="#922610" />
    </svg>
  );
}

interface ClickableTextProps {
  text: string;
  onRollDice?: (data: DiceRollData) => void;
  monsterName: string;
  contextName?: string;
}

function ClickableText({ text, onRollDice, monsterName, contextName }: ClickableTextProps) {
  if (!onRollDice) {
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  }

  const diceRegex = /(\d+d\d+(?:\s*[+\-]\s*\d+)?)/gi;
  const attackBonusRegex = /([+\-]\d+)\s*(?:pour toucher|au toucher|to hit)/gi;
  const attackModifierRegex = /:\s*([+\-]\d+)(?=\s*,)/gi;

  let lastIndex = 0;
  const parts: (string | JSX.Element)[] = [];
  let keyCounter = 0;

  let processedText = text.replace(attackBonusRegex, (match, bonus) => {
    const modifier = parseInt(bonus);
    return `<span class="dice-roll-trigger" data-formula="1d20" data-modifier="${modifier}" data-type="attack" data-name="Attaque">${match}</span>`;
  });

  processedText = processedText.replace(attackModifierRegex, (match, bonus) => {
    const modifier = parseInt(bonus);
    return `: <span class="dice-roll-trigger" data-formula="1d20" data-modifier="${modifier}" data-type="attack" data-name="Attaque">${bonus}</span>`;
  });

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = processedText;

  const walkTextNodes = (node: Node, parent: Element | null) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent || '';
      let match;
      let nodeLastIndex = 0;
      const nodeParts: (string | JSX.Element)[] = [];

      diceRegex.lastIndex = 0;
      while ((match = diceRegex.exec(nodeText)) !== null) {
        if (match.index > nodeLastIndex) {
          nodeParts.push(nodeText.slice(nodeLastIndex, match.index));
        }

        const fullFormula = match[1].replace(/\s/g, '');
        const formulaMatch = fullFormula.match(/^(\d+d\d+)([+\-]\d+)?$/i);

        if (formulaMatch) {
          const diceFormula = formulaMatch[1];
          const modifier = formulaMatch[2] ? parseInt(formulaMatch[2]) : 0;

          nodeParts.push(
            <button
              key={`dice-${keyCounter++}`}
              onClick={() => onRollDice({
                type: 'damage',
                attackName: contextName ? `${monsterName} - ${contextName}` : `${monsterName} - Degats`,
                diceFormula,
                modifier,
              })}
              className="inline-flex items-center px-1 py-0.5 mx-0.5 rounded bg-red-900/30 hover:bg-red-900/50 text-red-800 font-bold cursor-pointer transition-colors border border-red-900/30 hover:border-red-700"
              title={`Lancer ${fullFormula}`}
            >
              {fullFormula}
            </button>
          );
        } else {
          nodeParts.push(match[0]);
        }

        nodeLastIndex = match.index + match[0].length;
      }

      if (nodeLastIndex < nodeText.length) {
        nodeParts.push(nodeText.slice(nodeLastIndex));
      }

      return nodeParts.length > 0 ? nodeParts : [nodeText];
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;

      if (element.classList?.contains('dice-roll-trigger')) {
        const formula = element.getAttribute('data-formula') || '1d20';
        const modifier = parseInt(element.getAttribute('data-modifier') || '0');
        const rollType = element.getAttribute('data-type') as DiceRollData['type'] || 'attack';
        const rollName = element.getAttribute('data-name') || 'Attaque';

        return [
          <button
            key={`attack-${keyCounter++}`}
            onClick={() => onRollDice({
              type: rollType,
              attackName: `${monsterName} - ${rollName}`,
              diceFormula: formula,
              modifier,
            })}
            className="inline-flex items-center px-1 py-0.5 mx-0.5 rounded bg-amber-900/30 hover:bg-amber-900/50 text-amber-800 font-bold cursor-pointer transition-colors border border-amber-900/30 hover:border-amber-700"
            title={`Lancer 1d20${modifier >= 0 ? '+' : ''}${modifier}`}
          >
            {element.textContent}
          </button>
        ];
      }

      const childParts: (string | JSX.Element)[] = [];
      const tagName = element.tagName.toLowerCase();

      element.childNodes.forEach(child => {
        const result = walkTextNodes(child, element);
        childParts.push(...result);
      });

      if (tagName === 'b' || tagName === 'strong') {
        return [<strong key={`strong-${keyCounter++}`}>{childParts}</strong>];
      } else if (tagName === 'i' || tagName === 'em') {
        return [<em key={`em-${keyCounter++}`}>{childParts}</em>];
      } else if (tagName === 'br') {
        return [<br key={`br-${keyCounter++}`} />];
      } else {
        return childParts;
      }
    }
    return [];
  };

  const result: (string | JSX.Element)[] = [];
  tempDiv.childNodes.forEach(node => {
    result.push(...walkTextNodes(node, null));
  });

  return <>{result}</>;
}

interface EntryListProps {
  entries: Array<{ name: string; description: string }>;
  onRollDice?: (data: DiceRollData) => void;
  monsterName: string;
}

function EntryList({ entries, onRollDice, monsterName }: EntryListProps) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {entries.map((entry, i) => (
        <p key={i} className="text-[13px] leading-[1.5] text-[#1a1a1a]">
          <span className="font-bold italic text-[#1a1a1a]">{entry.name}.</span>{' '}
          <ClickableText
            text={entry.description}
            onRollDice={onRollDice}
            monsterName={monsterName}
            contextName={entry.name}
          />
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
  onRollDice?: (data: DiceRollData) => void;
}

export function MonsterStatBlock({ monster, compact, onRollDice }: MonsterStatBlockProps) {
  const speedText = Object.entries(monster.speed || {})
    .map(([k, v]) => (k === 'marche' ? v : `${k} ${v}`))
    .join(', ');

  const initMod = Math.floor((monster.abilities.dex - 10) / 2);
  const initText = initMod >= 0 ? `+${initMod}` : `${initMod}`;
  const initPassive = 10 + initMod;

  const handleAbilityRoll = (label: string, fullName: string, modifier: number) => {
    if (!onRollDice) return;
    onRollDice({
      type: 'ability',
      attackName: `${monster.name} - ${fullName}`,
      diceFormula: '1d20',
      modifier,
    });
  };

  const handleSaveRoll = (label: string, fullName: string, modifier: number) => {
    if (!onRollDice) return;
    onRollDice({
      type: 'saving-throw',
      attackName: `${monster.name} - JdS ${fullName}`,
      diceFormula: '1d20',
      modifier,
    });
  };

  const handleInitiativeRoll = () => {
    if (!onRollDice) return;
    onRollDice({
      type: 'ability',
      attackName: `${monster.name} - Initiative`,
      diceFormula: '1d20',
      modifier: initMod,
    });
  };

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

      {monster.image_url && (
        <div className="px-4 pt-2 pb-0">
          <img
            src={monster.image_url}
            alt={monster.name}
            className="w-full h-auto rounded border border-[#922610]/30"
            style={{ maxHeight: '250px', objectFit: 'contain' }}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      <div className="px-4">
        <TaperRule />

        <div className="space-y-0.5 text-[13px] text-[#58180d]">
          <div className="flex justify-between">
            <div>
              <span className="font-bold">CA</span> {monster.armor_class}
              {monster.armor_desc ? ` (${monster.armor_desc})` : ''}
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">Initiative</span>{' '}
              {onRollDice ? (
                <button
                  onClick={handleInitiativeRoll}
                  className="px-1.5 py-0.5 rounded bg-amber-900/30 hover:bg-amber-900/50 text-amber-800 font-bold cursor-pointer transition-colors border border-amber-900/30 hover:border-amber-700"
                  title="Lancer l'initiative"
                >
                  {initText}
                </button>
              ) : (
                <span>{initText}</span>
              )}{' '}
              ({initPassive})
            </div>
          </div>
          <div>
            <span className="font-bold">PV</span> {monster.hit_points}
            {monster.hit_points_formula && onRollDice ? (
              <>
                {' ('}
                <button
                  onClick={() => {
                    const match = monster.hit_points_formula?.match(/^(\d+d\d+)([+\-]\d+)?$/);
                    if (match) {
                      onRollDice({
                        type: 'damage',
                        attackName: `${monster.name} - Points de vie`,
                        diceFormula: match[1],
                        modifier: match[2] ? parseInt(match[2]) : 0,
                      });
                    }
                  }}
                  className="px-1 py-0.5 rounded bg-red-900/30 hover:bg-red-900/50 text-red-800 font-bold cursor-pointer transition-colors border border-red-900/30 hover:border-red-700"
                  title={`Lancer ${monster.hit_points_formula}`}
                >
                  {monster.hit_points_formula}
                </button>
                {')'}
              </>
            ) : monster.hit_points_formula ? (
              ` (${monster.hit_points_formula})`
            ) : null}
          </div>
          <div>
            <span className="font-bold">Vitesse</span> {speedText || '—'}
          </div>
        </div>

        <TaperRule />

        <div className="grid grid-cols-6 text-center text-[11px] mb-0.5" style={{ gap: '1px' }}>
          {ABILITY_LABELS.map(({ key, label, fullName }) => {
            const score = monster.abilities[key];
            const modValue = Math.floor((score - 10) / 2);
            const modText = modValue >= 0 ? `+${modValue}` : `${modValue}`;
            const saveText = modValue >= 0 ? `+${modValue}` : `${modValue}`;

            return (
              <div key={key} className="border border-[#922610]/20 bg-[#f5e8d0] min-w-0 overflow-hidden">
                <div className="font-bold text-[#58180d] border-b border-[#922610]/20 py-0.5 text-[10px]">
                  {label}
                </div>
                <div className="py-1">
                  <div className="font-bold text-[#58180d] text-[14px] leading-tight">
                    {score}
                  </div>
                  <div className="flex flex-col items-center mt-0.5">
                    <div className="flex items-center gap-0.5">
                      <span className="text-[7px] text-[#922610] uppercase leading-none">Mod</span>
                      {onRollDice ? (
                        <button
                          onClick={() => handleAbilityRoll(label, fullName, modValue)}
                          className="font-semibold text-[#58180d] hover:text-amber-700 hover:bg-amber-200/50 rounded cursor-pointer transition-colors text-[11px] leading-none"
                          title={`Test ${fullName}`}
                        >
                          {modText}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#58180d] text-[11px] leading-none">{modText}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[7px] text-[#922610] uppercase leading-none">JS</span>
                      {onRollDice ? (
                        <button
                          onClick={() => handleSaveRoll(label, fullName, modValue)}
                          className="font-semibold text-[#58180d] hover:text-red-700 hover:bg-red-200/50 rounded cursor-pointer transition-colors text-[11px] leading-none"
                          title={`JdS ${fullName}`}
                        >
                          {saveText}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#58180d] text-[11px] leading-none">{saveText}</span>
                      )}
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
            <EntryList entries={monster.traits} onRollDice={onRollDice} monsterName={monster.name} />
          </>
        )}

        {monster.actions && monster.actions.length > 0 && (
          <>
            <SectionTitle>Actions</SectionTitle>
            <EntryList entries={monster.actions} onRollDice={onRollDice} monsterName={monster.name} />
          </>
        )}

        {!compact && monster.bonus_actions && monster.bonus_actions.length > 0 && (
          <>
            <SectionTitle>Actions bonus</SectionTitle>
            <EntryList entries={monster.bonus_actions} onRollDice={onRollDice} monsterName={monster.name} />
          </>
        )}

        {!compact && monster.reactions && monster.reactions.length > 0 && (
          <>
            <SectionTitle>Reactions</SectionTitle>
            <EntryList entries={monster.reactions} onRollDice={onRollDice} monsterName={monster.name} />
          </>
        )}

        {!compact && monster.legendary_actions && monster.legendary_actions.length > 0 && (
          <>
            <SectionTitle>Actions legendaires</SectionTitle>
            {monster.legendary_description && (
              <p className="text-[12px] italic text-[#58180d] mb-1.5">{monster.legendary_description}</p>
            )}
            <EntryList entries={monster.legendary_actions} onRollDice={onRollDice} monsterName={monster.name} />
          </>
        )}

        <div className="h-3" />
      </div>
    </div>
  );
}
