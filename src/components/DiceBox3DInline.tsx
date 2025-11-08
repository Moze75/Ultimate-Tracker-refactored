import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface DiceBox3DProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceBox3D({ isOpen, onClose, rollData }: DiceBox3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceBoxRef = useRef<any>(null);
  const [result, setResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  // Initialiser la DiceBox
  useEffect(() => {
    if (!isOpen || !containerRef.current || diceBoxRef.current) return;

    let mounted = true;

    const initDiceBox = async () => {
      try {
        // Import dynamique pour lazy loading
        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

        if (!mounted || !containerRef.current) return;

        const box = new DiceBox(containerRef.current, {
          assetPath: '/assets/dice-box/',
          theme: 'default',
          themeColor: '#8b5cf6',
          scale: 6,
          gravity: 2,
          mass: 1,
          friction: 0.8,
          restitution: 0.3,
          linearDamping: 0.5,
          angularDamping: 0.4,
          spinForce: 6,
          throwForce: 5,
          startingHeight: 8,
          settleTimeout: 5000,
          offscreen: false,
          delay: 10,

          onRollComplete: (results: any) => {
            if (!mounted) return;
            
            const rolls = results.rolls || [];
            const total = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll.value || 0);
            }, 0);

            setResult({
              total: total + (rollData?.modifier || 0),
              rolls: rolls.map((r: any) => r.value)
            });
            setIsRolling(false);
          }
        });

        await box.init();
        
        if (mounted) {
          diceBoxRef.current = box;
        }
      } catch (error) {
        console.error('Erreur initialisation DiceBox:', error);
        if (mounted) {
          setIsRolling(false);
        }
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
      if (diceBoxRef.current) {
        diceBoxRef.current.clear();
        diceBoxRef.current = null;
      }
    };
  }, [isOpen]);

  // Lancer les dés quand rollData change
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || isRolling) return;

    setIsRolling(true);
    setResult(null);

    // Construire la notation (ex: "1d20+3")
    const notation = rollData.modifier >= 0
      ? `${rollData.diceFormula}+${rollData.modifier}`
      : `${rollData.diceFormula}${rollData.modifier}`;

    try {
      diceBoxRef.current.roll(notation);
    } catch (error) {
      console.error('Erreur lancer de dés:', error);
      setIsRolling(false);
    }
  }, [isOpen, rollData, isRolling]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/90 to-blue-900/90 backdrop-blur-md rounded-t-xl border border-purple-500/30 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">
                {rollData?.attackName || 'Lancer de dés'}
              </h3>
              <p className="text-sm text-purple-200">
                {rollData?.diceFormula}
                {rollData && rollData.modifier !== 0 && (
                  <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Scene 3D */}
        <div className="relative bg-gradient-to-b from-gray-900 to-black rounded-b-xl border-x border-b border-purple-500/30 overflow-hidden">
          <div 
            ref={containerRef} 
            className="w-full h-[500px]"
            style={{ touchAction: 'none' }}
          />

          {/* Résultat */}
          {result && !isRolling && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                  {result.total}
                </div>
                <div className="text-sm text-gray-400">
                  Dés: [{result.rolls.join(', ')}]
                  {rollData && rollData.modifier !== 0 && (
                    <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {isRolling && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-xl animate-pulse">
                Lancer en cours...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}