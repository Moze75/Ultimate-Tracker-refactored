import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { VTTCanvas } from '../components/VTT/VTTCanvas';
import { VTTLeftToolbar } from '../components/VTT/VTTLeftToolbar';
import { VTTSidebar } from '../components/VTT/VTTSidebar';
import { VTTSceneBar } from '../components/VTT/VTTSceneBar';
import { VTTContextMenu } from '../components/VTT/VTTContextMenu';
import { AddTokenModal } from '../components/VTT/AddTokenModal';
import { VTTTokenEditModal } from '../components/VTT/VTTTokenEditModal';
import { VTTRoomLobby } from '../components/VTT/VTTRoomLobby';
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
} from '../types/vtt';

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
  };
}

export function VTTPage({ session, onBack }: VTTPageProps) {
  const [phase, setPhase] = useState<'lobby' | 'room'>('lobby');
  const [roomId, setRoomId] = useState<string | null>(null);

  const [role, setRole] = useState<VTTRole>('player');
  const [config, setConfig] = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<VTTToken[]>([]);
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [connectedCount, setConnectedCount] = useState(1);
  const [connected, setConnected] = useState(false);

  const [activeTool, setActiveTool] = useState<'select' | 'fog-reveal' | 'fog-erase' | 'grid-calibrate'>('select');
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([]);
  const [fogBrushSize, setFogBrushSize] = useState(30);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [showAddToken, setShowAddToken] = useState(false);
  const [editingToken, setEditingToken] = useState<VTTToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ token: VTTToken; x: number; y: number } | null>(null);

  const [scenes, setScenes] = useState<VTTScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const switchingSceneRef = useRef(false);

  // Always-current refs for scene save (avoid stale closure)
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

  const userId = session.user.id;
  const authToken = session.access_token;

  const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const moveThrottleRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleServerEvent = useCallback((event: VTTServerEvent) => {
    switch (event.type) {
      case 'STATE_SYNC':
        setConfig(event.state.room.config);
        setTokens(event.state.room.tokens);
        setFogState(event.state.room.fogState);
        setRole(event.state.yourRole);
        setConnectedCount(event.state.room.connectedUsers.length);
        break;
      case 'TOKEN_MOVED':
        setTokens(prev => prev.map(t =>
          t.id === event.tokenId ? { ...t, position: event.position } : t
        ));
        break;
      case 'TOKEN_ADDED':
        setTokens(prev => [...prev, event.token]);
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
      case 'USER_JOINED':
        setConnectedCount(c => c + 1);
        break;
      case 'USER_LEFT':
        setConnectedCount(c => Math.max(1, c - 1));
        break;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'room' || !roomId) return;
    const unsub = vttService.onMessage(handleServerEvent);
    const unsubConn = vttService.onConnectionChange(setConnected);
    vttService.connect(roomId, userId, authToken);
    return () => { unsub(); unsubConn(); vttService.disconnect(); };
  }, [phase, roomId, userId, authToken, handleServerEvent]);

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
          if (!activeSceneId) setActiveSceneId(parsed[0].id);
        } else {
          supabase
            .from('vtt_scenes')
            .insert({ room_id: roomId, name: 'Scène 1', order_index: 0, config: DEFAULT_CONFIG, fog_state: DEFAULT_FOG, tokens: [] })
            .select()
            .maybeSingle()
            .then(({ data: s }) => {
              if (s) {
                const scene = dbSceneToVTTScene(s);
                setScenes([scene]);
                setActiveSceneId(scene.id);
              }
            });
        }
      });
  }, [phase, roomId, role]);

  const saveCurrentSceneState = useCallback(async (sceneId: string) => {
    if (!sceneId || !roomId) return;
    await supabase
      .from('vtt_scenes')
      .update({
        config: configRef.current,
        fog_state: fogStateRef.current,
        tokens: tokensRef.current,
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

      // Broadcast scene change to other clients (suppress local echo to avoid conflicts)
      vttService.suppressLocalNotifications(true);
      const currentTokenIds = tokensRef.current.map(t => t.id);
      currentTokenIds.forEach(id => vttService.send({ type: 'REMOVE_TOKEN', tokenId: id }));
      vttService.send({ type: 'UPDATE_MAP', config: scene.config });
      vttService.send({ type: 'RESET_FOG' });
      if (scene.fogState.strokes && scene.fogState.strokes.length > 0) {
        for (const stroke of scene.fogState.strokes) {
          vttService.send({ type: 'REVEAL_FOG', cells: [], erase: stroke.erase, stroke });
        }
      }
      scene.tokens.forEach(token => {
        const { id: _id, ...rest } = token;
        void _id;
        vttService.send({ type: 'ADD_TOKEN', token: rest });
      });
      vttService.suppressLocalNotifications(false);

      // Update local React state directly (don't wait for broadcast echo)
      setConfig(scene.config);
      setFogState({ revealedCells: [], strokes: scene.fogState.strokes || [] });
      setTokens(scene.tokens);
      setActiveSceneId(sceneId);
      setScenes(prev => prev.map(s => s.id === sceneId ? scene : s));
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
  }, []);

  const handleAddToken = useCallback((token: Omit<VTTToken, 'id'>) => {
    vttService.send({ type: 'ADD_TOKEN', token });
  }, []);

  const handleDropToken = useCallback((tokenId: string, worldPos: { x: number; y: number }) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    const canMove = role === 'gm' || token.ownerUserId === userId;
    if (!canMove) return;
    handleMoveToken(tokenId, worldPos);
  }, [role, userId, handleMoveToken]);

  const handleRemoveToken = useCallback((tokenId: string) => {
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    if (role !== 'gm' && token.ownerUserId !== userId) return;
    vttService.send({ type: 'REMOVE_TOKEN', tokenId });
    setSelectedTokenId(id => id === tokenId ? null : id);
  }, [tokens, role, userId]);

  const handleToggleVisibility = useCallback((tokenId: string) => {
    if (role !== 'gm') return;
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes: { visible: !token.visible } });
  }, [tokens, role]);

  const handleEditTokenSave = useCallback((changes: Partial<VTTToken>) => {
    if (!editingToken) return;
    const canEdit = role === 'gm' || editingToken.ownerUserId === userId;
    if (!canEdit) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId: editingToken.id, changes });
  }, [editingToken, role, userId]);

  const handleUpdateToken = useCallback((tokenId: string, changes: Partial<VTTToken>) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    const canEdit = role === 'gm' || token.ownerUserId === userId;
    if (!canEdit) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes });
  }, [role, userId]);

  const handleResetFog = useCallback(() => {
    if (role !== 'gm') return;
    if (!window.confirm('Réinitialiser tout le brouillard de guerre ?')) return;
    vttService.send({ type: 'RESET_FOG' });
    setFogState({ revealedCells: [], strokes: [] });
  }, [role]);

  const handleUpdateMap = useCallback((changes: Partial<VTTRoomConfig>) => {
    setConfig(prev => ({ ...prev, ...changes }));
    vttService.send({ type: 'UPDATE_MAP', config: changes });
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

    // Use the larger axis component to determine cell size
    // This handles purely horizontal, purely vertical, or slightly diagonal clicks
    const dx = Math.abs(p2.x - p1.x);
    const dy = Math.abs(p2.y - p1.y);
    const cellSize = Math.round(Math.max(dx, dy));
    if (cellSize < 10) return;

    // Compute offset from the first point (which lies on a grid intersection)
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

  const leaveRoom = () => {
    setPhase('lobby');
    setRoomId(null);
    setTokens([]);
    setFogState(DEFAULT_FOG);
    setSelectedTokenId(null);
    setScenes([]);
    setActiveSceneId(null);
    setProps([]);
    setSelectedPropId(null);
  };

  if (phase === 'lobby') {
    return (
      <VTTRoomLobby
        userId={userId}
        authToken={authToken}
        onJoinRoom={(id) => { setRoomId(id); setPhase('room'); }}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {role === 'gm' && (
        <VTTSceneBar
          scenes={scenes}
          activeSceneId={activeSceneId}
          onSwitchScene={handleSwitchScene}
          onCreateScene={handleCreateScene}
          onRenameScene={handleRenameScene}
          onDeleteScene={handleDeleteScene}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <VTTLeftToolbar
          role={role}
          activeTool={activeTool}
          fogBrushSize={fogBrushSize}
          config={config}
          onToolChange={setActiveTool}
          onFogBrushSizeChange={setFogBrushSize}
          onAddToken={() => setShowAddToken(true)}
          onResetFog={handleResetFog}
          onUpdateMap={handleUpdateMap}
          onBack={leaveRoom}
          calibrationPoints={calibrationPoints}
          onCalibrationPoint={handleCalibrationPoint}
          onClearCalibration={handleClearCalibration}
          onApplyCalibration={handleApplyCalibration}
        />

        <div
          className="flex-1 relative"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const propId = e.dataTransfer.getData('application/vtt-prop-id');
            if (propId) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              handleUpdateProp(propId, { position: { x, y } });
            }
          }}
        >
          {!connected && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-red-900/80 border border-red-700/60 rounded-lg text-sm text-red-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              Reconnexion en cours...
            </div>
          )}

          <VTTCanvas
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
            onRightClickToken={(token, x, y) => setContextMenu({ token, x, y })}
            onDropToken={handleDropToken}
            calibrationPoints={calibrationPoints}
            onCalibrationPoint={handleCalibrationPoint}
            onMapDimensions={(w, h) => {
              if (config.mapWidth !== w || config.mapHeight !== h) {
                setConfig(prev => ({ ...prev, mapWidth: w, mapHeight: h }));
              }
            }}
          />

          {props.map(prop => (
            <div
              key={prop.id}
              className={`absolute pointer-events-auto cursor-move select-none ${selectedPropId === prop.id ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent' : ''}`}
              style={{
                left: prop.position.x,
                top: prop.position.y,
                width: prop.width,
                height: prop.height,
                opacity: prop.opacity,
                zIndex: 5,
              }}
              draggable={role === 'gm' && !prop.locked}
              onDragStart={e => {
                e.dataTransfer.setData('application/vtt-prop-id', prop.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => setSelectedPropId(id => id === prop.id ? null : prop.id)}
            >
              {prop.imageUrl ? (
                <img
                  src={prop.imageUrl}
                  alt={prop.label}
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900/70 border border-gray-600/50 rounded px-2">
                  <span className="text-white text-sm font-medium text-center break-words">{prop.label}</span>
                </div>
              )}
            </div>
          ))}

          {activeSceneId && scenes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
              <div className="px-4 py-1.5 bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 rounded-full text-sm text-gray-300 font-medium shadow-lg">
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
          connectedCount={connectedCount}
          onSelectToken={setSelectedTokenId}
          onEditToken={setEditingToken}
          onRemoveToken={handleRemoveToken}
          onToggleVisibility={handleToggleVisibility}
          onUpdateMap={handleUpdateMap}
          onResetFog={handleResetFog}
          onBack={leaveRoom}
          props={props}
          selectedPropId={selectedPropId}
          onSelectProp={setSelectedPropId}
          onAddProp={handleAddProp}
          onRemoveProp={handleRemoveProp}
          onUpdateProp={handleUpdateProp}
        />
      </div>

      {showAddToken && (
        <AddTokenModal
          userId={userId}
          onConfirm={handleAddToken}
          onClose={() => setShowAddToken(false)}
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
          onResize={(size) => { handleUpdateToken(contextMenu.token.id, { size }); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
