import React from 'react';
import { Shield as ShieldIcon } from 'lucide-react'; 
import { Player, PlayerStats } from '../../types/dnd';

interface QuickStatsDisplayProps {
  player: Player;
  inventory: any[];
  activeTooltip: 'ac' | 'speed' | 'initiative' | 'proficiency' | null;
  setActiveTooltip: (tooltip: 'ac' | 'speed' | 'initiative' | 'proficiency' | null) => void;
}

const getProficiencyBonusForLevel = (level: number): number => {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
};

const getDexModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) ? abilities.find((a: any) => a?.name === 'Dextérité') : undefined;
  if (fromArray?.modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

const getWisModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) ? abilities.find((a: any) => a?.name === 'Sagesse') : undefined;
  if (fromArray?.modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

  

const getConModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) 
    ? abilities. find((a: any) => a?.name === 'Constitution') 
    : undefined;
  if (fromArray?. modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

function computeArmorAC(armor_formula: {
  base: number;
  addDex: boolean;
  dexCap?: number | null;
}, dexMod: number): number {
  if (!armor_formula) return 0;
  const base = armor_formula.base || 10;
  if (!armor_formula.addDex) return base;
  const cap = armor_formula.dexCap == null ? Infinity : armor_formula.dexCap;
  const applied = Math.max(-10, Math.min(cap, dexMod));
  return base + applied;
}

const calculateEquipmentBonuses = (inventory: any[]): { armor_class: number } => {
  const bonuses = {
    armor_class: 0
  };

  if (!inventory || !Array.isArray(inventory)) return bonuses;

  for (const item of inventory) {
    try {
      const description = item.description || '';
      const metaLine = description
        .split('\n')
        .reverse()
        .find((l: string) => l.trim().startsWith('#meta:'));

      if (!metaLine) continue;

      const meta = JSON.parse(metaLine.trim().slice(6));

      if (meta.equipped && meta.bonuses?.armor_class) {
        bonuses.armor_class += meta.bonuses.armor_class;
      }
    } catch (e) {
      continue;
    }
  }

  return bonuses;
};

export function QuickStatsDisplay({ player, inventory, activeTooltip, setActiveTooltip }: QuickStatsDisplayProps) {
  const calculatedProficiencyBonus = getProficiencyBonusForLevel(player.level);
  const stats: PlayerStats = player.stats || {
    armor_class: 10,
    initiative: 0,
    speed: 30,
    proficiency_bonus: calculatedProficiencyBonus,
    inspirations: player.stats?.inspirations || 0,
  };

  const toNumber = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(',', '.'));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };

  const formatFr = (v: number | string | null | undefined): string => {
    if (v == null) return '0';
    if (typeof v === 'string') {
      if (v.includes(',')) return v.trim();
      return v.replace('.', ',').trim();
    }
    return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  };

  const speedNum = toNumber(stats.speed);
  const dexMod = getDexModFromPlayer(player);
  const wisMod = getWisModFromPlayer(player);
  const armorFormula = (player as any)?.equipment?.armor?.armor_formula || null;
  const shieldBonus = Number((player as any)?.equipment?.shield?.shield_bonus ?? 0) || 0;
  const baseACFromStats = Number(stats.armor_class || 0);

const conMod = getConModFromPlayer(player);

// Calcul de la défense sans armure selon la classe
const calculateClassUnarmoredAC = (): number => {
  if (player. class === 'Moine') return 10 + dexMod + wisMod;
  if (player.class === 'Barbare') return 10 + dexMod + conMod;
  return 10 + dexMod;
};

const unarmoredDefenseAC = ! armorFormula ?  calculateClassUnarmoredAC() : 0;

// Déterminer si la CA stockée est une valeur "auto" (égale à 10+DEX basique)
// ou une valeur personnalisée par l'utilisateur
const isAutoACValue = baseACFromStats === (10 + dexMod) || baseACFromStats === 0;

