import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { vttService } from '../services/vttService';
import { DEFAULT_FOG } from './useVTTFog';
import type {
  VTTScene,
  VTTRoomConfig,
  VTTFogState,
  VTTToken,
  VTTProp,
  VTTWall,
  VTTDoor,
  VTTWindow,
  VTTRole,
  VTTWeatherEffect,
} from '../types/vtt';

// ---------------------------------------------------------------------------
// Constantes exportées (supprimables de VTTPage une fois branché)
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: VTTRoomConfig = {
  mapImageUrl: '',
  gridSize: 60,
  snapToGrid: true,
  fogEnabled: true,
  fogPersistent: false,
  mapWidth: 3000,
  mapHeight: 2000,
};

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

const normalizeFogState = (fog?: VTTFogState | null): VTTFogState => ({
  revealedCells:   [...(fog?.revealedCells   || [])],
  strokes:         [...(fog?.strokes         || [])],
  exploredStrokes: [...(fog?.exploredStrokes || [])],
  seenDoors:       [...(fog?.seenDoors       || [])],
});

const getLastSceneStorageKey = (roomId: string) => `vtt:last-scene:${roomId}`;

function dbSceneToVTTScene(row: Record<string, unknown>): VTTScene {
  return {
    id:         row.id         as string,
    roomId:     row.room_id    as string,
    name:       row.name       as string,
    orderIndex: row.order_index as number,
    config:     { ...DEFAULT_CONFIG, ...(row.config as Partial<VTTRoomConfig>) },
    fogState:   normalizeFogState((row.fog_state as VTTFogState) || DEFAULT_FOG),
    tokens:     (row.tokens  as VTTToken[])  || [],
    walls:      (row.walls   as VTTWall[])   || [],
    doors:      (row.doors   as VTTDoor[])   || [],
    windows:    (row.windows as VTTWindow[]) || [],
    props:      (row.props   as VTTProp[])   || [],
  };
}

// ---------------------------------------------------------------------------
// Paramètres du hook
// ---------------------------------------------------------------------------
// applySceneToLive doit mettre à jour de nombreux states externes (tokens, fog,
// walls, props, viewport…). Plutôt que de tout passer en paramètre individuel,
// on regroupe les setters dans un objet "callbacks" pour garder la signature lisible.

export interface ApplySceneCallbacks {
  setConfig:         React.Dispatch<React.SetStateAction<VTTRoomConfig>>;
  setTokens:         React.Dispatch<React.SetStateAction<VTTToken[]>>;
  setWalls:          React.Dispatch<React.SetStateAction<VTTWall[]>>;
  setDoors:          React.Dispatch<React.SetStateAction<VTTDoor[]>>;
  setWindows:        React.Dispatch<React.SetStateAction<VTTWindow[]>>;
  setProps:          React.Dispatch<React.SetStateAction<VTTProp[]>>;
  setSelectedPropId: React.Dispatch<React.SetStateAction<string | null>>;
  setWeatherEffects: React.Dispatch<React.SetStateAction<VTTWeatherEffect[]>>;
  setSavedViewport:  React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number } | null>>;
  setCanvasViewport: React.Dispatch<React.SetStateAction<{ x: number; y: number; scale: number }>>;

  // Depuis useVTTFog
  applyFogState: (fog: VTTFogState) => void;

  // Refs à mettre à jour en synchrone
  fogStateRef:      React.MutableRefObject<VTTFogState>;
  canvasViewportRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  configRef:        React.MutableRefObject<VTTRoomConfig>;

  // Ref vers VTTCanvas pour broadcaster le masque exploré
  vttCanvasRef: React.MutableRefObject<{ getExploredMaskDataUrl?: () => { dataUrl: string; width: number; height: number } | null } | null>;
}

export interface UseVTTScenesParams {
  role:    VTTRole;
  roomId:  string | null;
  phase:   'lobby' | 'room';

