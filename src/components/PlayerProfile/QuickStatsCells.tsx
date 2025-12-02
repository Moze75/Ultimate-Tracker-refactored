import React from 'react';
import { Shield as ShieldIcon } from 'lucide-react';
import { Player } from '../../types/dnd';

interface QuickStatsCellsProps {
  player: Player;
  inventory: any[];
  activeTooltip?: 'ac' | 'speed' | 'initiative' | 'proficiency' | null;
  setActiveTooltip?: (tooltip: 'ac' | 'speed' | 'initiative' | 'proficiency' | null) => void;
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
  const fromArray = Array.isArray(abilities) ?  abilities.find((a: any) => a?. name === 'Dextérité') : undefined;
  if (fromArray?. modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

const getWisModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) ? abilities.find((a: any) => a?. name === 'Sagesse') : undefined;
  if (fromArray?.modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math. floor((fromArray. score - 10) / 2);
  return 0;
};

const getConModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) ?  abilities.find((a: any) => a?.name === 'Constitution') : undefined;
  if (fromArray?.modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math. floor((fromArray. score - 10) / 2);
  return 0;
};

function computeArmorAC(armor_formula: {
  base: number;
  addDex: boolean;
  dexCap?: number | null;
}, dexMod: number): number {
  if (! armor_formula) return 0;
  const base = armor_formula. base || 10;
  if (! armor_formula.addDex) return base;
  const cap = armor_formula. dexCap == null ?  Infinity : armor_formula.dexCap;
  const applied = Math.max(-10, Math.min(cap, dexMod));
  return base + applied;
}

const calculateEquipmentBonuses = (inventory: any[]): { armor_class: number } => {
  const bonuses = { armor_class: 0 };
  if (! inventory || ! Array.isArray(inventory)) return bonuses;

  for (const item of inventory) {
    try {
      const description = item.description || '';
      const metaLine = description
        .split('\n')
        .reverse()
        .find((l: string) => l.trim().startsWith('#meta:'));

      if (! metaLine) continue;
      const meta = JSON.parse(metaLine.trim(). slice(6));
      if (meta.equipped && meta.bonuses?. armor_class) {
        bonuses. armor_class += meta.bonuses. armor_class;
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
    return v. replace('. ', ',').trim();
  }
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
};

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v. replace(',', '.'));
    return isNaN(n) ?  0 : n;
  }
  return 0;
};

