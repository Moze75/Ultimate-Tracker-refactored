import React from 'react';
import { Ability } from '../types/dnd';

interface AbilityScoreGridProps {
  abilities: Ability[];
  editing: boolean;
  calculateEquipmentBonuses: () => {
    Force: number;
    Dextérité: number;
    Constitution: number;
    Intelligence: number;
    Sagesse: number;
    Charisme: number;
    armor_class: number;
  };
  handleScoreChange: (index: number, score: number) => void;
  rollAbilityCheck: (ability: Ability) => void;
  rollSavingThrow: (ability: Ability) => void;
  handleSavingThrowChange: (index: number) => void;
}

export function AbilityScoreGrid({
  abilities,
  editing,
  calculateEquipmentBonuses,
  handleScoreChange,
  rollAbilityCheck,
  rollSavingThrow,
  handleSavingThrowChange
}: AbilityScoreGridProps) {
  const getModifier = (score: number) => Math.floor((score - 10) / 2);

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {abilities.map((ability, abilityIndex) => {
          const equipmentBonuses = calculateEquipmentBonuses();
          const equipmentBonus = equipmentBonuses[ability.name as keyof typeof equipmentBonuses] || 0;
          const baseModifier = getModifier(ability.score);
          const displayModifier = baseModifier + equipmentBonus;

          return (
            <div key={ability.name} className="flex flex-col items-center">
              <div
                className={`relative w-28 h-36 flex flex-col items-center justify-start ${
                  !editing ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
                }`}
                style={{
                  backgroundImage: 'url(/background/contenant_stats.png)',
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center'
                }}
                onClick={() => !editing && rollAbilityCheck(ability)}
                title={!editing ? `Cliquer pour lancer 1d20+${ability.modifier}` : ''}
              >
                <div className="absolute top-13 left-0 right-0 flex flex-col items-center pointer-events-none">
<h4 className="text-[9px] font-normal text-gray-100 uppercase tracking-wide">
  {ability.name}
</h4>
                </div>

                {equipmentBonus !== 0 && (
                  <div className="absolute -top-0 left-1/2 transform -translate-x-1/2 pointer-events-none">
                    <div className="text-[10px] text-green-400 leading-none whitespace-nowrap bg-gray-900/80 px-2 py-0.5 rounded">
                      ({baseModifier >= 0 ? '+' : ''}{baseModifier} {equipmentBonus > 0 ? '+' : ''}{equipmentBonus})
                    </div>
                  </div>
                )}

                <div className="absolute top-[46%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="text-3xl font-normal text-gray-100">
                    {displayModifier >= 0 ? '+' : ''}{displayModifier}
                  </div>
                </div>

                <div
                  className="absolute bottom-4 left-[49%] transform -translate-x-1/2"
                  onClick={(e) => editing && e.stopPropagation()}
                >
                  {editing ? (
                    <input
                      type="number"
                      value={ability.score}
                      onChange={(e) => handleScoreChange(abilityIndex, parseInt(e.target.value) || 0)}
                      className="w-10 h-10 text-center text-base font-normal bg-transparent text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 rounded"
                      min={1}
                      max={20}
                    />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center text-base font-normal text-gray-100">
                      {ability.score}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 w-full max-w-[130px]">
                <div
                  className={`flex items-center justify-between px-2 py-1.5 bg-gray-800/50 rounded-md border border-gray-700/50 ${
                    !editing ? 'cursor-pointer hover:bg-gray-700/50 transition-colors' : ''
                  }`}
                  onClick={() => !editing && rollSavingThrow(ability)}
                  title={!editing ? `Jet de sauvegarde 1d20+${ability.savingThrow}` : ''}
                >
                  <div className="flex items-center gap-2">
                    {editing ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSavingThrowChange(abilityIndex);
                        }}
                        className={`w-3.5 h-3.5 rounded border ${
                          ability.savingThrow !== ability.modifier
                            ? 'bg-red-500 border-red-600'
                            : 'border-gray-600 hover:border-gray-500'
                        }`}
                      />
                    ) : (
                      <div
                        className={`w-3.5 h-3.5 rounded border ${
                          ability.savingThrow !== ability.modifier
                            ? 'bg-red-500 border-red-600'
                            : 'border-gray-600'
                        }`}
                      />
                    )}
                    <span className="text-xs text-gray-400">Sauv.</span>
                  </div>
                  <span className="text-base font-medium text-gray-200">
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