  // Refs partagées avec les autres hooks
  activeSceneIdRef:  React.MutableRefObject<string | null>;
  fogStateRef:       React.MutableRefObject<VTTFogState>;
  tokensRef:         React.MutableRefObject<VTTToken[]>;
  wallsRef:          React.MutableRefObject<VTTWall[]>;
  doorsRef:          React.MutableRefObject<VTTDoor[]>;
  windowsRef:        React.MutableRefObject<VTTWindow[]>;
  propsRef:          React.MutableRefObject<VTTProp[]>;
  configRef:         React.MutableRefObject<VTTRoomConfig>;
  fogSaveTimerRef:   React.MutableRefObject<ReturnType<typeof setTimeout> | null>;

  // Setters et callbacks pour applySceneToLive
  callbacks: ApplySceneCallbacks;

  // Viewport courant (pour handleSaveView)
  canvasViewport: { x: number; y: number; scale: number };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVTTScenes({
  role,
  roomId,
  phase,
  activeSceneIdRef,
  fogStateRef,
  tokensRef,
  wallsRef,
  doorsRef,
  windowsRef,
  propsRef,
  configRef,
  fogSaveTimerRef,
  callbacks,
  canvasViewport,
}: UseVTTScenesParams) {

  // -------------------
  // State
  // -------------------
  const [scenes,        setScenes]        = useState<VTTScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [config,        setConfig]        = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [weatherEffects, setWeatherEffects] = useState<VTTWeatherEffect[]>([]);

  // State UI scène (context menu)
  const [sceneContextMenu, setSceneContextMenu] = useState<{
    sceneId:   string;
    sceneName: string;
    config:    VTTRoomConfig;
    x: number;
    y: number;
  } | null>(null);
  const [sceneConfigEdit, setSceneConfigEdit] = useState<{
    sceneId: string;
    config:  VTTRoomConfig;
  } | null>(null);

  // -------------------
  // Refs
  // -------------------
  const switchingSceneRef = useRef(false);
  const sceneLoadedRef    = useRef<string | null>(null);
  const weatherEffectsRef = useRef<VTTWeatherEffect[]>([]);
  weatherEffectsRef.current = weatherEffects;

  // Sync activeSceneId → ref (partagée avec les autres hooks)
  activeSceneIdRef.current = activeSceneId;

  // ===========================================================================
  // saveCurrentSceneState
  // ===========================================================================
  // Persiste l'intégralité de la scène courante dans Supabase.
  // Appelée par useVTTFog, useVTTTokens, useVTTGeometry, etc.
  // On la définit ici car elle a besoin de roomId et de toutes les refs.

  const saveCurrentSceneState = useCallback(async (sceneId: string) => {
    if (!sceneId || !roomId) return;
    await supabase
      .from('vtt_scenes')
      .update({
        config:     configRef.current,
        fog_state:  fogStateRef.current,
        tokens:     tokensRef.current,
        walls:      wallsRef.current,
        doors:      doorsRef.current,
        windows:    windowsRef.current,
        props:      propsRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId);
  }, [roomId, configRef, fogStateRef, tokensRef, wallsRef, doorsRef, windowsRef, propsRef]);

  // ===========================================================================
  // applySceneToLive
  // ===========================================================================
  // Applique une scène chargée depuis Supabase à tous les states React locaux
  // et aux refs. Aussi responsable du broadcast du masque exploré (fog de vision).

  const applySceneToLive = useCallback((scene: VTTScene) => {
    const {
      setConfig, setTokens, setWalls, setDoors, setWindows,
      setProps, setSelectedPropId, setWeatherEffects,
      setSavedViewport, setCanvasViewport,
      applyFogState, canvasViewportRef, vttCanvasRef,
    } = callbacks;

    setConfig(scene.config);
    setTokens(scene.tokens);

    const nextFogState = normalizeFogState(scene.fogState);
    applyFogState(nextFogState);

    setWalls(scene.walls   || []);
    setDoors(scene.doors   || []);
    setWindows(scene.windows || []);
    setProps(Array.isArray(scene.props) ? scene.props : []);
    setSelectedPropId(null);
    setWeatherEffects(scene.config.weatherEffects || []);
    setSavedViewport(scene.config.savedViewport ?? null);
    sceneLoadedRef.current = scene.id;

    console.log('[VTT] applySceneToLive: doors=', scene.doors?.length ?? 0, 'windows=', scene.windows?.length ?? 0);

    // Synchronisation du viewport React pour les props HTML
    const nextViewport = scene.config.savedViewport ?? { x: 0, y: 0, scale: 1 };
    setCanvasViewport(nextViewport);
    canvasViewportRef.current = nextViewport;

    setActiveSceneId(scene.id);

    if (scene.roomId) {
      localStorage.setItem(getLastSceneStorageKey(scene.roomId), scene.id);
    }

    // -------------------
    // Broadcast du masque exploré aux clients distants après changement de scène.
    // IMPORTANT : 2 rAF sont nécessaires.
    // Le 1er rAF laisse VTTCanvas déclencher son useEffect[sceneId] (reset + pré-création canvas).
    // Le 2ème rAF laisse restoreExploredMaskSnapshot() finir de charger l'image en async.
    // Sans le 2ème rAF, getExploredMaskDataUrl() encode un canvas encore noir.
    // -------------------
    if (scene.id) {
      const sceneIdToSend = scene.id;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const maskData = vttCanvasRef.current?.getExploredMaskDataUrl?.();
            if (maskData?.dataUrl) {
              vttService.broadcastExploredMask(sceneIdToSend, maskData);
            }
          }, 300);
        });
      });
    }

    vttService.setActiveSceneId(scene.id);
    vttService.send({
      type:     'SWITCH_SCENE',
      sceneId:  scene.id,
      config:   scene.config,
      tokens:   scene.tokens,
      fogState: scene.fogState,
      walls:    scene.walls   || [],
      doors:    scene.doors   || [],
      windows:  scene.windows || [],
    });
  }, [callbacks]);

  // ===========================================================================
  // Chargement initial des scènes (GM uniquement)
  // ===========================================================================

  useEffect(() => {
    if (phase !== 'room' || !roomId || role !== 'gm') return;

    supabase
      .from('vtt_scenes')
      .select('*')
      .eq('room_id', roomId)
      .order('order_index')
      .then(({ data }) => {
        if (data && data.length > 0) {
          const parsed = data.map(dbSceneToVTTScene);
          setScenes(parsed);

          if (!activeSceneIdRef.current) {
            const lastSceneId = localStorage.getItem(getLastSceneStorageKey(roomId));
            const restoredScene = lastSceneId
              ? parsed.find(s => s.id === lastSceneId)
              : null;

            const initialScene = restoredScene ?? {
              ...parsed[0],
              props: Array.isArray(parsed[0].props) ? parsed[0].props : [],
            };

            setActiveSceneId(initialScene.id);
            applySceneToLive(initialScene);
            vttService.updateLocalState(
              initialScene.config,
              initialScene.tokens,
              initialScene.fogState,
              initialScene.walls   || [],
              initialScene.doors   || [],
              initialScene.windows || [],
            );
          }
        } else {
          // Aucune scène existante → création automatique de "Scene 1"
          supabase
            .from('vtt_scenes')
            .insert({
              room_id:     roomId,
              name:        'Scene 1',
              order_index: 0,
              config:      DEFAULT_CONFIG,
              fog_state:   DEFAULT_FOG,
              tokens:      [],
              props:       [],
            })
            .select()
            .maybeSingle()
            .then(({ data: s }) => {
              if (s) {
                const scene = dbSceneToVTTScene(s);
                setScenes([scene]);
                setActiveSceneId(scene.id);
                applySceneToLive(scene);
              }
            });
        }
      });
  }, [phase, roomId, role, applySceneToLive, activeSceneIdRef]);

  // ===========================================================================
  // handleSwitchScene
  // ===========================================================================

  const handleSwitchScene = useCallback(async (sceneId: string) => {
    if (sceneId === activeSceneIdRef.current || switchingSceneRef.current) return;
    switchingSceneRef.current = true;

    try {
      // Sauvegarde immédiate du fog avant changement de scène
      if (fogSaveTimerRef.current) {
        clearTimeout(fogSaveTimerRef.current);
        fogSaveTimerRef.current = null;
      }

      if (activeSceneIdRef.current) {
        await supabase
          .from('vtt_scenes')
          .update({
            fog_state:  fogStateRef.current,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeSceneIdRef.current);

        await saveCurrentSceneState(activeSceneIdRef.current);
      }

      const { data } = await supabase
        .from('vtt_scenes')
        .select('*')
        .eq('id', sceneId)
        .maybeSingle();
      if (!data) return;

      const scene = dbSceneToVTTScene(data);

      vttService.send({
        type:     'SWITCH_SCENE',
        sceneId:  scene.id,
        config:   scene.config,
        tokens:   scene.tokens,
        fogState: scene.fogState,
        walls:    scene.walls   || [],
        doors:    scene.doors   || [],
        windows:  scene.windows || [],
      });

      const { setConfig, setTokens, setWalls, setDoors, setWindows,
              setProps, setSelectedPropId, setSavedViewport,
              setCanvasViewport, applyFogState, canvasViewportRef } = callbacks;

      setConfig(scene.config);

      const nextFogState = normalizeFogState(scene.fogState);
      applyFogState(nextFogState);

      setTokens(scene.tokens);
      setWalls(scene.walls   || []);
      setDoors(scene.doors   || []);
      setWindows(scene.windows || []);
      setProps(Array.isArray(scene.props) ? scene.props : []);
      setSelectedPropId(null);
      setActiveSceneId(sceneId);

      localStorage.setItem(getLastSceneStorageKey(roomId!), sceneId);

      vttService.setActiveSceneId(sceneId);
      setScenes(prev => prev.map(s =>
        s.id === sceneId
          ? { ...s, ...scene, props: Array.isArray(scene.props) ? scene.props : [] }
          : s
      ));
      setSavedViewport(scene.config.savedViewport ?? null);

      if (scene.config.savedViewport) {
        setCanvasViewport(scene.config.savedViewport);
        canvasViewportRef.current = scene.config.savedViewport;
      }
    } finally {
      switchingSceneRef.current = false;
    }
  }, [roomId, activeSceneIdRef, fogStateRef, fogSaveTimerRef, saveCurrentSceneState, callbacks]);

  // ===========================================================================
  // CRUD scènes
  // ===========================================================================

  const handleCreateScene = useCallback(async (name: string) => {
    if (!roomId) return;
    const { data } = await supabase
      .from('vtt_scenes')
      .insert({
        room_id:     roomId,
        name,
        order_index: scenes.length,
        config:      DEFAULT_CONFIG,
        fog_state:   DEFAULT_FOG,
        tokens:      [],
        props:       [],
      })
      .select()
      .maybeSingle();
    if (data) {
      const scene = dbSceneToVTTScene(data);
      setScenes(prev => [...prev, scene]);
    }
  }, [roomId, scenes.length]);

  const handleRenameScene = useCallback(async (sceneId: string, name: string) => {
    await supabase.from('vtt_scenes').update({ name }).eq('id', sceneId);
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, name } : s));
  }, []);

  const handleDeleteScene = useCallback(async (sceneId: string) => {
    await supabase.from('vtt_scenes').delete().eq('id', sceneId);
    setScenes(prev => {
      const next = prev.filter(s => s.id !== sceneId);
      if (activeSceneIdRef.current === sceneId && next.length > 0) {
        handleSwitchScene(next[0].id);
      }
      return next;
    });
  }, [activeSceneIdRef, handleSwitchScene]);

  // ===========================================================================
  // Config map & scène
  // ===========================================================================

  const handleUpdateMap = useCallback((changes: Partial<VTTRoomConfig>) => {
    callbacks.setConfig(prev => ({ ...prev, ...changes }));
    vttService.send({ type: 'UPDATE_MAP', config: changes });
    if (activeSceneIdRef.current) {
      setScenes(prev => prev.map(s =>
        s.id !== activeSceneIdRef.current
          ? s
          : { ...s, config: { ...s.config, ...changes } }
      ));
      supabase
        .from('vtt_scenes')
        .update({ config: { ...configRef.current, ...changes } })
        .eq('id', activeSceneIdRef.current)
        .then(() => {});
    }
  }, [activeSceneIdRef, configRef, callbacks]);

  const handleSceneRightClick = useCallback((sceneId: string, x: number, y: number) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    setSceneContextMenu({ sceneId, sceneName: scene.name, config: scene.config, x, y });
  }, [scenes]);

  const handleSaveSceneConfig = useCallback(async (sceneId: string, changes: Partial<VTTRoomConfig>) => {
    setScenes(prev => {
      const scene = prev.find(s => s.id === sceneId);
      if (!scene) return prev;
      const newConfig = { ...scene.config, ...changes };
      supabase.from('vtt_scenes').update({ config: newConfig }).eq('id', sceneId).then(() => {});
      return prev.map(s => s.id === sceneId ? { ...s, config: newConfig } : s);
    });
    if (sceneId === activeSceneIdRef.current) {
      callbacks.setConfig(prev => ({ ...prev, ...changes }));
      vttService.send({ type: 'UPDATE_MAP', config: changes });
    }
  }, [activeSceneIdRef, callbacks]);

  // ===========================================================================
  // Sauvegarde manuelle + vue
  // ===========================================================================

  const handleSaveScene = useCallback(async () => {
    if (!activeSceneIdRef.current || role !== 'gm') return;
    await saveCurrentSceneState(activeSceneIdRef.current);
  }, [role, activeSceneIdRef, saveCurrentSceneState]);

  const handleSaveView = useCallback(async () => {
    if (!activeSceneIdRef.current || role !== 'gm') return;
    const savedViewport = { x: canvasViewport.x, y: canvasViewport.y, scale: canvasViewport.scale };

    // 1. Propager aux joueurs connectés
    vttService.send({ type: 'UPDATE_MAP', config: { savedViewport } });

    // 2. Persister en base
    const newConfig = { ...configRef.current, savedViewport };
    await supabase
      .from('vtt_scenes')
      .update({ config: newConfig })
      .eq('id', activeSceneIdRef.current);

    // 3. Mettre à jour le tableau de scènes local
    setScenes(prev => prev.map(s =>
      s.id === activeSceneIdRef.current ? { ...s, config: newConfig } : s
    ));
  }, [role, canvasViewport, activeSceneIdRef, configRef]);

  // ===========================================================================
  // Météo
  // ===========================================================================

  const handleUpdateWeather = useCallback((effects: VTTWeatherEffect[]) => {
    if (role !== 'gm') return;
    setWeatherEffects(effects);
    weatherEffectsRef.current = effects;
    vttService.send({ type: 'UPDATE_WEATHER', effects });
    if (activeSceneIdRef.current) {
      callbacks.setConfig(prev => ({ ...prev, weatherEffects: effects }));
    }
  }, [role, activeSceneIdRef, callbacks]);

  // ---------------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------------
  return {
    // State
    scenes,
    activeSceneId,
    config,
    savedViewport,
    weatherEffects,
    weatherEffectsRef,
    sceneLoadedRef,

    // State UI
    sceneContextMenu,
    setSceneContextMenu,
    sceneConfigEdit,
    setSceneConfigEdit,

    // Setters (nécessaires pour handleServerEvent dans VTTPage)
    setScenes,
    setActiveSceneId,
    setConfig,
    setSavedViewport,
    setWeatherEffects,

    // Handlers
    saveCurrentSceneState,
    applySceneToLive,
    handleSwitchScene,
    handleCreateScene,
    handleRenameScene,
    handleDeleteScene,
    handleUpdateMap,
    handleSceneRightClick,
    handleSaveSceneConfig,
    handleSaveScene,
    handleSaveView,
    handleUpdateWeather,
  };
}