export function QuickStatsCells({ player, inventory, activeTooltip, setActiveTooltip }: QuickStatsCellsProps) {
  const calculatedProficiencyBonus = getProficiencyBonusForLevel(player.level);
  const stats = player.stats || {
    armor_class: 10,
    initiative: 0,
    speed: 30,
    proficiency_bonus: calculatedProficiencyBonus,
  };

  const dexMod = getDexModFromPlayer(player);
  const wisMod = getWisModFromPlayer(player);
  const conMod = getConModFromPlayer(player);
  const armorFormula = (player as any)?.equipment?.armor?. armor_formula || null;
  const shieldBonus = Number((player as any)?. equipment?.shield?.shield_bonus ??  0) || 0;
  const baseACFromStats = Number(stats.armor_class || 0);

  // Calcul de la défense sans armure selon la classe
  const calculateClassUnarmoredAC = (): number => {
    if (player.class === 'Moine') return 10 + dexMod + wisMod;
    if (player.class === 'Barbare') return 10 + dexMod + conMod;
    return 10 + dexMod;
  };

  const unarmoredDefenseAC = ! armorFormula ?  calculateClassUnarmoredAC() : 0;
  const isAutoACValue = baseACFromStats === (10 + dexMod) || baseACFromStats === 0;

  const baseAC = armorFormula
    ? computeArmorAC(armorFormula, dexMod)
    : (isAutoACValue || baseACFromStats <= 0)
      ? unarmoredDefenseAC
      : baseACFromStats;

  const equipmentBonuses = calculateEquipmentBonuses(inventory);
  const acBonus = Number((stats as any).ac_bonus || 0);
  const totalAC = baseAC + shieldBonus + acBonus + equipmentBonuses.armor_class;

  // ...  reste du JSX identique

return (
  <div className="flex items-center gap-1" style={{ overflow: 'visible' }}>
    <div
      className="flex flex-col items-center justify-center cursor-pointer relative"
      style={{ width: '90px', overflow: 'visible' }}
      onClick={() => setActiveTooltip && setActiveTooltip(activeTooltip === 'ac' ? null : 'ac')}
    >
      <div 
        className="relative flex items-center justify-center"
        style={{
          width: '90px',
          height: '110px',
          overflow: 'visible'
        }}
      >
        <img 
          src="/background/shield_gris.png" 
          alt="CA"
          style={{
            position: 'absolute',
            width: '140px',
            height: '170px',
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
        />
        <span className="text-2xl lg:text-3xl font-bold text-gray-100 relative z-10">
          {totalAC}
        </span>
      </div>
      <div className="text-xs uppercase tracking-wide text-gray-500 -mt-2">CA</div>
      {activeTooltip === 'ac' && (
        <>
          // ...  reste du tooltip
    
  
          <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setActiveTooltip && setActiveTooltip(null); }} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
            <h4 className="font-semibold text-gray-100 mb-1">Classe d'Armure</h4>
            <p className="mb-2">Détermine la difficulté pour vous toucher en combat.</p>
            <p className="text-gray-400">Calcul actuel :</p>
            <ul className="list-disc list-inside text-gray-400 space-y-1">
              {armorFormula ?  (
                <>
                  <li>Armure équipée: {computeArmorAC(armorFormula, dexMod)} (Formule: {armorFormula. base}{armorFormula. addDex ?  ` + mod DEX${armorFormula. dexCap != null ? ` (max ${armorFormula.dexCap})` : ''}` : ''})</li>
                </>
              ) : (
                <li>CA de base (profil): {baseACFromStats}</li>
              )}
              <li>+ Bonus de bouclier (équipement): {shieldBonus >= 0 ? `+${shieldBonus}` : shieldBonus}</li>
              {equipmentBonuses.armor_class !== 0 && (
                <li>+ Bonus d'équipement: {equipmentBonuses. armor_class >= 0 ? `+${equipmentBonuses.armor_class}` : equipmentBonuses. armor_class}</li>
              )}
              <li>Total: {totalAC}</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">L'armure équipée remplace la CA de base.  La CA de base est configurable dans les paramètres si vous n'utilisez pas d'armure.</p>
          </div>
        </>
      )}
    </div>

    <div
      className="flex flex-col items-center justify-center px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 min-w-[80px] cursor-pointer hover:bg-gray-700/50 transition-colors relative"
      onClick={() => setActiveTooltip && setActiveTooltip(activeTooltip === 'speed' ? null : 'speed')}

      >
        <div className="text-xl font-bold text-gray-100 mb-1">
          {formatFr(stats.speed)} m
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Vitesse</div>
        {activeTooltip === 'speed' && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setActiveTooltip && setActiveTooltip(null); }} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
              <h4 className="font-semibold text-gray-100 mb-1">Vitesse</h4>
              <p className="mb-2">Distance que vous pouvez parcourir en un tour.</p>
              <div className="text-gray-400">
                <p>Équivalences :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{formatFr(stats.speed)} mètres = {Math.floor(toNumber(stats.speed) / 1.5)} cases</li>
                  <li>Course : × 2 ({formatFr(toNumber(stats.speed) * 2)} mètres)</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      <div 
        className="flex flex-col items-center justify-center px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 min-w-[80px] cursor-pointer hover:bg-gray-700/50 transition-colors relative"
        onClick={() => setActiveTooltip && setActiveTooltip(activeTooltip === 'initiative' ? null : 'initiative')}
      >
        <div className="text-xl font-bold text-gray-100 mb-1">
          {stats.initiative >= 0 ? '+' : ''}{stats.initiative}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Initiative</div>
        {activeTooltip === 'initiative' && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setActiveTooltip && setActiveTooltip(null); }} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
              <h4 className="font-semibold text-gray-100 mb-1">Initiative</h4>
              <p className="mb-2">Détermine l'ordre de passage lors des combats.</p>
              <ul className="list-disc list-inside text-gray-400 space-y-1">
                <li>Basée sur votre modificateur de Dextérité.</li>
                <li>Un score élevé vous permet d'agir avant vos ennemis.</li>
              </ul>
            </div>
          </>
        )}
      </div>

      <div 
        className="flex flex-col items-center justify-center px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 min-w-[80px] cursor-pointer hover:bg-gray-700/50 transition-colors relative"
        onClick={() => setActiveTooltip && setActiveTooltip(activeTooltip === 'proficiency' ? null : 'proficiency')}
      >
        <div className="text-xl font-bold text-gray-100 mb-1"> 
          +{calculatedProficiencyBonus}
        </div>
        <div className="text-xs uppercase tracking-wide text-gray-500">Maîtrise</div>
        {activeTooltip === 'proficiency' && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={(e) => { e.stopPropagation(); setActiveTooltip && setActiveTooltip(null); }} />
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 backdrop-blur-sm text-sm text-gray-300 rounded-lg max-w-sm w-[90vw] shadow-xl border border-gray-700 z-[9999]">
              <h4 className="font-semibold text-gray-100 mb-1">Bonus de Maîtrise</h4>
              <p className="mb-2">Votre niveau d'expérience global.</p>
              <p className="text-gray-400 mb-1">Ce bonus s'ajoute notamment au calcul :</p>
              <ul className="list-disc list-inside text-gray-400 space-y-1">
                <li>Des <strong>jets d'attaque</strong>.</li>
                <li>Des jets de sauvegarde.</li>
                <li>Des tests de compétences.</li>
                <li>Du DD de vos sorts.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
