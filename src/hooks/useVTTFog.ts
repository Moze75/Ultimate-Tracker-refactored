import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { getExploredMaskStorageKey } from '../components/VTT/VTTCanvas';
import { vttService } from '../services/vttService';
import type {
  VTTRole,
  VTTFogState,
  VTTFogStroke,
  VTTRoomConfig,
} from '../types/vtt';

// ===================================
// Hook : Gestion du Brouillard de Guerre (Fog of War)
// ===================================
// Centralise toute la logique fog :
// - Reveal (pinceau / rectangle / batch)
// - Tout masquer (reset)
// - Tout révéler (stroke géant)
// - Portes vues (seenDoors)
// - Sauvegarde debounced dans Supabase

// -------------------
// Constante fog par défaut
// -------------------
const DEFAULT_FOG: VTTFogState = {
  revealedCells: [],
  strokes: [],
  exploredStrokes: [],
  seenDoors: [],
};

// -------------------
// Normalisation du brouillard de guerre persisté
// Garantit que chaque champ est un tableau (jamais undefined/null)
// -------------------
export const normalizeFogState = (fog?: VTTFogState | null): VTTFogState => ({
  revealedCells: [...(fog?.revealedCells || [])],
  strokes: [...(fog?.strokes || [])],
  exploredStrokes: [...(fog?.exploredStrokes || [])],
  seenDoors: [...(fog?.seenDoors || [])],
});

interface UseVTTFogParams {
  role: VTTRole;
  configRef: React.MutableRefObject<VTTRoomConfig>;
  activeSceneIdRef: React.MutableRefObject<string | null>;
  saveCurrentSceneState: (sceneId: string) => Promise<void>;
  // -------------------
  // Ref fog fournie par VTTPage (déclarée avant saveCurrentSceneState)
  // Le hook la met à jour mais ne la crée pas
  // -------------------
  fogStateRef: React.MutableRefObject<VTTFogState>;
}

