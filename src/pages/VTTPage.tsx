import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { VTTCanvas } from '../components/VTT/VTTCanvas';
import type { VTTCanvasHandle } from '../components/VTT/VTTCanvas';
import { VTTLeftToolbar } from '../components/VTT/VTTLeftToolbar';
import type { VTTActiveTool } from '../components/VTT/VTTLeftToolbar';
import { VTTSidebar } from '../components/VTT/VTTSidebar';
import { VTTSceneBar } from '../components/VTT/VTTSceneBar';
import { VTTContextMenu } from '../components/VTT/VTTContextMenu';
import { AddTokenModal } from '../components/VTT/AddTokenModal';
import { VTTTokenEditModal } from '../components/VTT/VTTTokenEditModal';
import { VTTVisionConfigModal } from '../components/VTT/VTTVisionConfigModal';
import { VTTSceneConfigModal } from '../components/VTT/VTTSceneConfigModal';
import { VTTRoomLobby } from '../components/VTT/VTTRoomLobby';
import { VTTPlayerList } from '../components/VTT/VTTPlayerList';
import { VTTBroadcastFrame } from '../components/VTT/VTTBroadcastFrame';
import { VTTTokenBindingModal } from '../components/VTT/VTTTokenBindingModal';
import { vttService } from '../services/vttService';
import type {
  VTTRole,
  VTTToken,
  VTTRoomConfig,
  VTTFogState,
  VTTFogStroke,
  VTTScene,
  VTTServerEvent,
  VTTProp,
  VTTWall,
  VTTConnectedUser,
  VTTWeatherEffect,
} from '../types/vtt';
import { VTTWeatherOverlay } from '../components/VTT/VTTWeatherOverlay';

interface VTTPageProps {
  session: Session;
  onBack: () => void;
}

const DEFAULT_CONFIG: VTTRoomConfig = {
  mapImageUrl: '',
  gridSize: 60,
  snapToGrid: true,
  fogEnabled: true,
  fogPersistent: false,
  mapWidth: 3000,
  mapHeight: 2000,
};

const DEFAULT_FOG: VTTFogState = { revealedCells: [] };

function dbSceneToVTTScene(row: Record<string, unknown>): VTTScene {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    name: row.name as string,
    orderIndex: row.order_index as number,
    config: { ...DEFAULT_CONFIG, ...(row.config as Partial<VTTRoomConfig>) },
    fogState: (row.fog_state as VTTFogState) || DEFAULT_FOG,
    tokens: (row.tokens as VTTToken[]) || [],
    walls: (row.walls as VTTWall[]) || [],
  };
}

