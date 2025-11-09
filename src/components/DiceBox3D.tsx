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
  const currentRollIdRef = useRef<number>(0);
  const lastRollDataRef = useRef<string>('');

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
          gravity: 1,
          mass: 1,
          friction: 0.8,
          restitution: 0,
          angularDamping: 0.4,
          linearDamping: 0.5,
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
              if (mounted) {
                onClose();
              }
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
    };
  }, []);

  // Lancer les dés quand rollData change
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) {
      return;
    }

    // ✅ Créer une signature unique pour ce rollData
    const rollSignature = JSON.stringify(rollData);
    
    // ✅ Éviter de relancer si c'est le même rollData
    if (rollSignature === lastRollDataRef.current) {
      return;
    }

    lastRollDataRef.current = rollSignature;
    currentRollIdRef.current += 1;
    const thisRollId = currentRollIdRef.current;

    console.log('🎲 Nouveau lancer #' + thisRollId + ':', rollData);

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
      // ✅ Petit délai pour laisser le DOM se mettre à jour
      setTimeout(() => {
        if (thisRollId === currentRollIdRef.current && diceBoxRef.current) {
          diceBoxRef.current.roll(notation);
        }
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lancer de dés:', error);
      setIsRolling(false);
    }
  }, [isOpen, rollData, isInitialized]);

  // Reset du flag quand on ferme
  useEffect(() => {
    if (!isOpen) {
      lastRollDataRef.current = '';
      setResult(null);
      setIsRolling(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay transparent couvrant tout l'écran */}
      <div 
        className="fixed inset-0 z-40"
        style={{ 
          backgroundColor: 'transparent',
          pointerEvents: isRolling ? 'none' : 'auto' // ✅ Désactive les clics pendant le lancer
        }}
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
          <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-xl border border-purple-500/50 p-8 shadow-2xl animate-[fadeIn_0.3s_ease-in]">
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
          <div className="bg-purple-900/90 backdrop-blur-sm rounded-full px-6 py-3 border border-purple-500/50 animate-pulse">
            <div className="text-white text-lg font-semibold">
              🎲 {rollData?.attackName}
            </div>
          </div>
        </div>
      )}

      {/* Bouton fermer (visible seulement quand pas de lancer en cours) */}
      {!isRolling && (
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 p-2 bg-gray-900/80 hover:bg-gray-800/90 rounded-lg border border-gray-700 transition-colors"
          title="Fermer (ou attendre la fermeture automatique)"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </>
  );
} 