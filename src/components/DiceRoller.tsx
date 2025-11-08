import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface DiceRollerProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceRoller({ isOpen, onClose, rollData }: DiceRollerProps) {
  const [result, setResult] = useState<number | null>(null);
  const [rolls, setRolls] = useState<number[]>([]);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    if (!isOpen || !rollData) return;

    setIsRolling(true);
    setResult(null);
    setRolls([]);

    // Simuler le lancer de dés
    setTimeout(() => {
      const diceMatch = rollData.diceFormula.match(/(\d+)d(\d+)/);
      if (diceMatch) {
        const numDice = parseInt(diceMatch[1]);
        const diceSize = parseInt(diceMatch[2]);
        const newRolls: number[] = [];
        
        for (let i = 0; i < numDice; i++) {
          newRolls.push(Math.floor(Math.random() * diceSize) + 1);
        }
        
        const total = newRolls.reduce((sum, roll) => sum + roll, 0) + rollData.modifier;
        setRolls(newRolls);
        setResult(total);
        setIsRolling(false);

        // Auto-fermeture après 3 secondes
        setTimeout(() => {
          onClose();
        }, 3000);
      }
    }, 500);
  }, [isOpen, rollData, onClose]);

  if (!isOpen || !rollData) return null;

  return (
    <>
      {/* Dés qui roulent en overlay fullscreen (pas de backdrop) */}
      <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
        <div className="relative">
          {/* Animation de dés (vous pouvez ajouter votre propre animation ici) */}
          {isRolling && (
            <div className="text-9xl animate-bounce">
              🎲
            </div>
          )}
        </div>
      </div>

      {/* Résultat en haut à droite */}
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
        <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-xl rounded-xl border border-purple-500/50 shadow-2xl shadow-purple-900/50 p-4 min-w-[280px] pointer-events-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h4 className="text-white font-bold text-lg mb-1">
                {rollData.attackName}
              </h4>
              <p className="text-purple-200 text-sm">
                {rollData.diceFormula}
                {rollData.modifier !== 0 && (
                  <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Résultat */}
          {result !== null && !isRolling ? (
            <div className="text-center py-2 animate-in zoom-in duration-300">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2">
                {result}
              </div>
              <div className="text-xs text-gray-300">
                {rolls.length > 0 && (
                  <>
                    Dés: [{rolls.join(', ')}]
                    {rollData.modifier !== 0 && (
                      <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <div className="text-white text-sm animate-pulse">
                🎲 Lancer en cours...
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}