export function VTTPage({ session, onBack }: VTTPageProps) {
  const [phase, setPhase] = useState<'lobby' | 'room'>('lobby');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [requestedRole, setRequestedRole] = useState<'gm' | 'player'>('player');
  const [playerBoundTokenIds, setPlayerBoundTokenIds] = useState<string[]>([]);

  const [role, setRole] = useState<VTTRole>('player');
  const [config, setConfig] = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<VTTToken[]>([]);
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [connectedUsers, setConnectedUsers] = useState<VTTConnectedUser[]>([]);
  const [connected, setConnected] = useState(false);

  const [activeTool, setActiveTool] = useState<VTTActiveTool>('select');
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([]);
  const [fogBrushSize, setFogBrushSize] = useState(30);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [showAddToken, setShowAddToken] = useState(false);
  const [sceneConfigEdit, setSceneConfigEdit] = useState<{ sceneId: string; config: VTTRoomConfig } | null>(null);
    const [sceneContextMenu, setSceneContextMenu] = useState<{ sceneId: string; sceneName: string; config: VTTRoomConfig; x: number; y: number } | null>(null);
  
  const [editingToken, setEditingToken] = useState<VTTToken | null>(null);
  const [bindingToken, setBindingToken] = useState<VTTToken | null>(null);
  const [visionToken, setVisionToken] = useState<VTTToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ token: VTTToken; x: number; y: number } | null>(null);
  const [showWalls, setShowWalls] = useState(true);
  const [walls, setWalls] = useState<VTTWall[]>([]);
  const wallsRef = useRef<VTTWall[]>([]);
  wallsRef.current = walls;

  const [scenes, setScenes] = useState<VTTScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const switchingSceneRef = useRef(false);

  const configRef = useRef(config);
  configRef.current = config;
  const fogStateRef = useRef(fogState);
  fogStateRef.current = fogState;
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const activeSceneIdRef = useRef(activeSceneId);
  activeSceneIdRef.current = activeSceneId;

  const [props, setProps] = useState<VTTProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [broadcastFrameEnabled, setBroadcastFrameEnabled] = useState(false);
    const [draggingPropId, setDraggingPropId] = useState<string | null>(null);
  const [resizingPropId, setResizingPropId] = useState<string | null>(null);

  const propDragRef = useRef<{
    propId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const propResizeRef = useRef<{
    propId: string;
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [broadcastFrame, setBroadcastFrame] = useState({ x: 200, y: 100, width: 1600, height: 900 });
  const [broadcastAspectRatio, setBroadcastAspectRatio] = useState('16:9');
  const [broadcastLockRatio, setBroadcastLockRatio] = useState(true);
  const [broadcastMode, setBroadcastMode] = useState<'frame' | 'follow'>('follow');
  const broadcastFrameRef = useRef(broadcastFrame);
  broadcastFrameRef.current = broadcastFrame;
  const broadcastModeRef = useRef(broadcastMode);
  broadcastModeRef.current = broadcastMode;
  const broadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gmFollowEnabled, setGmFollowEnabled] = useState(false);
  const gmFollowEnabledRef = useRef(false);
  gmFollowEnabledRef.current = gmFollowEnabled;
  const [playerForcedViewport, setPlayerForcedViewport] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [playerInitialViewport, setPlayerInitialViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const playerInitialViewportSetRef = useRef(false);
  const [weatherEffects, setWeatherEffects] = useState<VTTWeatherEffect[]>([]);
  const weatherEffectsRef = useRef<VTTWeatherEffect[]>([]);
  weatherEffectsRef.current = weatherEffects;

  const userId = session.user.id;
  const authToken = session.access_token;
  const userName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Joueur';

  const vttCanvasRef = useRef<VTTCanvasHandle>(null);

  const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const moveThrottleRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const fogSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleServerEvent = useCallback((event: VTTServerEvent) => {
    switch (event.type) {
      case 'STATE_SYNC':
        setConfig(event.state.room.config);
        setTokens(event.state.room.tokens);
        setFogState(event.state.room.fogState);
        setWalls(event.state.room.walls || []);
        setRole(event.state.yourRole);
        setWeatherEffects(event.state.room.config.weatherEffects || []);
        break;
      case 'TOKEN_MOVED':
        setTokens(prev => prev.map(t =>
          t.id === event.tokenId ? { ...t, position: event.position } : t
        ));
        break;
      case 'TOKEN_ADDED':
        setTokens(prev => {
          if (prev.some(t => t.id === event.token.id)) return prev;
          return [...prev, event.token];
        });
        break;
      case 'TOKEN_REMOVED':
        setTokens(prev => prev.filter(t => t.id !== event.tokenId));
        setSelectedTokenId(id => id === event.tokenId ? null : id);
        break;
      case 'TOKEN_UPDATED':
        setTokens(prev => prev.map(t =>
          t.id === event.tokenId ? { ...t, ...event.changes } : t
        ));
        break;
      case 'FOG_UPDATED':
        setFogState(event.fogState);
        break;
      case 'MAP_UPDATED':
        setConfig(prev => ({ ...prev, ...event.config }));
        break;
      case 'SCENE_SWITCHED':
        setConfig(event.config);
        setTokens(event.tokens);
        setFogState(event.fogState);
        setWalls(event.walls);
        setWeatherEffects(event.config.weatherEffects || []);
        break;
      case 'WALLS_UPDATED':
        setWalls(event.walls);
        break;
      case 'WEATHER_UPDATED':
        setWeatherEffects(event.effects);
        break;
      case 'USER_JOINED':
      case 'USER_LEFT':
        break;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'room' || !roomId) return;
    const unsub = vttService.onMessage(handleServerEvent);
    const unsubConn = vttService.onConnectionChange(setConnected);
    const unsubPresence = vttService.onPresenceChange(setConnectedUsers);
    // Joueur : abonnement au viewport forcé par le MJ
    const unsubVp = role === 'player'
      ? vttService.onBroadcastViewport(vp => setPlayerForcedViewport(vp))
      : () => {};
    vttService.connect(roomId, userId, authToken, userName, requestedRole);
    return () => { unsub(); unsubConn(); unsubPresence(); unsubVp(); vttService.disconnect(); };
  }, [phase, roomId, userId, authToken, userName, requestedRole, handleServerEvent]);

  const applySceneToLive = useCallback((scene: VTTScene) => {
    setConfig(scene.config);
    setTokens(scene.tokens);
    setFogState(scene.fogState);
    setWalls(scene.walls || []);
        setWeatherEffects(scene.config.weatherEffects || []);
        setSavedViewport(scene.config.savedViewport ?? null);
    vttService.setActiveSceneId(scene.id);
    vttService.send({
      type: 'SWITCH_SCENE',
      sceneId: scene.id,
      config: scene.config,
      tokens: scene.tokens,
      fogState: scene.fogState,
      walls: scene.walls || [],
    });
  }, []);

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
          if (!activeSceneId) {
            const first = parsed[0];
            setActiveSceneId(first.id);
            applySceneToLive(first);
          }
        } else {
          supabase
            .from('vtt_scenes')
            .insert({ room_id: roomId, name: 'Scene 1', order_index: 0, config: DEFAULT_CONFIG, fog_state: DEFAULT_FOG, tokens: [] })
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
  }, [phase, roomId, role, applySceneToLive]);

  const saveCurrentSceneState = useCallback(async (sceneId: string) => {
    if (!sceneId || !roomId) return;
    await supabase
      .from('vtt_scenes')
      .update({
        config: configRef.current,
        fog_state: fogStateRef.current,
        tokens: tokensRef.current,
        walls: wallsRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId);
  }, [roomId]);

  const handleSwitchScene = useCallback(async (sceneId: string) => {
    if (sceneId === activeSceneIdRef.current || switchingSceneRef.current) return;
    switchingSceneRef.current = true;
    try {
      if (activeSceneIdRef.current) await saveCurrentSceneState(activeSceneIdRef.current);

      const { data } = await supabase
        .from('vtt_scenes')
        .select('*')
        .eq('id', sceneId)
        .maybeSingle();
      if (!data) return;
      const scene = dbSceneToVTTScene(data);

      vttService.send({
        type: 'SWITCH_SCENE',
        sceneId: scene.id,
        config: scene.config,
        tokens: scene.tokens,
        fogState: scene.fogState,
        walls: scene.walls || [],
      });

      setConfig(scene.config);
      setFogState(scene.fogState);
      setTokens(scene.tokens);
      setWalls(scene.walls || []);
      setActiveSceneId(sceneId);
      vttService.setActiveSceneId(sceneId);
      setScenes(prev => prev.map(s => s.id === sceneId ? scene : s));
            setSavedViewport(scene.config.savedViewport ?? null);
    } finally {
      switchingSceneRef.current = false;
    }
  }, [saveCurrentSceneState]);

  const handleCreateScene = useCallback(async (name: string) => {
    if (!roomId) return;
    const orderIndex = scenes.length;
    const { data } = await supabase
      .from('vtt_scenes')
      .insert({
        room_id: roomId,
        name,
        order_index: orderIndex,
        config: DEFAULT_CONFIG,
        fog_state: DEFAULT_FOG,
        tokens: [],
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
  }, [handleSwitchScene]);

  const handleMoveToken = useCallback((tokenId: string, position: { x: number; y: number }) => {
    setTokens(prev => prev.map(t => t.id === tokenId ? { ...t, position } : t));
    pendingMovesRef.current.set(tokenId, position);
    const existing = moveThrottleRef.current.get(tokenId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      const pos = pendingMovesRef.current.get(tokenId);
      if (pos) {
        vttService.send({ type: 'MOVE_TOKEN_REQUEST', tokenId, position: pos });
        pendingMovesRef.current.delete(tokenId);
      }
      moveThrottleRef.current.delete(tokenId);
    }, 50);
    moveThrottleRef.current.set(tokenId, timer);
  }, []);

  const handleRevealFog = useCallback((stroke: VTTFogStroke) => {
    setFogState(prev => ({
      revealedCells: prev.revealedCells,
      strokes: [...(prev.strokes || []), stroke],
    }));
    vttService.send({ type: 'REVEAL_FOG', cells: [], erase: stroke.erase, stroke });
    // Pour le GM uniquement : sauvegarde complète de la scène (config + tokens + fog + walls)
    // Pour les joueurs, c'est vttService._persistNow() via RPC qui gère le fog
    if (activeSceneIdRef.current && role === 'gm') {
      if (fogSaveTimerRef.current) clearTimeout(fogSaveTimerRef.current);
      fogSaveTimerRef.current = setTimeout(() => {
        saveCurrentSceneState(activeSceneIdRef.current!);
      }, 2000);
    }
  }, [saveCurrentSceneState, role]);

  const handleAddToken = useCallback((token: Omit<VTTToken, 'id'>) => {
    const center = vttCanvasRef.current?.getViewportCenter() ?? { x: 200, y: 200 };
    vttService.send({ type: 'ADD_TOKEN', token: { ...token, position: center } });
  }, []);

  const canControlToken = useCallback((token: VTTToken): boolean => {
    if (role === 'gm') return true;
    if (token.controlledByUserIds && token.controlledByUserIds.includes(userId)) return true;
    return false;
  }, [role, userId]);

  const handleDropToken = useCallback((tokenId: string, worldPos: { x: number; y: number }) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    if (!canControlToken(token)) return;
    handleMoveToken(tokenId, worldPos);
  }, [canControlToken, handleMoveToken]);

  const handleRemoveToken = useCallback((tokenId: string) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    if (!canControlToken(token)) return;
    vttService.send({ type: 'REMOVE_TOKEN', tokenId });
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    setSelectedTokenId(id => id === tokenId ? null : id);
    setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
  }, [canControlToken]);


  
  useEffect(() => {
    if (phase !== 'room') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      if (role !== 'gm') return;
      if (selectedTokenId) {
        e.preventDefault();
        handleRemoveToken(selectedTokenId);
      } else if (selectedPropId) {
        e.preventDefault();
        setProps(prev => prev.filter(p => p.id !== selectedPropId));
        setSelectedPropId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, role, selectedTokenId, selectedPropId, handleRemoveToken]);

  const handleToggleVisibility = useCallback((tokenId: string) => {
    if (role !== 'gm') return;
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes: { visible: !token.visible } });
  }, [tokens, role]);

  const handleEditTokenSave = useCallback((changes: Partial<VTTToken>) => {
    if (!editingToken) return;
    if (!canControlToken(editingToken)) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId: editingToken.id, changes });
  }, [editingToken, canControlToken]);

  const handleUpdateToken = useCallback((tokenId: string, changes: Partial<VTTToken>) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    if (!canControlToken(token)) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes });
  }, [canControlToken]);

  const handleResizeToken = useCallback((tokenId: string, size: number) => {
    handleUpdateToken(tokenId, { size });
  }, [handleUpdateToken]);

  const handleAddTokenAtPos = useCallback((tokenData: Omit<VTTToken, 'id'>, worldPos: { x: number; y: number }) => {
    vttService.send({ type: 'ADD_TOKEN', token: { ...tokenData, position: worldPos } });
  }, []);

  const handleResetFog = useCallback(() => {
    if (role !== 'gm') return;
    if (!window.confirm('Reinitialiser tout le brouillard de guerre ?')) return;
    vttService.send({ type: 'RESET_FOG' });
    setFogState({ revealedCells: [], strokes: [] });
  }, [role]);

  const handleRevealAll = useCallback(() => {
    if (role !== 'gm') return;
    const mapW = configRef.current.mapWidth || 3000;
    const mapH = configRef.current.mapHeight || 2000;
    const r = Math.sqrt(mapW * mapW + mapH * mapH);
    const stroke = { x: mapW / 2, y: mapH / 2, r, erase: false };
    const newFog = { revealedCells: [], strokes: [stroke] };
    setFogState(newFog);
    vttService.send({ type: 'RESET_FOG' });
    vttService.send({ type: 'REVEAL_FOG', cells: [], erase: false, stroke });
  }, [role]);

  const handleMaskAll = useCallback(() => {
    if (role !== 'gm') return;
    const newFog = { revealedCells: [], strokes: [] };
    setFogState(newFog);
    vttService.send({ type: 'RESET_FOG' });
  }, [role]);

  const handleUpdateMap = useCallback((changes: Partial<VTTRoomConfig>) => {
    setConfig(prev => ({ ...prev, ...changes }));
    vttService.send({ type: 'UPDATE_MAP', config: changes });
    if (activeSceneIdRef.current) {
      setScenes(prev => prev.map(s => {
        if (s.id !== activeSceneIdRef.current) return s;
        return { ...s, config: { ...s.config, ...changes } };
      }));
      supabase
        .from('vtt_scenes')
        .update({ config: { ...configRef.current, ...changes } })
        .eq('id', activeSceneIdRef.current)
        .then(() => {});
    }
  }, []);

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
      setConfig(prev => ({ ...prev, ...changes }));
      vttService.send({ type: 'UPDATE_MAP', config: changes });
    }
  }, []);

  const handleCalibrationPoint = useCallback((pt: { x: number; y: number }) => {
    setCalibrationPoints(prev => {
      if (prev.length >= 2) return [pt];
      return [...prev, pt];
    });
  }, []);

  const handleClearCalibration = useCallback(() => {
    setCalibrationPoints([]);
  }, []);

  const handleApplyCalibration = useCallback(() => {
    if (calibrationPoints.length < 2) return;
    const [p1, p2] = calibrationPoints;
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const cellSize = Math.round(Math.max(dx, dy));
    if (cellSize < 10) return;
    const ox = Math.round(((p1.x % cellSize) + cellSize) % cellSize);
    const oy = Math.round(((p1.y % cellSize) + cellSize) % cellSize);
    handleUpdateMap({ gridSize: cellSize, gridOffsetX: ox, gridOffsetY: oy });
    setCalibrationPoints([]);
    setActiveTool('select');
  }, [calibrationPoints, handleUpdateMap]);

  const handleAddProp = useCallback((propData: Omit<VTTProp, 'id'>) => {
    const newProp: VTTProp = { ...propData, id: crypto.randomUUID() };
    setProps(prev => [...prev, newProp]);
  }, []);

  const handleRemoveProp = useCallback((propId: string) => {
    setProps(prev => prev.filter(p => p.id !== propId));
    setSelectedPropId(id => id === propId ? null : id);
  }, []);

  const handleUpdateProp = useCallback((propId: string, changes: Partial<VTTProp>) => {
    setProps(prev => prev.map(p => p.id === propId ? { ...p, ...changes } : p));
  }, []);

  const handlePropMouseDown = useCallback((e: React.MouseEvent, prop: VTTProp) => {
    if (role !== 'gm' || prop.locked) return;

    e.preventDefault();
    e.stopPropagation();

    const elementRect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    setSelectedPropId(prop.id);
    setDraggingPropId(prop.id);
    setResizingPropId(null);
    propResizeRef.current = null;

    propDragRef.current = {
      propId: prop.id,
      offsetX: e.clientX - elementRect.left,
      offsetY: e.clientY - elementRect.top,
    };
  }, [role]);

  const handlePropResizeMouseDown = useCallback((e: React.MouseEvent, prop: VTTProp) => {
    if (role !== 'gm' || prop.locked) return;

    e.preventDefault();
    e.stopPropagation();

    setSelectedPropId(prop.id);
    setResizingPropId(prop.id);
    setDraggingPropId(null);
    propDragRef.current = null;

    propResizeRef.current = {
      propId: prop.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: prop.width,
      startHeight: prop.height,
    };
  }, [role]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = canvasContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      if (propDragRef.current) {
        const { propId, offsetX, offsetY } = propDragRef.current;

        const nextX = e.clientX - containerRect.left - offsetX;
        const nextY = e.clientY - containerRect.top - offsetY;

        handleUpdateProp(propId, {
          position: {
            x: Math.max(0, nextX),
            y: Math.max(0, nextY),
          },
        });
        return;
      }

      if (propResizeRef.current) {
        const {
          propId,
          startMouseX,
          startMouseY,
          startWidth,
          startHeight,
        } = propResizeRef.current;

        const deltaX = e.clientX - startMouseX;
        const deltaY = e.clientY - startMouseY;

        handleUpdateProp(propId, {
          width: Math.max(40, startWidth + deltaX),
          height: Math.max(40, startHeight + deltaY),
        });
      }
    };

    const handleMouseUp = () => {
      propDragRef.current = null;
      propResizeRef.current = null;
      setDraggingPropId(null);
      setResizingPropId(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleUpdateProp]);

  const handleWallAdded = useCallback((wall: VTTWall) => {
    setWalls(prev => {
      const next = [...prev, wall];
      // Sauvegarder immédiatement dans la scène active
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
  }, []);

  const handleWallUpdated = useCallback((wall: VTTWall) => {
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
  }, []);

  const handleWallRemoved = useCallback((wallId: string) => {
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
  }, []);
  
  const handleClearWalls = useCallback(() => {
    setWalls([]);
    vttService.send({ type: 'UPDATE_WALLS', walls: [] });
    // Sauvegarder dans la scène active
    const sceneId = activeSceneIdRef.current;
    if (sceneId) {
      supabase
        .from('vtt_scenes')
        .update({ walls: [], updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .then(({ error }) => { if (error) console.error('[VTT] Clear walls error:', error); });
    }
  }, []);

  const handleBroadcastFrameChange = useCallback((frame: { x: number; y: number; width: number; height: number }) => {
    setBroadcastFrame(frame);
    if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
    broadcastTimerRef.current = setTimeout(() => {
      vttService.sendBroadcastViewport(frame);
    }, 50);
  }, []);

  const handleCanvasViewportChange = useCallback((vp: { x: number; y: number; scale: number }) => {
    setCanvasViewport(vp);
    // Mode suivi joueurs : envoie viewport à tous les joueurs
    if (role === 'gm' && gmFollowEnabledRef.current) {
      const container = canvasContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const worldX = -vp.x / vp.scale;
        const worldY = -vp.y / vp.scale;
        const worldW = rect.width / vp.scale;
        const worldH = rect.height / vp.scale;
        vttService.sendBroadcastViewport({ x: worldX, y: worldY, width: worldW, height: worldH });
      }
    }
    if (broadcastModeRef.current !== 'follow') return;
    const container = canvasContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const worldX = -vp.x / vp.scale;
    const worldY = -vp.y / vp.scale;
    const worldW = rect.width / vp.scale;
    const worldH = rect.height / vp.scale;
    if (followTimerRef.current) clearTimeout(followTimerRef.current);
    followTimerRef.current = setTimeout(() => {
      vttService.sendBroadcastViewport({ x: worldX, y: worldY, width: worldW, height: worldH });
    }, 50);
  }, []);

  const handleOpenBroadcastWindow = useCallback(() => {
    if (!roomId) return;
    const url = `${window.location.origin}${window.location.pathname}#/vtt-broadcast/${roomId}`;
    window.open(url, `vtt-broadcast-${roomId}`, 'width=1280,height=720,menubar=no,toolbar=no');
    setTimeout(() => {
      if (broadcastModeRef.current === 'frame' && broadcastFrameEnabled) {
        vttService.sendBroadcastViewport(broadcastFrameRef.current);
      } else if (broadcastModeRef.current === 'follow') {
        const container = canvasContainerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const vp = canvasViewport;
          vttService.sendBroadcastViewport({
            x: -vp.x / vp.scale,
            y: -vp.y / vp.scale,
            width: rect.width / vp.scale,
            height: rect.height / vp.scale,
          });
        }
      }
    }, 500);
  }, [roomId, broadcastFrameEnabled, canvasViewport]);

  const handleSaveScene = useCallback(async () => {
    if (!activeSceneIdRef.current || role !== 'gm') return;
    await saveCurrentSceneState(activeSceneIdRef.current);
  }, [role, saveCurrentSceneState]);

  const handleSaveView = useCallback(async () => {
    if (!activeSceneIdRef.current || role !== 'gm') return;
    const vp = canvasViewport;
    const savedViewport = { x: vp.x, y: vp.y, scale: vp.scale };
    // 1. Propager aux joueurs connectés via UPDATE_MAP (sans toucher au state config local)
    vttService.send({ type: 'UPDATE_MAP', config: { savedViewport } });
    // 2. Persister en base
    const newConfig = { ...configRef.current, savedViewport };
    await supabase
      .from('vtt_scenes')
      .update({ config: newConfig })
      .eq('id', activeSceneIdRef.current);
    // 3. Mettre à jour le tableau de scènes local
    setScenes(prev =>
      prev.map(s =>
        s.id === activeSceneIdRef.current
          ? { ...s, config: newConfig }
          : s
      )
    );
  }, [role, canvasViewport]);
  
    const handleUpdateWeather = useCallback((effects: VTTWeatherEffect[]) => {
    if (role !== 'gm') return;
    setWeatherEffects(effects);
    weatherEffectsRef.current = effects;
    // Propager aux joueurs via UPDATE_MAP (réutilise la config)
    vttService.send({ type: 'UPDATE_WEATHER', effects });
    // Persister dans la scène
    if (activeSceneIdRef.current) {
      setConfig(prev => ({ ...prev, weatherEffects: effects }));
    }
  }, [role]);

  
  const leaveRoom = useCallback(async () => {
    if (activeSceneIdRef.current && role === 'gm') {
      await saveCurrentSceneState(activeSceneIdRef.current);
    }
    setPhase('lobby');
    setRoomId(null);
    setTokens([]);
    setFogState(DEFAULT_FOG);
    setSelectedTokenId(null);
    setScenes([]);
    setActiveSceneId(null);
    setProps([]);
    setSelectedPropId(null);
    setWalls([]);
    setConnectedUsers([]);
  }, [role, saveCurrentSceneState]);

  const handleJoinFromLobby = useCallback((id: string, chosenRole: 'gm' | 'player', selectedTokenIds?: string[]) => {
    setRoomId(id);
    setRequestedRole(chosenRole);
    setPlayerBoundTokenIds(selectedTokenIds || []);
    setPhase('room');
  }, []);

  useEffect(() => {
    if (phase !== 'room' || !roomId || role !== 'player' || playerBoundTokenIds.length === 0) return;
    if (tokens.length === 0) return;

    // Assigner userId aux tokens sélectionnés
    playerBoundTokenIds.forEach(tid => {
      const token = tokens.find(t => t.id === tid);
      if (!token) return;
      vttService.send({
        type: 'UPDATE_TOKEN',
        tokenId: tid,
        changes: { controlledByUserIds: [userId] },
      });
    });

    // Retirer userId de tous les tokens NON sélectionnés (exclusivité)
    tokens.forEach(token => {
      if (playerBoundTokenIds.includes(token.id)) return;
      if (!token.controlledByUserIds?.includes(userId)) return;
      // Ce token avait userId mais n'est pas dans la sélection actuelle → on retire userId
      const newControlled = token.controlledByUserIds.filter(id => id !== userId);
      vttService.send({
        type: 'UPDATE_TOKEN',
        tokenId: token.id,
        changes: { controlledByUserIds: newControlled },
      });
    });

    setPlayerBoundTokenIds([]);
  }, [phase, roomId, role, playerBoundTokenIds, tokens, userId]);

  // Centrer la vue joueur sur son premier token contrôlé (one-shot)
  useEffect(() => {
    if (role !== 'player') return;
    if (playerInitialViewportSetRef.current) return;
    if (tokens.length === 0) return;

    const myToken = tokens.find(t =>
      t.visible && t.controlledByUserIds?.includes(userId)
    );
    if (!myToken) return;

    const container = canvasContainerRef.current;
    const W = container?.clientWidth ?? window.innerWidth;
    const H = container?.clientHeight ?? window.innerHeight;
    const CELL = config.gridSize || 60;
    const scale = 1;
    const tokenCX = myToken.position.x + ((myToken.size || 1) * CELL) / 2;
    const tokenCY = myToken.position.y + ((myToken.size || 1) * CELL) / 2;
    const vx = W / 2 - tokenCX * scale;
    const vy = H / 2 - tokenCY * scale;

    playerInitialViewportSetRef.current = true;
    setPlayerInitialViewport({ x: vx, y: vy, scale });
  }, [role, tokens, userId, config.gridSize]);

  if (phase === 'lobby') {
    return (
      <VTTRoomLobby
        userId={userId}
        authToken={authToken}
        onJoinRoom={handleJoinFromLobby}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 z-30 pointer-events-auto">
          <VTTLeftToolbar
          role={role}
          activeTool={activeTool}
          fogBrushSize={fogBrushSize}
          config={config}
          onToolChange={setActiveTool}
          onFogBrushSizeChange={setFogBrushSize}
          onAddToken={() => setShowAddToken(true)}
          onResetFog={handleResetFog}
          onRevealAll={handleRevealAll}
          onMaskAll={handleMaskAll}
          onUpdateMap={handleUpdateMap}
          onBack={leaveRoom}
          calibrationPoints={calibrationPoints}
          onClearCalibration={handleClearCalibration}
          onApplyCalibration={handleApplyCalibration}
          wallCount={walls.length}
          onClearWalls={handleClearWalls}
          showWalls={showWalls}
          onToggleShowWalls={() => setShowWalls(v => !v)}
          roomId={roomId!}
          broadcastFrameEnabled={broadcastFrameEnabled}
          onToggleBroadcastFrame={() => setBroadcastFrameEnabled(v => !v)}
          broadcastAspectRatio={broadcastAspectRatio}
          onBroadcastAspectRatioChange={setBroadcastAspectRatio}
          broadcastLockRatio={broadcastLockRatio}
          onToggleBroadcastLockRatio={() => setBroadcastLockRatio(v => !v)}
          onOpenBroadcastWindow={handleOpenBroadcastWindow}
          gmFollowEnabled={gmFollowEnabled}
          onToggleGmFollow={() => setGmFollowEnabled(v => !v)}
          weatherEffects={weatherEffects}
          onUpdateWeather={handleUpdateWeather}
        />
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 relative overflow-hidden"
          onMouseDown={e => {
            if (e.target !== e.currentTarget) return;
            setSelectedPropId(null);
            setSelectedTokenId(null);
            setSelectedTokenIds([]);
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();

            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const dropX = e.clientX - rect.left;
            const dropY = e.clientY - rect.top;

            const propId = e.dataTransfer.getData('application/vtt-prop-id');
            if (propId) {
              handleUpdateProp(propId, {
                position: { x: dropX, y: dropY },
              });
              return;
            }

            const propUrl = e.dataTransfer.getData('application/vtt-prop-url');
            const propName = e.dataTransfer.getData('application/vtt-prop-name');
            const propIsVideo = e.dataTransfer.getData('application/vtt-prop-isvideo') === 'true';

            if (propUrl) {
              const width = propIsVideo ? 200 : 150;
              const height = propIsVideo ? 200 : 150;

              handleAddProp({
                label: propName || 'Prop',
                imageUrl: propUrl,
                position: {
                  x: dropX - width / 2,
                  y: dropY - height / 2,
                },
                width,
                height,
                opacity: 1,
                locked: false,
              });
            }
          }}
        >
          {role === 'gm' && scenes.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none flex justify-center">
            <div className="pointer-events-auto inline-flex">
              <VTTSceneBar
                  scenes={scenes}
                  activeSceneId={activeSceneId}
                  onSwitchScene={handleSwitchScene}
                  onCreateScene={handleCreateScene}
                  onRenameScene={handleRenameScene}
                  onDeleteScene={handleDeleteScene}
                        onRightClickScene={handleSceneRightClick}
                  onSaveView={handleSaveView}
                />
              </div>
            </div>
          )}

          {!connected && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-red-900/80 border border-red-700/60 rounded-lg text-sm text-red-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Reconnexion en cours...
            </div>
          )}

          {weatherEffects.length > 0 && canvasContainerRef.current && (
            <VTTWeatherOverlay
              effects={weatherEffects}
              width={canvasContainerRef.current.clientWidth || window.innerWidth}
              height={canvasContainerRef.current.clientHeight || window.innerHeight}
            />
          )}

          
          <VTTCanvas
            ref={vttCanvasRef}
            config={config}
            tokens={tokens}
            fogState={fogState}
            role={role}
            userId={userId}
            activeTool={activeTool}
            fogBrushSize={fogBrushSize}
            onMoveToken={handleMoveToken}
            onRevealFog={handleRevealFog}
            selectedTokenId={selectedTokenId}
            onSelectToken={setSelectedTokenId}
            selectedTokenIds={selectedTokenIds}
            onSelectTokens={ids => { setSelectedTokenIds(ids); if (ids.length > 0) setSelectedTokenId(ids[0]); }}
            onRightClickToken={(token, x, y) => setContextMenu({ token, x, y })}
            onDropToken={handleDropToken}
            onAddTokenAtPos={handleAddTokenAtPos}
            onResizeToken={handleResizeToken}
            calibrationPoints={calibrationPoints}
            onCalibrationPoint={handleCalibrationPoint}
            walls={walls}
            onWallAdded={handleWallAdded}
            onWallUpdated={handleWallUpdated}
            onWallRemoved={handleWallRemoved}
            showWalls={showWalls}
            onMapDimensions={(w, h) => {
              if (config.mapWidth !== w || config.mapHeight !== h) {
                setConfig(prev => ({ ...prev, mapWidth: w, mapHeight: h }));
              }
            }}
            forceViewport={role === 'player' && playerForcedViewport ? playerForcedViewport : undefined}
            initialViewport={role === 'player' ? playerInitialViewport : savedViewport}
            onViewportChange={handleCanvasViewportChange}
          />

                {props.map(prop => (
            <div
              key={prop.id}
              className={`absolute pointer-events-auto select-none ${
                selectedPropId === prop.id ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent' : ''
              } ${draggingPropId === prop.id ? 'cursor-grabbing' : 'cursor-move'}`}
              style={{
                left: prop.position.x,
                top: prop.position.y,
                width: prop.width,
                height: prop.height,
                opacity: prop.opacity,
                zIndex: selectedPropId === prop.id ? 15 : 5,
              }}
              onMouseDown={e => handlePropMouseDown(e, prop)}
              onClick={e => {
                e.stopPropagation();
                setSelectedPropId(id => id === prop.id ? id : prop.id);
              }}
            >
              {prop.imageUrl ? (
                /\.(webm|mp4|ogv)(\?.*)?$/i.test(prop.imageUrl) ? (
                  <video
                    src={prop.imageUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                ) : (
                  <img
                    src={prop.imageUrl}
                    alt={prop.label}
                    className="w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900/70 border border-gray-600/50 rounded px-2">
                  <span className="text-white text-sm font-medium text-center break-words">{prop.label}</span>
                </div>
              )}

              {selectedPropId === prop.id && role === 'gm' && !prop.locked && (
                <button
                  type="button"
                  className="absolute bottom-0 right-0 w-4 h-4 bg-amber-500 hover:bg-amber-400 border border-black/40 rounded-tl cursor-se-resize"
                  onMouseDown={e => handlePropResizeMouseDown(e, prop)}
                  onClick={e => e.stopPropagation()}
                  title="Redimensionner"
                />
              )}
            </div>
          ))}

          <VTTPlayerList users={connectedUsers} />

          {broadcastFrameEnabled && broadcastMode === 'frame' && role === 'gm' && (
            <VTTBroadcastFrame
              frame={broadcastFrame}
              onChange={handleBroadcastFrameChange}
              aspectRatio={broadcastAspectRatio}
              lockRatio={broadcastLockRatio}
              viewport={canvasViewport}
            />
          )}

          {activeSceneId && scenes.length > 0 && (
            <div className="absolute bottom-4 right-60 pointer-events-none z-10">
              <div className="px-3 py-1 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-full text-xs text-gray-400 shadow-lg">
                {scenes.find(s => s.id === activeSceneId)?.name ?? ''}
              </div>
            </div>
          )}
        </div>

        <VTTSidebar
          role={role}
          tokens={tokens}
          config={config}
          selectedTokenId={selectedTokenId}
          userId={userId}
          roomId={roomId!}
          connected={connected}
          connectedCount={connectedUsers.length || 1}
          onSelectToken={setSelectedTokenId}
          onEditToken={setEditingToken}
          onRemoveToken={handleRemoveToken}
          onToggleVisibility={handleToggleVisibility}
          onUpdateMap={handleUpdateMap}
          onResetFog={handleResetFog}
          onBack={leaveRoom}
          onHome={onBack}
          props={props}
          selectedPropId={selectedPropId}
          onSelectProp={setSelectedPropId}
          onAddProp={handleAddProp}
          onRemoveProp={handleRemoveProp}
          onUpdateProp={handleUpdateProp}
          onSaveScene={role === 'gm' ? handleSaveScene : undefined}
        />
      </div>

      {showAddToken && (
        <AddTokenModal
          userId={userId}
          onConfirm={handleAddToken}
          onClose={() => setShowAddToken(false)}
          onCharDragStart={() => setShowAddToken(false)}
        />
      )}

      {editingToken && (
        <VTTTokenEditModal
          token={editingToken}
          role={role}
          onSave={handleEditTokenSave}
          onRemove={() => handleRemoveToken(editingToken.id)}
          onClose={() => setEditingToken(null)}
        />
      )}

      {contextMenu && (
        <VTTContextMenu
          token={contextMenu.token}
          x={contextMenu.x}
          y={contextMenu.y}
          role={role}
          userId={userId}
          onEdit={() => { setEditingToken(contextMenu.token); setContextMenu(null); }}
          onDelete={() => { handleRemoveToken(contextMenu.token.id); setContextMenu(null); }}
          onToggleVisibility={() => { handleToggleVisibility(contextMenu.token.id); setContextMenu(null); }}
          onManageBinding={() => {
            const freshToken = tokensRef.current.find(t => t.id === contextMenu.token.id);
            setBindingToken(freshToken || contextMenu.token);
            setContextMenu(null);
          }}
          onConfigureVision={() => {
            const freshToken = tokensRef.current.find(t => t.id === contextMenu.token.id);
            setVisionToken(freshToken || contextMenu.token);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {bindingToken && (
        <VTTTokenBindingModal
          token={bindingToken}
          connectedUsers={connectedUsers}
          onSave={(controlledByUserIds) => {
            vttService.send({
              type: 'UPDATE_TOKEN',
              tokenId: bindingToken.id,
              changes: { controlledByUserIds },
            });
          }}
          onClose={() => setBindingToken(null)}
        />
      )}

      {visionToken && (
        <VTTVisionConfigModal
          token={visionToken}
          onSave={(changes) => {
            vttService.send({
              type: 'UPDATE_TOKEN',
              tokenId: visionToken.id,
              changes,
            });
          }}
          onClose={() => setVisionToken(null)}
        />
      )}

        {sceneContextMenu && (
          <div
            className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ top: sceneContextMenu.y, left: sceneContextMenu.x }}
            onMouseLeave={() => setSceneContextMenu(null)}
          >
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
              onClick={() => {
                // Déclenche le renommage inline via l'état de VTTSceneBar
                // On simule en passant par un prop dédié ou en passant un ref
                // Ici on ferme juste le menu — le double-clic gère le renommage
                setSceneContextMenu(null);
              }}
            >
              ✏️ Renommer (double-clic)
            </button>
            {scenes.length > 1 && (
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700"
                onClick={() => {
                  if (window.confirm(`Supprimer "${sceneContextMenu.sceneName}" ?`)) {
                    handleDeleteScene(sceneContextMenu.sceneId);
                  }
                  setSceneContextMenu(null);
                }}
              >
                🗑️ Supprimer
              </button>
            )}
            <button
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700"
              onClick={() => {
                setSceneConfigEdit({ sceneId: sceneContextMenu.sceneId, config: sceneContextMenu.config });
                setSceneContextMenu(null);
              }}
            >
              ⚙️ Configurer la scène
            </button>
          </div>
        )}
      
      {sceneConfigEdit && (
        <VTTSceneConfigModal
          sceneName={scenes.find(s => s.id === sceneConfigEdit.sceneId)?.name ?? ''}
          config={sceneConfigEdit.config}
          onSave={changes => handleSaveSceneConfig(sceneConfigEdit.sceneId, changes)}
          onClose={() => setSceneConfigEdit(null)}
        />
      )}
    </div>
  );
}