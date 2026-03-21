import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { vttService } from '../services/vttService';
import type { VTTWall, VTTDoor, VTTWindow, VTTRole } from '../types/vtt';

// ---------------------------------------------------------------------------
// Paramètres du hook
// ---------------------------------------------------------------------------

export interface UseVTTGeometryParams {
  role: VTTRole;
  activeSceneId: string | null;
  activeSceneIdRef: React.MutableRefObject<string | null>;
  sceneLoadedRef: React.MutableRefObject<string | null>;

  // pushUndoSnapshot vient de useVTTUndo
  pushUndoSnapshot: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVTTGeometry({
  role,
  activeSceneId,
  activeSceneIdRef,
  sceneLoadedRef,
  pushUndoSnapshot,
}: UseVTTGeometryParams) {

  // -------------------
  // State
  // -------------------
  const [walls, setWalls]     = useState<VTTWall[]>([]);
  const [doors, setDoors]     = useState<VTTDoor[]>([]);
  const [windows, setWindows] = useState<VTTWindow[]>([]);

  // -------------------
  // Refs (accès synchrone dans les callbacks)
  // -------------------
  const wallsRef   = useRef<VTTWall[]>([]);
  const doorsRef   = useRef<VTTDoor[]>([]);
  const windowsRef = useRef<VTTWindow[]>([]);
  wallsRef.current   = walls;
  doorsRef.current   = doors;
  windowsRef.current = windows;

  const geometrySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Autosave debounced (500 ms) à chaque changement de walls/doors/windows
  // Uniquement pour le MJ, et seulement si la scène est bien chargée.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (role !== 'gm' || !activeSceneId) return;
    if (sceneLoadedRef.current !== activeSceneId) return;

    console.log('[VTT] geometry autosave triggered: walls=', walls.length, 'doors=', doors.length, 'windows=', windows.length);

    if (geometrySaveTimerRef.current) clearTimeout(geometrySaveTimerRef.current);
    geometrySaveTimerRef.current = setTimeout(() => {
      console.log('[VTT] geometry autosave WRITE: walls=', walls.length, 'doors=', doors.length, 'windows=', windows.length);
      supabase
        .from('vtt_scenes')
        .update({ walls, doors, windows, updated_at: new Date().toISOString() })
        .eq('id', activeSceneId)
        .then(({ error }) => {
          if (error) console.error('[VTT] geometry autosave error:', error);
        });
    }, 500);

    return () => {
      if (geometrySaveTimerRef.current) clearTimeout(geometrySaveTimerRef.current);
    };
  }, [walls, doors, windows, activeSceneId, role, sceneLoadedRef]);

  // ===========================================================================
  // WALLS
  // ===========================================================================

  const handleWallAdded = useCallback((wall: VTTWall) => {
    pushUndoSnapshot();
    setWalls(prev => {
      const next = [...prev, wall];
      const sceneId = activeSceneIdRef.current;
      if (sceneId) {
        supabase
          .from('vtt_scenes')
          .update({ walls: next, updated_at: new Date().toISOString() })
          .eq('id', sceneId)
          .then(({ error }) => { if (error) console.error('[VTT] Save walls error:', error); });
      }
      vttService.send({ type: 'UPDATE_WALLS', walls: next });
      return next;
    });
  }, [pushUndoSnapshot, activeSceneIdRef]);

  const handleWallUpdated = useCallback((wall: VTTWall) => {
    pushUndoSnapshot();
    setWalls(prev => {
      const next = prev.map(w => w.id === wall.id ? wall : w);
      const sceneId = activeSceneIdRef.current;
      if (sceneId) {
        supabase
          .from('vtt_scenes')
          .update({ walls: next, updated_at: new Date().toISOString() })
          .eq('id', sceneId)
          .then(({ error }) => { if (error) console.error('[VTT] Update wall error:', error); });
      }
      vttService.send({ type: 'UPDATE_WALLS', walls: next });
      return next;
    });
  }, [pushUndoSnapshot, activeSceneIdRef]);

  const handleWallRemoved = useCallback((wallId: string) => {
    pushUndoSnapshot();
    setWalls(prev => {
      const next = prev.filter(w => w.id !== wallId);
      const sceneId = activeSceneIdRef.current;
      if (sceneId) {
        supabase
          .from('vtt_scenes')
          .update({ walls: next, updated_at: new Date().toISOString() })
          .eq('id', sceneId)
          .then(({ error }) => { if (error) console.error('[VTT] Remove wall error:', error); });
      }
      vttService.send({ type: 'UPDATE_WALLS', walls: next });
      return next;
    });
  }, [pushUndoSnapshot, activeSceneIdRef]);

  const handleClearWalls = useCallback(() => {
    pushUndoSnapshot();
    setWalls([]);
    vttService.send({ type: 'UPDATE_WALLS', walls: [] });
    const sceneId = activeSceneIdRef.current;
    if (sceneId) {
      supabase
        .from('vtt_scenes')
        .update({ walls: [], updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .then(({ error }) => { if (error) console.error('[VTT] Clear walls error:', error); });
    }
  }, [pushUndoSnapshot, activeSceneIdRef]);

  // ===========================================================================
  // DOORS
  // ===========================================================================

  const persistDoors = useCallback((nextDoors: VTTDoor[]) => {
    doorsRef.current = nextDoors;
    vttService.send({ type: 'UPDATE_DOORS', doors: nextDoors });
    const sceneId = activeSceneIdRef.current;
    if (sceneId) {
      supabase
        .from('vtt_scenes')
        .update({ doors: nextDoors, updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .then(({ error }) => { if (error) console.error('[VTT] Save doors error:', error); });
    }
  }, [activeSceneIdRef]);

  const handleDoorAdded = useCallback((door: VTTDoor) => {
    setDoors(prev => {
      const next = [...prev, door];
      persistDoors(next);
      return next;
    });
  }, [persistDoors]);

  const handleDoorToggled = useCallback((doorId: string, open: boolean) => {
    setDoors(prev => {
      const next = prev.map(d => d.id === doorId ? { ...d, open } : d);
      persistDoors(next);
      return next;
    });
  }, [persistDoors]);

  const handleDoorRemoved = useCallback((doorId: string) => {
    setDoors(prev => {
      const next = prev.filter(d => d.id !== doorId);
      persistDoors(next);
      return next;
    });
  }, [persistDoors]);

  const handleClearDoors = useCallback(() => {
    setDoors([]);
    persistDoors([]);
  }, [persistDoors]);

  // ===========================================================================
  // WINDOWS
  // ===========================================================================

  const persistWindows = useCallback((nextWindows: VTTWindow[]) => {
    windowsRef.current = nextWindows;
    vttService.send({ type: 'UPDATE_WINDOWS', windows: nextWindows } as any);
    const sceneId = activeSceneIdRef.current;
    console.log('[VTT] persistWindows called, count=', nextWindows.length, 'sceneId=', sceneId);
    if (sceneId) {
      supabase
        .from('vtt_scenes')
        .update({ windows: nextWindows, updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .then(({ data, error, status, statusText }) => {
          console.log('[VTT] persistWindows DB result:', { status, statusText, error, data });
          if (error) console.error('[VTT] Save windows error:', error);
        });
    }
  }, [activeSceneIdRef]);

  const handleWindowAdded = useCallback((win: VTTWindow) => {
    setWindows(prev => {
      const next = [...prev, win];
      persistWindows(next);
      return next;
    });
  }, [persistWindows]);

  const handleWindowRemoved = useCallback((windowId: string) => {
    setWindows(prev => {
      const next = prev.filter(w => w.id !== windowId);
      persistWindows(next);
      return next;
    });
  }, [persistWindows]);

  const handleClearWindows = useCallback(() => {
    setWindows([]);
    persistWindows([]);
  }, [persistWindows]);

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  return {
    // State (à passer aux composants enfants)
    walls,
    doors,
    windows,
    setWalls,
    setDoors,
    setWindows,

    // Refs (à passer à useVTTUndo et saveCurrentSceneState)
    wallsRef,
    doorsRef,
    windowsRef,

    // Handlers walls
    handleWallAdded,
    handleWallUpdated,
    handleWallRemoved,
    handleClearWalls,

    // Handlers doors
    handleDoorAdded,
    handleDoorToggled,
    handleDoorRemoved,
    handleClearDoors,

    // Handlers windows
    handleWindowAdded,
    handleWindowRemoved,
    handleClearWindows,
  };
}