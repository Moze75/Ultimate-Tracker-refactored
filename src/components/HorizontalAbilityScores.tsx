import React from 'react';
import { Ability } from '../types/dnd';

interface HorizontalAbilityScoresProps {
  abilities: Ability[];
  inventory?: any[];
  onAbilityClick?: (ability: Ability) => void;
  onSavingThrowClick?: (ability: Ability) => void;
}

export function HorizontalAbilityScores({
  abilities,
  inventory = [],
  onAbilityClick,
  onSavingThrowClick
}: HorizontalAbilityScoresProps) {
  const calculateEquipmentBonuses = () => {
    const bonuses = {
      Force: 0,
      Dextérité: 0,
      Constitution: 0,
      Intelligence: 0,
      Sagesse: 0,
      Charisme: 0,
      armor_class: 0
    };

    if (inventory && Array.isArray(inventory)) {
      for (const item of inventory) {
        try {
          const description = item.description || '';
          const metaLine = description
            .split('\n')
            .reverse()
            .find((l: string) => l.trim().startsWith('#meta:'));

          if (!metaLine) continue;
          const meta = JSON.parse(metaLine.trim().slice(6));

          if (meta.equipped && meta.bonuses) {
            if (meta.bonuses.strength) bonuses.Force += meta.bonuses.strength;
            if (meta.bonuses.dexterity) bonuses.Dextérité += meta.bonuses.dexterity;
            if (meta.bonuses.constitution) bonuses.Constitution += meta.bonuses.constitution;
            if (meta.bonuses.intelligence) bonuses.Intelligence += meta.bonuses.intelligence;
            if (meta.bonuses.wisdom) bonuses.Sagesse += meta.bonuses.wisdom;
            if (meta.bonuses.charisma) bonuses.Charisme += meta.bonuses.charisma;
            if (meta.bonuses.armor_class) bonuses.armor_class += meta.bonuses.armor_class;
          }
        } catch (e) {
          continue;
        }
      }
    }
    return bonuses;
  };

  const getModifier = (score: number) => Math.floor((score - 10) / 2);
  const equipmentBonuses = calculateEquipmentBonuses();

  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 h-full">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Caractéristiques</h3>
      <div className="grid grid-cols-6 gap-3">
        {abilities.map((ability) => {
          const equipmentBonus = equipmentBonuses[ability.name as keyof typeof equipmentBonuses] || 0;
          const baseModifier = getModifier(ability.score);
          const displayModifier = baseModifier + equipmentBonus;

          return (
            <div key={ability.name} className="flex flex-col items-center">
              <div
                className="relative w-24 h-32 flex flex-col items-center justify-start cursor-pointer hover:opacity-80 transition-opacity" 
                style={{
                  backgroundImage: 'url(/background/contenant_stats.png)',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center'
                }}
                onClick={() => onAbilityClick && onAbilityClick(ability)}
                title={`Cliquer pour lancer 1d20+${ability.modifier}`}
              >
                <div className="absolute top-8 left-0 right-0 flex flex-col items-center pointer-events-none">
  <h4 className="text-xs font-semibold text-gray-100 capitalize tracking-wide">
  {ability.name}
</h4>
                </div>

                {equipmentBonus !== 0 && (
                  <div className="absolute -top-0 left-1/2 transform -translate-x-1/2 pointer-events-none">
                    <div className="text-[9px] text-green-400 leading-none whitespace-nowrap bg-gray-900/80 px-1.5 py-0.5 rounded">
                      ({baseModifier >= 0 ? '+' : ''}{baseModifier} {equipmentBonus > 0 ? '+' : ''}{equipmentBonus})
                    </div>
                  </div>
                )}

                <div className="absolute top-[46%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="text-2xl font-normal text-gray-100">
                    {displayModifier >= 0 ? '+' : ''}{displayModifier}
                  </div>
                </div>

                <div className="absolute bottom-4 left-[50%] transform -translate-x-1/2 pointer-events-none">
                  <div className="w-8 h-8 flex items-center justify-center text-sm font-normal text-gray-100">
                    {ability.score}
                  </div>
                </div>
              </div>

              <div className="mt-2 w-full max-w-[110px]">
                <div
                  className="flex items-center justify-between px-2 py-1 bg-gray-800/50 rounded-md border border-gray-700/50 cursor-pointer hover:bg-gray-700/50 transition-colors"
                  onClick={() => onSavingThrowClick && onSavingThrowClick(ability)}
                  title={`Jet de sauvegarde 1d20+${ability.savingThrow}`}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-3 h-3 rounded border ${
                        ability.savingThrow !== ability.modifier
                          ? 'bg-red-500 border-red-600'
                          : 'border-gray-600'
                      }`}
                    />
                    <span className="text-xs text-gray-400">Sauv.</span>
                  </div>
                  <span className="text-sm font-medium text-gray-200">
                    {ability.savingThrow >= 0 ? '+' : ''}{ability.savingThrow}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
