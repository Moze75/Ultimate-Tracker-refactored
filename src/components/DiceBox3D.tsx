/**
 * This component uses @3d-dice/dice-box-threejs
 * Copyright (c) 2022 3D Dice - MIT License
 * https://github.com/3d-dice/dice-box-threejs
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS } from '../hooks/useDiceSettings';
import { createPortal } from 'react-dom';
import { useDiceHistory } from '../hooks/useDiceHistory';
import { audioManager } from '../utils/audioManager';
import { getDiceBoxInstance, updateDiceBoxSettings } from '../utils/diceBoxInstance';

interface DiceBox3DProps {
  isOpen: boolean;
  onClose: () => void;
  rollData: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null;
  settings?: DiceSettings;
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
  
  const effectiveSettings = settings || DEFAULT_DICE_SETTINGS;
  const settingsRef = useRef(effectiveSettings);

  const { addRoll } = useDiceHistory();

  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

  // ✅ Fonction pour jouer le son du lancement de dés
  const playDiceDropSound = useCallback(() => {
    audioManager.play('/assets/dice-box/sounds/dice-drop/dice_drop.mp3', 0.6);
  }, []);

  // 🔧 Débloquer l'audio au premier clic sur mobile
  useEffect(() => {
    if (isOpen) {
      audioManager.unlock();
    }
  }, [isOpen]);

  // Fonction pour jouer le son du résultat
  const playResultSound = useCallback(() => {
    audioManager.play('/assets/dice-box/sounds/dicepopup/dice_results.mp3', 0.5);
  }, []);

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

  // ✅ Initialiser UNE SEULE FOIS au montage du composant
  useEffect(() => {
    let mounted = true;

    const initDiceBox = async () => {
      if (!containerRef.current) return;

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎲 [INIT] Initialisation UNIQUE de DiceBox...');
        console.log('🎲 [INIT] Theme:', effectiveSettings.theme);
        console.log('🎲 [INIT] Material:', effectiveSettings.themeMaterial);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ✅ Utiliser le singleton au lieu de créer une nouvelle instance
        const box = await getDiceBoxInstance(
          '#dice-box-overlay',
          effectiveSettings
        );

        if (!mounted) return;

        // ✅ Override le callback onRollComplete pour ce composant
        box.onRollComplete = (results: any) => {
          if (!mounted) return;
          if (hasShownResultRef.current) return;

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
          const finalResult = { total: finalTotal, rolls: rollValues, diceTotal: diceTotal };

          hasShownResultRef.current = true;
          setResult(finalResult);
          setIsRolling(false);
          setShowResult(true);

          // ✅ Enregistrer dans l'historique
          if (rollDataRef.current) {
            addRoll({
              attackName: rollDataRef.current.attackName,
              diceFormula: rollDataRef.current.diceFormula,
              modifier: rollDataRef.current.modifier,
              total: finalResult.total,
              rolls: finalResult.rolls,
              diceTotal: finalResult.diceTotal,
            });
          }
          
          // Jouer le son du résultat
          playResultSound();
        };

        // 🔧 Forcer les dimensions au viewport visible
        if (containerRef.current) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          console.log(`📐 Dimensions viewport: ${viewportWidth}x${viewportHeight}`);
          
          containerRef.current.style.width = `${viewportWidth}px`;
          containerRef.current.style.height = `${viewportHeight}px`;
        }

        diceBoxRef.current = box;
        setIsInitialized(true);
        console.log('✅ DiceBox prêt !');

      } catch (error) {
        console.error('❌ Erreur init DiceBox:', error);
        if (mounted) setIsRolling(false);
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      // 🔧 Arrêter les sons (ne pas nettoyer complètement)
      if (typeof audioManager !== 'undefined' && audioManager.stopAll) {
        audioManager.stopAll();
      }
    };
  }, []); // ✅ Dépendances vides = initialisation UNE SEULE FOIS

  // ✅ Gérer les changements de settings SANS réinitialisation complète
  useEffect(() => {
    const settingsChanged = JSON.stringify(settingsRef.current) !== JSON.stringify(effectiveSettings);
    
    if (settingsChanged && isInitialized) {
      console.log('🔧 Settings modifiés, mise à jour sans réinitialisation...');
      updateDiceBoxSettings(effectiveSettings);
      settingsRef.current = effectiveSettings;
    }
  }, [effectiveSettings, isInitialized]);

  // ✅ Lancer les dés
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) return;

    const rollSignature = JSON.stringify(rollData);
    if (rollSignature === lastRollDataRef.current) return;

    lastRollDataRef.current = rollSignature;
    currentRollIdRef.current += 1;
    const thisRollId = currentRollIdRef.current;

    console.log('🎲 Lancer #' + thisRollId);

    if (typeof diceBoxRef.current.clear === 'function') {
      diceBoxRef.current.clear();
    }

    setIsRolling(true);
    setResult(null);
    setShowResult(false);
    setIsFadingDice(false);
    setIsFadingAll(false);
    pendingResultRef.current = null;
    hasShownResultRef.current = false;

    let notation = rollData.diceFormula;
    if (rollData.modifier !== 0) {
      notation += rollData.modifier >= 0 ? `+${rollData.modifier}` : `${rollData.modifier}`;
    }

    // ✅ Jouer le son IMMÉDIATEMENT (avant requestAnimationFrame)
    playDiceDropSound();

    // Lancement des dés juste après
    requestAnimationFrame(() => {
      if (thisRollId === currentRollIdRef.current && diceBoxRef.current) {
        console.log('🚀 Lancement immédiat !');
        diceBoxRef.current.roll(notation);
      }
    });
  }, [rollData, isInitialized, playDiceDropSound]);

  // Reset à la fermeture
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
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleOverlayClick = useCallback(() => {
    if (isRolling) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      hasShownResultRef.current = true;
      setIsFadingDice(true);
      setIsRolling(false);
      
      if (diceBoxRef.current && typeof diceBoxRef.current.clear === 'function') {
        diceBoxRef.current.clear();
      }
      
      if (rollDataRef.current) {
        const randomResult = generateRandomResult(rollDataRef.current.diceFormula, rollDataRef.current.modifier);
        setResult(randomResult);
        setShowResult(true);

        // ✅ Sauvegarder le résultat lors de l'interruption
        addRoll({
          attackName: rollDataRef.current.attackName,
          diceFormula: rollDataRef.current.diceFormula,
          modifier: rollDataRef.current.modifier,
          total: randomResult.total,
          rolls: randomResult.rolls,
          diceTotal: randomResult.diceTotal,
        });
        
        // Jouer le son aussi lors de l'arrêt forcé
        playResultSound();
        
        closeTimeoutRef.current = setTimeout(() => handleClose(), 2000);
      } else {
        handleClose();
      }
    } else if (showResult) {
      handleClose();
    } else {
      handleClose();
    }
  }, [isRolling, showResult, handleClose, generateRandomResult, playResultSound, addRoll]);

  if (!isOpen) return null;

  return createPortal(
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
          className={`pointer-events-none transition-opacity duration-300 ${
            isFadingDice ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ 
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            touchAction: 'none',
            overflow: 'hidden',
            pointerEvents: 'none'
          }}
        />
      </div>

      {result && showResult && (
        <div 
          className={`fixed z-50 pointer-events-none transition-all duration-500 ${
            isFadingAll ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
          }`}
          style={{
            position: 'fixed',
            top: '50vh',
            left: '50vw',
            transform: 'translate(-50%, -50%)',
            willChange: 'transform, opacity',
            filter: isFadingAll ? 'blur(10px)' : 'blur(0px)'
          }}
        >
          {/* Aura démoniaque pulsante */}
          <div className="absolute inset-0 animate-pulse">
            <div className="absolute inset-0 bg-red-900/30 blur-3xl rounded-full scale-150"></div>
            <div className="absolute inset-0 bg-orange-600/20 blur-2xl rounded-full scale-125 animate-[pulse_2s_ease-in-out_infinite]"></div>
          </div>

          {/* Particules de feu flottantes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-orange-500 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 2}s`,
                  opacity: 0.3 + Math.random() * 0.7,
                  boxShadow: '0 0 10px currentColor'
                }}
              />
            ))}
          </div>

          {/* Conteneur principal */}
          <div className="relative">
            {/* Bordure de flammes */}
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-lg blur-sm animate-[pulse_1.5s_ease-in-out_infinite]"></div>
            
            {/* Fond noir pur */}
            <div className="relative bg-black rounded-lg border-2 border-red-900/50 shadow-2xl overflow-hidden">
              {/* Contenu */}
              <div className="relative px-12 py-10 text-center">
                {/* Titre avec effet gravé */}
                <p className="text-xs tracking-[0.3em] uppercase text-red-400 mb-3 font-serif" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {rollDataRef.current?.attackName}
                </p>
                
                {/* Résultat principal - style forgé dans les flammes */}
                <div className="relative mb-4">
                  {/* Lueur derrière le nombre */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-9xl font-black text-red-600/30 blur-xl scale-110">
                      {result.total}
                    </div>
                  </div>
                  
                  {/* Nombre principal avec effet métal brûlant */}
                  <div 
                    className="relative text-8xl font-black tracking-tight"
                    style={{
                      background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 30%, #dc2626 60%, #7f1d1d 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      textShadow: '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.4)',
                      filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.9))'
                    }}
                  >
                    {result.total}
                  </div>
                </div>

                {/* Détails avec runes */}
                <div className="text-sm text-red-200/80 font-serif">
                  {result.rolls.length > 0 ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-red-800">⟨</span>
                      <span className="tracking-wide">
                        Dés: [{result.rolls.join(' • ')}] = {result.diceTotal}
                      </span>
                      {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                        <>
                          <span className="text-orange-400 font-bold">
                            {rollDataRef.current.modifier >= 0 ? ' + ' : ' − '}
                            {Math.abs(rollDataRef.current.modifier)}
                          </span>
                        </>
                      )}
                      <span className="text-red-800">⟩</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-red-800">⟨</span>
                      <span className="tracking-wide">
                        {rollDataRef.current?.diceFormula}: {result.diceTotal}
                      </span>
                      {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                        <>
                          <span className="text-orange-400 font-bold">
                            {rollDataRef.current.modifier >= 0 ? ' + ' : ' − '}
                            {Math.abs(rollDataRef.current.modifier)}
                          </span>
                        </>
                      )}
                      <span className="text-red-800">⟩</span>
                    </div>
                  )}
                </div>

                {/* Ligne de séparation runique */}
                <div className="mt-4 flex items-center justify-center gap-2 text-red-900/50 text-xs">
                  <span>⸎</span>
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-red-900/50 to-transparent"></div>
                  <span>✦</span>
                  <div className="h-px w-16 bg-gradient-to-r from-transparent via-red-900/50 to-transparent"></div>
                  <span>⸎</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}