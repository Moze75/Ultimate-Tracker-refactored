import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { VTTCanvas } from '../components/VTT/VTTCanvas';
import { VTTToolbar } from '../components/VTT/VTTToolbar';
import { AddTokenModal } from '../components/VTT/AddTokenModal';
import { VTTRoomLobby } from '../components/VTT/VTTRoomLobby';
import { vttService } from '../services/vttService';
import type {
  VTTRole,
  VTTToken,
  VTTRoomConfig,
  VTTFogState,
  VTTServerEvent,
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

export function VTTPage({ session, onBack }: VTTPageProps) {
  const [phase, setPhase] = useState<'lobby' | 'room'>('lobby');
  const [roomId, setRoomId] = useState<string | null>(null);

  const [role, setRole] = useState<VTTRole>('player');
  const [config, setConfig] = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<VTTToken[]>([]);
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [connectedCount, setConnectedCount] = useState(1);
  const [connected, setConnected] = useState(false);

  const [activeTool, setActiveTool] = useState<'select' | 'fog-reveal' | 'fog-erase'>('select');
  const [fogBrushSize, setFogBrushSize] = useState(2);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [showAddToken, setShowAddToken] = useState(false);

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

    return () => {
      unsub();
      unsubConn();
      vttService.disconnect();
    };
  }, [phase, roomId, userId, authToken, handleServerEvent]);

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

  const handleRevealFog = useCallback((cells: string[]) => {
    setFogState(prev => {
      const revealed = new Set(prev.revealedCells);
      if (activeTool === 'fog-reveal') {
        cells.forEach(c => revealed.add(c));
      } else {
        cells.forEach(c => revealed.delete(c));
      }
      return { revealedCells: Array.from(revealed) };
    });
    vttService.send({ type: 'REVEAL_FOG', cells });
  }, [activeTool]);

  const handleAddToken = useCallback((token: Omit<VTTToken, 'id'>) => {
    vttService.send({ type: 'ADD_TOKEN', token });
  }, []);

  const handleRemoveToken = useCallback(() => {
    if (!selectedTokenId) return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (!token) return;
    if (role !== 'gm' && token.ownerUserId !== userId) return;
    vttService.send({ type: 'REMOVE_TOKEN', tokenId: selectedTokenId });
    setSelectedTokenId(null);
  }, [selectedTokenId, tokens, role, userId]);

  const handleToggleTokenVisibility = useCallback(() => {
    if (!selectedTokenId || role !== 'gm') return;
    const token = tokens.find(t => t.id === selectedTokenId);
    if (!token) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId: selectedTokenId, changes: { visible: !token.visible } });
  }, [selectedTokenId, tokens, role]);

  const handleResetFog = useCallback(() => {
    if (role !== 'gm') return;
    if (!window.confirm('Réinitialiser tout le brouillard de guerre ?')) return;
    vttService.send({ type: 'RESET_FOG' });
    setFogState(DEFAULT_FOG);
  }, [role]);

  const selectedToken = tokens.find(t => t.id === selectedTokenId) ?? null;

  if (phase === 'lobby') {
    return (
      <VTTRoomLobby
        userId={userId}
        authToken={authToken}
        onJoinRoom={(id) => {
          setRoomId(id);
          setPhase('room');
        }}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <VTTToolbar
        role={role}
        activeTool={activeTool}
        fogBrushSize={fogBrushSize}
        connectedCount={connectedCount}
        connected={connected}
        selectedToken={selectedToken}
        onToolChange={setActiveTool}
        onFogBrushSizeChange={setFogBrushSize}
        onAddToken={() => setShowAddToken(true)}
        onRemoveToken={handleRemoveToken}
        onToggleTokenVisibility={handleToggleTokenVisibility}
        onResetFog={handleResetFog}
        onBack={() => {
          setPhase('lobby');
          setRoomId(null);
          setTokens([]);
          setFogState(DEFAULT_FOG);
          setSelectedTokenId(null);
        }}
      />

      <div className="flex-1 relative">
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
        />

        {role === 'gm' && (
          <GMPanel
            config={config}
            roomId={roomId!}
            onUpdateMap={(changes) => {
              setConfig(prev => ({ ...prev, ...changes }));
              vttService.send({ type: 'UPDATE_MAP', config: changes });
            }}
          />
        )}
      </div>

      {showAddToken && (
        <AddTokenModal
          userId={userId}
          onConfirm={handleAddToken}
          onClose={() => setShowAddToken(false)}
        />
      )}
    </div>
  );
}

function GMPanel({
  config,
  roomId,
  onUpdateMap,
}: {
  config: VTTRoomConfig;
  roomId: string;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mapUrl, setMapUrl] = useState(config.mapImageUrl);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 px-3 py-2 bg-gray-800/90 hover:bg-gray-700 border border-gray-600 text-gray-300 text-sm rounded-lg transition-colors shadow-lg"
      >
        Paramètres carte
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 bg-gray-900/95 border border-gray-700 rounded-xl shadow-2xl p-4 w-72 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Paramètres carte</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">URL de la carte</label>
        <div className="flex gap-1">
          <input
            type="url"
            value={mapUrl}
            onChange={e => setMapUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
          />
          <button
            onClick={() => onUpdateMap({ mapImageUrl: mapUrl })}
            className="px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs"
          >
            OK
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Taille de la grille : {config.gridSize}px</label>
        <input
          type="range"
          min={20}
          max={120}
          step={5}
          value={config.gridSize}
          onChange={e => onUpdateMap({ gridSize: parseInt(e.target.value) })}
          className="w-full accent-amber-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Snap to grid</span>
        <button
          onClick={() => onUpdateMap({ snapToGrid: !config.snapToGrid })}
          className={`w-10 h-5 rounded-full transition-colors ${config.snapToGrid ? 'bg-amber-600' : 'bg-gray-600'}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${config.snapToGrid ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Brouillard de guerre</span>
        <button
          onClick={() => onUpdateMap({ fogEnabled: !config.fogEnabled })}
          className={`w-10 h-5 rounded-full transition-colors ${config.fogEnabled ? 'bg-amber-600' : 'bg-gray-600'}`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${config.fogEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="pt-1 border-t border-gray-700">
        <p className="text-xs text-gray-500">ID Room : <span className="font-mono text-gray-300">{roomId}</span></p>
        <p className="text-xs text-gray-500 mt-0.5">Partagez cet ID avec vos joueurs</p>
      </div>
    </div>
  );
}
