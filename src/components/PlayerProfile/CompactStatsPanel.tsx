import React from 'react';
import { Shield as ShieldIcon } from 'lucide-react';
import { Player } from '../../types/dnd';

interface CompactStatsPanelProps {
  player: Player;
  inventory: any[];
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
    ?  abilities.find((a: any) => a?.name === 'Constitution') 
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
  const bonuses = { armor_class: 0 };
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

const formatFr = (v: number | string | null | undefined): string => {
  if (v == null) return '0';
  if (typeof v === 'string') {
    if (v.includes(',')) return v.trim();
    return v.replace('.', ',').trim();
  }
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
};

export function CompactStatsPanel({ player, inventory }: CompactStatsPanelProps) {
  const calculatedProficiencyBonus = getProficiencyBonusForLevel(player.level);
  const stats = player.stats || {
    armor_class: 10,
    initiative: 0,
    speed: 30,
    proficiency_bonus: calculatedProficiencyBonus,
  };

  const dexMod = getDexModFromPlayer(player);
  const wisMod = getWisModFromPlayer(player);
  const armorFormula = (player as any)?.equipment?.armor?.armor_formula || null;
  const shieldBonus = Number((player as any)?.equipment?.shield?.shield_bonus ?? 0) || 0;
  const baseACFromStats = Number(stats.armor_class || 0);

const conMod = getConModFromPlayer(player);

const calculateClassUnarmoredAC = (): number => {
  if (player. class === 'Moine') return 10 + dexMod + wisMod;
  if (player.class === 'Barbare') return 10 + dexMod + conMod;
  return 10 + dexMod;
};

const unarmoredDefenseAC = !armorFormula ? calculateClassUnarmoredAC() : 0;
const isAutoACValue = baseACFromStats === (10 + dexMod) || baseACFromStats === 0;

const baseAC = armorFormula
  ?  computeArmorAC(armorFormula, dexMod)
  : (isAutoACValue || baseACFromStats <= 0)
    ? unarmoredDefenseAC
    : baseACFromStats;

  const equipmentBonuses = calculateEquipmentBonuses(inventory);
  const acBonus = Number((stats as any).ac_bonus || 0);
  const totalAC = baseAC + shieldBonus + acBonus + equipmentBonuses.armor_class;

  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
      <div className="grid grid-cols-2 gap-4">
        {/* CA */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-lg">
          <div className="relative w-16 h-16 mb-1">
            <ShieldIcon className="absolute inset-0 w-full h-full text-gray-400 stroke-[1.5]" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-100">
              {totalAC}
            </div>
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">CA</div>
        </div>

        {/* Vitesse */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-2xl font-bold text-gray-100 mb-1">
            {formatFr(stats.speed)} m
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Vitesse</div>
        </div>

        {/* Initiative */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-2xl font-bold text-gray-100 mb-1">
            {stats.initiative >= 0 ? '+' : ''}{stats.initiative}
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Initiative</div>
        </div>

        {/* Maîtrise */}
        <div className="flex flex-col items-center justify-center p-3 bg-gray-800/50 rounded-lg">
          <div className="text-2xl font-bold text-gray-100 mb-1">
            +{calculatedProficiencyBonus}
          </div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Maîtrise</div>
        </div>
      </div>
    </div>
  );
}
