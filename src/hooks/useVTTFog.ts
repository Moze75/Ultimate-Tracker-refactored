import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { vttService } from '../services/vttService';
import { getExploredMaskStorageKey } from '../components/VTT/VTTCanvas';
import type { VTTFogState, VTTFogStroke, VTTRole } from '../types/vtt';

// ---------------------------------------------------------------------------
// Valeur par défaut exportée pour être partagée avec VTTPage
// ---------------------------------------------------------------------------

export const DEFAULT_FOG: VTTFogState = {
  revealedCells: [],
  strokes: [],
  exploredStrokes: [],
  seenDoors: [],
};

// ---------------------------------------------------------------------------
// Paramètres du hook
// ---------------------------------------------------------------------------

export interface UseVTTFogParams {
  role: VTTRole;
  activeSceneIdRef: React.MutableRefObject<string | null>;

  // Fourni par useVTTScenes (ou VTTPage tant que le refacto n'est pas terminé)
  saveCurrentSceneState: (sceneId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVTTFog({
  role,
  activeSceneIdRef,
  saveCurrentSceneState,
}: UseVTTFogParams) {

  // -------------------
  // State
  // -------------------
  const [fogState, setFogState]           = useState<VTTFogState>(DEFAULT_FOG);
  const [fogResetSignal, setFogResetSignal] = useState(0);

  // -------------------
  // Refs (accès synchrone dans les callbacks)
  // -------------------
  const fogStateRef            = useRef<VTTFogState>(DEFAULT_FOG);
  const fogSaveTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenDoorsSaveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===========================================================================
  // REVEAL FOG
  // ===========================================================================
  // Accepte un stroke unique ou un batch de strokes (painting continu).
  // Un batch produit UN SEUL setState + UN SEUL broadcast + UNE SEULE RPC Supabase,
  // au lieu de N (un par mousemove). C'est la clé de la performance du pinceau.

  const handleRevealFog = useCallback((strokeOrBatch: VTTFogStroke | VTTFogStroke[]) => {
    const batch = Array.isArray(strokeOrBatch) ? strokeOrBatch : [strokeOrBatch];
    if (batch.length === 0) return;

    // Construction du prochain fogState en ajoutant tout le batch d'un coup
    const prevStrokes  = fogStateRef.current.strokes        || [];
    const prevExplored = fogStateRef.current.exploredStrokes || [];
    const newStrokes   = [...prevStrokes,  ...batch];
    const newExplored  = [...prevExplored, ...batch.filter(s => !s.erase)];

    const nextFogState: VTTFogState = {
      revealedCells:  [...(fogStateRef.current.revealedCells || [])],
      strokes:        newStrokes,
      exploredStrokes: newExplored,
      seenDoors:      fogStateRef.current.seenDoors,
    };

    // UN SEUL setState React pour tout le batch → un seul re-render
    fogStateRef.current = nextFogState;
    setFogState(nextFogState);

    // UN SEUL envoi vttService → un seul broadcast + une seule RPC
    vttService.send({
      type: 'REVEAL_FOG',
      cells: [],
      erase: batch[batch.length - 1].erase,
      stroke: batch[batch.length - 1],
      batch,
    });

    // Sauvegarde scène debounced (2 s)
    if (activeSceneIdRef.current && role === 'gm') {
      if (fogSaveTimerRef.current) clearTimeout(fogSaveTimerRef.current);
      fogSaveTimerRef.current = setTimeout(() => {
        saveCurrentSceneState(activeSceneIdRef.current!);
      }, 2000);
    }
  }, [role, activeSceneIdRef, saveCurrentSceneState]);

  // ===========================================================================
  // MASK ALL — remet le fog en noir complet
  // ===========================================================================
  // Réinitialise strokes + exploredStrokes à vide.
  // Un seul envoi atomique RESET_FOG (évite les doubles broadcasts).
  // Aussi utilisé comme alias "Réinitialiser le brouillard".

  const handleMaskAll = useCallback(() => {
    if (role !== 'gm') return;

    const newFog: VTTFogState = { revealedCells: [], strokes: [], exploredStrokes: [] };

    // 1. Mise à jour du state React local (affichage immédiat)
    fogStateRef.current = newFog;
    setFogState(newFog);
    setFogResetSignal(s => s + 1);

    // 2. Suppression immédiate du snapshot localStorage
    // (ne pas attendre le cleanup React — trop tard si refresh immédiat)
    if (activeSceneIdRef.current) {
      localStorage.removeItem(getExploredMaskStorageKey(activeSceneIdRef.current));
    }

    // 3. Broadcast via vttService
    vttService.send({ type: 'RESET_FOG' });

    // 4. Sauvegarde explicite dans la scène Supabase
    if (activeSceneIdRef.current) {
      saveCurrentSceneState(activeSceneIdRef.current);
    }
  }, [role, activeSceneIdRef, saveCurrentSceneState]);

  // ===========================================================================
  // REVEAL ALL — lève le fog sur toute la carte d'un coup
  // ===========================================================================
  // Crée un unique stroke géant (rayon = diagonale de la carte).

  const handleRevealAll = useCallback(() => {
    if (role !== 'gm') return;
configRef: React.MutableRefObject<VTTRoomConfig>;
const mapW = configRef.current.mapWidth || 3000;
const mapH = configRef.current.mapHeight || 2000;

    // ⚠️ Si tu veux les dimensions réelles de la carte, passe configRef en paramètre
    // et remplace les deux lignes ci-dessus par :
    // const mapW = configRef.current.mapWidth  || 3000;
    // const mapH = configRef.current.mapHeight || 2000;

    const r = Math.sqrt(mapW * mapW + mapH * mapH);
    const stroke: VTTFogStroke = { x: mapW / 2, y: mapH / 2, r, erase: false };
    const newFog: VTTFogState = {
      revealedCells:   [],
      strokes:         [stroke],
      exploredStrokes: [stroke],
    };

    // 1. Mise à jour du state React local
    fogStateRef.current = newFog;
    setFogState(newFog);

    // 2. Reset d'abord pour vider l'ancien state dans vttService,
    //    puis envoi du stroke géant
    vttService.send({ type: 'RESET_FOG' });
    vttService.send({ type: 'REVEAL_FOG', cells: [], erase: false, stroke });

    // 3. Sauvegarde explicite dans Supabase
    if (activeSceneIdRef.current) {
      saveCurrentSceneState(activeSceneIdRef.current);
    }
  }, [role, activeSceneIdRef, saveCurrentSceneState]);

  // Alias — même comportement que maskAll
  const handleResetFog = handleMaskAll;

  // ===========================================================================
  // SEEN DOORS — portes vues par le joueur (fog de vision persisté)
  // ===========================================================================

  const handleSeenDoorsUpdate = useCallback((seenIds: string[]) => {
    const currentSeenDoors = fogStateRef.current.seenDoors || [];
    const newIds = seenIds.filter(id => !currentSeenDoors.includes(id));
    if (newIds.length === 0) return;

    const nextFogState: VTTFogState = {
      ...fogStateRef.current,
      seenDoors: [...currentSeenDoors, ...newIds],
    };
    fogStateRef.current = nextFogState;
    setFogState(nextFogState);

    if (seenDoorsSaveTimerRef.current) clearTimeout(seenDoorsSaveTimerRef.current);
    seenDoorsSaveTimerRef.current = setTimeout(() => {
      seenDoorsSaveTimerRef.current = null;
      const sceneId = activeSceneIdRef.current;
      if (!sceneId) return;
      supabase.rpc('update_scene_fog_state', {
        p_scene_id: sceneId,
        p_fog_state: fogStateRef.current,
      }).then(({ error }) => {
        if (error) console.error('[VTT] handleSeenDoorsUpdate save error:', error);
      });
    }, 2000);
  }, [activeSceneIdRef]);

  // ---------------------------------------------------------------------------
  // Helpers de synchronisation — appelés par useVTTScenes lors d'un changement
  // de scène pour écraser le fog avec les données chargées depuis Supabase
  // ---------------------------------------------------------------------------

  const applyFogState = useCallback((newFog: VTTFogState) => {
    fogStateRef.current = newFog;
    setFogState(newFog);
  }, []);

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  return {
    // State
    fogState,
    fogResetSignal,

    // Ref (à passer à saveCurrentSceneState et aux composants qui en ont besoin)
    fogStateRef,

    // Handlers
    handleRevealFog,
    handleMaskAll,
    handleRevealAll,
    handleResetFog,
    handleSeenDoorsUpdate,

    // Sync depuis l'extérieur (useVTTScenes / applySceneToLive)
    applyFogState,
  };
}