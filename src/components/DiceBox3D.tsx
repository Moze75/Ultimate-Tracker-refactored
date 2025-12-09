/**
 * This component uses @3d-dice/dice-box-threejs
 * Copyright (c) 2022 3D Dice - MIT License
 * https://github.com/3d-dice/dice-box-threejs
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS, useDiceSettings } from '../hooks/useDiceSettings';
import { createPortal } from 'react-dom';
import { useDiceHistoryContext } from '../hooks/useDiceHistoryContext';
import { audioManager } from '../utils/audioManager';

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

// Mapping des textures par colorset
const COLORSET_TEXTURES: Record<string, string> = {
  'fire': 'fire',
  'ice': 'ice',
  'poison': 'cloudy',
  'acid': 'marble',
  'thunder': 'cloudy',
  'lightning': 'ice',
  'air': 'cloudy',
  'water': 'water',
  'earth': 'speckles',
  'force': 'stars',
  'psychic': 'speckles',
  'necrotic': 'skulls',
  'radiant': 'paper',
  'bronze': 'bronze01',
  'dragons': 'dragon',
  'tigerking': 'tiger',
  'birdup': 'bird',
  'astralsea': 'astral',
  'glitterparty': 'glitter',
  'starynight': 'stars',
  'bloodmoon': 'marble',
  'pinkdreams': 'skulls',
  'breebaby': 'marble',
  'inspired': 'none',
  'black': 'none',
  'white': 'none',
  'rainbow': 'stars',
  'covid': 'skulls',
};

export function DiceBox3D({ isOpen, onClose, rollData }: DiceBox3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const diceBoxRef = useRef<any>(null);
  const [result, setResult] = useState<{ total: number; rolls: number[]; diceTotal: number } | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isFadingDice, setIsFadingDice] = useState(false);
  const [isFadingAll, setIsFadingAll] = useState(false);
  const [showReadyPopup, setShowReadyPopup] = useState(false);
  const [showResult, setShowResult] = useState(false);
  
  const currentRollIdRef = useRef<number>(0);
  const lastRollDataRef = useRef<string>('');
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownResultRef = useRef(false);
  const rollDataRef = useRef(rollData);

  const { settings: contextSettings } = useDiceSettings();
  const effectiveSettings = contextSettings ?? DEFAULT_DICE_SETTINGS;
  const { addRoll } = useDiceHistoryContext();

  // Mise à jour de la ref pour l'accès dans les callbacks
  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

  // --- Gestion Audio ---
  const applyVolume = useCallback((enabled: boolean, vol: number) => {
    if (!diceBoxRef.current) return;
    diceBoxRef.current.sounds = enabled;
    diceBoxRef.current.volume = enabled ? vol : 0;
  }, []);

  const playDiceDropSound = useCallback(() => {
    if (effectiveSettings.soundsEnabled) {
      const fx = Math.max(0, Math.min(100, effectiveSettings.fxVolume ?? 50));
      const vol = Math.pow(fx / 100, 1.5);
      audioManager.play('/assets/dice-box/sounds/dice-drop/dice_drop.mp3', vol);
    }
  }, [effectiveSettings]);

  const playResultSound = useCallback(() => {
    if (effectiveSettings.soundsEnabled) {
      const fx = Math.max(0, Math.min(100, effectiveSettings.fxVolume ?? 50));
      const vol = Math.pow(fx / 100, 1.5);
      audioManager.play('/assets/dice-box/sounds/dicepopup/dice_results.mp3', vol);
    }
  }, [effectiveSettings]);

  useEffect(() => {
    if (isOpen) audioManager.unlock();
  }, [isOpen]);

  // --- Logique de Résultat ---
  
  // Fonction stable pour traiter le résultat (utilisée par callback ET promise)
  const processRollResult = useCallback((results: any) => {
    if (hasShownResultRef.current) {
        setIsRolling(false);
        return;
    }

    console.log('🏁 [ROLL] Résultat reçu:', results);

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

    const currentModifier = rollDataRef.current?.modifier || 0;
    const finalTotal = results?.total ?? (diceTotal + currentModifier);
    const finalResult = { total: finalTotal, rolls: rollValues, diceTotal: diceTotal };

    hasShownResultRef.current = true;
    setResult(finalResult);
    setIsRolling(false);
    setShowResult(true);
    
    try { playResultSound(); } catch (e) { /* noop */ }

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
  }, [playResultSound, addRoll]);

  const generateRandomResult = useCallback((formula: string, modifier: number) => {
    console.log('🎲 Génération résultat aléatoire de secours pour:', formula);
    const match = formula.match(/(\d+)d(\d+)/i);
    if (!match) {
      return { total: Math.floor(Math.random() * 20) + 1 + modifier, rolls: [Math.floor(Math.random() * 20) + 1], diceTotal: Math.floor(Math.random() * 20) + 1 };
    }
    const numDice = parseInt(match[1]);
    const diceSize = parseInt(match[2]);
    const rolls: number[] = [];
    for (let i = 0; i < numDice; i++) {
      rolls.push(Math.floor(Math.random() * diceSize) + 1);
    }
    const diceTotal = rolls.reduce((sum, val) => sum + val, 0);
    return { total: diceTotal + modifier, rolls, diceTotal };
  }, []);


  // --- INITIALISATION (Une seule fois) ---
  useEffect(() => {
    let mounted = true;

    const initDiceBox = async () => {
      if (diceBoxRef.current && isInitialized) return;

      try {
        console.log('🎲 [INIT] Démarrage DiceBox...');
        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;
        if (!mounted) return;

        const textureForTheme = effectiveSettings.theme ? (COLORSET_TEXTURES[effectiveSettings.theme] || '') : 'none';

        const config = {
          assetPath: '/assets/dice-box/',
          theme_colorset: effectiveSettings.theme || 'custom',
          theme_texture: textureForTheme,
          theme_customColorset: !effectiveSettings.theme ? {
            name: 'custom',
            foreground: '#ffffff',
            background: effectiveSettings.themeColor,
            outline: effectiveSettings.themeColor,
            edge: effectiveSettings.themeColor,
            texture: 'none',
            material: effectiveSettings.themeMaterial
          } : undefined,
          theme_material: effectiveSettings.themeMaterial || "plastic",
          baseScale: effectiveSettings.baseScale * 100 / 6,
          gravity_multiplier: effectiveSettings.gravity * 400,
          strength: effectiveSettings.strength * 1.3,
          sounds: effectiveSettings.soundsEnabled,
          volume: effectiveSettings.soundsEnabled ? effectiveSettings.volume : 0,
          onRollComplete: processRollResult, // Callback initial
        };

        const box = new DiceBox('#dice-box-overlay', config);

        if (containerRef.current) {
          containerRef.current.style.width = '100vw';
          containerRef.current.style.height = '100vh';
          containerRef.current.style.position = 'fixed';
          containerRef.current.style.top = '0';
          containerRef.current.style.left = '0';
        }
        
        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsInitialized(true);
          console.log('✅ DiceBox Ready!');
        }

        applyVolume(effectiveSettings.soundsEnabled, effectiveSettings.volume);
        setShowReadyPopup(true);
        setTimeout(() => setShowReadyPopup(false), 2500);

      } catch (error) {
        console.error('❌ Erreur init:', error);
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dépendances vides pour init unique


  // --- MISE À JOUR DES SETTINGS (Sans casser le moteur) ---
  useEffect(() => {
    if (!diceBoxRef.current || !isInitialized) return;

    const updateSettings = async () => {
      console.log('🔧 [UPDATE] Mise à jour configuration...');
      
      const textureForTheme = effectiveSettings.theme ? (COLORSET_TEXTURES[effectiveSettings.theme] || '') : 'none';

      const customColorset = !effectiveSettings.theme ? {
        name: 'custom',
        foreground: '#ffffff',
        background: effectiveSettings.themeColor,
        outline: effectiveSettings.themeColor,
        edge: effectiveSettings.themeColor,
        texture: 'none',
        material: effectiveSettings.themeMaterial || 'plastic'
      } : undefined;

      // Nettoyage soft
      if (typeof diceBoxRef.current.clearDice === 'function') {
        diceBoxRef.current.clearDice();
      }

      // Vider le cache de matériaux si accessible, sans casser l'objet principal
      if (diceBoxRef.current.DiceFactory) {
         diceBoxRef.current.DiceFactory.materials_cache = {};
      }

      // Mise à jour standard
      await diceBoxRef.current.updateConfig({
        theme_colorset: effectiveSettings.theme || 'custom',
        theme_texture: textureForTheme,
        theme_material: effectiveSettings.themeMaterial || "plastic",
        theme_customColorset: customColorset,
        baseScale: effectiveSettings.baseScale * 100 / 6,
        gravity_multiplier: effectiveSettings.gravity * 400,
        strength: effectiveSettings.strength * 1.3,
        sounds: effectiveSettings.soundsEnabled,
        volume: effectiveSettings.soundsEnabled ? effectiveSettings.volume : 0,
        onRollComplete: processRollResult // On réinjecte le callback
      });

      // Ré-appliquer la gravité manuellement si nécessaire
      try {
        if (diceBoxRef.current.world) {
            const world: any = diceBoxRef.current.world;
            const grav = (effectiveSettings.gravity || 1) * 400 * -9.8;
            if (world.gravity?.set) world.gravity.set(0, 0, grav);
            else if (world.gravity) world.gravity.z = grav;
            
            // Réveiller les objets
             if (Array.isArray(world.bodies)) {
                world.bodies.forEach((b: any) => b.wakeUp?.());
            }
        }
      } catch (e) { console.warn('Gravity update error', e); }
      
      applyVolume(effectiveSettings.soundsEnabled, effectiveSettings.volume);
    };

    updateSettings();
  }, [effectiveSettings, isInitialized, applyVolume, processRollResult]);


  // --- LANCEMENT DU ROLL ---
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) return;

    const rollSignature = JSON.stringify(rollData);
    if (rollSignature === lastRollDataRef.current) return;

    lastRollDataRef.current = rollSignature;
    currentRollIdRef.current += 1;
    const thisRollId = currentRollIdRef.current;

    console.log('🎲 [ROLL] Nouveau lancer demandé');

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

    playDiceDropSound();

    requestAnimationFrame(() => {
      if (thisRollId === currentRollIdRef.current && diceBoxRef.current) {
        // 1. Assurer que le callback est attaché
        diceBoxRef.current.onRollComplete = processRollResult;

        // 2. Lancer
        const rollResult = diceBoxRef.current.roll(notation);

        // 3. Tenter d'utiliser la PROMESSE (Méthode robuste)
        if (rollResult && typeof rollResult.then === 'function') {
            console.log('✨ [ROLL] Utilisation de la Promise pour le résultat');
            rollResult.then((results: any) => {
                processRollResult(results);
            }).catch((err: any) => {
                console.error('Erreur Promise Roll:', err);
            });
        } else {
            console.log('⚠️ [ROLL] Pas de Promise, fallback sur callback');
        }
      }
    });
  }, [rollData, isInitialized, isOpen, playDiceDropSound, processRollResult]);


  // --- FERMETURE ET NETTOYAGE ---
  useEffect(() => {
    if (!isOpen) {
      lastRollDataRef.current = '';
      setResult(null);
      setIsRolling(false);
      setIsFadingDice(false);
      setIsFadingAll(false);
      setShowResult(false);
      hasShownResultRef.current = false;
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      
      if (diceBoxRef.current?.clearDice) {
        diceBoxRef.current.clearDice();
      }
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setIsFadingAll(true);
    setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleOverlayClick = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);

    if (isRolling) {
      // Force le résultat instantané si on clique pendant le roulement
      hasShownResultRef.current = true;
      setIsFadingDice(true);
      setIsRolling(false);
      
      if (diceBoxRef.current?.clearDice) diceBoxRef.current.clearDice();
      
      if (rollDataRef.current) {
        const randomResult = generateRandomResult(rollDataRef.current.diceFormula, rollDataRef.current.modifier);
        setResult(randomResult);
        setShowResult(true);
        addRoll({
          attackName: rollDataRef.current.attackName,
          diceFormula: rollDataRef.current.diceFormula,
          modifier: rollDataRef.current.modifier,
          total: randomResult.total,
          rolls: randomResult.rolls,
          diceTotal: randomResult.diceTotal,
        });
        playResultSound();
        closeTimeoutRef.current = setTimeout(() => handleClose(), 3000);
      } else {
        handleClose();
      }
    } else {
      handleClose();
    }
  }, [isRolling, showResult, handleClose, generateRandomResult, playResultSound, addRoll]);

  // --- RENDER ---
  return createPortal(
    <>
      <div 
        id="dice-box-overlay"
        ref={containerRef} 
        className={`pointer-events-none transition-opacity duration-300 ${isFadingDice ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          touchAction: 'none', overflow: 'hidden', pointerEvents: 'none',
          zIndex: 9999, opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden',
        }}
      />

      {isOpen && (
        <div 
          onClick={handleOverlayClick}
          className={`fixed inset-0 z-[9998] overflow-hidden cursor-pointer transition-opacity duration-300 ${isFadingAll ? 'opacity-0' : 'opacity-100'}`}
          style={{ backgroundColor: 'transparent' }}
        />
      )}

      {result && showResult && isOpen && (
        <div 
          className={`fixed z-[10000] pointer-events-none transition-all duration-500 ${isFadingAll ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}
          style={{
            position: 'fixed', top: '50vh', left: '50vw', transform: 'translate(-50%, -50%)',
            willChange: 'transform, opacity', filter: isFadingAll ? 'blur(10px)' : 'blur(0px)'
          }}
        >
          {/* UI du Résultat (inchangée) */}
          <div className="absolute inset-0 animate-pulse">
            <div className="absolute inset-0 bg-red-900/30 blur-3xl rounded-full scale-150"></div>
            <div className="absolute inset-0 bg-orange-600/20 blur-2xl rounded-full scale-125 animate-[pulse_2s_ease-in-out_infinite]"></div>
          </div>
          
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-lg blur-sm animate-[pulse_1.5s_ease-in-out_infinite]"></div>
            <div className="relative bg-black rounded-lg border-2 border-red-900/50 shadow-2xl overflow-hidden">
              <div className="relative px-12 py-10 text-center">
                <p className="text-xs tracking-[0.3em] uppercase text-red-400 mb-3 font-serif" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                  {rollDataRef.current?.attackName}
                </p>
                
                <div className="relative mb-4">
                  <div className="relative text-8xl font-black tracking-tight" style={{
                      background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 30%, #dc2626 60%, #7f1d1d 100%)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.9))'
                  }}>
                    {result.total}
                  </div>
                </div>

                {result.rolls.length === 1 && rollDataRef.current?.diceFormula === '1d20' && (
                  <>
                    {result.rolls[0] === 1 && <div className="mb-2 text-base font-bold text-red-500 animate-pulse">⚠️ ÉCHEC CRITIQUE ⚠️</div>}
                    {result.rolls[0] === 20 && <div className="mb-2 text-base font-bold text-yellow-400 animate-pulse">✨ SUCCÈS CRITIQUE ✨</div>}
                  </>
                )}

                <div className="text-sm text-red-200/80 font-serif">
                   <div className="flex items-center justify-center gap-2">
                      <span className="text-red-800">⟨</span>
                      <span className="tracking-wide">
                        {result.rolls.length > 1 ? `Dés: [${result.rolls.join(' • ')}] = ` : ''}{result.diceTotal}
                      </span>
                      {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
                        <span className="text-orange-400 font-bold">
                          {rollDataRef.current.modifier >= 0 ? ' + ' : ' − '}
                          {Math.abs(rollDataRef.current.modifier)}
                        </span>
                      )}
                      <span className="text-red-800">⟩</span>
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReadyPopup && (
        <div className="fixed top-6 right-6 z-[10001] px-4 py-3 rounded-lg bg-black/80 border border-emerald-500/60 shadow-lg text-sm text-emerald-100 flex items-center gap-2">
          <span className="text-emerald-400 font-bold">DICE ROLLER PRÊT</span>
        </div>
      )}
    </>,
    document.body
  );
}