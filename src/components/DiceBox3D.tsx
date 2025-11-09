import React, { useEffect, useRef, useState } from 'react';

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
  const hasRolledRef = useRef(false); // ✅ Éviter les jets multiples

  // Initialiser la DiceBox UNE SEULE FOIS au montage
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
          onRollComplete: (results: any) => {
            if (!mounted) return;
            
            console.log('🎲 Résultats bruts:', results);
            
            const rolls = results?.rolls || [];
            const total = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll?.value || 0);
            }, 0);

            setResult({
              total: total + (rollData?.modifier || 0),
              rolls: rolls.map((r: any) => r?.value || 0)
            });
            setIsRolling(false);

            // ✅ Fermer automatiquement après 3 secondes
            setTimeout(() => {
              onClose();
            }, 3000);
          }
        });

        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsInitialized(true);
          console.log('✅ DiceBox initialisé');
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
      // ⚠️ Ne PAS détruire la DiceBox pour réutilisation
    };
  }, []);

  // Lancer les dés quand rollData change
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) {
      return;
    }

    // ✅ Éviter les jets multiples pour le même rollData
    if (hasRolledRef.current) {
      return;
    }

    console.log('🎲 Nouveau lancer:', rollData);

    hasRolledRef.current = true;
    setIsRolling(true);
    setResult(null);

    // Construire la notation
    let notation = rollData.diceFormula;
    if (rollData.modifier !== 0) {
      notation += rollData.modifier >= 0 
        ? `+${rollData.modifier}` 
        : `${rollData.modifier}`;
    }

    console.log('🎲 Notation:', notation);

    try {
      // ✅ Clear les dés précédents avant nouveau lancer
      diceBoxRef.current.clear();
      
      // ✅ Petit délai pour laisser le clear s'effectuer
      setTimeout(() => {
        diceBoxRef.current.roll(notation);
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lancer de dés:', error);
      setIsRolling(false);
      hasRolledRef.current = false;
    }
  }, [isOpen, rollData, isInitialized]);

  // Reset du flag quand on ferme
  useEffect(() => {
    if (!isOpen) {
      hasRolledRef.current = false;
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay transparent couvrant tout l'écran */}
      <div 
        className="fixed inset-0 z-40 pointer-events-auto"
        style={{ backgroundColor: 'transparent' }}
      >
        <div 
          id="dice-box-overlay"
          ref={containerRef} 
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        />
      </div>

      {/* Résultat en overlay */}
      {result && !isRolling && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
          <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-xl border border-purple-500/50 p-8 shadow-2xl">
            <div className="text-center">
              <p className="text-sm text-purple-200 mb-2">{rollData?.attackName}</p>
              <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                {result.total}
              </div>
              <div className="text-sm text-gray-300">
                Dés: [{result.rolls.join(', ')}]
                {rollData && rollData.modifier !== 0 && (
                  <span> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur de chargement */}
      {!isInitialized && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-black/80 backdrop-blur-sm rounded-xl p-6">
            <div className="text-center">
              <img 
                src="/icons/wmremove-transformed.png" 
                alt="Chargement..." 
                className="animate-spin h-12 w-12 mx-auto mb-4 object-contain"
                style={{ backgroundColor: 'transparent' }}
              />
              <div className="text-white text-lg">Initialisation des dés 3D...</div>
            </div>
          </div>
        </div>
      )}

      {/* Indicateur de lancer */}
      {isRolling && isInitialized && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-purple-900/90 backdrop-blur-sm rounded-full px-6 py-3 border border-purple-500/50">
            <div className="text-white text-lg animate-pulse font-semibold">
              🎲 {rollData?.attackName}
            </div>
          </div>
        </div>
      )}
    </>
  );
} 