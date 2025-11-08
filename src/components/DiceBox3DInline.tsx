import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface DiceBox3DInlineProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
}

export function DiceBox3DInline({ isOpen, onClose, rollData }: DiceBox3DInlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceBoxRef = useRef<any>(null);
  const [result, setResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [containerReady, setContainerReady] = useState(false);

  // S'assurer que le container est rendu
  useEffect(() => {
    if (isOpen && containerRef.current) {
      console.log('✅ Container ref existe:', containerRef.current);
      setContainerReady(true);
    } else if (!isOpen) {
      setContainerReady(false);
    }
  }, [isOpen]);

  // Initialiser la DiceBox quand le container est prêt
  useEffect(() => {
    if (!containerReady || !isOpen) return;
    if (diceBoxRef.current) return;

    let mounted = true;

    const initDiceBox = async () => {
      try {
        console.log('🎲 Début initialisation DiceBox...');
        
        // Attendre que le DOM soit stable
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const container = document.querySelector('#dice-box-overlay');
        console.log('🎲 Recherche container:', container);
        
        if (!container) {
          console.error('❌ Container #dice-box-overlay introuvable dans le DOM');
          console.log('DOM actuel:', document.body.innerHTML.substring(0, 500));
          return;
        }

        console.log('✅ Container trouvé, dimensions:', {
          width: container.clientWidth,
          height: container.clientHeight
        });

        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;
        console.log('✅ Module DiceBox chargé');

        if (!mounted) {
          console.log('⚠️ Composant démonté, abandon');
          return;
        }

        console.log('🎲 Création de la DiceBox...');
        const box = new DiceBox('#dice-box-overlay', {
          assetPath: 'https://unpkg.com/@3d-dice/dice-box@1.1.5/dist/assets/',
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
            
            console.log('🎲 Résultats bruts:', results);
            
            const rolls = results?.rolls || [];
            const total = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll?.value || 0);
            }, 0);

            const finalResult = {
              total: total + (rollData?.modifier || 0),
              rolls: rolls.map((r: any) => r?.value || 0)
            };

            console.log('🎲 Résultat final:', finalResult);

            setResult(finalResult);
            setIsRolling(false);

            // Auto-fermer après 3 secondes
            setTimeout(() => {
              onClose();
            }, 3000);
          }
        });

        console.log('🎲 Initialisation de la box...');
        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsInitialized(true);
          console.log('✅✅✅ DiceBox complètement initialisée !');
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
  }, [containerReady, isOpen]);

  // Lancer les dés quand rollData change
  useEffect(() => {
if (!isOpen || !rollData) {
  return;
}

console.log('🔍 État:', { 
  isOpen, 
  hasRollData: !!rollData, 
  hasDiceBox: !!diceBoxRef.current, 
  isInitialized,
  containerReady 
});

if (!diceBoxRef.current) {
  console.warn('⚠️ DiceBox pas encore initialisée, on attend...');
  return;
}

if (!isInitialized) {
  console.warn('⚠️ Initialisation pas terminée, on attend...');
  return;
}

    console.log('🎲 Préparation du lancer:', rollData);

    const timer = setTimeout(() => {
      if (!diceBoxRef.current) {
        console.warn('⚠️ DiceBox non disponible');
        return;
      }

      setIsRolling(true);
      setResult(null);

      let notation = rollData.diceFormula;
      if (rollData.modifier !== 0) {
        notation += rollData.modifier >= 0 
          ? `+${rollData.modifier}` 
          : `${rollData.modifier}`;
      }

      console.log('🎲 Lancer avec notation:', notation);

      try {
        diceBoxRef.current.clear();
        
        setTimeout(() => {
          if (diceBoxRef.current) {
            console.log('🎲 ROLL!');
            diceBoxRef.current.roll(notation);
          }
        }, 100);
      } catch (error) {
        console.error('❌ Erreur lors du lancer:', error);
        setIsRolling(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, rollData, isInitialized]);

  // Reset quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setIsRolling(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay fullscreen avec dés 3D - TOUJOURS VISIBLE QUAND isOpen */}
      <div 
        id="dice-box-overlay"
        ref={containerRef} 
        className="fixed inset-0 z-50 pointer-events-none"
        style={{ 
          width: '100vw', 
          height: '100vh',
          backgroundColor: 'transparent'
        }}
      />

      {/* Badge du lancer en haut à droite */}
      <div className="fixed top-4 right-4 z-[60] animate-in slide-in-from-top duration-300">
        <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-xl rounded-xl border border-purple-500/50 shadow-2xl shadow-purple-900/50 p-4 min-w-[280px]">
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
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors pointer-events-auto"
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
                {!isInitialized ? '⏳ Initialisation...' : '🎲 Lancer en cours...'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop semi-transparent cliquable */}
      <div 
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] animate-in fade-in duration-300 pointer-events-auto"
        onClick={onClose}
      />
    </>
  );
}