import React, { useEffect, useRef, useState, useCallback } from 'react';

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
  const [result, setResult] = useState<{ total: number; rolls: number[]; diceTotal: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFadingDice, setIsFadingDice] = useState(false);
  const [isFadingAll, setIsFadingAll] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const currentRollIdRef = useRef<number>(0);
  const lastRollDataRef = useRef<string>('');
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownResultRef = useRef(false); // ✅ Éviter le double affichage
  
  const rollDataRef = useRef(rollData);
  const pendingResultRef = useRef<{ total: number; rolls: number[]; diceTotal: number } | null>(null);

  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

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
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎲 onRollComplete APPELÉ');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // ✅ Extraire les valeurs depuis results.sets
            let rollValues: number[] = [];
            let diceTotal = 0;
            
            if (Array.isArray(results?.sets)) {
              results.sets.forEach((set: any) => {
                if (Array.isArray(set?.rolls)) {
                  set.rolls.forEach((roll: any) => {
                    if (typeof roll?.value === 'number') {
                      rollValues.push(roll.value);
                    }
                  });
                }
              });
              
              diceTotal = rollValues.reduce((sum: number, val: number) => sum + val, 0);
              console.log('✅ Valeurs extraites:', rollValues, 'Total:', diceTotal);
            }

            const finalTotal = results?.total ?? (diceTotal + (rollDataRef.current?.modifier || 0));

            const finalResult = {
              total: finalTotal,
              rolls: rollValues,
              diceTotal: diceTotal
            };

            console.log('✅ Résultat FINAL:', finalResult);

            // ✅ Annuler l'interval de vérification si actif
            if (checkIntervalRef.current) {
              console.log('✅ Annulation du checkInterval');
              clearInterval(checkIntervalRef.current);
              checkIntervalRef.current = null;
            }

            // ✅ Annuler l'auto-close pour éviter le double affichage
            if (closeTimeoutRef.current) {
              console.log('✅ Annulation de l\'auto-close précédent');
              clearTimeout(closeTimeoutRef.current);
              closeTimeoutRef.current = null;
            }

            // ✅ Stocker dans la ref
            pendingResultRef.current = finalResult;
            
            // ✅ Si on n'a pas déjà affiché un résultat, l'afficher maintenant
            if (!hasShownResultRef.current) {
              console.log('✅ Affichage du résultat (premier)');
              setResult(finalResult);
              setIsRolling(false);
              setIsCalculating(false);
              setShowResult(true);
              hasShownResultRef.current = true;

              // Fade les dés après 500ms
              setTimeout(() => {
                if (mounted) {
                  setIsFadingDice(true);
                }
              }, 500);

              // Fermer automatiquement après 3 secondes
              closeTimeoutRef.current = setTimeout(() => {
                if (mounted) {
                  setIsFadingAll(true);
                  setTimeout(() => {
                    onClose();
                  }, 300);
                }
              }, 3000);
            } else {
              console.log('⚠️ Résultat déjà affiché, ignoré');
            }
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
          setIsCalculating(false);
        }
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [onClose]);

  // Lancer les dés quand rollData change
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) {
      return;
    }

    const rollSignature = JSON.stringify(rollData);
    
    if (rollSignature === lastRollDataRef.current) {
      return;
    }

    lastRollDataRef.current = rollSignature;
    currentRollIdRef.current += 1;
    const thisRollId = currentRollIdRef.current;

    console.log('🎲 Nouveau lancer #' + thisRollId + ':', rollData);

    setIsRolling(true);
    setResult(null);
    setShowResult(false);
    setIsFadingDice(false);
    setIsFadingAll(false);
    setIsCalculating(false);
    pendingResultRef.current = null;
    hasShownResultRef.current = false; // ✅ Reset du flag

    let notation = rollData.diceFormula;
    if (rollData.modifier !== 0) {
      notation += rollData.modifier >= 0 
        ? `+${rollData.modifier}` 
        : `${rollData.modifier}`;
    }

    console.log('🎲 Notation:', notation);

    try {
      setTimeout(() => {
        if (thisRollId === currentRollIdRef.current && diceBoxRef.current) {
          console.log('🎲 Exécution de roll()');
          diceBoxRef.current.roll(notation);
        }
      }, 100);
    } catch (error) {
      console.error('❌ Erreur lancer de dés:', error);
      setIsRolling(false);
      setIsCalculating(false);
    }
  }, [isOpen, rollData, isInitialized]);

  // Reset quand on ferme
  useEffect(() => {
    if (!isOpen) {
      lastRollDataRef.current = '';
      setResult(null);
      setIsRolling(false);
      setIsFadingDice(false);
      setIsFadingAll(false);
      setShowResult(false);
      setIsCalculating(false);
      pendingResultRef.current = null;
      hasShownResultRef.current = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }

    setIsFadingAll(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // ✅ Clic pendant le roulement : affichage IMMÉDIAT du popup
  const handleOverlayClick = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖱️ CLIC OVERLAY');
    console.log('   - isRolling:', isRolling);
    console.log('   - showResult:', showResult);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (isRolling) {
      console.log('⏸️ ARRÊT FORCÉ - Affichage IMMÉDIAT du popup');
      
      // Nettoyer les timers
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      
      // ✅ Fade les dés IMMÉDIATEMENT
      setIsFadingDice(true);
      setIsRolling(false);
      
      // ✅ Afficher le popup avec loader IMMÉDIATEMENT
      setIsCalculating(true);
      setShowResult(true);
      
      // ✅ Attendre le résultat avec timeout de 2 secondes
      let attempts = 0;
      const maxAttempts = 20; // 20 × 100ms = 2 secondes
      
      checkIntervalRef.current = setInterval(() => {
        attempts++;
        
        if (pendingResultRef.current && !hasShownResultRef.current) {
          console.log(`✅ Résultat trouvé après ${attempts * 100}ms`);
          clearInterval(checkIntervalRef.current!);
          checkIntervalRef.current = null;
          
          hasShownResultRef.current = true;
          setIsCalculating(false);
          setResult(pendingResultRef.current);
          
          // Fermer après 2s
          closeTimeoutRef.current = setTimeout(() => {
            handleClose();
          }, 2000);
          
        } else if (attempts >= maxAttempts) {
          console.log('⏱️ Timeout 2s : Fermeture sans résultat');
          clearInterval(checkIntervalRef.current!);
          checkIntervalRef.current = null;
          handleClose();
        }
      }, 100);
      
    } else if (showResult) {
      console.log('👋 Fermeture (résultat affiché)');
      handleClose();
    } else {
      console.log('👋 Fermeture normale');
      handleClose();
    }
  }, [isRolling, showResult, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-40 overflow-hidden cursor-pointer transition-opacity duration-300 ${
          isFadingAll ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: 'transparent' }}
      >
        <div 
          id="dice-box-overlay"
          ref={containerRef} 
          className={`absolute top-0 left-0 w-screen h-screen pointer-events-none transition-opacity duration-300 ${
            isFadingDice ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ 
            touchAction: 'none',
            maxWidth: '100vw',
            maxHeight: '100vh',
            position: 'fixed',
            overflow: 'hidden'
          }}
        />
      </div>

      {showResult && (
        <div 
          className={`fixed z-50 pointer-events-none transition-opacity duration-300 ${
            isFadingAll ? 'opacity-0' : 'opacity-100'
          }`}
          style={{
            position: 'fixed',
            top: '50vh',
            left: '50vw',
            transform: 'translate(-50%, -50%)',
            willChange: 'transform'
          }}
        >
          <div className="bg-gradient-to-r from-purple-900/95 to-blue-900/95 backdrop-blur-md rounded-xl border border-purple-500/50 p-8 shadow-2xl animate-[fadeIn_0.3s_ease-in]">
            <div className="text-center">
              <p className="text-sm text-purple-200 mb-2">{rollDataRef.current?.attackName}</p>
              
              {isCalculating ? (
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-400 mb-4"></div>
                  <p className="text-purple-300 text-lg">Calcul du résultat...</p>
                </div>
              ) : result ? (
                <>
                  <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                    {result.total}
                  </div>
                  <div className="text-sm text-gray-300">
                    {result.rolls.length > 0 ? (
                      <>
                        Dés: [{result.rolls.join(', ')}] = {result.diceTotal}
                        {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                          <span> {rollDataRef.current.modifier >= 0 ? ' + ' : ' - '}{Math.abs(rollDataRef.current.modifier)}</span>
                        )}
                      </>
                    ) : (
                      <>
                        {rollDataRef.current?.diceFormula}: {result.diceTotal}
                        {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                          <span> {rollDataRef.current.modifier >= 0 ? ' + ' : ' - '}{Math.abs(rollDataRef.current.modifier)}</span>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleClose}
        className={`fixed z-50 p-2 bg-gray-900/80 hover:bg-gray-800/90 rounded-lg border border-gray-700 transition-all duration-300 ${
          isFadingAll ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem'
        }}
        title="Fermer"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </>
  );
}