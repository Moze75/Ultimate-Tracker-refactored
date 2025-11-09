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
  const currentRollIdRef = useRef<number>(0);
  const lastRollDataRef = useRef<string>('');
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ REF pour stocker rollData et le résultat
  const rollDataRef = useRef(rollData);
  const pendingResultRef = useRef<{ total: number; rolls: number[]; diceTotal: number } | null>(null);

  // ✅ Mettre à jour rollDataRef quand rollData change
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
            
            console.log('🎲 Résultats bruts onRollComplete:', results);
            console.log('🎲 rollDataRef.current:', rollDataRef.current);
            
            const rolls = results?.rolls || [];
            const diceTotal = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll?.value || 0);
            }, 0);

            // ✅ CORRECTION : Utiliser le total calculé par la bibliothèque
            // La bibliothèque retourne results.value qui inclut déjà le modificateur
            let finalTotal: number;
            
            if (typeof results?.value === 'number') {
              // La bibliothèque a calculé le total (avec modificateur inclus)
              finalTotal = results.value;
              console.log('✅ Utilisation du total de la bibliothèque:', finalTotal);
            } else if (typeof results?.total === 'number') {
              // Fallback au cas où c'est dans results.total
              finalTotal = results.total;
              console.log('✅ Utilisation du total (fallback):', finalTotal);
            } else {
              // Fallback : calculer manuellement
              const modifier = rollDataRef.current?.modifier || 0;
              finalTotal = diceTotal + modifier;
              console.log('⚠️ Calcul manuel du total:', finalTotal);
            }

            const finalResult = {
              total: finalTotal,
              rolls: rolls.map((r: any) => r?.value || 0),
              diceTotal: diceTotal
            };

            console.log('✅ Résultat calculé:', finalResult);
            console.log('   - Dés:', finalResult.rolls, '= ', finalResult.diceTotal);
            console.log('   - Modificateur:', rollDataRef.current?.modifier);
            console.log('   - Total:', finalResult.total);

            // ✅ Stocker IMMÉDIATEMENT dans la ref
            pendingResultRef.current = finalResult;
            
            // Puis dans le state
            setResult(finalResult);
            setIsRolling(false);
            setShowResult(true);

            // ✅ Fermer automatiquement après 3 secondes
            closeTimeoutRef.current = setTimeout(() => {
              if (mounted) {
                setIsFadingAll(true);
                setTimeout(() => {
                  onClose();
                }, 300);
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
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [onClose]);

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
    setShowResult(false);
    setIsFadingDice(false);
    setIsFadingAll(false);
    pendingResultRef.current = null;

    // Construire la notation
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
    }
  }, [isOpen, rollData, isInitialized]);

  // Reset du flag quand on ferme
  useEffect(() => {
    if (!isOpen) {
      lastRollDataRef.current = '';
      setResult(null);
      setIsRolling(false);
      setIsFadingDice(false);
      setIsFadingAll(false);
      setShowResult(false);
      pendingResultRef.current = null;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // ✅ Fonction de fermeture complète avec fade
  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    setIsFadingAll(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  // ✅ Gestion du clic sur l'overlay
  const handleOverlayClick = useCallback(() => {
    console.log('🖱️ Clic overlay');
    console.log('   - isRolling:', isRolling);
    console.log('   - showResult:', showResult);
    console.log('   - result:', result);
    console.log('   - pendingResultRef.current:', pendingResultRef.current);
    
    if (isRolling) {
      console.log('⏸️ Arrêt forcé du jet');
      
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      
      setIsFadingDice(true);
      setIsRolling(false);
      
      if (pendingResultRef.current) {
        console.log('✅ Résultat disponible, affichage immédiat');
        setResult(pendingResultRef.current);
        setShowResult(true);
        
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        console.log('⏳ Pas de résultat, attente 500ms...');
        // ✅ Attendre un peu au cas où le résultat arrive juste après
        setTimeout(() => {
          if (pendingResultRef.current) {
            console.log('✅ Résultat trouvé après attente');
            setResult(pendingResultRef.current);
            setShowResult(true);
            setTimeout(() => {
              handleClose();
            }, 2000);
          } else {
            console.log('❌ Toujours pas de résultat, fermeture');
            handleClose();
          }
        }, 500);
      }
    } else {
      console.log('👋 Fermeture normale');
      handleClose();
    }
  }, [isRolling, showResult, result, handleClose]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-40 overflow-hidden cursor-pointer transition-opacity duration-300 ${
          isFadingDice || isFadingAll ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: 'transparent' }}
      >
        <div 
          id="dice-box-overlay"
          ref={containerRef} 
          className="absolute top-0 left-0 w-screen h-screen pointer-events-none"
          style={{ 
            touchAction: 'none',
            maxWidth: '100vw',
            maxHeight: '100vh',
            position: 'fixed',
            overflow: 'hidden'
          }}
        />
      </div>

      {result && showResult && (
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
              <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                {result.total}
              </div>
              <div className="text-sm text-gray-300">
                Dés: [{result.rolls.join(', ')}] = {result.diceTotal}
                {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                  <span> {rollDataRef.current.modifier >= 0 ? ' + ' : ' - '}{Math.abs(rollDataRef.current.modifier)}</span>
                )}
              </div>
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