export function useVTTFog({
  role,
  configRef,
  activeSceneIdRef,
  saveCurrentSceneState,
}: UseVTTFogParams) {

  // ===================================
  // État React du brouillard
  // ===================================
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [fogResetSignal, setFogResetSignal] = useState(0);
  const fogStateRef = useRef<VTTFogState>(fogState);
  fogStateRef.current = fogState;

  // -------------------
  // Timers de sauvegarde debounced
  // -------------------
  const fogSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenDoorsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===================================
  // Reveal fog — pinceau / rectangle (batch de strokes)
  // ===================================
  // Accepte un stroke unique ou un batch de strokes (painting continu).
  // Un batch produit UN SEUL setState + UN SEUL broadcast + UNE SEULE RPC Supabase,
  // au lieu de N (un par mousemove). C'est la clé de la performance du pinceau.
  const handleRevealFog = useCallback((strokeOrBatch: VTTFogStroke | VTTFogStroke[]) => {
    const batch = Array.isArray(strokeOrBatch) ? strokeOrBatch : [strokeOrBatch];
    if (batch.length === 0) return;

    // -------------------
    // Construction du prochain fogState en ajoutant tout le batch d'un coup
    // Une seule copie O(N) au lieu de N copies O(N²) cumulées
    // -------------------
    const prevStrokes = fogStateRef.current.strokes || [];
    const prevExplored = fogStateRef.current.exploredStrokes || [];
    const newStrokes = [...prevStrokes, ...batch];
    const newExplored = [...prevExplored, ...batch.filter(s => !s.erase)];

    const nextFogState: VTTFogState = {
      revealedCells: [...(fogStateRef.current.revealedCells || [])],
      strokes: newStrokes,
      exploredStrokes: newExplored,
      seenDoors: fogStateRef.current.seenDoors,
    };

    // -------------------
    // UN SEUL setState React pour tout le batch → un seul re-render
    // -------------------
    fogStateRef.current = nextFogState;
    setFogState(nextFogState);

    // -------------------
    // UN SEUL envoi vttService pour tout le batch → un seul broadcast + une seule RPC
    // On envoie le dernier stroke du batch (pour compatibilité vttService.send)
    // mais le state complet est déjà construit avec tous les strokes
    // -------------------
    vttService.send({
      type: 'REVEAL_FOG',
      cells: [],
      erase: batch[batch.length - 1].erase,
      stroke: batch[batch.length - 1],
      batch,
    });

    // -------------------
    // Sauvegarde scène debounced (inchangé)
    // -------------------
    if (activeSceneIdRef.current && role === 'gm') {
      if (fogSaveTimerRef.current) clearTimeout(fogSaveTimerRef.current);
      fogSaveTimerRef.current = setTimeout(() => {
        saveCurrentSceneState(activeSceneIdRef.current!);
      }, 2000);
    }
  }, [saveCurrentSceneState, role, activeSceneIdRef]);

  // ===================================
  // Mise à jour des portes vues (seenDoors)
  // ===================================
  // Appelé par VTTCanvas quand le joueur passe à proximité d'une porte.
  // Les portes vues restent visibles même si le fog les recouvre ensuite.
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

    vttService.send({ type: 'REVEAL_FOG', cells: [], erase: false, stroke: { x: 0, y: 0, r: 0, erase: false } });

    // -------------------
    // Sauvegarde debounced pour éviter les écritures multiples rapides
    // -------------------
    if (activeSceneIdRef.current) {
      if (seenDoorsSaveTimerRef.current) clearTimeout(seenDoorsSaveTimerRef.current);
      seenDoorsSaveTimerRef.current = setTimeout(() => {
        saveCurrentSceneState(activeSceneIdRef.current!);
      }, 2000);
    }
  }, [saveCurrentSceneState, activeSceneIdRef]);

  // ===================================
  // Tout masquer — remet le fog en noir complet
  // ===================================
  // Réinitialise strokes + exploredStrokes à vide.
  // Un seul envoi atomique RESET_FOG (évite les doubles broadcasts).
  // Aussi utilisé comme "Réinitialiser le brouillard" (même effet).
  const handleMaskAll = useCallback(() => {
    if (role !== 'gm') return;
    const newFog: VTTFogState = { revealedCells: [], strokes: [], exploredStrokes: [] };
    // -------------------
    // 1. Mise à jour du state React local (affichage immédiat)
    // -------------------
    fogStateRef.current = newFog;
    setFogState(newFog);
    setFogResetSignal(s => s + 1);
    // -------------------
    // 2. Suppression immédiate du snapshot localStorage pour toutes les scènes courantes
    // On ne peut pas attendre le cleanup React (trop tard si refresh immédiat)
    // -------------------
    if (activeSceneIdRef.current) {
      localStorage.removeItem(getExploredMaskStorageKey(activeSceneIdRef.current));
    }
    // -------------------
    // 3. Broadcast + persistance via vttService
    // -------------------
    vttService.send({ type: 'RESET_FOG' });
    // -------------------
    // 4. Sauvegarde explicite dans la scène Supabase
    // -------------------
    if (activeSceneIdRef.current) {
      saveCurrentSceneState(activeSceneIdRef.current);
    }
  }, [role, saveCurrentSceneState, activeSceneIdRef]);

  // ===================================
  // Tout révéler — lève le fog sur toute la carte d'un coup
  // ===================================
  // Crée un unique stroke géant (rayon = diagonale de la carte)
  // qui couvre toute la surface. Un seul envoi REVEAL_FOG (pas de RESET d'abord).
  const handleRevealAll = useCallback(() => {
    if (role !== 'gm') return;
    const mapW = configRef.current.mapWidth || 3000;
    const mapH = configRef.current.mapHeight || 2000;
    // -------------------
    // Le rayon couvre la diagonale entière de la carte
    // -------------------
    const r = Math.sqrt(mapW * mapW + mapH * mapH);
    const stroke: VTTFogStroke = { x: mapW / 2, y: mapH / 2, r, erase: false };
    const newFog: VTTFogState = {
      revealedCells: [],
      strokes: [stroke],
      exploredStrokes: [stroke],
    };
    // -------------------
    // 1. Mise à jour du state React local (affichage immédiat)
    // -------------------
    fogStateRef.current = newFog;
    setFogState(newFog);
    // -------------------
    // 2. Reset d'abord pour vider l'ancien state dans vttService,
    //    puis envoi du stroke géant
    // -------------------
    vttService.send({ type: 'RESET_FOG' });
    vttService.send({ type: 'REVEAL_FOG', cells: [], erase: false, stroke });
    // -------------------
    // 3. Sauvegarde explicite dans la scène Supabase
    // -------------------
    if (activeSceneIdRef.current) {
      saveCurrentSceneState(activeSceneIdRef.current);
    }
  }, [role, saveCurrentSceneState, configRef, activeSceneIdRef]);

  // ===================================
  // Réinitialiser le fog — alias de "Tout masquer" (même comportement)
  // ===================================
  const handleResetFog = handleMaskAll;

  return {
    // -------------------
    // État fog exposé à VTTPage
    // -------------------
    fogState,
    setFogState,
    fogStateRef,
    fogResetSignal,
    setFogResetSignal,
    fogSaveTimerRef,
    // -------------------
    // Handlers fog exposés à VTTPage / VTTCanvas / VTTLeftToolbar
    // -------------------
    handleRevealFog,
    handleSeenDoorsUpdate,
    handleMaskAll,
    handleRevealAll,
    handleResetFog,
    // -------------------
    // Utilitaire réexporté pour les appelants
    // -------------------
    normalizeFogState,
  };
}