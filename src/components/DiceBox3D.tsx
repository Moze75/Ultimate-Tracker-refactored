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
  const [result, setResult] = useState<{ total: number; rolls: number[]; diceTotal: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFadingDice, setIsFadingDice] = useState(false);
  const [isFadingAll, setIsFadingAll] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const currentRollIdRef = useRef<number>(0);
  const lastRollDataRef = useRef<string>('');
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
            
            const rolls = results?.rolls || [];
            const diceTotal = rolls.reduce((sum: number, roll: any) => {
              return sum + (roll?.value || 0);
            }, 0);

            const modifier = rollData?.modifier || 0;

            const finalResult = {
              total: diceTotal + modifier,
              rolls: rolls.map((r: any) => r?.value || 0),
              diceTotal: diceTotal
            };

            console.log('✅ Résultat calculé:', finalResult);

            setResult(finalResult);
            setIsRolling(false);
            setShowResult(true);

            // ✅ Fermer automatiquement après 3 secondes
            closeTimeoutRef.current = setTimeout(() => {
              if (mounted) {
                handleClose();
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
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
      }
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
    setShowResult(false);
    setIsFadingDice(false);
    setIsFadingAll(false);

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
      setIsFadingDice(false);
      setIsFadingAll(false);
      setShowResult(false);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      if (resultTimeoutRef.current) {
        clearTimeout(resultTimeoutRef.current);
        resultTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // ✅ Fonction de fermeture complète avec fade
  const handleClose = () => {
    // Annuler tous les timeouts
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (resultTimeoutRef.current) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }

    setIsFadingAll(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // ✅ Gestion du clic sur l'overlay
  const handleOverlayClick = () => {
    console.log('🖱️ Clic overlay - isRolling:', isRolling, 'showResult:', showResult, 'result:', result);
    
    // ✅ Si le jet est en cours
    if (isRolling) {
      console.log('⏸️ Arrêt du jet en cours');
      
      // Annuler le timeout de fermeture auto si existant
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      
      // Fade les dés mais PAS le reste
      setIsFadingDice(true);
      setIsRolling(false);
      
      // ✅ Attendre que le résultat arrive (max 1 seconde)
      let waited = 0;
      const checkInterval = setInterval(() => {
        waited += 50;
        
        if (result) {
          console.log('✅ Résultat trouvé après', waited, 'ms:', result);
          clearInterval(checkInterval);
          
          // Afficher le résultat
          setShowResult(true);
          
          // Fermer après 2 secondes
          resultTimeoutRef.current = setTimeout(() => {
            handleClose();
          }, 2000);
        } else if (waited >= 1000) {
          console.log('⏱️ Timeout - pas de résultat après 1s');
          clearInterval(checkInterval);
          handleClose();
        }
      }, 50);
      
    } else {
      // ✅ Sinon, fermer normalement
      console.log('👋 Fermeture normale');
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ✅ Overlay cliquable - fade séparé pour les dés */}
      <div 
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-40 overflow-hidden cursor-pointer transition-opacity duration-300 ${
          isFadingDice || isFadingAll ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ 
          backgroundColor: 'transparent'
        }}
      >
        {/* ✅ Conteneur 3D */}
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

      {/* ✅ Résultat - fade SEULEMENT avec isFadingAll, PAS isFadingDice */}
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
              <p className="text-sm text-purple-200 mb-2">{rollData?.attackName}</p>
              <div className="text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-3">
                {result.total}
              </div>
              <div className="text-sm text-gray-300">
                Dés: [{result.rolls.join(', ')}] = {result.diceTotal}
                {rollData && rollData.modifier !== 0 && (
                  <span> {rollData.modifier >= 0 ? ' + ' : ' - '}{Math.abs(rollData.modifier)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Bouton fermer - fade SEULEMENT avec isFadingAll */}
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