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
  const isInitializingRef = useRef(false);
  const [result, setResult] = useState<{ total: number; rolls: number[] } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialisation de la DiceBox (une seule fois)
  useEffect(() => {
    if (!isOpen) return;
    if (diceBoxRef.current) {
      console.log('✅ DiceBox déjà prête');
      setIsReady(true);
      return;
    }
    if (isInitializingRef.current) {
      console.log('⏳ Initialisation déjà en cours...');
      return;
    }

    isInitializingRef.current = true;
    let mounted = true;

    const initDiceBox = async () => {
      try {
        console.log('🎲 Début initialisation DiceBox...');
        
        // Attendre que le DOM soit prêt
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const container = document.getElementById('dice-box-overlay');
        if (!container) {
          console.error('❌ Container introuvable');
          isInitializingRef.current = false;
          return;
        }

        console.log('✅ Container trouvé:', container.clientWidth, 'x', container.clientHeight);

        // Import dynamique
        const { default: DiceBox } = await import('@3d-dice/dice-box-threejs');
        
        if (!mounted) {
          console.log('⚠️ Composant démonté');
          isInitializingRef.current = false;
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
          delay: 10
        });

        console.log('🎲 Initialisation...');
        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsReady(true);
          isInitializingRef.current = false;
          console.log('✅✅✅ DiceBox prête !');
        }
      } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        isInitializingRef.current = false;
        setIsReady(false);
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  // Lancer les dés
  useEffect(() => {
    if (!isOpen || !rollData || !isReady || !diceBoxRef.current || isRolling) {
      return;
    }

    console.log('🎲 Lancement des dés:', rollData);

    const timer = setTimeout(() => {
      if (!diceBoxRef.current) {
        console.warn('⚠️ DiceBox non disponible');
        return;
      }

      setIsRolling(true);
      setResult(null);

      // ✅ Re-bind du callback pour chaque lancer
      diceBoxRef.current.onRollComplete = (results: any) => {
        console.log('🎯 Résultats bruts:', results);
        
        // ✅ Extraire les valeurs des dés depuis sets
        const sets = results?.sets || [];
        const rolls: number[] = [];
        
        sets.forEach((set: any) => {
          if (set?.rolls) {
            set.rolls.forEach((roll: any) => {
              rolls.push(roll?.value || 0);
            });
          }
        });
        
        console.log('🎲 Dés extraits:', rolls);
        
        // dice-box calcule déjà le total avec le modificateur
        const finalResult = {
          total: results?.total || 0,
          rolls: rolls
        };

        console.log('✅ Résultat final:', finalResult);

        setResult(finalResult);
        setIsRolling(false);
        
        // ❌ PAS DE AUTO-CLOSE - L'utilisateur doit cliquer
      };

      // Construire la notation
      let notation = rollData.diceFormula;
      if (rollData.modifier !== 0) {
        notation += rollData.modifier >= 0 
          ? `+${rollData.modifier}` 
          : `${rollData.modifier}`;
      }

      console.log('🎲 Notation:', notation);

      try {
        // Nettoyer la scène
        if (diceBoxRef.current.clear) {
          diceBoxRef.current.clear();
        }
        
        // Petit délai avant le roll
        setTimeout(() => {
          if (diceBoxRef.current && diceBoxRef.current.roll) {
            console.log('🎲 ROLL!');
            diceBoxRef.current.roll(notation);
          } else {
            console.error('❌ Méthode roll() non disponible');
            setIsRolling(false);
          }
        }, 150);
      } catch (error) {
        console.error('❌ Erreur lors du lancer:', error);
        setIsRolling(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, rollData, isReady, isRolling]);

  // Reset quand on ferme
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setIsRolling(false);
      
      // Nettoyer la scène 3D
      if (diceBoxRef.current && diceBoxRef.current.clear) {
        try {
          diceBoxRef.current.clear();
        } catch (e) {
          console.warn('⚠️ Erreur lors du clear:', e);
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Container 3D en fullscreen overlay */}
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

      {/* Badge résultat en haut à droite */}
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
              <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 mb-2 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                {result.total}
              </div>
              <div className="text-sm text-gray-300 mb-3">
                {result.rolls.length > 0 ? (
                  <>
                    Dés: <span className="font-mono text-purple-300">[{result.rolls.join(', ')}]</span>
                    {rollData && rollData.modifier !== 0 && (
                      <span className="text-purple-400"> {rollData.modifier >= 0 ? '+' : ''}{rollData.modifier}</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">Calcul en cours...</span>
                )}
              </div>
              <div className="text-xs text-purple-300 italic flex items-center justify-center gap-1">
                <span className="text-lg">👆</span>
                <span>Cliquez n'importe où pour fermer</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-white text-base animate-pulse">
                {!isReady ? '⏳ Initialisation des dés 3D...' : '🎲 Lancer en cours...'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop semi-transparent cliquable - FERME la modale */}
      <div 
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-300 pointer-events-auto cursor-pointer"
        onClick={onClose}
        title="Cliquez pour fermer"
      />
    </>
  );
}