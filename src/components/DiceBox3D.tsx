import React, { useEffect, useRef, useState } from 'react';
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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialiser la DiceBox (une seule fois au montage du composant)
  useEffect(() => {
    if (diceBoxRef.current) return;

    let mounted = true;

    const initDiceBox = async () => {
      try {
        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

        if (!mounted) return;

        const box = new DiceBox('#dice-box-overlay', {
          assetPath: '/assets/dice-box/',
          theme: 'default',
          themeColor: '#8b5cf6',
          scale: 6,
          gravity: 2,
          offscreen: true,
          
          onRollComplete: (results: any) => {
            if (!mounted) return;
            
            const rolls = results?.rolls || [];
            const total = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll?.value || 0);
            }, 0);

            setResult({
              total: total + (rollData?.modifier || 0),
              rolls: rolls.map((r: any) => r?.value || 0)
            });
            setIsRolling(false);

            // Auto-fermer après 3 secondes
            setTimeout(() => {
              onClose();
              setResult(null);
            }, 3000);
          }
        });

        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsInitialized(true);
          console.log('✅ DiceBox 3D initialisé');
        }
      } catch (error) {
        console.error('❌ Erreur initialisation DiceBox:', error);
        if (mounted) {
          setIsRolling(false);
        }
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
    };
  }, []);

  // Lancer les dés quand rollData change
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || isRolling || !isInitialized) return;

    setIsRolling(true);
    setResult(null);

    let notation = rollData.diceFormula;
    if (rollData.modifier !== 0) {
      notation += rollData.modifier >= 0 
        ? `+${rollData.modifier}` 
        : `${rollData.modifier}`;
    }

    try {
      diceBoxRef.current.roll(notation);
    } catch (error) {
      console.error('❌ Erreur lancer de dés:', error);
      setIsRolling(false);
    }
  }, [isOpen, rollData, isRolling, isInitialized, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Container 3D en overlay fullscreen - PAS DE BACKDROP */}
      <div 
        id="dice-box-overlay"
        ref={containerRef} 
        className="fixed inset-0 z-40 pointer-events-none"
      />

      {/* Badge résultat en haut à droite */}
      <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top duration-300">
        <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-xl rounded-xl border border-purple-500/50 shadow-2xl shadow-purple-900/50 p-4 min-w-[280px] pointer-events-auto">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h4 className="text-white font-bold text-lg mb-1">
                {rollData?.attackName}
              </h4>
              <p className="text-purple-200 text-sm">
                {rollData?.diceFormula}
                {rollData && rollData.modifier !== 0 && (
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
          {result && !isRolling ? (
            <div className="text-center py-2 animate-in zoom-in duration-300">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 mb-2">
                {result.total}
              </div>
              <div className="text-xs text-gray-300">
                Dés: [{result.rolls.join(', ')}]
                {rollData && rollData.modifier !== 0 && (
                  <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
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