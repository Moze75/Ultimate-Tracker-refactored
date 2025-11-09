import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DiceSettings } from '../hooks/useDiceSettings';

interface DiceBox3DProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
  settings: DiceSettings; // ✅ Ajout des settings
}

export function DiceBox3D({ isOpen, onClose, rollData, settings }: DiceBox3DProps) {
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
  const hasShownResultRef = useRef(false);
  
  const rollDataRef = useRef(rollData);
  const pendingResultRef = useRef<{ total: number; rolls: number[]; diceTotal: number } | null>(null);
  const settingsRef = useRef(settings); // ✅ Ref pour les settings

  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

  // ✅ Mettre à jour la ref des settings
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const generateRandomResult = useCallback((formula: string, modifier: number) => {
    console.log('🎲 Génération résultat aléatoire INSTANTANÉ pour:', formula);
    
    const match = formula.match(/(\d+)d(\d+)/i);
    if (!match) {
      return {
        total: Math.floor(Math.random() * 20) + 1 + modifier,
        rolls: [Math.floor(Math.random() * 20) + 1],
        diceTotal: Math.floor(Math.random() * 20) + 1
      };
    }

    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    
    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * diceSize) + 1);
    }
    
    const diceTotal = rolls.reduce((sum, val) => sum + val, 0);
    
    return {
      total: diceTotal + modifier,
      rolls,
      diceTotal
    };
  }, []);

  // ✅ Réinitialiser DiceBox quand les settings changent
  useEffect(() => {
    if (!isOpen) return;
    
    // Si DiceBox existe déjà, on le détruit pour le recréer avec les nouveaux settings
    if (diceBoxRef.current) {
      console.log('🔄 Réinitialisation de DiceBox avec nouveaux paramètres');
      try {
        if (typeof diceBoxRef.current.clear === 'function') {
          diceBoxRef.current.clear();
        }
      } catch (e) {
        console.log('⚠️ Impossible de clear DiceBox');
      }
      diceBoxRef.current = null;
      setIsInitialized(false);
    }
  }, [settings, isOpen]);

  // Initialiser la DiceBox
  useEffect(() => {
    if (diceBoxRef.current) return;
    if (!isOpen) return;

    let mounted = true;

    const initDiceBox = async () => {
      try {
        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

        if (!mounted) return;

        console.log('🎲 Initialisation DiceBox avec settings:', settingsRef.current);

        // ✅ Utiliser les settings pour la configuration
        const box = new DiceBox('#dice-box-overlay', {
          assetPath: '/assets/dice-box/',
          theme: settingsRef.current.theme,
          themeColor: settingsRef.current.themeColor,
          scale: settingsRef.current.scale,
          gravity: settingsRef.current.gravity,
          mass: 1,
          friction: settingsRef.current.friction,
          restitution: settingsRef.current.restitution,
          angularDamping: 0.4,
          linearDamping: 0.5,
          // ✅ Sons conditionnels
          sounds: settingsRef.current.soundsEnabled,
          soundVolume: settingsRef.current.soundsEnabled ? 0.5 : 0,
          onRollComplete: (results: any) => {
            if (!mounted) return;
            
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🎲 onRollComplete APPELÉ');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            if (hasShownResultRef.current) {
              console.log('⚠️ Résultat déjà affiché (force-stop), ignoré');
              return;
            }

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
            }

            const finalTotal = results?.total ?? (diceTotal + (rollDataRef.current?.modifier || 0));

            const finalResult = {
              total: finalTotal,
              rolls: rollValues,
              diceTotal: diceTotal
            };

            console.log('✅ Résultat FINAL:', finalResult);

            hasShownResultRef.current = true;
            pendingResultRef.current = finalResult;
            
            setResult(finalResult);
            setIsRolling(false);
            setShowResult(true);

            setTimeout(() => {
              if (mounted) {
                setIsFadingDice(true);
              }
            }, 500);

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
          console.log('✅ DiceBox initialisé avec thème:', settingsRef.current.theme);
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
  }, [isOpen, onClose, generateRandomResult]);

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
    pendingResultRef.current = null;
    hasShownResultRef.current = false;

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

  // Reset quand on ferme
  useEffect(() => {
    if (!isOpen) {
      lastRollDataRef.current = '';
      setResult(null);
      setIsRolling(false);
      setIsFadingDice(false);
      setIsFadingAll(false);
      setShowResult(false);
      pendingResultRef.current = null;
      hasShownResultRef.current = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

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

  const handleOverlayClick = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖱️ CLIC OVERLAY');
    console.log('   - isRolling:', isRolling);
    console.log('   - showResult:', showResult);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (isRolling) {
      console.log('⚡ ARRÊT FORCÉ - Génération résultat IMMÉDIAT');
      
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      
      hasShownResultRef.current = true;
      setIsFadingDice(true);
      setIsRolling(false);
      
      if (diceBoxRef.current) {
        console.log('🔍 Tentative d\'arrêt de la simulation...');
        
        if (typeof diceBoxRef.current.clear === 'function') {
          console.log('  → Appel de clear()');
          try { diceBoxRef.current.clear(); } catch (e) { console.log('  ✗ Échec clear()'); }
        }
        if (typeof diceBoxRef.current.clearDice === 'function') {
          console.log('  → Appel de clearDice()');
          try { diceBoxRef.current.clearDice(); } catch (e) { console.log('  ✗ Échec clearDice()'); }
        }
        if (typeof diceBoxRef.current.hide === 'function') {
          console.log('  → Appel de hide()');
          try { diceBoxRef.current.hide(); } catch (e) { console.log('  ✗ Échec hide()'); }
        }
      }
      
      if (rollDataRef.current) {
        const randomResult = generateRandomResult(
          rollDataRef.current.diceFormula,
          rollDataRef.current.modifier
        );
        
        console.log('✅ Résultat aléatoire IMMÉDIAT:', randomResult);
        
        pendingResultRef.current = randomResult;
        setResult(randomResult);
        setShowResult(true);
        
        closeTimeoutRef.current = setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        handleClose();
      }
      
    } else if (showResult) {
      console.log('👋 Fermeture (résultat affiché)');
      handleClose();
    } else {
      console.log('👋 Fermeture normale');
      handleClose();
    }
  }, [isRolling, showResult, handleClose, generateRandomResult]);

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