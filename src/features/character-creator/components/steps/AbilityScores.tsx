import React, { useState, useEffect, useMemo } from 'react';
import Button from '../ui/Button';
import Card, { CardContent, CardHeader } from '../ui/Card';
import { calculateModifier, validatePointBuy, standardArray, rollAbilityScore, applyBackgroundBonuses } from '../../utils/dndCalculations';
import { Dice1, RotateCcw, Calculator, TrendingUp, ChevronRight } from 'lucide-react';
import type { DndBackground } from '../../types/character';

interface AbilityScoresProps {
  abilities: Record<string, number>;
  onAbilitiesChange: (abilities: Record<string, number>) => void;
  onNext: () => void;
  onPrevious: () => void;
  selectedBackground?: DndBackground | null;
  onEffectiveAbilitiesChange?: (abilities: Record<string, number>) => void; 
}

const abilityNames = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

export default function AbilityScores({
  abilities,
  onAbilitiesChange,
  onNext,
  onPrevious,
  selectedBackground = null,
  customBackgroundData = null,
  onEffectiveAbilitiesChange
}: AbilityScoresProps) {
  const [method, setMethod] = useState<'pointbuy' | 'array' | 'roll'>('pointbuy');

  // ✅ Créer un objet d'historique unifié (standard ou personnalisé)
  const effectiveBackground = useMemo(() => {
    // Si on a un historique personnalisé avec des abilityScores
    if (customBackgroundData && customBackgroundData.abilityScores && customBackgroundData.abilityScores.length > 0) {
      return {
        name: customBackgroundData.name,
        abilityScores: customBackgroundData.abilityScores,
        isCustom: true,
      };
    }
    // Sinon, utiliser l'historique standard
    if (selectedBackground) {
      return {
        name: selectedBackground.name,
        abilityScores: selectedBackground.abilityScores,
        isCustom: false,
      };
    }
    return null;
  }, [selectedBackground, customBackgroundData]);
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [assignedScores, setAssignedScores] = useState<Record<string, number>>({});
  const [bgMode, setBgMode] = useState<'twoPlusOne' | 'oneOneOne'>('twoPlusOne');
  const [bgAssignments, setBgAssignments] = useState<{ plusTwo?: string; plusOne?: string }>({});

  const effectiveAbilities = useMemo(() => {
    if (!effectiveBackground) return abilities;
    return applyBackgroundBonuses(abilities, effectiveBackground.abilityScores, bgMode, bgAssignments);
  }, [abilities, effectiveBackground, bgMode, bgAssignments]);
  useEffect(() => {
    onEffectiveAbilitiesChange?.(effectiveAbilities);
  }, [effectiveAbilities, onEffectiveAbilitiesChange]);

  useEffect(() => {
    setBgAssignments({});
  }, [effectiveBackground, bgMode]);

  useEffect(() => {
    if (method === 'pointbuy') {
      const defaultScores = abilityNames.reduce((acc, ability) => {
        acc[ability] = 8;
        return acc;
      }, {} as Record<string, number>);
      onAbilitiesChange(defaultScores);
    } else if (method === 'array') {
      setAssignedScores({});
      onAbilitiesChange({});
    } else if (method === 'roll') {
      rollAllAbilities();
    }
  }, [method]);

  const rollAllAbilities = () => {
    const newScores = Array.from({ length: 6 }, () => rollAbilityScore());
    setRolledScores(newScores);
    setAssignedScores({});
    onAbilitiesChange({});
  };

  const handlePointBuyChange = (ability: string, value: number) => {
    const newAbilities = { ...abilities, [ability]: value };
    onAbilitiesChange(newAbilities);
  };

  const assignScore = (ability: string, scoreIndex: number) => {
    if (method === 'array') {
      const newAssigned = { ...assignedScores };
      
      Object.keys(newAssigned).forEach(key => {
        if (newAssigned[key] === scoreIndex) {
          delete newAssigned[key];
        }
      });
      
      if (newAssigned[ability] !== undefined) {
        delete newAssigned[ability];
      }
      
      newAssigned[ability] = scoreIndex;
      setAssignedScores(newAssigned);
      
      const newAbilities = { ...abilities };
      newAbilities[ability] = standardArray[scoreIndex];
      onAbilitiesChange(newAbilities);
    } else if (method === 'roll') {
      const newAssigned = { ...assignedScores };
      
      Object.keys(newAssigned).forEach(key => {
        if (newAssigned[key] === scoreIndex) {
          delete newAssigned[key];
        }
      });
      
      if (newAssigned[ability] !== undefined) {
        delete newAssigned[ability];
      }
      
      newAssigned[ability] = scoreIndex;
      setAssignedScores(newAssigned);
      
      const newAbilities = { ...abilities };
      newAbilities[ability] = rolledScores[scoreIndex];
      onAbilitiesChange(newAbilities);
    }
  };

  const pointBuyValidation = method === 'pointbuy' ? validatePointBuy(abilities) : { valid: true, pointsUsed: 0, errors: [] };
  const isArrayComplete = method === 'array' && Object.keys(assignedScores).length === 6;
  const isRollComplete = method === 'roll' && Object.keys(assignedScores).length === 6;

  const isBackgroundComplete =
    !effectiveBackground
      ? true
      : (bgMode === 'oneOneOne' || (!!bgAssignments.plusTwo && !!bgAssignments.plusOne && bgAssignments.plusTwo !== bgAssignments.plusOne));

  const canProceed =
    ((method === 'pointbuy' && pointBuyValidation.valid) || isArrayComplete || isRollComplete) && isBackgroundComplete;

  return (
    <div className="wizard-step space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Déterminez vos caractéristiques</h2>
        <p className="text-gray-400">Choisissez votre méthode de génération des scores</p>
      </div>

      <div className="flex justify-center space-x-4 mb-6">
        <Button
          variant={method === 'pointbuy' ? 'primary' : 'secondary'}
          onClick={() => setMethod('pointbuy')}
          size="sm"
        >
          <Calculator className="w-4 h-4 mr-2" />
          Point Buy
        </Button>
        <Button
          variant={method === 'array' ? 'primary' : 'secondary'}
          onClick={() => setMethod('array')}
          size="sm"
        >
          Tableau standard
        </Button>
        <Button
          variant={method === 'roll' ? 'primary' : 'secondary'}
          onClick={() => setMethod('roll')}
          size="sm"
        >
          <Dice1 className="w-4 h-4 mr-2" />
          Lancer de dés
        </Button>
      </div>

      {method === 'pointbuy' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Point Buy System</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Points utilisés:</span>
                <span className={`text-lg font-bold ${pointBuyValidation.pointsUsed > 27 ? 'text-red-400' : 'text-white'}`}>
                  {pointBuyValidation.pointsUsed}/27
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {abilityNames.map((ability) => {
                const baseVal = abilities[ability] ?? 8;
                const effVal = effectiveAbilities[ability] ?? baseVal;
                const bonus = effVal - baseVal;
                const baseMod = calculateModifier(baseVal);
                const effMod = calculateModifier(effVal);

                return (
                  <div key={ability} className="relative p-4 rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/50 hover:border-gray-600/50 transition-all space-y-3">
                    {/* En-tête avec nom et badge bonus */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-semibold text-gray-200">{ability}</span>
                      {bonus !== 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-900/30 border border-emerald-600/40">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs font-medium text-emerald-400">+{bonus}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Scores et modificateurs */}
                    <div className="flex items-center justify-between bg-gray-900/40 rounded-lg p-3 border border-gray-700/30">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Score</span>
                        <div className="flex items-baseline gap-1.5">
                          {bonus !== 0 ? (
                            <>
                              <span className="text-xl font-bold text-white">{effVal}</span>
                              <span className="text-xs text-gray-500">({baseVal}</span>
                              <span className="text-xs text-emerald-400 font-medium">+{bonus}</span>
                              <span className="text-xs text-gray-500">)</span>
                            </>
                          ) : (
                            <span className="text-xl font-bold text-white">{baseVal}</span>
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                      
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">Mod</span>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-2xl font-bold ${effMod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {effMod >= 0 ? '+' : ''}{effMod}
                          </span>
                          {bonus !== 0 && baseMod !== effMod && (
                            <span className="text-xs text-gray-500">
                              ({baseMod >= 0 ? '+' : ''}{baseMod})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Slider */}
                    <div className="space-y-1.5">
                      <input
                        type="range"
                        min="8"
                        max="15"
                        value={baseVal}
                        onChange={(e) => handlePointBuyChange(ability, parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-red-500/80 hover:accent-red-500"
                        style={{
                          background: `linear-gradient(to right, rgb(239 68 68 / 0.5) 0%, rgb(239 68 68 / 0.5) ${((baseVal - 8) / 7) * 100}%, rgb(55 65 81 / 0.5) ${((baseVal - 8) / 7) * 100}%, rgb(55 65 81 / 0.5) 100%)`
                        }}
                      />
                      <div className="flex justify-between px-0.5">
                        <span className="text-[10px] text-gray-600">8</span>
                        <span className="text-[10px] text-gray-600">15</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {pointBuyValidation.errors.length > 0 && (
              <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                <ul className="text-red-400 text-sm space-y-1">
                  {pointBuyValidation.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {method === 'array' && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-white">Tableau Standard</h3>
            <p className="text-sm text-gray-400 mt-1">Assignez les scores suivants à vos caractéristiques</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Scores disponibles */}
              <div className="grid grid-cols-6 gap-2">
                {standardArray.map((score, index) => {
                  const mod = calculateModifier(score);
                  const isUsed = Object.values(assignedScores).includes(index);
                  return (
                    <div
                      key={index}
                      className={`relative text-center py-3 px-2 rounded-lg border-2 transition-all ${
                        isUsed
                          ? 'border-gray-700 bg-gray-800/20 opacity-30'
                          : 'border-red-500/40 bg-gradient-to-br from-red-900/10 to-red-900/5 hover:border-red-500/60 hover:bg-red-900/15'
                      }`}
                    >
                      <div className="text-xl font-bold text-white">{score}</div>
                      <div className={`text-sm font-semibold ${mod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {mod >= 0 ? '+' : ''}{mod}
                      </div>
                      {isUsed && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-gray-600 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Assignations */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {abilityNames.map((ability) => {
                  const assignedIndex = assignedScores[ability];
                  const baseVal = abilities[ability] ?? 0;
                  const effVal = effectiveAbilities[ability] ?? baseVal;
                  const bonus = effVal - baseVal;
                  const baseMod = baseVal > 0 ? calculateModifier(baseVal) : 0;
                  const effMod = baseVal > 0 ? calculateModifier(effVal) : 0;

                  return (
                    <div key={ability} className="p-4 rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-base font-semibold text-gray-200">{ability}</label>
                        {bonus !== 0 && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-900/30 border border-emerald-600/40">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span className="text-xs font-medium text-emerald-400">+{bonus}</span>
                          </div>
                        )}
                      </div>

                      <select
                        value={assignedIndex !== undefined ? assignedIndex : ''}
                        onChange={(e) => e.target.value && assignScore(ability, parseInt(e.target.value))}
                        className="input-dark w-full text-sm"
                      >
                        <option value="">Sélectionner un score...</option>
                        {standardArray.map((score, index) => {
                          const mod = calculateModifier(score);
                          return (
                            <option
                              key={index}
                              value={index}
                              disabled={Object.values(assignedScores).includes(index) && assignedScores[ability] !== index}
                            >
                              {score} (modificateur: {mod >= 0 ? '+' : ''}{mod})
                            </option>
                          );
                        })}
                      </select>
                      
                      {baseVal > 0 && (
                        <div className="flex items-center justify-between bg-gray-900/40 rounded-lg p-2.5 border border-gray-700/30">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Score final</span>
                            <div className="flex items-baseline gap-1">
                              {bonus !== 0 ? (
                                <>
                                  <span className="text-lg font-bold text-white">{effVal}</span>
                                  <span className="text-[10px] text-gray-500">({baseVal}+{bonus})</span>
                                </>
                              ) : (
                                <span className="text-lg font-bold text-white">{baseVal}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Modificateur</span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-xl font-bold ${effMod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {effMod >= 0 ? '+' : ''}{effMod}
                              </span>
                              {bonus !== 0 && baseMod !== effMod && (
                                <span className="text-[10px] text-gray-500">
                                  ({baseMod >= 0 ? '+' : ''}{baseMod})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {method === 'roll' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">Lancer de dés</h3>
                <p className="text-sm text-gray-400 mt-1">4d6, garder les 3 meilleurs</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={rollAllAbilities}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Relancer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Scores tirés */}
              <div className="grid grid-cols-6 gap-2">
                {rolledScores.map((score, index) => {
                  const mod = calculateModifier(score);
                  const isUsed = Object.values(assignedScores).includes(index);
                  return (
                    <div
                      key={index}
                      className={`relative text-center py-3 px-2 rounded-lg border-2 transition-all ${
                        isUsed
                          ? 'border-gray-700 bg-gray-800/20 opacity-30'
                          : 'border-red-500/40 bg-gradient-to-br from-red-900/10 to-red-900/5 hover:border-red-500/60 hover:bg-red-900/15'
                      }`}
                    >
                      <div className="text-xl font-bold text-white">{score}</div>
                      <div className={`text-sm font-semibold ${mod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {mod >= 0 ? '+' : ''}{mod}
                      </div>
                      {isUsed && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-0.5 h-full bg-gray-600 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Assignations */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {abilityNames.map((ability) => {
                  const assignedIndex = assignedScores[ability];
                  const baseVal = abilities[ability] ?? 0;
                  const effVal = effectiveAbilities[ability] ?? baseVal;
                  const bonus = effVal - baseVal;
                  const baseMod = baseVal > 0 ? calculateModifier(baseVal) : 0;
                  const effMod = baseVal > 0 ? calculateModifier(effVal) : 0;

                  return (
                    <div key={ability} className="p-4 rounded-lg bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-base font-semibold text-gray-200">{ability}</label>
                        {bonus !== 0 && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-900/30 border border-emerald-600/40">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span className="text-xs font-medium text-emerald-400">+{bonus}</span>
                          </div>
                        )}
                      </div>

                      <select
                        value={assignedIndex !== undefined ? assignedIndex : ''}
                        onChange={(e) => e.target.value && assignScore(ability, parseInt(e.target.value))}
                        className="input-dark w-full text-sm"
                      >
                        <option value="">Sélectionner un score...</option>
                        {rolledScores.map((score, index) => {
                          const mod = calculateModifier(score);
                          return (
                            <option
                              key={index}
                              value={index}
                              disabled={Object.values(assignedScores).includes(index) && assignedScores[ability] !== index}
                            >
                              {score} (modificateur: {mod >= 0 ? '+' : ''}{mod})
                            </option>
                          );
                        })}
                      </select>
                      
                      {baseVal > 0 && (
                        <div className="flex items-center justify-between bg-gray-900/40 rounded-lg p-2.5 border border-gray-700/30">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Score final</span>
                            <div className="flex items-baseline gap-1">
                              {bonus !== 0 ? (
                                <>
                                  <span className="text-lg font-bold text-white">{effVal}</span>
                                  <span className="text-[10px] text-gray-500">({baseVal}+{bonus})</span>
                                </>
                              ) : (
                                <span className="text-lg font-bold text-white">{baseVal}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Modificateur</span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-xl font-bold ${effMod >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {effMod >= 0 ? '+' : ''}{effMod}
                              </span>
                              {bonus !== 0 && baseMod !== effMod && (
                                <span className="text-[10px] text-gray-500">
                                  ({baseMod >= 0 ? '+' : ''}{baseMod})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

          {effectiveBackground && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Bonus d'historique</h3>
              <div className="flex items-center gap-2 ml-auto">
                {effectiveBackground.isCustom && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">
                    Personnalisé
                  </span>
                )}
                <span className="text-sm text-gray-400">{effectiveBackground.name}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  variant={bgMode === 'twoPlusOne' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setBgMode('twoPlusOne')}
                >
                  +2 et +1
                </Button>
                <Button
                  variant={bgMode === 'oneOneOne' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setBgMode('oneOneOne')}
                >
                  +1 +1 +1
                </Button>
              </div>

              <div className="text-xs text-gray-400 p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/30">
                <span className="text-gray-500">Caractéristiques autorisées:</span>{' '}
                <span className="text-gray-200 font-medium">
                  {effectiveBackground.abilityScores.join(' • ')}
                </span>
              </div>

              {bgMode === 'twoPlusOne' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bonus de +2</label>
                    <select
                      className="input-dark w-full"
                      value={bgAssignments.plusTwo ?? ''}
                      onChange={(e) =>
                        setBgAssignments((prev) => ({ ...prev, plusTwo: e.target.value || undefined }))
                      }
                    >
                      <option value="">Sélectionner...</option>
                      {effectiveBackground.abilityScores.map((a) => (
                        <option
                          key={a}
                          value={a}
                          disabled={bgAssignments.plusOne === a}
                        >
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Bonus de +1</label>
                    <select
                      className="input-dark w-full"
                      value={bgAssignments.plusOne ?? ''}
                      onChange={(e) =>
                        setBgAssignments((prev) => ({ ...prev, plusOne: e.target.value || undefined }))
                      }
                    >
                      <option value="">Sélectionner...</option>
                      {effectiveBackground.abilityScores.map((a) => (
                        <option
                          key={a}
                          value={a}
                          disabled={bgAssignments.plusTwo === a}
                        >
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-blue-900/20 border border-blue-700/50 text-sm text-blue-200">
                  ✓ Bonus de +1 appliqué automatiquement à: {effectiveBackground.abilityScores.join(', ')}
                </div>
              )}

              {!isBackgroundComplete && (
                <div className="p-2.5 rounded-lg bg-yellow-900/20 border border-yellow-700/50 text-sm text-yellow-200 flex items-start gap-2">
                  <span>⚠️</span>
                  <span>Sélectionnez deux caractéristiques différentes pour continuer</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between pt-6">
        <Button
          onClick={onPrevious}
          variant="secondary"
          size="lg"
        >
          Précédent
        </Button>
        <Button
          onClick={onNext}
          disabled={!canProceed}
          size="lg"
          className="min-w-[200px]"
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}