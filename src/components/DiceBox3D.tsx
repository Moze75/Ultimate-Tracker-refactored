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
  const settingsKeyRef = useRef<string>(''); // ✅ AJOUTER

   const { addRoll } = useDiceHistory();

  useEffect(() => {
    rollDataRef.current = rollData;
  }, [rollData]);

  // ✅ Fonction pour jouer le son du lancement de dés
  const playDiceDropSound = useCallback(() => {
    try {
      const audio = new Audio('/assets/dice-box/sounds/dice-drop/dice_drop.mp3');
      audio.volume = 0.6;
      audio.play().catch(err => console.warn('Erreur lecture son lancement:', err));
    } catch (error) {
      console.warn('Impossible de jouer le son de lancement:', error);
    }
  }, []);

  // Fonction pour jouer le son du résultat
  const playResultSound = useCallback(() => {
    try {
      const audio = new Audio('/assets/dice-box/sounds/dicepopup/dice_results.mp3');
      audio.volume = 0.5;
      audio.play().catch(err => console.warn('Erreur lecture son résultat:', err));
    } catch (error) {
      console.warn('Impossible de jouer le son:', error);
    }
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

  // Initialiser UNE SEULE FOIS
 useEffect(() => {
  // ✅ Calculer une clé unique pour les settings
  const currentSettingsKey = JSON.stringify(effectiveSettings);
  
 // ✅ Si les settings ont changé, DÉTRUIRE et réinitialiser
  if (settingsKeyRef.current !== currentSettingsKey && diceBoxRef.current) {
    console.log('🔄 [SETTINGS CHANGED] Destruction du DiceBox...');
    
    // Détruire proprement l'instance
    try {
      if (typeof diceBoxRef.current.clear === 'function') {
        diceBoxRef.current.clear();
      }
      // Supprimer le canvas s'il existe
      const canvas = document.querySelector('#dice-box-overlay canvas');
      if (canvas) {
        canvas.remove();
      }
    } catch (e) {
      console.warn('Erreur lors de la destruction:', e);
    }
    
    diceBoxRef.current = null;
    setIsInitialized(false);
    settingsKeyRef.current = currentSettingsKey;
  }
  
  if (diceBoxRef.current && isInitialized) {
    console.log('✓ DiceBox déjà initialisé');
    return;
  }

  let mounted = true;

  const initDiceBox = async () => {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🎲 [INIT] Initialisation de DiceBox...');
      console.log('🎲 [INIT] Settings Key:', currentSettingsKey.substring(0, 50) + '...');
      console.log('🎲 [INIT] Theme:', effectiveSettings.theme);
      console.log('🎲 [INIT] Material:', effectiveSettings.themeMaterial);
      console.log('🎲 [INIT] Color:', effectiveSettings.themeColor);
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
        strength: effectiveSettings.strength,
        
        sounds: effectiveSettings.soundsEnabled,
        volume: effectiveSettings.soundsEnabled ? effectiveSettings.volume : 0,
        
        onRollComplete: (results: any) => {
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

    // ✅ AJOUTER : Enregistrer dans l'historique
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


}
        };

        console.log('📦 Config complète:', config);

        const box = new DiceBox('#dice-box-overlay', config);
        await box.initialize();
        
        if (mounted) {
          diceBoxRef.current = box;
          setIsInitialized(true);
           settingsKeyRef.current = currentSettingsKey; // ✅ Sauvegarder la clé
          console.log('✅ DiceBox initialisé !');
        }
      } catch (error) {
        console.error('❌ Erreur init:', error);
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
    };
  }, [effectiveSettings, playResultSound]);

  // Lancer les dés
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

      // ✅ AJOUTER : Sauvegarder le résultat lors de l'interruption
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
  }, [isRolling, showResult, handleClose, generateRandomResult, playResultSound]);

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