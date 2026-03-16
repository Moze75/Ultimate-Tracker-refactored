import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { vttService } from '../services/vttService';
import type {
  VTTRole,
  VTTToken,
  VTTWall,
  VTTProp,
} from '../types/vtt';

// ===================================
// Hook : Undo / Redo
// ===================================
// Gère la pile d'annulation et de rétablissement
// pour les tokens, murs et props de la scène active.
// Seul le MJ peut undo/redo.

export type VTTUndoSnapshot = {
  tokens: VTTToken[];
  walls: VTTWall[];
  props: VTTProp[];
};

interface UseVTTUndoRedoParams {
  role: VTTRole;
  // -------------------
  // Refs vers les données live (mutées en dehors du hook)
  // Nécessaires car makeSnapshot() doit capturer l'état courant
  // au moment de l'appel, pas celui du dernier rendu React
  // -------------------
  tokensRef: React.MutableRefObject<VTTToken[]>;
  wallsRef: React.MutableRefObject<VTTWall[]>;
  propsRef: React.MutableRefObject<VTTProp[]>;
  activeSceneIdRef: React.MutableRefObject<string | null>;
  // -------------------
  // Setters React pour appliquer un snapshot restauré
  // -------------------
  setTokens: React.Dispatch<React.SetStateAction<VTTToken[]>>;
  setWalls: React.Dispatch<React.SetStateAction<VTTWall[]>>;
  setProps: React.Dispatch<React.SetStateAction<VTTProp[]>>;
}

export function useVTTUndoRedo({
  role,
  tokensRef,
  wallsRef,
  propsRef,
  activeSceneIdRef,
  setTokens,
  setWalls,
  setProps,
}: UseVTTUndoRedoParams) {
  const [undoStack, setUndoStack] = useState<VTTUndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<VTTUndoSnapshot[]>([]);

  // -------------------
  // Capture un instantané de l'état courant (tokens + murs + props)
  // Utilise structuredClone pour un deep copy sans mutation
  // -------------------
  const makeSnapshot = useCallback((): VTTUndoSnapshot => ({
    tokens: structuredClone(tokensRef.current),
    walls: structuredClone(wallsRef.current),
    props: structuredClone(propsRef.current),
  }), [tokensRef, wallsRef, propsRef]);

  // -------------------
  // Empile un snapshot dans la pile d'annulation
  // Vide la pile de rétablissement (redo)
  // Limite la pile à 10 entrées max
  // -------------------
  const pushUndoSnapshot = useCallback(() => {
    if (role !== 'gm') return;
    setUndoStack(prev => [...prev.slice(-9), makeSnapshot()]);
    setRedoStack([]);
  }, [role, makeSnapshot]);

  // -------------------
  // Applique un snapshot (restaure tokens, murs et props)
  // Persiste immédiatement dans Supabase et broadcast les murs
  // -------------------
  const applySnapshot = useCallback((snapshot: VTTUndoSnapshot) => {
    setTokens(snapshot.tokens);
    tokensRef.current = snapshot.tokens;

    setWalls(snapshot.walls);
    wallsRef.current = snapshot.walls;

    setProps(snapshot.props);
    propsRef.current = snapshot.props;

    const sceneId = activeSceneIdRef.current;
    if (sceneId) {
      supabase
        .from('vtt_scenes')
        .update({
          tokens: snapshot.tokens,
          walls: snapshot.walls,
          props: snapshot.props,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sceneId)
        .then(({ error }) => {
          if (error) console.error('[VTT] Undo/redo persist error:', error);
        });
    }

    vttService.send({ type: 'UPDATE_WALLS', walls: snapshot.walls });
  }, [tokensRef, wallsRef, propsRef, activeSceneIdRef, setTokens, setWalls, setProps]);

  // -------------------
  // Annuler (Ctrl+Z) — restaure le dernier snapshot empilé
  // -------------------
  const handleUndo = useCallback(() => {
    if (role !== 'gm') return;
    setUndoStack(prevUndo => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      setRedoStack(prevRedo => [...prevRedo, makeSnapshot()]);
      applySnapshot(previous);
      return prevUndo.slice(0, -1);
    });
  }, [role, makeSnapshot, applySnapshot]);

  // -------------------
  // Rétablir (Ctrl+Y / Ctrl+Shift+Z) — restaure le prochain snapshot redo
  // -------------------
  const handleRedo = useCallback(() => {
    if (role !== 'gm') return;
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      setUndoStack(prevUndo => [...prevUndo.slice(-9), makeSnapshot()]);
      applySnapshot(next);
      return prevRedo.slice(0, -1);
    });
  }, [role, makeSnapshot, applySnapshot]);

  return {
    undoStack,
    redoStack,
    pushUndoSnapshot,
    handleUndo,
    handleRedo,
  };
}