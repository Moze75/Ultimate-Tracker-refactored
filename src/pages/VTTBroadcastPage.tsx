import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { VTTCanvas } from '../components/VTT/VTTCanvas';
import { VTTWeatherOverlay } from '../components/VTT/VTTWeatherOverlay';
import type { BroadcastViewport } from '../services/vttService';
import type {
  VTTToken,
  VTTRoomConfig,
  VTTFogState,
  VTTServerEvent,
  VTTWall,
} from '../types/vtt';
import { Maximize, Minimize } from 'lucide-react';

interface VTTBroadcastPageProps {
  session: Session;
  roomId: string;
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

export function VTTBroadcastPage({ session, roomId, onBack }: VTTBroadcastPageProps) {
  const [config, setConfig] = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<VTTToken[]>([]);
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [walls, setWalls] = useState<VTTWall[]>([]);
  const [connected, setConnected] = useState(false);
  const [broadcastViewport, setBroadcastViewport] = useState<BroadcastViewport | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const userId = session.user.id;
  const authToken = session.access_token;
  const userName = `${session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Spectateur'} (Broadcast)`;

  const handleServerEvent = useCallback((event: VTTServerEvent) => {
    switch (event.type) {
      case 'STATE_SYNC':
        setConfig(event.state.room.config);
        setTokens(event.state.room.tokens);
        setFogState(event.state.room.fogState);
        setWalls(event.state.room.walls || []);
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
        break;
      case 'WALLS_UPDATED':
        setWalls(event.walls);
        break;
    }
  }, []);

  useEffect(() => {
    // Canal Supabase DÉDIÉ à la fenêtre broadcast — indépendant du vttService singleton
    const channel = supabase.channel(`vtt-room-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'vtt' }, ({ payload }) => {
        handleServerEvent(payload as VTTServerEvent);
      })
      .on('broadcast', { event: 'vtt-viewport' }, ({ payload }) => {
        setBroadcastViewport(payload as BroadcastViewport);
      })
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    // Charger l'état initial depuis Supabase DB (la room + la première scène)
    supabase
      .from('vtt_rooms')
      .select('state_json')
      .eq('id', roomId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.state_json) return;
        const s = data.state_json as { config?: VTTRoomConfig; tokens?: VTTToken[]; fogState?: VTTFogState };
        if (s.config) setConfig(prev => ({ ...prev, ...s.config }));
        if (s.tokens) setTokens(s.tokens);
        if (s.fogState) setFogState(s.fogState);
      });

    supabase
      .from('vtt_scenes')
      .select('walls, fog_state, config')
      .eq('room_id', roomId)
      .order('order_index', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          if (data[0].walls) setWalls(data[0].walls);
          if (data[0].fog_state) setFogState(data[0].fog_state);
          if (data[0].config) setConfig(prev => ({ ...prev, ...data[0].config }));
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, userId, handleServerEvent]);

  useEffect(() => {
    const handleFS = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFS);
    return () => document.removeEventListener('fullscreenchange', handleFS);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  const noOp = useCallback(() => {}, []);
  const noOpStroke = useCallback(() => {}, []);

  const defaultViewport = broadcastViewport || (config.mapWidth > 0 ? {
    x: 0,
    y: 0,
    width: config.mapWidth,
    height: config.mapHeight,
  } : null);

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-black relative overflow-hidden cursor-none"
      onMouseMove={handleMouseMove}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {!config.mapImageUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-gray-500 text-sm">En attente du MJ...</p>
            {!connected && <p className="text-red-400 text-xs">Connexion en cours...</p>}
          </div>
        </div>
      )}

      <VTTCanvas
        config={config}
        tokens={tokens}
        fogState={fogState}
        role="player"
        userId=""
        activeTool="select"
        fogBrushSize={0}
        onMoveToken={noOp as any}
        onRevealFog={noOpStroke as any}
        selectedTokenId={null}
        onSelectToken={noOp as any}
        walls={walls}
        forceViewport={defaultViewport}
      />

      {(config.weatherEffects ?? []).length > 0 && (
        <VTTWeatherOverlay
          effects={config.weatherEffects!}
          width={containerRef.current?.clientWidth ?? window.innerWidth}
          height={containerRef.current?.clientHeight ?? window.innerHeight}
        />
      )}

      <div className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-lg text-gray-300 text-xs transition-colors"
          >
            Quitter
          </button>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {connected ? 'Connecte' : 'Deconnecte'}
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-lg text-gray-300 transition-colors"
              title={isFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
