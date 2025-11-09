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
  const [isCalculating, setIsCalculating] = useState(false); // ✅ Nouveau state pour le loader
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

  // ✅ Fonction pour parser la formule de dés et générer un résultat aléatoire
  const generateRandomResult = useCallback((formula: string, modifier: number) => {
    console.log('🎲 Génération résultat aléatoire pour:', formula);
    
    // Parser la formule (ex: "1d20", "2d6", "3d8")
    const match = formula.match(/(\d+)d(\d+)/i);
    if (!match) {
      console.warn('⚠️ Formule invalide, utilisation par défaut');
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
            console.log('🎲🎲🎲 DEBUG COMPLET onRollComplete 🎲🎲🎲');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📦 Type de results:', typeof results);
            console.log('📦 Keys de results:', results ? Object.keys(results) : 'null');
            console.log('📦 results complet (JSON):');
            try {
              console.log(JSON.stringify(results, null, 2));
            } catch (e) {
              console.log('(non-sérialisable)', results);
            }
            console.log('📦 results.rolls:', results?.rolls);
            console.log('📦 results.value:', results?.value);
            console.log('📦 results.total:', results?.total);
            console.log('📦 rollDataRef.current:', rollDataRef.current);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            // ✅ Extraire les valeurs des dés
            let rollValues: number[] = [];
            let diceTotal = 0;
            
            // Tentative 1 : results.rolls est un tableau
            if (Array.isArray(results?.rolls)) {
              console.log('✅ results.rolls est un tableau, longueur:', results.rolls.length);
              
              // Vérifier la structure de chaque élément
              results.rolls.forEach((roll: any, index: number) => {
                console.log(`   Roll[${index}]:`, roll);
                console.log(`   - Type:`, typeof roll);
                console.log(`   - Keys:`, roll ? Object.keys(roll) : 'null');
                console.log(`   - roll.value:`, roll?.value);
                console.log(`   - roll.qty:`, roll?.qty);
                console.log(`   - roll.sides:`, roll?.sides);
              });
              
              // Extraire les valeurs
              rollValues = results.rolls.map((r: any) => {
                if (typeof r === 'number') return r;
                if (r?.value !== undefined) return r.value;
                if (r?.qty !== undefined) return r.qty;
                return 0;
              }).filter((v: number) => v > 0);
              
              diceTotal = rollValues.reduce((sum: number, val: number) => sum + val, 0);
              console.log('✅ Valeurs extraites:', rollValues, 'Total:', diceTotal);
            } else {
              console.log('⚠️ results.rolls n\'est pas un tableau ou est undefined');
            }

            // ✅ Récupérer le total final
            let finalTotal: number;
            const modifier = rollDataRef.current?.modifier || 0;
            
            if (typeof results?.value === 'number') {
              finalTotal = results.value;
              console.log('✅ Utilisation de results.value:', finalTotal);
              
              // Si on n'a pas les valeurs individuelles, calculer à rebours
              if (rollValues.length === 0 && finalTotal > 0) {
                diceTotal = finalTotal - modifier;
                console.log('⚠️ Calcul à rebours: diceTotal =', diceTotal);
                // On ne peut pas reconstituer les valeurs individuelles
                rollValues = []; // Rester vide pour affichage alternatif
              }
            } else if (typeof results?.total === 'number') {
              finalTotal = results.total;
              console.log('✅ Utilisation de results.total:', finalTotal);
              
              if (rollValues.length === 0 && finalTotal > 0) {
                diceTotal = finalTotal - modifier;
                console.log('⚠️ Calcul à rebours: diceTotal =', diceTotal);
                rollValues = [];
              }
            } else {
              // Fallback : calcul manuel
              finalTotal = diceTotal + modifier;
              console.log('⚠️ Calcul manuel du total:', finalTotal);
            }

            const finalResult = {
              total: finalTotal,
              rolls: rollValues,
              diceTotal: diceTotal
            };

            console.log('✅✅✅ Résultat FINAL:', finalResult);
            console.log('   - Total:', finalResult.total);
            console.log('   - Rolls:', finalResult.rolls);
            console.log('   - DiceTotal:', finalResult.diceTotal);
            console.log('   - Modifier:', modifier);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            // ✅ Stocker IMMÉDIATEMENT dans la ref
            pendingResultRef.current = finalResult;
            
            // Puis dans le state
            setResult(finalResult);
            setIsRolling(false);
            setIsCalculating(false); // ✅ Arrêter le loader
            setShowResult(true);

            // ✅ Fade les dés après 500ms
            setTimeout(() => {
              if (mounted) {
                setIsFadingDice(true);
              }
            }, 500);

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
    setIsCalculating(false);
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
      setIsCalculating(false);
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
      setIsCalculating(false);
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

  // ✅ NOUVELLE LOGIQUE : Gestion du clic sur l'overlay
  const handleOverlayClick = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🖱️ CLIC OVERLAY');
    console.log('   - isRolling:', isRolling);
    console.log('   - showResult:', showResult);
    console.log('   - isCalculating:', isCalculating);
    console.log('   - result:', result);
    console.log('   - pendingResultRef.current:', pendingResultRef.current);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (isRolling) {
      console.log('⏸️ ARRÊT FORCÉ du jet');
      
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      
      // ✅ Fade les dés immédiatement
      setIsFadingDice(true);
      setIsRolling(false);
      
      // ✅ Afficher le loader "Calcul du résultat..."
      setIsCalculating(true);
      setShowResult(true);
      
      // ✅ Vérifier si la bibliothèque a une méthode pour forcer l'arrêt
      if (diceBoxRef.current) {
        console.log('🔍 Méthodes disponibles sur diceBoxRef.current:', Object.keys(diceBoxRef.current));
        
        // Tenter d'appeler une méthode stop/clear si elle existe
        if (typeof diceBoxRef.current.stop === 'function') {
          console.log('✅ Appel de diceBoxRef.current.stop()');
          diceBoxRef.current.stop();
        } else if (typeof diceBoxRef.current.clear === 'function') {
          console.log('✅ Appel de diceBoxRef.current.clear()');
          diceBoxRef.current.clear();
        } else {
          console.log('⚠️ Aucune méthode stop/clear trouvée');
        }
      }
      
      // ✅ Attendre le résultat de la bibliothèque (max 1.5s)
      let attempts = 0;
      const maxAttempts = 15;
      
      const checkInterval = setInterval(() => {
        attempts++;
        console.log(`⏳ Tentative ${attempts}/${maxAttempts} de récupération du résultat...`);
        
        if (pendingResultRef.current) {
          console.log('✅ Résultat trouvé après', attempts * 100, 'ms');
          clearInterval(checkInterval);
          setIsCalculating(false);
          setResult(pendingResultRef.current);
          
          // Fermer après 2s
          closeTimeoutRef.current = setTimeout(() => {
            handleClose();
          }, 2000);
        } else if (attempts >= maxAttempts) {
          console.log('❌ TIMEOUT : Génération d\'un résultat aléatoire');
          clearInterval(checkInterval);
          
          // ✅ Générer un résultat aléatoire en fallback
          if (rollDataRef.current) {
            const randomResult = generateRandomResult(
              rollDataRef.current.diceFormula,
              rollDataRef.current.modifier
            );
            console.log('🎲 Résultat aléatoire généré:', randomResult);
            
            pendingResultRef.current = randomResult;
            setResult(randomResult);
            setIsCalculating(false);
            
            // Fermer après 2s
            closeTimeoutRef.current = setTimeout(() => {
              handleClose();
            }, 2000);
          } else {
            console.log('❌ Impossible de générer un résultat, fermeture');
            handleClose();
          }
        }
      }, 100);
      
    } else if (showResult) {
      console.log('👋 Fermeture (résultat déjà affiché)');
      handleClose();
    } else {
      console.log('👋 Fermeture normale');
      handleClose();
    }
  }, [isRolling, showResult, isCalculating, result, handleClose, generateRandomResult]);

  if (!isOpen) return null;

  return (
    <>
      {/* ✅ Overlay cliquable */}
      <div 
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-40 overflow-hidden cursor-pointer transition-opacity duration-300 ${
          isFadingAll ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: 'transparent' }}
      >
        {/* ✅ Container des dés - fade indépendamment */}
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

      {/* ✅ Popup de résultat OU loader */}
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
              
              {/* ✅ Si en train de calculer, afficher un loader */}
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
                    {/* ✅ Affichage adaptatif selon si on a les valeurs individuelles */}
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

      {/* ✅ Bouton fermer */}
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