const baseAC = armorFormula
  ? computeArmorAC(armorFormula, dexMod)
  : (isAutoACValue || baseACFromStats <= 0)
    ? unarmoredDefenseAC
    : baseACFromStats;

  const equipmentBonuses = calculateEquipmentBonuses(inventory);
  const acBonus = Number((stats as any).ac_bonus || 0);
  const totalAC = baseAC + shieldBonus + acBonus + equipmentBonuses.armor_class;
 
  return (
   <div className="grid grid-cols-4 gap-4 mt-2 bg-gray-800/50 rounded-lg py-1">
{/* CA */}
<div className="flex flex-col items-center pt-2">
  <div
    className="relative w-16 h-14 -mt-2 -mb-1 group cursor-pointer"
    onClick={() => setActiveTooltip(activeTooltip === 'ac' ?  null : 'ac')}
  >
    <img 
      src="/background/shield_gris.png" 
      alt="Bouclier CA"
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 object-contain drop-shadow-lg pointer-events-none"
    />
    <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-gray-100 z-10">
      {totalAC}
    </div>
          {activeTooltip === 'ac' && (
            <>
              <div className="fixed inset-0" onClick={() => setActiveTooltip(null)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
                <h4 className="font-semibold text-gray-100 mb-1">Classe d'Armure</h4>
                <p className="mb-2">Détermine la difficulté pour vous toucher en combat.</p>
                <p className="text-gray-400">Calcul actuel :</p>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
{armorFormula ? (
  <>
    <li>Armure équipée: {computeArmorAC(armorFormula, dexMod)} (Formule: {armorFormula.base}{armorFormula.addDex ? ` + mod DEX${armorFormula. dexCap != null ? ` (max ${armorFormula.dexCap})` : ''}` : ''})</li>
  </>
) : (
  <>
    {player.class === 'Moine' ?  (
      <li>Défense sans armure (Moine): 10 + DEX ({dexMod >= 0 ? '+' : ''}{dexMod}) + SAG ({wisMod >= 0 ? '+' : ''}{wisMod}) = {unarmoredDefenseAC}</li>
    ) : player.class === 'Barbare' ?  (
      <li>Défense sans armure (Barbare): 10 + DEX ({dexMod >= 0 ? '+' : ''}{dexMod}) + CON ({conMod >= 0 ?  '+' : ''}{conMod}) = {unarmoredDefenseAC}</li>
    ) : (
      <li>CA de base: 10 + DEX ({dexMod >= 0 ?  '+' : ''}{dexMod}) = {10 + dexMod}</li>
    )}
  </>
)}
                  <li>+ Bonus de bouclier (équipement): {shieldBonus >= 0 ? `+${shieldBonus}` : shieldBonus}</li>
                  {equipmentBonuses.armor_class !== 0 && (
                    <li>+ Bonus d'équipement: {equipmentBonuses.armor_class >= 0 ? `+${equipmentBonuses.armor_class}` : equipmentBonuses.armor_class}</li>
                  )}
                  <li>Total: {totalAC}</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">L'armure équipée remplace la CA de base. La CA de base est configurable dans les paramètres si vous n'utilisez pas d'armure.</p>
              </div>
            </>
          )}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500 -mt-1" />
      </div>

      {/* Vitesse */}
    <div className="flex flex-col items-center pt-2">
        <div
          className="relative w-16 h-10 -mt-2 -mb-1 group cursor-pointer"
          onClick={() => setActiveTooltip(activeTooltip === 'speed' ? null : 'speed')}
        >
          <div className="text-lg font-bold text-gray-100 whitespace-nowrap">
            {formatFr(stats.speed)} m
          </div>
          {activeTooltip === 'speed' && (
            <>
              <div className="fixed inset-0" onClick={() => setActiveTooltip(null)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
                <h4 className="font-semibold text-gray-100 mb-1">Vitesse</h4>
                <p className="mb-2">Distance que vous pouvez parcourir en un tour.</p>
                <div className="text-gray-400">
                  <p>Équivalences :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{formatFr(stats.speed)} mètres = {Math.floor(speedNum / 1.5)} cases</li>
                    <li>Course : × 2 ({formatFr(speedNum * 2)} mètres)</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500 -mt-2 text-center -ml-7">VIT</div>
      </div>

      {/* Initiative */}
    <div className="flex flex-col items-center pt-2">
        <div
          className="relative w-12 h-10 -mt-2 -mb-1 group cursor-pointer"
          onClick={() => setActiveTooltip(activeTooltip === 'initiative' ? null : 'initiative')}
        >
           <div className="text-lg font-bold text-gray-100">
            {stats.initiative >= 0 ? '+' : ''}{stats.initiative}
          </div>
          {activeTooltip === 'initiative' && (
            <>
              <div className="fixed inset-0" onClick={() => setActiveTooltip(null)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[100]">
                <h4 className="font-semibold text-gray-100 mb-1">Initiative</h4>
                <p className="mb-2">Détermine l'ordre de passage lors des combats.</p>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  <li>Basée sur votre modificateur de Dextérité.</li>
                  <li>Un score élevé vous permet d'agir avant vos ennemis.</li>
                  <li>Peut être modifié par des dons ou des objets magiques.</li>
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500 -mt-2 text-center -ml-4">INIT</div>
      </div>

      {/* Maîtrise */}
   <div className="flex flex-col items-center pt-2">
        <div
          className="relative w-12 h-10 -mt-2 -mb-1 group cursor-pointer"
          onClick={() => setActiveTooltip(activeTooltip === 'proficiency' ? null : 'proficiency')}
        >
          <div className="text-lg font-bold text-gray-100">
            +{calculatedProficiencyBonus}
          </div>
          {activeTooltip === 'proficiency' && (
            <>
              <div className="fixed inset-0" onClick={() => setActiveTooltip(null)} />
              <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[100]">
                <h4 className="font-semibold text-gray-100 mb-1">Bonus de Maîtrise</h4>
                <p className="mb-2">Représente votre niveau d'expérience et d'entraînement.</p>
                <p className="text-gray-400 mb-1">S'ajoute automatiquement à :</p>
                <ul className="list-disc list-inside text-gray-400 space-y-1">
                  <li>Vos <strong>jets d'attaque</strong> avec les armes maîtrisées.</li>
                  <li>Vos jets de sauvegarde maîtrisés.</li>
                  <li>Vos tests de compétences maîtrisées.</li>
                  <li>Le DD (Degré de Difficulté) de vos sorts.</li>
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500 -mt-2 text-center -ml-6">MAÎT</div>
      </div>
    </div>  
  );
} 
