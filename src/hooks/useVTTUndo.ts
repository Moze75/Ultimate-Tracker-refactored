import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { vttService } from '../services/vttService';
import type { VTTToken, VTTProp, VTTWall, VTTRole } from '../types/vtt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VTTUndoSnapshot = {
  tokens: VTTToken[];
  walls: VTTWall[];
  props: VTTProp[];
};

// ---------------------------------------------------------------------------
// Paramètres du hook
// ---------------------------------------------------------------------------

export interface UseVTTUndoParams {
  role: VTTRole;
  tokensRef: React.MutableRefObject<VTTToken[]>;
  wallsRef:  React.MutableRefObject<VTTWall[]>;
  propsRef:  React.MutableRefObject<VTTProp[]>;
  activeSceneIdRef: React.MutableRefObject<string | null>;
  setTokens: React.Dispatch<React.SetStateAction<VTTToken[]>>;
  setWalls:  React.Dispatch<React.SetStateAction<VTTWall[]>>;
  setProps:  React.Dispatch<React.SetStateAction<VTTProp[]>>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVTTUndo({
  role,
  tokensRef,
  wallsRef,
  propsRef,
  activeSceneIdRef,
  setTokens,
  setWalls,
  setProps,
}: UseVTTUndoParams) {
  const [undoStack, setUndoStack] = useState<VTTUndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<VTTUndoSnapshot[]>([]);

  const makeSnapshot = useCallback((): VTTUndoSnapshot => ({
    tokens: structuredClone(tokensRef.current),
    walls:  structuredClone(wallsRef.current),
    props:  structuredClone(propsRef.current),
  }), [tokensRef, wallsRef, propsRef]);

  const pushUndoSnapshot = useCallback(() => {
    if (role !== 'gm') return;
    setUndoStack(prev => [...prev.slice(-9), makeSnapshot()]);
    setRedoStack([]);
  }, [role, makeSnapshot]);

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
          walls:  snapshot.walls,
          props:  snapshot.props,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sceneId)
        .then(({ error }) => {
          if (error) console.error('[VTT] Undo/redo persist error:', error);
        });
    }
    vttService.send({ type: 'UPDATE_WALLS', walls: snapshot.walls });
  }, [tokensRef, wallsRef, propsRef, activeSceneIdRef, setTokens, setWalls, setProps]);

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