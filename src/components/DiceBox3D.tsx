/**
 * This component uses @3d-dice/dice-box-threejs
 * Copyright (c) 2022 3D Dice - MIT License
 * https://github.com/3d-dice/dice-box-threejs
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS } from '../hooks/useDiceSettings';
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
  settings?: DiceSettings;
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

  const { addRoll } = useDiceHistoryContext();

  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

  const playDiceDropSound = useCallback(() => {
    audioManager.play('/assets/dice-box/sounds/dice-drop/dice_drop.mp3', 0.6);
  }, []);

  useEffect(() => {
    if (isOpen) {
      audioManager.unlock();
    }
  }, [isOpen]);

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

  // ✅ Initialiser UNE SEULE FOIS - Ne jamais détruire
  useEffect(() => {
    let mounted = true;

    const initDiceBox = async () => {
      if (diceBoxRef.current && isInitialized) {
        console.log('✓ DiceBox déjà initialisé, skip réinitialisation');
        return;
      }

      try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎲 [INIT] Initialisation PERMANENTE de DiceBox...');
        console.log('🎲 [INIT] Theme:', effectiveSettings.theme);
        console.log('🎲 [INIT] Material:', effectiveSettings.themeMaterial);
        console.log('🎲 [INIT] Strength (brute):', effectiveSettings.strength);
        console.log('🎲 [INIT] Strength (x1.3):', effectiveSettings.strength * 1.3);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const DiceBox = (await import('@3d-dice/dice-box-threejs')).default;

        if (!mounted) return;

        const textureForTheme = effectiveSettings.theme 
          ? (COLORSET_TEXTURES[effectiveSettings.theme] || '')
          : 'none';

        console.log('🎨 Texture sélectionnée:', textureForTheme);

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
          onRollComplete: (results: any) => {
            if (!mounted) return;

            if (hasShownResultRef.current) {
              setIsRolling(false);
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
          }
        };

        console.log('📦 Config complète:', config);

        const box = new DiceBox('#dice-box-overlay', config);

        if (containerRef.current) {
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          console.log(`📐 Dimensions viewport: ${viewportWidth}x${viewportHeight}`);
          
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
          console.log('✅ DiceBox initialisé avec strength x1.3 !');
          console.log('💪 Force finale du moteur:', box.strength);
          console.log('♾️ Le DiceBox restera monté en permanence');
        }
      } catch (error) {
        console.error('❌ Erreur init:', error);
        if (mounted) setIsRolling(false);
      }
    };

    initDiceBox();

    return () => {
      mounted = false;
      // ⚠️ NE PAS détruire le DiceBox - il reste en mémoire
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [effectiveSettings, playResultSound, addRoll]); // ✅ Plus de dépendances inutiles

  // ✅ Gérer les changements de settings
  useEffect(() => {
    if (!diceBoxRef.current || !isInitialized) return;

    const updateSettings = async () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔧 [UPDATE] Mise à jour des settings...');
      console.log('💪 [UPDATE] Ancienne force:', diceBoxRef.current.strength);
      console.log('💪 [UPDATE] Nouvelle force (brute):', effectiveSettings.strength);
      console.log('💪 [UPDATE] Nouvelle force (x1.3):', effectiveSettings.strength * 1.3);
      
      const textureForTheme = effectiveSettings.theme 
        ? (COLORSET_TEXTURES[effectiveSettings.theme] || '')
        : 'none';

      await diceBoxRef.current.updateConfig({
        theme_colorset: effectiveSettings.theme || 'custom',
        theme_texture: textureForTheme,
        theme_material: effectiveSettings.themeMaterial || "plastic",
        theme_customColorset: !effectiveSettings.theme ? {
          name: 'custom',
          foreground: '#ffffff',
          background: effectiveSettings.themeColor,
          outline: effectiveSettings.themeColor,
          edge: effectiveSettings.themeColor,
          texture: 'none',
          material: effectiveSettings.themeMaterial
        } : undefined,
        baseScale: effectiveSettings.baseScale * 100 / 6,
        gravity_multiplier: effectiveSettings.gravity * 400,
        strength: effectiveSettings.strength * 1.3,
        sounds: effectiveSettings.soundsEnabled,
        volume: effectiveSettings.soundsEnabled ? effectiveSettings.volume : 0,
      });
      
      console.log('✅ [UPDATE] Force finale appliquée:', diceBoxRef.current.strength);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    };

    updateSettings();
  }, [effectiveSettings, isInitialized]);

  useEffect(() => {
    const handleSettingsChanged = async (e: CustomEvent) => {
      if (!diceBoxRef.current || !isInitialized) return;
      
      const newSettings = e.detail as DiceSettings;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔧 [EVENT] Settings changés via événement custom');
      console.log('💪 [EVENT] Ancienne force:', diceBoxRef.current.strength);
      console.log('💪 [EVENT] Nouvelle force (brute):', newSettings.strength);
      console.log('💪 [EVENT] Nouvelle force (x1.3):', newSettings.strength * 1.3);
      
      const textureForTheme = newSettings.theme 
        ? (COLORSET_TEXTURES[newSettings.theme] || '')
        : 'none';

      await diceBoxRef.current.updateConfig({
        theme_colorset: newSettings.theme || 'custom',
        theme_texture: textureForTheme,
        theme_material: newSettings.themeMaterial || "plastic",
        theme_customColorset: !newSettings.theme ? {
          name: 'custom',
          foreground: '#ffffff',
          background: newSettings.themeColor,
          outline: newSettings.themeColor,
          edge: newSettings.themeColor,
          texture: 'none',
          material: newSettings.themeMaterial
        } : undefined,
        baseScale: newSettings.baseScale * 100 / 6,
        gravity_multiplier: newSettings.gravity * 400,
        strength: newSettings.strength * 1.3,
        sounds: newSettings.soundsEnabled,
        volume: newSettings.soundsEnabled ? newSettings.volume : 0,
      });

      if (diceBoxRef.current) {
        diceBoxRef.current.baseScale = newSettings.baseScale * 100 / 6;
        console.log('✅ [EVENT] baseScale forcé directement:', diceBoxRef.current.baseScale);
        
        if (diceBoxRef.current.DiceFactory) {
          try {
            const DiceFactory = diceBoxRef.current.DiceFactory.constructor;
            diceBoxRef.current.DiceFactory = new DiceFactory({
              baseScale: newSettings.baseScale * 100 / 6
            });
            if (diceBoxRef.current.colorData) {
              diceBoxRef.current.DiceFactory.applyColorSet(diceBoxRef.current.colorData);
            }
            console.log('✅ [EVENT] DiceFactory recréé avec baseScale:', newSettings.baseScale * 100 / 6);
          } catch (error) {
            console.error('❌ [EVENT] Erreur recréation DiceFactory:', error);
          }
        }
      } 

      try {
        if (diceBoxRef.current && diceBoxRef.current.world) {
          const world: any = diceBoxRef.current.world;
          const gravSetting = typeof newSettings.gravity === 'number' ? newSettings.gravity : 1;
          const expectedMultiplier = gravSetting * 400;
          diceBoxRef.current.gravity_multiplier = expectedMultiplier;
          const gravityValue = -9.8 * expectedMultiplier;

          if (world.gravity && typeof world.gravity.set === 'function') {
            world.gravity.set(0, 0, gravityValue);
            console.log('✅ [EVENT] Gravité forcée (x,y,z):', 0, 0, gravityValue);
          } else if (world.gravity && 'z' in world.gravity) {
            world.gravity.z = gravityValue;
            console.log('✅ [EVENT] Gravité forcée via property z:', world.gravity.z);
          } else {
            console.warn('⚠️ [EVENT] world.gravity présent mais ne possède pas set() ni z - gravité non forcée');
          }

          try {
            if (Array.isArray(world.bodies)) {
              world.bodies.forEach((b: any) => {
                try {
                  if (typeof b.wakeUp === 'function') b.wakeUp();
                  if (typeof b.sleepState !== 'undefined') b.sleepState = 0;
                } catch (err) { /* noop */ }
              });
              console.log('✅ [EVENT] Bodies réveillés pour appliquer nouvelle gravité.');
            }
          } catch (err) {
            console.error('❌ [EVENT] Erreur en réveillant les bodies :', err);
          }

          if (typeof diceBoxRef.current.updateConfig === 'function') {
            try {
              const maybePromise = diceBoxRef.current.updateConfig({ gravity_multiplier: expectedMultiplier });
              if (maybePromise && typeof maybePromise.then === 'function') {
                maybePromise.catch((e: any) => {
                  console.warn('⚠️ updateConfig rejeté :', e);
                });
              }
            } catch (err) {
              console.warn('⚠️ updateConfig a échoué (fallback ok) :', err);
            }
          }
        }
      } catch (err) {
        console.error('❌ [EVENT] Erreur lors du forçage de la gravité:', err);
      }

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    };

    window.addEventListener('dice-settings-changed', handleSettingsChanged as EventListener);
    
    return () => {
      window.removeEventListener('dice-settings-changed', handleSettingsChanged as EventListener);
    };
  }, [isInitialized]);

  // ✅ Recalculer les dimensions à chaque ouverture
  useEffect(() => {
    if (isOpen && diceBoxRef.current && containerRef.current) {
      requestAnimationFrame(() => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        console.log('📐 [RESIZE] Recalcul dimensions:', viewportWidth, 'x', viewportHeight);
        
        if (containerRef.current) {
          containerRef.current.style.width = '100vw';
          containerRef.current.style.height = '100vh';
        }
        
        if (typeof diceBoxRef.current.setDimensions === 'function') {
          diceBoxRef.current.setDimensions({ x: viewportWidth, y: viewportHeight });
        }
      });
    }
  }, [isOpen]);
  
  // ✅ Lancer les dés
  useEffect(() => {
    if (!isOpen || !rollData || !diceBoxRef.current || !isInitialized) return;

    const rollSignature = JSON.stringify(rollData);
    if (rollSignature === lastRollDataRef.current) return;

    lastRollDataRef.current = rollSignature;
    currentRollIdRef.current += 1;
    const thisRollId = currentRollIdRef.current;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎲 [ROLL] Lancer #' + thisRollId);
    console.log('💪 [ROLL] Force au moment du lancer:', diceBoxRef.current.strength);
    console.log('♾️ [ROLL] DiceBox toujours actif - pas de stutter !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
        console.log('🚀 Lancement immédiat du roll !');
        
        if (typeof diceBoxRef.current.roll === 'function') {
          diceBoxRef.current.roll(notation);
        } else {
          console.error('❌ [ROLL] Méthode roll() non disponible !');
          const randomResult = generateRandomResult(rollData.diceFormula, rollData.modifier);
          setResult(randomResult);
          setShowResult(true);
          setIsRolling(false);
          hasShownResultRef.current = true;
          
          if (rollDataRef.current) {
            addRoll({
              attackName: rollDataRef.current.attackName,
              diceFormula: rollDataRef.current.diceFormula,
              modifier: rollDataRef.current.modifier,
              total: randomResult.total,
              rolls: randomResult.rolls,
              diceTotal: randomResult.diceTotal,
            });
          }
        }
      }
    });
  }, [rollData, isInitialized, playDiceDropSound, isOpen, effectiveSettings, generateRandomResult, addRoll]);

  // ✅ Reset à la fermeture (mais pas démontage)
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
      
      // ✅ Nettoyer les dés de la scène (mais garder le moteur actif)
      if (diceBoxRef.current && typeof diceBoxRef.current.clearDice === 'function') {
        diceBoxRef.current.clearDice();
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
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (isRolling) {
      hasShownResultRef.current = true;
      setIsFadingDice(true);
      setIsRolling(false);
      
      if (diceBoxRef.current && typeof diceBoxRef.current.clearDice === 'function') {
        diceBoxRef.current.clearDice();
      }
      
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
        
        console.log('📊 [CLICK] Affichage forcé du résultat');
        closeTimeoutRef.current = setTimeout(() => handleClose(), 3000);
      } else {
        handleClose();
      }
    } else if (showResult) {
      console.log('🚪 [CLICK] Fermeture manuelle');
      handleClose();
    } else {
      handleClose();
    }
  }, [isRolling, showResult, handleClose, generateRandomResult, playResultSound, addRoll]);

  // ✅ Le composant reste TOUJOURS monté, on contrôle juste la visibilité
  return createPortal(
    <>
      {/* Canvas DiceBox - TOUJOURS présent, caché quand fermé */}
      <div 
        id="dice-box-overlay"
        ref={containerRef} 
        className={`pointer-events-none transition-opacity duration-300 ${
          isFadingDice ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          touchAction: 'none',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden', // ✅ Au lieu de démonter, on cache
        }}
      />

      {/* Overlay cliquable */}
      {isOpen && (
        <div 
          onClick={handleOverlayClick}
          className={`fixed inset-0 z-[9998] overflow-hidden cursor-pointer transition-opacity duration-300 ${
            isFadingAll ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backgroundColor: 'transparent' }}
        />
      )}

      {/* Résultat */}
      {result && showResult && isOpen && (
        <div 
          className={`fixed z-[10000] pointer-events-none transition-all duration-500 ${
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
          <div className="absolute inset-0 animate-pulse">
            <div className="absolute inset-0 bg-red-900/30 blur-3xl rounded-full scale-150"></div>
            <div className="absolute inset-0 bg-orange-600/20 blur-2xl rounded-full scale-125 animate-[pulse_2s_ease-in-out_infinite]"></div>
          </div>

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

          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 rounded-lg blur-sm animate-[pulse_1.5s_ease-in-out_infinite]"></div>
            
      <div className="relative bg-black rounded-lg border-2 border-red-900/50 shadow-2xl overflow-hidden">
  <div className="relative px-12 py-10 text-center">
    <p className="text-xs tracking-[0.3em] uppercase text-red-400 mb-3 font-serif" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
      {rollDataRef.current?.attackName}
    </p>
    
    <div className="relative mb-4">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-9xl font-black text-red-600/30 blur-xl scale-110">
          {result.total}
        </div>
      </div>
      
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

    {/* ✅ AJOUT : Mention critique */}
    {result.rolls.length === 1 && rollDataRef.current?.diceFormula === '1d20' && (
      <>
        {result.rolls[0] === 1 && (
          <div className="mb-3 text-xl font-bold tracking-wider text-red-500 animate-pulse" style={{ textShadow: '0 0 10px rgba(239, 68, 68, 0.8)' }}>
            ⚠️ ÉCHEC CRITIQUE ⚠️
          </div>
        )}
        {result.rolls[0] === 20 && (
          <div className="mb-3 text-xl font-bold tracking-wider text-yellow-400 animate-pulse" style={{ textShadow: '0 0 10px rgba(250, 204, 21, 0.8)' }}>
            ✨ SUCCÈS CRITIQUE ✨
          </div>
        )}
      </>
    )}

    <div className="text-sm text-red-200/80 font-serif">
      {result.rolls.length > 0 ? (
        <div className="flex items-center justify-center gap-2">
          <span className="text-red-800">⟨</span>
          <span className="tracking-wide">
            Dés: [{result.rolls.join(' • ')}] = {result.diceTotal}
          </span>
          {rollDataRef.current && rollDataRef.current.modifier !== 0 && (
            <span className="text-orange-400 font-bold">
              {rollDataRef.current.modifier >= 0 ? ' + ' : ' − '}
              {Math.abs(rollDataRef.current.modifier)}
            </span>
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
            <span className="text-orange-400 font-bold">
              {rollDataRef.current.modifier >= 0 ? ' + ' : ' − '}
              {Math.abs(rollDataRef.current.modifier)}
            </span>
          )}
          <span className="text-red-800">⟩</span>
        </div>
      )}
    </div>

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