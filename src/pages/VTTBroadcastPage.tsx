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
  VTTDoor,
  VTTWindow,
  VTTProp,
} from '../types/vtt';
import { Maximize, Minimize } from 'lucide-react';

interface VTTBroadcastPageProps {
  session?: Session;
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
  const [doors, setDoors] = useState<VTTDoor[]>([]);
  const [windows, setWindows] = useState<VTTWindow[]>([]);
  const [props, setProps] = useState<VTTProp[]>([]);
  // -------------------
  // Suivi de la scène active reçue du MJ
  // Nécessaire pour déclencher save/restore du fog exploré dans VTTCanvas
  // -------------------
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [waitingForSync, setWaitingForSync] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
    const vttCanvasRef = useRef<import('../components/VTT/VTTCanvas').VTTCanvasHandle>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initialViewportAppliedRef = useRef(false);
  const [initialForceViewport, setInitialForceViewport] = useState<BroadcastViewport | null>(null);

  // Traitement des événements serveur VTT (identique à avant)
  const handleServerEvent = useCallback((event: VTTServerEvent) => {
    switch (event.type) {
      case 'STATE_SYNC':
        setConfig(event.state.room.config);
        setTokens(event.state.room.tokens);
        setFogState(event.state.room.fogState);
        setWalls(event.state.room.walls || []);
        setDoors(event.state.room.doors || []);
        setWindows((event.state.room as any).windows || []);
        setWaitingForSync(false);
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
        setDoors(event.doors || []);
        setWindows((event as any).windows || []);
        if (event.sceneId) setCurrentSceneId(event.sceneId);
        break;
      case 'WALLS_UPDATED':
        setWalls(event.walls);
        break;
      case 'DOORS_UPDATED':
        setDoors(event.doors);
        break;
      case 'WINDOWS_UPDATED':
        setWindows((event as any).windows || []);
        break;
      case 'WEATHER_UPDATED':
        setConfig(prev => ({ ...prev, weatherEffects: event.effects }));
        break;
    }
  }, []);

  // Connexion au canal Supabase Realtime — AUCUNE requête DB
  useEffect(() => {
    const channel = supabase.channel(`vtt-room-${roomId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'vtt' }, ({ payload }) => {
        handleServerEvent(payload as VTTServerEvent);
      })
      .on('broadcast', { event: 'vtt-viewport' }, ({ payload }) => {
        const vp = payload as BroadcastViewport;
        if (!initialViewportAppliedRef.current) {
          setInitialForceViewport(vp);
          initialViewportAppliedRef.current = true;
        }
        vttCanvasRef.current?.followViewport(vp);
      })
      // Écoute l'événement dédié d'initialisation broadcast
      .on('broadcast', { event: 'vtt-broadcast-init' }, ({ payload }) => {
        console.log('[Broadcast] Received init state from GM');
        const s = payload as {
          config?: VTTRoomConfig;
          tokens?: VTTToken[];
          fogState?: VTTFogState;
          walls?: VTTWall[];
          doors?: VTTDoor[];
          sceneId?: string | null;
        };
        if (s.config) setConfig(prev => ({ ...prev, ...s.config }));
        if (s.tokens) setTokens(s.tokens);
        if (s.fogState) setFogState(s.fogState);
        if (s.walls) setWalls(s.walls);
        if (s.doors) setDoors(s.doors);
        if ((s as any).windows) setWindows((s as any).windows);
        if (s.sceneId) setCurrentSceneId(s.sceneId);
        setWaitingForSync(false);
      })
      // ===================================
      // Réception du masque exploré broadcasted par le MJ
      // ===================================
      // Applique directement le dataUrl dans le localStorage local
      // afin que VTTCanvas.restoreExploredMaskSnapshot() le retrouve
      // au prochain changement de scène ou au montage.
      .on('broadcast', { event: 'vtt-fog-explored' }, ({ payload }) => {
        const p = payload as { sceneId: string; dataUrl: string; width: number; height: number };
        if (!p?.sceneId || !p?.dataUrl) return;
        console.log('[Broadcast] vtt-fog-explored reçu pour scène', p.sceneId, `(${p.width}x${p.height})`);
        try {
          const storageKey = `vtt:explored-mask:${p.sceneId}`;
          localStorage.setItem(storageKey, JSON.stringify({
            width: p.width,
            height: p.height,
            dataUrl: p.dataUrl,
          }));
          console.log('[Broadcast] masque exploré sauvegardé dans localStorage pour', p.sceneId);
        } catch (e) {
          console.warn('[Broadcast] vtt-fog-explored: impossible d\'écrire localStorage', e);
        }
      })
      .subscribe((status) => {
        const isConnected = status === 'SUBSCRIBED';
        setConnected(isConnected);
        if (isConnected) {
          // Demander au MJ d'envoyer l'état initial
          console.log('[Broadcast] Connected, requesting state from GM...');
          channel.send({
            type: 'broadcast',
            event: 'vtt-broadcast-request',
            payload: { requestedAt: Date.now() },
          }).catch(console.error);
        }
      });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, handleServerEvent]);

  // Redemander l'état périodiquement si toujours en attente
  useEffect(() => {
    if (!waitingForSync || !connected) return;
    const interval = setInterval(() => {
      if (channelRef.current) {
        console.log('[Broadcast] Still waiting, re-requesting state...');
        channelRef.current.send({
          type: 'broadcast',
          event: 'vtt-broadcast-request',
          payload: { requestedAt: Date.now() },
        }).catch(console.error);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [waitingForSync, connected]);

  // Fullscreen
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

  // Auto-hide controls
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    if (!initialForceViewport) return;
    const timer = setTimeout(() => setInitialForceViewport(null), 100);
    return () => clearTimeout(timer);
  }, [initialForceViewport]);

  const noOp = useCallback(() => {}, []);
  const noOpStroke = useCallback(() => {}, []);


  return (
    <div
      ref={containerRef}
      className="h-screen w-screen bg-black relative overflow-hidden"
      onMouseMove={handleMouseMove}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* Écran d'attente tant que le MJ n'a pas envoyé l'état */}
      {waitingForSync && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-gray-500 text-sm">En attente du MJ...</p>
            {!connected && <p className="text-red-400 text-xs">Connexion en cours...</p>}
            {connected && <p className="text-emerald-400 text-xs">Connecté — synchronisation en cours...</p>}
          </div>
        </div>
      )}

<VTTCanvas
  ref={vttCanvasRef}
  sceneId={currentSceneId ?? undefined}
  config={config}
  tokens={tokens}
  fogState={fogState}
  role="player"
  userId=""
  spectatorMode="player-vision"
  activeTool="select"
  fogBrushSize={0}
  onMoveToken={noOp as any}
  onRevealFog={noOpStroke as any}
  selectedTokenId={null}
  onSelectToken={noOp as any}
  walls={walls}
  doors={doors}
  windows={windows}
  forceViewport={initialForceViewport ?? undefined}
/>

      {(config.weatherEffects ?? []).length > 0 && (
        <VTTWeatherOverlay
          effects={config.weatherEffects!}
          width={containerRef.current?.clientWidth ?? window.innerWidth}
          height={containerRef.current?.clientHeight ?? window.innerHeight}
        />
      )}

      {/* Barre de contrôle auto-hide */}
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
              {connected ? 'Connecté' : 'Déconnecté'}
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700/60 rounded-lg text-gray-300 transition-colors"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 