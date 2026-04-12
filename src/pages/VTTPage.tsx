import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { monsterService } from '../services/monsterService';
import { DiceRollContext } from '../components/ResponsiveGameLayout';
// import { DiceBox3D } from '../components/DiceBox3D';
import { VTTCanvas, getExploredMaskStorageKey } from '../components/VTT/VTTCanvas';
import type { VTTCanvasHandle } from '../components/VTT/vttCanvasTypes';
import { VTTLeftToolbar } from '../components/VTT/VTTLeftToolbar';
import type { VTTActiveTool } from '../components/VTT/VTTLeftToolbar';
import { VTTSidebar } from '../components/VTT/VTTSidebar';
import { VTTSceneBar } from '../components/VTT/VTTSceneBar';
// import { VTTContextMenu } from '../components/VTT/VTTContextMenu';
// import { AddTokenModal } from '../components/VTT/AddTokenModal';
// import { VTTTokenEditModal } from '../components/VTT/VTTTokenEditModal';
// import { VTTVisionConfigModal } from '../components/VTT/VTTVisionConfigModal';
// import { VTTSceneConfigModal } from '../components/VTT/VTTSceneConfigModal';
import { VTTRoomLobby } from '../components/VTT/VTTRoomLobby';
import { VTTPlayerList } from '../components/VTT/VTTPlayerList';
import { VTTBroadcastFrame } from '../components/VTT/VTTBroadcastFrame';
// import { VTTTokenBindingModal } from '../components/VTT/VTTTokenBindingModal';
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
  VTTDoor,
  VTTWindow,
  VTTConnectedUser,
  VTTWeatherEffect,
  VTTPing,
  VTTNote,
} from '../types/vtt';
import { VTTNotesOverlay } from '../components/VTT/VTTNotesOverlay';
import { VTTNoteEditModal } from '../components/VTT/VTTNoteEditModal';
import { clampViewport } from '../components/VTT/vttCanvasUtils';

import { VTTWeatherOverlay } from '../components/VTT/VTTWeatherOverlay';
import { VTTTargetingRing } from '../components/VTT/VTTTargetingRing';
// import { VTTCharacterSheetPanel } from '../components/VTT/VTTCharacterSheetPanel';
// import { VTTMonsterStatBlockPanel } from '../components/VTT/VTTMonsterStatBlockPanel';
// import { VTTChatPanel } from '../components/VTT/VTTChatPanel';
import type { DiceRollResult } from '../components/DiceBox3D';
import type { VTTChatMessage } from '../types/vtt';
import { useVTTUndo } from '../hooks/useVTTUndo';
import { useVTTGeometry } from '../hooks/useVTTGeometry';
import { VTTModals } from '../components/VTT/VTTModals';
import CombatBanner from '../components/VTT/combat/VTTCombatbanner';
import { getTargetedTokensForUser, computeNewHp } from '../services/vttAutoDamageService';

type VTTCopyBuffer =
  | { kind: 'token'; data: VTTToken }
  | { kind: 'prop'; data: VTTProp }
  | null;

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

const DEFAULT_FOG: VTTFogState = {
  revealedCells: [],
  strokes: [],
  exploredStrokes: [],
  seenDoors: [],
};

// -------------------
// Normalisation du brouillard de guerre persisté
// -------------------
const normalizeFogState = (fog?: VTTFogState | null): VTTFogState => ({
  revealedCells: [...(fog?.revealedCells || [])],
  strokes: [...(fog?.strokes || [])],
  exploredStrokes: [...(fog?.exploredStrokes || [])],
  seenDoors: [...(fog?.seenDoors || [])],
});
 
const getLastSceneStorageKey = (roomId: string) => `vtt:last-scene:${roomId}`;

function dbSceneToVTTScene(row: Record<string, unknown>): VTTScene {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    name: row.name as string,
    orderIndex: row.order_index as number,
    config: { ...DEFAULT_CONFIG, ...(row.config as Partial<VTTRoomConfig>) },
       fogState: normalizeFogState((row.fog_state as VTTFogState) || DEFAULT_FOG),
    tokens: (row.tokens as VTTToken[]) || [],
    walls: (row.walls as VTTWall[]) || [],
    doors: (row.doors as VTTDoor[]) || [],
    windows: (row.windows as VTTWindow[]) || [],
    props: (row.props as VTTProp[]) || [],
  };
}

function PingAnimation({ color, userName }: { color: string; userName: string }) {
  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes ping-ring {
          0% { transform: scale(0.3); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes ping-ring2 {
          0% { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(2.0); opacity: 0; }
        }
        @keyframes ping-dot {
          0% { transform: scale(0); opacity: 1; }
          30% { transform: scale(1.2); opacity: 1; }
          60% { transform: scale(1); opacity: 1; }
          80% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0); opacity: 0; }
        }
        @keyframes ping-label {
          0% { opacity: 0; transform: translateY(4px); }
          15% { opacity: 1; transform: translateY(0); }
          70% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
      `}</style>
      <div
        className="absolute rounded-full border-2"
        style={{
          width: 40,
          height: 40,
          borderColor: color,
          animation: 'ping-ring 1.8s ease-out 3 forwards',
        }}
      />
      <div
        className="absolute rounded-full border-2"
        style={{
          width: 40,
          height: 40,
          borderColor: color,
          animation: 'ping-ring2 1.8s ease-out 0.3s 3 forwards',
        }}
      />
      <div
        className="rounded-full z-10"
        style={{
          width: 14,
          height: 14,
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}`,
          animation: 'ping-dot 3.8s ease-in-out forwards',
        }}
      />
      <div
        className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full pointer-events-none z-20"
        style={{
          backgroundColor: color,
          color: '#fff',
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          animation: 'ping-label 3.8s ease-in-out forwards',
        }}
      >
        {userName}
      </div>
    </div>
  );
}

export function VTTPage({ session, onBack }: VTTPageProps) {
  const [phase, setPhase] = useState<'lobby' | 'room'>('lobby');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [requestedRole, setRequestedRole] = useState<'gm' | 'player'>('player');
  const [playerBoundTokenIds, setPlayerBoundTokenIds] = useState<string[]>([]);

  const [role, setRole] = useState<VTTRole>('player');
  const [config, setConfig] = useState<VTTRoomConfig>(DEFAULT_CONFIG);
  const [tokens, setTokens] = useState<VTTToken[]>([]);
  const [fogState, setFogState] = useState<VTTFogState>(DEFAULT_FOG);
  const [fogResetSignal, setFogResetSignal] = useState(0);
  const [combatBannerTrigger, setCombatBannerTrigger] = useState(0);
  const [autoApplyDamage, setAutoApplyDamage] = useState<boolean>(() => {
    try { return localStorage.getItem('vtt:setting:autoApplyDamage') !== 'false'; } catch { return true; }
  });
  const autoApplyDamageRef = useRef(autoApplyDamage);
  autoApplyDamageRef.current = autoApplyDamage;
  const [connectedUsers, setConnectedUsers] = useState<VTTConnectedUser[]>([]);
  const [connected, setConnected] = useState(false);

  const [activeTool, setActiveTool] = useState<VTTActiveTool>('select');
  const [gmNotes, setGmNotes] = useState<VTTNote[]>([]);
  const gmNotesRef = useRef<VTTNote[]>([]);
  const [showGmNotes, setShowGmNotes] = useState(true);
  const [editingNote, setEditingNote] = useState<{ note: VTTNote | null; initialX?: number; initialY?: number } | null>(null);

  const handleToolChange = useCallback((tool: VTTActiveTool) => {
    setActiveTool(tool);

    if (role === 'gm' && tool !== 'select') {
      setSelectedTokenId(null);
      setSelectedTokenIds([]);
      setSelectedPropId(null);
    }
  }, [role]);
  const [calibrationPoints, setCalibrationPoints] = useState<{ x: number; y: number }[]>([]);
  const [fogBrushSize, setFogBrushSize] = useState(30);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [showAddToken, setShowAddToken] = useState(false);
  const [sceneConfigEdit, setSceneConfigEdit] = useState<{ sceneId: string; config: VTTRoomConfig } | null>(null);
    const [sceneContextMenu, setSceneContextMenu] = useState<{ sceneId: string; sceneName: string; config: VTTRoomConfig; x: number; y: number } | null>(null);
  
  const [editingToken, setEditingToken] = useState<VTTToken | null>(null);
  const [characterSheetToken, setCharacterSheetToken] = useState<VTTToken | null>(null);
  const characterSheetTokenRef = useRef<VTTToken | null>(null);
  characterSheetTokenRef.current = characterSheetToken;
  const [characterSheetForcedHp, setCharacterSheetForcedHp] = useState<number | null>(null);
  const [monsterStatBlockToken, setMonsterStatBlockToken] = useState<VTTToken | null>(null);
  const [diceRollData, setDiceRollData] = useState<{
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null>(null);

  const currentRollTypeRef = useRef<'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage' | null>(null);

  const rollDice = useCallback((data: {
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  }) => {
    currentRollTypeRef.current = data.type;
    setDiceRollData(data);
  }, []);
  const [bindingToken, setBindingToken] = useState<VTTToken | null>(null);
  const [visionToken, setVisionToken] = useState<VTTToken | null>(null);
  const [contextMenu, setContextMenu] = useState<{ token: VTTToken; x: number; y: number } | null>(null);
  // -------------------
  // Gestion du chat live VTT
  // -------------------
  // pendingChatRoll : message de jet de dés en attente de publication dans le chat.
  // Construit ici (VTTPage a accès aux tokens pour résoudre l'avatar),
  // injecté dans VTTChatPanel via la prop externalMessage.
  const [pendingChatRoll, setPendingChatRoll] = useState<VTTChatMessage | null>(null);
  const [sidebarActiveTab, setSidebarActiveTab] = useState<'tokens' | 'map' | 'props' | 'combat' | 'settings' | 'chat'>(role === 'player' ? 'chat' : 'tokens');
  const [combatInitTokens, setCombatInitTokens] = useState<VTTToken[]>([]);
    // Ref vers handleDirectLaunchCombat exposé par VTTCombatTab
  const directLaunchCombatRef = useRef<((tokens: VTTToken[]) => void) | null>(null);
  const syncTokenHpRef = useRef<((tokenId: string, newHp: number) => void) | null>(null);
  const [showWalls, setShowWalls] = useState(true);
const [autoFocusCombatTurn, setAutoFocusCombatTurn] = useState(true);
const [followCameraOnTokenMove, setFollowCameraOnTokenMove] = useState<boolean>(() => {
  try {
    const stored = localStorage.getItem('vtt:setting:followCameraOnTokenMove');
    // Si jamais défini → true par défaut
    // Si défini explicitement par l'utilisateur → respecter son choix
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
});
const [lockPlayerMovementOutsideTurn, setLockPlayerMovementOutsideTurn] = useState(true);
const [currentCombatTurnLabel, setCurrentCombatTurnLabel] = useState<string | null>(null);



  const [scenes, setScenes] = useState<VTTScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const switchingSceneRef = useRef(false);

  const configRef = useRef(config);
  configRef.current = config;
  const fogStateRef = useRef(fogState);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  const activeSceneIdRef = useRef(activeSceneId);
  activeSceneIdRef.current = activeSceneId;

  const [props, setProps] = useState<VTTProp[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

  const propsRef = useRef<VTTProp[]>([]);
  propsRef.current = props;
  const [broadcastFrameEnabled, setBroadcastFrameEnabled] = useState(false);
    const [draggingPropId, setDraggingPropId] = useState<string | null>(null);
  // const [resizingPropId, setResizingPropId] = useState<string | null>(null); // Unused, removed

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

const handleBroadcastModeChange = useCallback((mode: 'frame' | 'follow') => {
  setBroadcastMode(mode);

  if (mode === 'frame') {
    setBroadcastFrameEnabled(true);
  }
}, []);
  const [playerForcedViewport, setPlayerForcedViewport] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0, scale: 1 });
const canvasViewportRef = useRef(canvasViewport);
canvasViewportRef.current = canvasViewport;
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [playerInitialViewport, setPlayerInitialViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const playerInitialViewportSetRef = useRef(false);
  const [weatherEffects, setWeatherEffects] = useState<VTTWeatherEffect[]>([]);
  const weatherEffectsRef = useRef<VTTWeatherEffect[]>([]);
  weatherEffectsRef.current = weatherEffects;


  const [copyBuffer, setCopyBuffer] = useState<VTTCopyBuffer>(null);

 
  
  const [isPingMode, setIsPingMode] = useState(false);
  const [activePings, setActivePings] = useState<VTTPing[]>([]);
  const pingModeRef = useRef(false);
  pingModeRef.current = isPingMode;

  const userId = session.user.id;
  const authToken = session.access_token;
  const userName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Joueur';

const vttCanvasRef = useRef<VTTCanvasHandle>(null);
const sceneLoadedRef = useRef<string | null>(null);

const focusCombatTokenByLabel = useCallback((displayName: string) => {
  const token = tokens.find((t) => t.label === displayName);
  if (!token) return;

  const gridSize = (config.gridSize || 50) * (token.size || 1);
  const centerX = token.position.x + gridSize / 2;
  const centerY = token.position.y + gridSize / 2;

  if (!followCameraOnTokenMove) {
    vttCanvasRef.current?.stopFollowingWorldPosition();
  }

  vttCanvasRef.current?.triggerCombatTurnHighlight(token.id);
  vttCanvasRef.current?.centerOnWorldPosition(centerX, centerY);
}, [tokens, config.gridSize, followCameraOnTokenMove]);
  
// Ref pour casser la dépendance circulaire entre useVTTUndo et useVTTGeometry
const pushUndoSnapshotRef = useRef<() => void>(() => {});

const {
  walls, doors, windows,
  setWalls, setDoors, setWindows,
  wallsRef, doorsRef, windowsRef,
  handleWallAdded, handleWallUpdated, handleWallRemoved, handleClearWalls,
  handleDoorAdded, handleDoorToggled, handleDoorRemoved, handleClearDoors,
  handleWindowAdded, handleWindowRemoved, handleClearWindows,
} = useVTTGeometry({
  role,
  activeSceneId,
  activeSceneIdRef,
  sceneLoadedRef,
  pushUndoSnapshot: () => pushUndoSnapshotRef.current(),
});

const { pushUndoSnapshot, handleUndo, handleRedo } = useVTTUndo({
  role,
  tokensRef,
  wallsRef,
  propsRef,
  activeSceneIdRef,
  setTokens,
  setWalls,
  setProps,
});

// On met à jour la ref après que useVTTUndo l'a créée
pushUndoSnapshotRef.current = pushUndoSnapshot;

  const pendingMovesRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const moveThrottleRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
const fogSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// -------------------
// Gestion des animations de déplacement des tokens
// -------------------
// Stocke l'identifiant requestAnimationFrame par token pour
// annuler proprement une animation en cours avant d'en démarrer une nouvelle.
const tokenMoveAnimationFrameRef = useRef<Map<string, number>>(new Map());

// -------------------
// Gestion de la position visuelle animée des tokens
// -------------------
// La position logique reste dans token.position.
// La position visuelle temporaire est stockée ici pour éviter
// de re-render React à chaque frame pendant le glissement.
const tokenAnimatedPositionRef = useRef<Map<string, { x: number; y: number }>>(new Map());


  const handleServerEvent = useCallback((event: VTTServerEvent) => {
    switch (event.type) {
      case 'STATE_SYNC':
        setConfig(event.state.room.config);
        setTokens(event.state.room.tokens);
        setFogState(normalizeFogState(event.state.room.fogState));
        setWalls(event.state.room.walls || []);
        setDoors(event.state.room.doors || []);
        setWindows((event.state.room as any).windows || []);
        setProps((event.state.room as any).props || []);
        setRole(event.state.yourRole);
        setWeatherEffects(event.state.room.config.weatherEffects || []);
        if (event.state.yourRole === 'gm') {
          const notes = event.state.room.config.gmNotes || [];
          setGmNotes(notes);
          gmNotesRef.current = notes;
        }
        // -------------------
        // Récupération du sceneId actif dès la première connexion
        // Sans cela, le VTTCanvas du joueur reste sur sceneId=null
        // et ne restaure jamais le masque exploré depuis localStorage
        // -------------------
        if ((event.state as any).activeSceneId && !activeSceneIdRef.current && event.state.yourRole !== 'gm') {
          const scId = (event.state as any).activeSceneId as string;
          setActiveSceneId(scId);
          activeSceneIdRef.current = scId;
          vttService.setActiveSceneId(scId);
        }
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
      case 'FOG_UPDATED': {
        const normalized = normalizeFogState(event.fogState);
        setFogState(normalized);
        if (
          (normalized.exploredStrokes?.length ?? 0) === 0 &&
          (normalized.strokes?.length ?? 0) === 0 &&
          activeSceneIdRef.current
        ) {
          localStorage.removeItem(getExploredMaskStorageKey(activeSceneIdRef.current));
        }
        break;
      }
      case 'MAP_UPDATED':
        setConfig(prev => ({ ...prev, ...event.config }));
        if (event.config.gmNotes !== undefined && role === 'gm') {
          setGmNotes(event.config.gmNotes);
          gmNotesRef.current = event.config.gmNotes;
        }
        break;
      // ===================================
      // Réception d'un changement de scène (joueur ou broadcast)
      // ===================================
      // Met à jour config/tokens/fog/walls + activeSceneId
      // Le sceneId est indispensable pour le cycle save/restore du fog exploré
      case 'SCENE_SWITCHED':
        setConfig(event.config);
        setTokens(event.tokens);
        setFogState(normalizeFogState(event.fogState));
        setWalls(event.walls);
        setDoors((event as any).doors || []);
        setWindows((event as any).windows || []);
        setProps((event as any).props || []);
        setWeatherEffects(event.config.weatherEffects || []);
        if (role === 'gm') {
          const sceneNotes = event.config.gmNotes || [];
          setGmNotes(sceneNotes);
          gmNotesRef.current = sceneNotes;
        }
        // -------------------
        // Propagation du sceneId au joueur distant
        // Sans cela, le VTTCanvas du joueur ne déclenche jamais
        // le cycle save/restore du masque exploré
        // -------------------
        if (event.sceneId) {
          setActiveSceneId(event.sceneId);
          activeSceneIdRef.current = event.sceneId;
          vttService.setActiveSceneId(event.sceneId);
        }
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
        setWeatherEffects(event.effects);
        break;
                case 'PROP_ADDED':
          setProps(prev => {
            if (prev.some(p => p.id === event.prop.id)) return prev;
            return [...prev, event.prop];
          });
          break;
        case 'PROP_REMOVED':
          setProps(prev => prev.filter(p => p.id !== event.propId));
          break;
        case 'PROP_UPDATED':
          setProps(prev => prev.map(p =>
            p.id === event.propId ? { ...p, ...event.changes } : p
          ));
          break;
      case 'PING_RECEIVED': {
        const ping = event.ping;
        setActivePings(prev => [...prev, ping]);
        setTimeout(() => {
          setActivePings(prev => prev.filter(p => p.id !== ping.id));
        }, 4000);
        break;
      }
      case 'USER_JOINED':
      case 'USER_LEFT':
        break;
    }
  }, []);

  useEffect(() => {
    if (!roomId) { setCampaignId(null); return; }
    supabase
      .from('vtt_rooms')
      .select('state_json')
      .eq('id', roomId)
      .maybeSingle()
      .then(({ data }) => {
        const stateJson = (data as Record<string, unknown> | null)?.state_json as Record<string, unknown> | null ?? {};
        setCampaignId((stateJson._campaignId as string | null) ?? null);
      });
  }, [roomId]);

  useEffect(() => {
    if (phase !== 'room' || !roomId) return;
    const unsub = vttService.onMessage(handleServerEvent);
    const unsubConn = vttService.onConnectionChange(setConnected);
    const unsubPresence = vttService.onPresenceChange(setConnectedUsers);

    // ===================================
    // Envoi du masque exploré au joueur qui se connecte (côté MJ)
    // ===================================
    // Quand un joueur distant envoie vtt-broadcast-request, le MJ
    // doit renvoyer le masque exploré de la scène courante en plus
    // de l'état initial (config/tokens/fog/walls/sceneId).
    const unsubBroadcastReq = vttService.onBroadcastRequest(() => {
      const sceneId = activeSceneIdRef.current;
      if (sceneId) {
        const maskData = vttCanvasRef.current?.getExploredMaskDataUrl?.();
        if (maskData?.dataUrl) {
          vttService.broadcastExploredMask(sceneId, maskData);
          console.log('[FOG-BROADCAST] masque renvoyé au nouveau connecté pour scène', sceneId);
        }
      }
    });

    vttService.connect(roomId, userId, authToken, userName, requestedRole);
    return () => { unsub(); unsubConn(); unsubPresence(); unsubBroadcastReq(); vttService.disconnect(); };
  }, [phase, roomId, userId, authToken, userName, requestedRole, handleServerEvent]);


// ===================================
// Joueur : abonnements Realtime spécifiques
// ===================================
// - Viewport forcé par le MJ
// - Masque exploré broadcasted par le MJ (fog de vision persisté)
useEffect(() => {
  if (phase !== 'room' || !roomId || role !== 'player') return;
  const unsubVp = vttService.onPlayerViewport(vp => setPlayerForcedViewport(vp));

  // -------------------
  // Écoute du masque exploré envoyé par le MJ
  // Sauvegarde dans localStorage pour que VTTCanvas.restoreExploredMaskSnapshot()
  // le retrouve au changement de scène
  // -------------------
  const channel = (vttService as any).channel;
  const fogExploredHandler = ({ payload }: { payload: any }) => {
    const p = payload as { sceneId: string; dataUrl: string; width: number; height: number };
    if (!p?.sceneId || !p?.dataUrl) return;
    try {
      // -------------------
      // Sauvegarde du masque exploré dans localStorage
      // -------------------
      const storageKey = `vtt:explored-mask:${p.sceneId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        width: p.width,
        height: p.height,
        dataUrl: p.dataUrl,
      }));

      // -------------------
      // Si le masque concerne la scène actuellement affichée,
      // on force VTTCanvas à restaurer immédiatement le snapshot
      // (sinon il faudrait attendre un changement de scène pour le voir)
      // -------------------
      if (p.sceneId === activeSceneIdRef.current) {
        // Petit délai pour laisser localStorage se stabiliser
        requestAnimationFrame(() => {
          // On force un "faux" changement de sceneId pour que le useEffect[sceneId]
          // de VTTCanvas se redéclenche : null → sceneId
          const currentId = activeSceneIdRef.current;
          setActiveSceneId(null);
          requestAnimationFrame(() => {
            setActiveSceneId(currentId);
            activeSceneIdRef.current = currentId;
          });
        });
      }
    } catch (e) {
      console.warn('[Player] vtt-fog-explored: impossible d\'écrire localStorage', e);
    }
  };

  if (channel) {
    channel.on('broadcast', { event: 'vtt-fog-explored' }, fogExploredHandler);
  }

  return () => { unsubVp(); };
}, [phase, roomId, role]);

 
  
const applySceneToLive = useCallback((scene: VTTScene, { silent = false }: { silent?: boolean } = {}) => {
    setConfig(scene.config);
    setTokens(scene.tokens);

    // -------------------
    const nextFogState = normalizeFogState(scene.fogState);
    fogStateRef.current = nextFogState;
    setFogState(nextFogState);

    setWalls(scene.walls || []);
    setDoors(scene.doors || []);
    setWindows(scene.windows || []);
    setProps(Array.isArray(scene.props) ? scene.props : []);
    setSelectedPropId(null);
    setWeatherEffects(scene.config.weatherEffects || []);
    {
      const rawSv = scene.config.savedViewport ?? null;
      const svContainer = canvasContainerRef.current;
      const clampedSv = rawSv && svContainer
        ? clampViewport(rawSv, scene.config, svContainer.clientWidth, svContainer.clientHeight)
        : rawSv;
      setSavedViewport(clampedSv);
    }
    const sceneNotes = scene.config.gmNotes || [];
    setGmNotes(sceneNotes);
    gmNotesRef.current = sceneNotes;
    sceneLoadedRef.current = scene.id;
    console.log('[VTT] applySceneToLive: doors=', scene.doors?.length ?? 0, 'windows=', scene.windows?.length ?? 0);

    // -------------------
    // Synchronisation du viewport React pour les props HTML
    // -------------------
    const rawViewport = scene.config.savedViewport ?? { x: 0, y: 0, scale: 1 };
    const container = canvasContainerRef.current;
    const nextViewport = container
      ? clampViewport(rawViewport, scene.config, container.clientWidth, container.clientHeight)
      : rawViewport;
    setCanvasViewport(nextViewport);
    canvasViewportRef.current = nextViewport;

    setActiveSceneId(scene.id);

  localStorage.setItem(getLastSceneStorageKey(roomId ?? ''), scene.id);

    vttService.setActiveSceneId(scene.id);

    if (!silent) {
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

      vttService.send({
        type: 'SWITCH_SCENE',
        sceneId: scene.id,
        config: scene.config,
        tokens: scene.tokens,
        fogState: scene.fogState,
        walls: scene.walls || [],
        doors: scene.doors || [],
        windows: scene.windows || [],
        props: Array.isArray(scene.props) ? scene.props : [],
      });
    }

    // (Le broadcast du masque exploré est déjà géré par le bloc précédent
    //  lignes 402-426 avec le double rAF + setTimeout)
  }, []);

useEffect(() => {
  if (phase !== 'room' || !roomId || role !== 'gm') return;
  let cancelled = false;

  supabase
    .from('vtt_scenes')
    .select('*')
    .eq('room_id', roomId)
    .order('order_index')
    .then(({ data }) => {
      if (cancelled) return;
      if (data && data.length > 0) {
        const parsed = data.map(dbSceneToVTTScene);
        setScenes(parsed);
        if (!sceneLoadedRef.current) {
          const lastSceneId = localStorage.getItem(getLastSceneStorageKey(roomId));
          const restoredScene = lastSceneId
            ? parsed.find(scene => scene.id === lastSceneId)
            : null;
          const initialScene = restoredScene ?? {
            ...parsed[0],
            props: Array.isArray(parsed[0].props) ? parsed[0].props : [],
          };
          setActiveSceneId(initialScene.id);
          applySceneToLive(initialScene);
          vttService.updateLocalState(initialScene.config, initialScene.tokens, initialScene.fogState, initialScene.walls || [], initialScene.doors || [], initialScene.windows || [], Array.isArray(initialScene.props) ? initialScene.props : []);
        }
      } else {
        supabase
          .from('vtt_scenes')
          .insert({ room_id: roomId, name: 'Scene 1', order_index: 0, config: DEFAULT_CONFIG, fog_state: DEFAULT_FOG, tokens: [], props: [] })
          .select()
          .maybeSingle()
          .then(({ data: s }) => {
            if (cancelled) return;
            if (s) {
              const scene = dbSceneToVTTScene(s);
              setScenes([scene]);
              setActiveSceneId(scene.id);
              applySceneToLive(scene);
            }
          });
      }
    });

  return () => { cancelled = true; };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [phase, roomId, role]);

  

  const saveCurrentSceneState = useCallback(async (sceneId: string) => {
    if (!sceneId || !roomId) return;

    await supabase
      .from('vtt_scenes')
      .update({
        config: configRef.current,
        fog_state: fogStateRef.current,
        tokens: tokensRef.current,
        walls: wallsRef.current,
        doors: doorsRef.current,
        windows: windowsRef.current,
        props: propsRef.current,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId);
  }, [roomId]);


  const handleSwitchScene = useCallback(async (sceneId: string) => {
    if (sceneId === activeSceneIdRef.current || switchingSceneRef.current) return;
    switchingSceneRef.current = true;
    try {
      // -------------------
      // Sauvegarde immédiate du brouillard de guerre avant changement de scène
      // -------------------
      if (fogSaveTimerRef.current) {
        clearTimeout(fogSaveTimerRef.current);
        fogSaveTimerRef.current = null;
      }

      if (activeSceneIdRef.current) {
        await supabase
          .from('vtt_scenes')
          .update({
            fog_state: fogStateRef.current,
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
        type: 'SWITCH_SCENE',
        sceneId: scene.id,
        config: scene.config,
        tokens: scene.tokens,
        fogState: scene.fogState,
        walls: scene.walls || [],
        doors: scene.doors || [],
        windows: scene.windows || [],
        props: Array.isArray(scene.props) ? scene.props : [],
      });

      setConfig(scene.config);

      // -------------------
    const nextFogState = normalizeFogState(scene.fogState);
      fogStateRef.current = nextFogState;
      setFogState(nextFogState);

      setTokens(scene.tokens);
      setWalls(scene.walls || []);
      setDoors(scene.doors || []);
      setWindows(scene.windows || []);
      setProps(Array.isArray(scene.props) ? scene.props : []);
      setSelectedPropId(null);
      const switchedNotes = scene.config.gmNotes || [];
      setGmNotes(switchedNotes);
      gmNotesRef.current = switchedNotes;
      setActiveSceneId(sceneId);

      localStorage.setItem(getLastSceneStorageKey(roomId!), sceneId);

      vttService.setActiveSceneId(sceneId);
      setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...scene, props: Array.isArray(scene.props) ? scene.props : [] } : s));
      {
        const rawSv2 = scene.config.savedViewport ?? null;
        const svContainer2 = canvasContainerRef.current;
        const clampedSv2 = rawSv2 && svContainer2
          ? clampViewport(rawSv2, scene.config, svContainer2.clientWidth, svContainer2.clientHeight)
          : rawSv2;
        setSavedViewport(clampedSv2);
      }

      // -------------------
      // Synchronisation du viewport React pour les props HTML
      // -------------------
      if (scene.config.savedViewport) {
        const switchContainer = canvasContainerRef.current;
        const clampedSwitchVp = switchContainer
          ? clampViewport(scene.config.savedViewport, scene.config, switchContainer.clientWidth, switchContainer.clientHeight)
          : scene.config.savedViewport;
        setCanvasViewport(clampedSwitchVp);
        canvasViewportRef.current = clampedSwitchVp;
      }
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
        props: [],
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

const handleMoveToken = useCallback((
  tokenId: string,
  position: { x: number; y: number },
  options?: { localCameraFollow?: boolean }
) => {
  const movedToken = tokensRef.current.find(t => t.id === tokenId);
  if (!movedToken) return;

  const currentPosition = movedToken.position;
  const gridSize = configRef.current.gridSize || 50;
  const dx = position.x - currentPosition.x;
  const dy = position.y - currentPosition.y;
  const distance = Math.hypot(dx, dy);

  // -------------------
  // Gestion du glissement case à case
  // -------------------
  const isSingleGridStep =
    gridSize > 0 &&
    distance > 0 &&
    distance <= gridSize * 1.5 &&
    (
      (Math.abs(dx) === gridSize && dy === 0) ||
      (Math.abs(dy) === gridSize && dx === 0)
    );

  // -------------------
  // Gestion des déplacements instantanés
  // -------------------
  if (!isSingleGridStep) {
    const existingAnimation = tokenMoveAnimationFrameRef.current.get(tokenId);
    if (existingAnimation) {
      cancelAnimationFrame(existingAnimation);
      tokenMoveAnimationFrameRef.current.delete(tokenId);
    }

    tokenAnimatedPositionRef.current.delete(tokenId);

    setTokens(prev => {
      const next = prev.map(t => t.id === tokenId ? { ...t, position } : t);
      tokensRef.current = next;
      return next;
    });
  } else {
    // -------------------
    // Gestion de la position logique du token
    // -------------------
    // On pose immédiatement la destination logique pour la sync,
    // mais l'affichage utilisera une position visuelle interpolée.
    setTokens(prev => {
      const next = prev.map(t => t.id === tokenId ? { ...t, position } : t);
      tokensRef.current = next;
      return next;
    });

    const existingAnimation = tokenMoveAnimationFrameRef.current.get(tokenId);
    if (existingAnimation) {
      cancelAnimationFrame(existingAnimation);
      tokenMoveAnimationFrameRef.current.delete(tokenId);
    }

    // -------------------
    // Gestion de la vitesse de glissement des tokens
    // -------------------
    const animationDuration = 320;
    const animationStart = performance.now();

const easeOutCubic = (t: number) => t < 0.5
  ? 2 * t * t
  : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const animate = (now: number) => {
      const rawT = Math.min(1, (now - animationStart) / animationDuration);
      const t = easeOutCubic(rawT);

      tokenAnimatedPositionRef.current.set(tokenId, {
        x: currentPosition.x + dx * t,
        y: currentPosition.y + dy * t,
      });

      vttCanvasRef.current?.redraw?.();

      if (rawT < 1) {
        const rafId = requestAnimationFrame(animate);
        tokenMoveAnimationFrameRef.current.set(tokenId, rafId);
      } else {
        tokenMoveAnimationFrameRef.current.delete(tokenId);
        tokenAnimatedPositionRef.current.delete(tokenId);
        vttCanvasRef.current?.redraw?.();
      }
    };

    const rafId = requestAnimationFrame(animate);
    tokenMoveAnimationFrameRef.current.set(tokenId, rafId);
  }

  if (options?.localCameraFollow && followCameraOnTokenMove) {
    const tokenSizePx = ((movedToken?.size || 1) * (configRef.current.gridSize || 50));

    vttCanvasRef.current?.followWorldPosition(
      position.x + tokenSizePx / 2,
      position.y + tokenSizePx / 2
    );
  }

  pendingMovesRef.current.set(tokenId, position);
  const existing = moveThrottleRef.current.get(tokenId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    const pos = pendingMovesRef.current.get(tokenId);
    if (pos) {
      vttService.send({ type: 'MOVE_TOKEN_REQUEST', tokenId, position: pos });
      pendingMovesRef.current.delete(tokenId);

      const sceneId = activeSceneIdRef.current;
      if (sceneId) {
        saveCurrentSceneState(sceneId).catch(err => {
          console.error('[VTT] Save scene after token move error:', err);
        });
      }
    }
    moveThrottleRef.current.delete(tokenId);
  }, 50);
  moveThrottleRef.current.set(tokenId, timer);
}, [saveCurrentSceneState, followCameraOnTokenMove]);


  // -------------------
  // Handler drag & drop d'un joueur connecté sur le canvas
  // Crée un token à la position de drop avec les infos du joueur
  // -------------------
  // Handler drag & drop d'un joueur connecté sur le canvas
  // Crée un token à la position de drop avec les infos du joueur
  // -------------------
  // NOTE: This function is currently unused, but must be a valid function if present
  /*
  const handleDropPlayerOnCanvas = useCallback((userId: string, worldPos: { x: number; y: number }) => {
    const userToken = tokens.find(t => t.controlledByUserIds?.includes(userId));
    if (!userToken) return;
    // Déplace le token existant du joueur à la position de drop
    vttService.send({
      type: 'MOVE_TOKEN_REQUEST',
      tokenId: userToken.id,
      position: worldPos,
    });
  }, [tokens]);
  */
  
// -------------------
// Gestion de la levée du brouillard de guerre
// Accepte un stroke unique ou un batch de strokes (painting continu).
// Un batch produit UN SEUL setState + UN SEUL broadcast + UNE SEULE RPC Supabase,
// au lieu de N (un par mousemove). C'est la clé de la performance du pinceau.
// -------------------
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
}, [saveCurrentSceneState, role]);

const seenDoorsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  if (seenDoorsSaveTimerRef.current) clearTimeout(seenDoorsSaveTimerRef.current);
  seenDoorsSaveTimerRef.current = setTimeout(() => {
    seenDoorsSaveTimerRef.current = null;
    const sceneId = activeSceneIdRef.current;
    if (!sceneId) return;
    supabase.rpc('update_scene_fog_state', {
      p_scene_id: sceneId,
      p_fog_state: fogStateRef.current,
    }).then(({ error }) => {
      if (error) console.error('[VTT] handleSeenDoorsUpdate save error:', error);
    });
  }, 2000);
}, []);

const handleAddToken = useCallback((token: Omit<VTTToken, 'id'>) => {
  pushUndoSnapshot();
  const center = vttCanvasRef.current?.getViewportCenter() ?? { x: 200, y: 200 };

  // -------------------
  // Construction du token de base avec les propriétés par défaut
  // -------------------
  const baseToken = {
    ...token,
    position: center,
    visible: token.visible ?? true,
    showLabel: token.showLabel ?? true,
    visionMode: token.visionMode ?? 'none',
    lightSource: token.lightSource ?? 'none',
  };

  // -------------------
  // Auto-assignation du token au joueur connecté
  // -------------------
  // Si le rôle est 'player', on assigne automatiquement le token
  // au joueur qui l'ajoute via controlledByUserIds.
  // Cela permet au joueur de contrôler immédiatement son token
  // sans intervention du MJ. L'info est persistée dans state_json.
  const tokenToAdd = {
    ...baseToken,
    controlledByUserIds: role === 'player'
      ? [userId]
      : baseToken.controlledByUserIds || [],
  };

  vttService.send({ type: 'ADD_TOKEN', token: tokenToAdd });
}, [pushUndoSnapshot, role, userId]);
  
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
    pushUndoSnapshot();
    vttService.send({ type: 'REMOVE_TOKEN', tokenId });
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    setSelectedTokenId(id => id === tokenId ? null : id);
    setSelectedTokenIds(prev => prev.filter(id => id !== tokenId));
  }, [canControlToken, pushUndoSnapshot]);

  


  const handleToggleVisibility = useCallback((tokenId: string) => {
    if (role !== 'gm') return;
    const token = tokens.find(t => t.id === tokenId);
    if (!token) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes: { visible: !token.visible } });
  }, [tokens, role]);

  const handleTokenDoubleClick = useCallback((token: VTTToken) => {
    const isGm = role === 'gm';
    const isOwner = token.ownerUserId === userId;
    const isController = (token.controlledByUserIds ?? []).includes(userId);
    if (!isGm && !isOwner && !isController) return;

    if (isGm && !token.characterId) {
      setMonsterStatBlockToken(token);
      return;
    }

    if (!token.characterId) return;
    setCharacterSheetToken(token);
  }, [role, userId]);

  const handleEditTokenSave = useCallback((changes: Partial<VTTToken>) => {
    if (!editingToken) return;
    if (!canControlToken(editingToken)) return;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId: editingToken.id, changes });
  }, [editingToken, canControlToken]);

// -------------------
// -------------------
// Gestion des mises à jour des tokens
// -------------------

const handleUpdateToken = useCallback((tokenId: string, changes: Partial<VTTToken>) => {
  const token = tokensRef.current.find(t => t.id === tokenId);
  if (!token) return;
  if (!canControlToken(token)) return;
  pushUndoSnapshot();

  // -------------------
  // Mise à jour optimiste locale
  // -------------------

  setTokens(prev => prev.map(t =>
    t.id === tokenId ? { ...t, ...changes } : t
  ));

  // -------------------
  // Envoi au serveur via vttService
  // -------------------
  vttService.send({ type: 'UPDATE_TOKEN', tokenId, changes });
}, [canControlToken, pushUndoSnapshot]);

// -------------------
// Synchronisation des PV personnage -> token
// -------------------

  
const handleSyncTokenHpFromCharacter = useCallback((tokenId: string, hp: number | null, maxHp: number | null) => {
  const token = tokensRef.current.find(t => t.id === tokenId);
  if (!token) return;
  if (!canControlToken(token)) return;

  const normalizedHp = typeof hp === 'number' && Number.isFinite(hp) ? Math.max(0, hp) : null;
  const normalizedMaxHp = typeof maxHp === 'number' && Number.isFinite(maxHp) ? Math.max(0, maxHp) : null;

  setTokens(prev => prev.map(t =>
    t.id === tokenId ? { ...t, hp: normalizedHp ?? undefined, maxHp: normalizedMaxHp ?? undefined } : t
  ));

  vttService.send({
    type: 'UPDATE_TOKEN',
    tokenId,
    changes: {
      hp: normalizedHp ?? undefined,
      maxHp: normalizedMaxHp ?? undefined,
    },
  });

  // Synchronisation vers l'onglet combat (participants)
  // Nécessaire quand le joueur modifie ses HP depuis sa feuille de perso
  if (normalizedHp !== null) {
    syncTokenHpRef.current?.(tokenId, normalizedHp);
  }
}, [canControlToken]); 

// -------------------
// Gestion du resize des tokens
// -------------------
// Empêche les joueurs connectés de redimensionner les tokens,
// même lorsqu'ils contrôlent ces derniers.
const handleResizeToken = useCallback((tokenId: string, size: number) => {
  if (role === 'player') return;

  handleUpdateToken(tokenId, { size });
}, [handleUpdateToken, role]);

const handleAddTokenAtPos = useCallback((tokenData: Omit<VTTToken, 'id'> & { needsImageResolve?: boolean }, worldPos: { x: number; y: number }) => {
  pushUndoSnapshot();

  // -------------------
  // Construction du token de base avec position et propriétés par défaut
  // -------------------
  const { needsImageResolve, ...cleanTokenData } = tokenData;
  const baseToken = {
    ...cleanTokenData,
    position: worldPos,
    visible: cleanTokenData.visible ?? true,
    showLabel: cleanTokenData.showLabel ?? true,
    visionMode: cleanTokenData.visionMode ?? 'none',
    lightSource: cleanTokenData.lightSource ?? 'none',
  };

  // -------------------
  // Auto-assignation du token au joueur connecté (drag & drop)
  // -------------------
  const tokenToAdd = {
    ...baseToken,
    controlledByUserIds: role === 'player'
      ? [userId]
      : baseToken.controlledByUserIds || [],
  };

  // -------------------
  // Résolution asynchrone de l'image du monstre
  // -------------------
  // vttService génère lui-même l'id final du token dans send(ADD_TOKEN).
  // On installe un listener one-shot sur TOKEN_ADDED pour récupérer
  // l'id réel, puis on envoie UPDATE_TOKEN avec l'image une fois
  // le détail chargé depuis l'API aidedd.
  if (needsImageResolve && baseToken.monsterSlug) {
    const slugToResolve = baseToken.monsterSlug;
    const label = baseToken.label;

    // Listener one-shot : attend le prochain TOKEN_ADDED correspondant au nom
    const unsubscribe = vttService.onMessage((msg) => {
      if (msg.type === 'TOKEN_ADDED' && msg.token.label === label) {
        unsubscribe();
        const realTokenId = msg.token.id;
        monsterService.fetchMonsterDetail(slugToResolve).then((detail) => {
          console.log('[VTT] image résolue pour', slugToResolve, '→', detail?.image_url);
          if (detail?.image_url) {
            vttService.send({
              type: 'UPDATE_TOKEN',
              tokenId: realTokenId,
              changes: { imageUrl: detail.image_url },
            });
          }
        }).catch(() => {
          // Pas d'image disponible → fallback couleur conservé
        });
      }
    });

    // Sécurité : nettoyage du listener après 10s si TOKEN_ADDED jamais reçu
    setTimeout(unsubscribe, 10000);
  }

  vttService.send({ type: 'ADD_TOKEN', token: tokenToAdd });
}, [pushUndoSnapshot, role, userId]);
  
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
  }, [role, saveCurrentSceneState]);

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
  }, [role, saveCurrentSceneState]);

  // ===================================
  // Réinitialiser le fog — alias de "Tout masquer" (même comportement)
  // ===================================
  const handleResetFog = handleMaskAll;

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

  const handleResetImageSize = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene?.config.mapImageUrl) return;
    const img = new Image();
    img.onload = () => {
      handleSaveSceneConfig(sceneId, { mapWidth: img.naturalWidth, mapHeight: img.naturalHeight });
    };
    img.src = scene.config.mapImageUrl;
  }, [scenes, handleSaveSceneConfig]);

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

      const persistSceneProps = useCallback((sceneId: string, nextProps: VTTProp[]) => {
    propsRef.current = nextProps;

    setScenes(currentScenes =>
      currentScenes.map(scene =>
        scene.id === sceneId
          ? { ...scene, props: nextProps }
          : scene
      )
    );

    supabase
      .from('vtt_scenes')
      .update({
        props: nextProps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sceneId)
      .then(({ error }) => {
        if (error) console.error('[VTT] Persist props error:', error);
      });
  }, []);

  // -------------------
  // Gestion du copier / coller
  // -------------------
  const handleCopySelection = useCallback(() => {
    if (role !== 'gm') return;

    if (selectedTokenId) {
      const token = tokensRef.current.find(t => t.id === selectedTokenId);
      if (token) {
        setCopyBuffer({ kind: 'token', data: structuredClone(token) });
        return;
      }
    }

    if (selectedPropId) {
      const prop = propsRef.current.find(p => p.id === selectedPropId);
      if (prop) {
        setCopyBuffer({ kind: 'prop', data: structuredClone(prop) });
      }
    }
  }, [role, selectedTokenId, selectedPropId]);

  const handlePasteSelection = useCallback(() => {
    if (role !== 'gm' || !copyBuffer) return;

    pushUndoSnapshot();

    if (copyBuffer.kind === 'token') {
      const source = copyBuffer.data;
      const newId = crypto.randomUUID();
      const newToken: VTTToken = {
        ...structuredClone(source),
        id: newId,
        position: {
          x: source.position.x + 40,
          y: source.position.y + 40,
        },
      };

      vttService.send({
        type: 'ADD_TOKEN',
        token: {
          ...newToken,
        },
      });

      setSelectedPropId(null);
      setSelectedTokenIds([newId]);
      setSelectedTokenId(newId);
      return;
    }

    if (copyBuffer.kind === 'prop') {
      const source = copyBuffer.data;
      const newProp: VTTProp = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        position: {
          x: source.position.x + 40,
          y: source.position.y + 40,
        },
      };

      setProps(prev => {
        const next = [...prev, newProp];
        const sceneId = activeSceneIdRef.current;
        if (sceneId) persistSceneProps(sceneId, next);
        return next;
      });

      setSelectedTokenId(null);
      setSelectedTokenIds([]);
      setSelectedPropId(newProp.id);
    }
  }, [role, copyBuffer, pushUndoSnapshot, persistSceneProps]);

  const handleAddProp = useCallback((propData: Omit<VTTProp, 'id'>) => {
    pushUndoSnapshot();
    const newProp: VTTProp = { ...propData, id: crypto.randomUUID() };

    setProps(prev => {
      const next = [...prev, newProp];
      const sceneId = activeSceneIdRef.current;
      if (sceneId) persistSceneProps(sceneId, next);
      return next;
    });

    vttService.broadcastPropEvent({ type: 'PROP_ADDED', prop: newProp });
  }, [persistSceneProps, pushUndoSnapshot]);

  const handleDropProp = useCallback((propData: { url: string; name: string; isVideo: boolean }, worldPos: { x: number; y: number }) => {
    handleAddProp({
      label: propData.name,
      imageUrl: propData.url,
      position: worldPos,
      width: propData.isVideo ? 200 : 150,
      height: propData.isVideo ? 200 : 150,
      opacity: 1,
      locked: false,
    });
  }, [handleAddProp]);

  const handleRemoveProp = useCallback((propId: string) => {
    pushUndoSnapshot();
    setProps(prev => {
      const next = prev.filter(p => p.id !== propId);
      const sceneId = activeSceneIdRef.current;
      if (sceneId) persistSceneProps(sceneId, next);
      return next;
    });

    setSelectedPropId(id => (id === propId ? null : id)); 
    vttService.broadcastPropEvent({ type: 'PROP_REMOVED', propId });
  }, [persistSceneProps, pushUndoSnapshot]); 

  const propBroadcastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPropBroadcastRef = useRef<{ propId: string; changes: Partial<VTTProp> } | null>(null);

  const handleUpdateProp = useCallback((propId: string, changes: Partial<VTTProp>) => {
    setProps(prev => {
      const next = prev.map(p => (p.id === propId ? { ...p, ...changes } : p));
      const sceneId = activeSceneIdRef.current;
      if (sceneId) persistSceneProps(sceneId, next);
      return next;
    });

    // Debounce le broadcast à 50ms pour éviter de spammer pendant le drag
    pendingPropBroadcastRef.current = { propId, changes };
    if (!propBroadcastTimerRef.current) {
      propBroadcastTimerRef.current = setTimeout(() => {
        propBroadcastTimerRef.current = null;
        const pending = pendingPropBroadcastRef.current;
        if (pending) {
          vttService.broadcastPropEvent({ type: 'PROP_UPDATED', propId: pending.propId, changes: pending.changes });
          pendingPropBroadcastRef.current = null;
        }
      }, 50);
    }
  }, [persistSceneProps]);

  useEffect(() => {
    if (phase !== 'room') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      // -------------------
      // Échap — décibler tous les tokens (tous rôles)
      // -------------------
      // Retire userId de targetedByUserIds sur tous les tokens
      // où il apparaît, quelle que soit la sélection courante.
      if (e.key === 'Escape') {
        tokensRef.current
          .filter(t => t.targetedByUserIds?.includes(userId))
          .forEach(t => {
            vttService.send({
              type: 'UPDATE_TOKEN',
              tokenId: t.id,
              changes: { targetedByUserIds: t.targetedByUserIds!.filter(id => id !== userId) },
            });
          });
        return;
      }

      if (role !== 'gm') return;

      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (key === 'c') {
          e.preventDefault();
          handleCopySelection();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          handlePasteSelection();
          return;
        }
        if (key === 'z' && e.shiftKey) {
          e.preventDefault();
          handleRedo();
          return;
        }
        if (key === 'z') {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;

      if (selectedTokenId) {
        e.preventDefault();
        handleRemoveToken(selectedTokenId);
      } else if (selectedPropId) {
        e.preventDefault();
        handleRemoveProp(selectedPropId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    phase,
    role,
    selectedTokenId,
    selectedPropId,
    handleRemoveToken,
    handleRemoveProp,
    handleUndo,
    handleRedo,
    handleCopySelection,
    handlePasteSelection,
  ]);

  // -------------------
  // Écoute de vtt:token-hp-changed pour mettre à jour forcedHp
  // de la fiche de personnage ouverte (cas applyHp depuis CombatTab)
  // -------------------
  useEffect(() => {
    const handler = (e: Event) => {
      const { characterId, tokenId, newHp } = (e as CustomEvent).detail as { characterId?: string; tokenId?: string; newHp: number };
      const sheet = characterSheetTokenRef.current;
      if (!sheet) return;
      const matches = (characterId && sheet.characterId && characterId === sheet.characterId)
        || (tokenId && tokenId === sheet.id);
      if (!matches) return;
      setCharacterSheetForcedHp(newHp);
      setCharacterSheetToken(prev => prev ? { ...prev, hp: newHp } : prev);
    };
    window.addEventListener('vtt:token-hp-changed', handler);
    return () => window.removeEventListener('vtt:token-hp-changed', handler);
  }, []);

  const handlePropMouseDown = useCallback((e: React.MouseEvent, prop: VTTProp) => {
    if (role !== 'gm' || prop.locked) return;

    e.preventDefault();
    e.stopPropagation();

    const elementRect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    setSelectedPropId(prop.id);
    setDraggingPropId(prop.id);
    // setResizingPropId(null); // removed
    propResizeRef.current = null;

const vp = canvasViewportRef.current;

propDragRef.current = {
  propId: prop.id,
  offsetX: (e.clientX - elementRect.left) / vp.scale,
  offsetY: (e.clientY - elementRect.top) / vp.scale,
};
  }, [role]);

  const handlePropResizeMouseDown = useCallback((e: React.MouseEvent, prop: VTTProp) => {
    if (role !== 'gm' || prop.locked) return;

    e.preventDefault();
    e.stopPropagation();

    setSelectedPropId(prop.id);
    // setResizingPropId(prop.id); // removed
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

const vp = canvasViewportRef.current;

const nextX = (e.clientX - containerRect.left - vp.x) / vp.scale - offsetX;
const nextY = (e.clientY - containerRect.top - vp.y) / vp.scale - offsetY;

handleUpdateProp(propId, {
  position: {
    x: nextX,
    y: nextY,
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
      // setResizingPropId(null); // removed
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleUpdateProp]);



const handleBroadcastFrameChange = useCallback((frame: { x: number; y: number; width: number; height: number }) => {
  setBroadcastFrame(frame);
  if (broadcastTimerRef.current) clearTimeout(broadcastTimerRef.current);
  broadcastTimerRef.current = setTimeout(() => {
    if (broadcastModeRef.current === 'frame' && broadcastFrameEnabled) {
      vttService.sendBroadcastViewport(frame);
    }
  }, 50);
}, [broadcastFrameEnabled]);

const handleCanvasViewportChange = useCallback((vp: { x: number; y: number; scale: number }) => {
  setCanvasViewport(vp);

  if (role !== 'gm') return;

  const container = canvasContainerRef.current;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const worldX = -vp.x / vp.scale;
  const worldY = -vp.y / vp.scale;
  const worldW = rect.width / vp.scale;
  const worldH = rect.height / vp.scale;
  const nextViewport = { x: worldX, y: worldY, width: worldW, height: worldH };

  if (followTimerRef.current) clearTimeout(followTimerRef.current);
  followTimerRef.current = setTimeout(() => {
    if (broadcastModeRef.current === 'follow') {
      vttService.sendBroadcastViewport(nextViewport);
    }
    if (gmFollowEnabledRef.current) {
      vttService.sendPlayerViewport(nextViewport);
    }
  }, 50);
}, [role]);
 
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

useEffect(() => {
  if (role !== 'gm') return;
  if (!broadcastFrameEnabled) return;
  if (broadcastMode !== 'frame') return;

  vttService.sendBroadcastViewport(broadcastFrame);
}, [role, broadcastFrameEnabled, broadcastMode, broadcastFrame]);



  useEffect(() => {
  if (!followCameraOnTokenMove) {
    vttCanvasRef.current?.stopFollowingWorldPosition();
  }
}, [followCameraOnTokenMove]);


  // const handleSaveScene = useCallback(async () => { // Unused, removed
  /*
  const handleSaveScene = useCallback(async () => {
    if (!activeSceneIdRef.current || role !== 'gm') return;
    await saveCurrentSceneState(activeSceneIdRef.current);
  }, [role, saveCurrentSceneState]);
  */

  // const handleSaveView = useCallback(async () => { // Unused, removed
  /*
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
  */
  
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

  const handleNotesChange = useCallback((notes: VTTNote[]) => {
    if (role !== 'gm') return;
    setGmNotes(notes);
    gmNotesRef.current = notes;
    vttService.send({ type: 'UPDATE_MAP', config: { gmNotes: notes } });
    const sceneId = activeSceneIdRef.current;
    if (sceneId) {
      setConfig(prev => ({ ...prev, gmNotes: notes }));
      supabase
        .from('vtt_scenes')
        .update({ config: { ...configRef.current, gmNotes: notes }, updated_at: new Date().toISOString() })
        .eq('id', sceneId)
        .then(({ error }) => { if (error) console.error('[VTT] notes save error:', error); });
    }
  }, [role]);

  
  // -------------------
  // Réception d'un résultat de jet de dés depuis DiceBox3D
  // -------------------
  // Construit un VTTChatMessage de kind='roll' avec l'avatar du joueur résolu
  // depuis la liste des tokens (controlledByUserIds → imageUrl / color / label).
  // Le message est ensuite injecté dans VTTChatPanel via pendingChatRoll.
  const handleRollResult = useCallback((result: DiceRollResult) => {
    // Résolution de l'avatar
    let tokenLabel = role === 'gm' ? 'MJ' : userName;
    let tokenImageUrl: string | null = null;
    let tokenColor = role === 'gm' ? '#f59e0b' : '#6b7280';

    if (role !== 'gm') {
      const myToken = tokensRef.current.find(t => t.controlledByUserIds?.includes(userId));
      if (myToken) {
        tokenLabel = myToken.label;
        tokenImageUrl = myToken.imageUrl ?? null;
        tokenColor = myToken.color;
      }
    }

    const msg: VTTChatMessage = {
      id: crypto.randomUUID(),
      userId,
      userName,
      role,
      timestamp: Date.now(),
      kind: 'roll',
      tokenLabel,
      tokenImageUrl,
      tokenColor,
      attackName: result.attackName,
      diceFormula: result.diceFormula,
      modifier: result.modifier,
      rolls: result.rolls,
      diceTotal: result.diceTotal,
      total: result.total,
      rollType: currentRollTypeRef.current ?? undefined,
    };

    setPendingChatRoll(msg);

    if (autoApplyDamageRef.current && currentRollTypeRef.current === 'damage') {
      const targeted = getTargetedTokensForUser(tokensRef.current, userId);
      targeted.forEach((token) => {
        const newHp = computeNewHp(token, result.total);
        vttService.send({ type: 'UPDATE_TOKEN', tokenId: token.id, changes: { hp: newHp } });
        setTokens((prev) =>
          prev.map((t) => (t.id === token.id ? { ...t, hp: newHp } : t)),
        );
        syncTokenHpRef.current?.(token.id, newHp);
        // Force la mise à jour du snapshot characterSheetToken si la fiche de ce token est ouverte
        setCharacterSheetToken((prev) =>
          prev?.id === token.id ? { ...prev, hp: newHp } : prev
        );
        // Événement custom direct vers VTTCharacterSheetPanel — court-circuite toute la chaîne React
        window.dispatchEvent(new CustomEvent('vtt:token-hp-changed', {
          detail: { tokenId: token.id, characterId: token.characterId, newHp }
        }));
        // Utilise la ref (pas la closure) pour éviter le problème de deps stales
        if (characterSheetTokenRef.current?.id === token.id) {
          setCharacterSheetForcedHp(newHp);
        }
        if (characterSheetToken?.id === token.id) {
          setCharacterSheetForcedHp(newHp);
        }
      });
    }
  }, [role, userId, userName]);

  const leaveRoom = useCallback(async () => {
    if (fogSaveTimerRef.current) {
      clearTimeout(fogSaveTimerRef.current);
      fogSaveTimerRef.current = null;
    }

    if (activeSceneIdRef.current && role === 'gm') {
      await supabase
        .from('vtt_scenes')
        .update({
          fog_state: fogStateRef.current,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeSceneIdRef.current);

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
    setDoors([]);
    setWindows([]);
    setConnectedUsers([]);
  }, [role, saveCurrentSceneState]);

  const handleJoinFromLobby = useCallback((id: string, chosenRole: 'gm' | 'player', selectedTokenIds?: string[]) => {
    setRoomId(id);
    setRequestedRole(chosenRole);
    setPlayerBoundTokenIds(selectedTokenIds || []);
    setPhase('room');
  }, []);

   // -------------------
  // Assignation automatique des tokens au joueur à la reconnexion
  // -------------------
  // Les playerBoundTokenIds peuvent contenir soit des token.id (canvas),
  // soit des player_id (personnages de campagne). On résout les deux cas
  // en cherchant d'abord par token.id, puis par token.characterId.
  // Cela garantit que la reconnexion via le lobby (stratégie campagne)
  // retrouve bien le token existant sur le canvas.
  useEffect(() => {
    if (phase !== 'room' || !roomId || role !== 'player' || playerBoundTokenIds.length === 0) return;
    if (tokens.length === 0) return;

    // -------------------
    // Résolution des IDs : player_id (campagne) → token.id (canvas)
    // -------------------
    // Pour chaque ID sélectionné dans le lobby, on cherche le token correspondant :
    // 1. D'abord par token.id direct (fallback canvas classique)
    // 2. Sinon par token.characterId (personnage de campagne lié au token)
    const resolvedTokenIds: string[] = [];
    playerBoundTokenIds.forEach(boundId => {
      // Recherche directe par token.id
      const directMatch = tokens.find(t => t.id === boundId);
      if (directMatch) {
        resolvedTokenIds.push(directMatch.id);
        return;
      }
      // Recherche par characterId (player_id de campagne → token canvas)
      const charMatch = tokens.find(t => t.characterId === boundId);
      if (charMatch) {
        resolvedTokenIds.push(charMatch.id);
        return;
      }
    });

    // -------------------
    // Assignation du userId aux tokens résolus
    // -------------------
    resolvedTokenIds.forEach(tokenId => {
      const token = tokens.find(t => t.id === tokenId);
      if (!token) return;
      vttService.send({
        type: 'UPDATE_TOKEN',
        tokenId,
        changes: { controlledByUserIds: [userId] },
      });
    });

    // -------------------
    // Nettoyage : retirer le userId des tokens NON sélectionnés (exclusivité)
    // -------------------
    // On ne retire que si on a effectivement résolu au moins un token,
    // sinon on risque de désassigner sans avoir rien réassigné.
    if (resolvedTokenIds.length > 0) {
      tokens.forEach(token => {
        if (resolvedTokenIds.includes(token.id)) return;
        if (!token.controlledByUserIds?.includes(userId)) return;
        const newControlled = token.controlledByUserIds.filter(id => id !== userId);
        vttService.send({
          type: 'UPDATE_TOKEN',
          tokenId: token.id,
          changes: { controlledByUserIds: newControlled },
        });
      });
    }

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
    <DiceRollContext.Provider value={{ rollDice }}>
    <div className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      <div className="flex flex-1 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 z-30 pointer-events-auto">
<VTTLeftToolbar
  role={role}
  activeTool={activeTool}
  fogBrushSize={fogBrushSize}
  config={config}
  tokens={tokens}
  connectedUsers={connectedUsers}
  onToolChange={handleToolChange}
  onFogBrushSizeChange={setFogBrushSize}
  onAddToken={() => setShowAddToken(true)}
  
  onRevealAll={handleRevealAll}
  onMaskAll={handleMaskAll}
  onResetFog={handleResetFog}
  onUpdateMap={handleUpdateMap}
  onBack={leaveRoom}
  calibrationPoints={calibrationPoints}
  onClearCalibration={handleClearCalibration}
  onApplyCalibration={handleApplyCalibration}
  wallCount={walls.length}
  onClearWalls={handleClearWalls}
  doorCount={doors.length}
  onClearDoors={handleClearDoors}
  windowCount={windows.length}
  onClearWindows={handleClearWindows}
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
  broadcastMode={broadcastMode}
  onBroadcastModeChange={handleBroadcastModeChange}
  gmFollowEnabled={gmFollowEnabled}
onToggleGmFollow={() => {
  setGmFollowEnabled(v => {
    const next = !v;
    if (next) {
      setBroadcastMode('follow');
    } else {
      vttService.sendPlayerViewport(null);
    }
    return next;
  });
}} 
  weatherEffects={weatherEffects}
  onUpdateWeather={handleUpdateWeather}
  isPingActive={isPingMode}
  onPing={() => setIsPingMode(v => !v)}
  gmNotes={gmNotes}
  noteCount={gmNotes.length}
  onNotesChange={handleNotesChange}
  showGmNotes={showGmNotes}
  onToggleShowGmNotes={() => setShowGmNotes(v => !v)}
/>
        </div>

        <div
          ref={canvasContainerRef}
          className="flex-1 relative overflow-hidden"
onMouseDown={e => {
  if (e.target !== e.currentTarget) return;
  setSelectedPropId(null);
}}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); }}
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
              viewportRef={canvasViewportRef}
            />
          )}

          
          {isPingMode && (
            <div
              className="absolute inset-0 z-10 cursor-crosshair"
              onClick={e => {
                const container = canvasContainerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const sx = e.clientX - rect.left;
                const sy = e.clientY - rect.top;
                const vp = canvasViewportRef.current;
                const wx = (sx - vp.x) / vp.scale;
                const wy = (sy - vp.y) / vp.scale;
                const userColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#ec4899'];
                const color = userColors[Math.abs(userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % userColors.length];
                vttService.sendPing(wx, wy, userName, color);
                setIsPingMode(false);
              }}
            />
          )}

          <VTTCanvas
            ref={vttCanvasRef}
            sceneId={activeSceneId ?? undefined}
            config={config}
            tokens={tokens}
            // -------------------
            // Gestion des positions visuelles animées des tokens
            // -------------------
            tokenAnimatedPositionsRef={tokenAnimatedPositionRef}
            fogState={fogState}
            role={role}
            userId={userId}
            activeTool={activeTool}
            fogBrushSize={fogBrushSize}
            onMoveToken={handleMoveToken}
            onRevealFog={handleRevealFog}
            selectedTokenId={selectedTokenId}
onSelectToken={id => {
  setSelectedPropId(null);
  if (role === 'gm' && activeTool !== 'select') {
    setActiveTool('select');
  }
  setSelectedTokenId(id);
}}
            selectedTokenIds={selectedTokenIds}
onSelectTokens={ids => {
  setSelectedPropId(null);
  if (role === 'gm' && activeTool !== 'select' && ids.length > 0) {
    setActiveTool('select');
  }
  setSelectedTokenIds(ids);
  if (ids.length > 0) {
    setSelectedTokenId(ids[0]);
  } else {
    setSelectedTokenId(null);
  }
}}
            onRightClickToken={(token, x, y) => setContextMenu({ token, x, y })}
            onTokenDoubleClick={handleTokenDoubleClick}
            onDropToken={handleDropToken}
            onDropProp={handleDropProp}
            onAddTokenAtPos={handleAddTokenAtPos}
            onResizeToken={handleResizeToken}
            calibrationPoints={calibrationPoints}
            onCalibrationPoint={handleCalibrationPoint}
            walls={walls}
            onWallAdded={handleWallAdded}
            onWallUpdated={handleWallUpdated}
            onWallRemoved={handleWallRemoved}
            showWalls={showWalls}
            doors={doors}
            onDoorAdded={handleDoorAdded}
            onDoorToggled={handleDoorToggled}
            onDoorRemoved={handleDoorRemoved}
            windows={windows}
            onWindowAdded={handleWindowAdded}
            onWindowRemoved={handleWindowRemoved}
            onMapDimensions={(w, h) => {
              if (config.mapWidth !== w || config.mapHeight !== h) {
                setConfig(prev => ({ ...prev, mapWidth: w, mapHeight: h }));
              }
            }}
     forceViewport={role === 'player' && playerForcedViewport ? playerForcedViewport : undefined}
            initialViewport={role === 'player' ? playerInitialViewport : savedViewport}
            onViewportChange={handleCanvasViewportChange}
            onSeenDoorsUpdate={role === 'player' ? handleSeenDoorsUpdate : undefined}
            fogResetSignal={fogResetSignal}
            followCameraOnTokenMove={followCameraOnTokenMove}
            restrictPlayerMovementOutsideTurn={lockPlayerMovementOutsideTurn}
            currentCombatTurnLabel={currentCombatTurnLabel}
            isCombatActive={currentCombatTurnLabel !== null}
          />
          
          {/* -------------------
              Anneaux de ciblage — couche HTML par-dessus le canvas
              -------------------
              Pour chaque token ciblé, on calcule la position écran
              à partir des coordonnées monde + viewport courant,
              puis on superpose le composant VTTTargetingRing.
              Utilise canvasViewport (mis à jour via onViewportChange)
              pour rester synchronisé avec le pan/zoom du canvas.
          */}
          {tokens
            .filter(t => (t.targetedByUserIds ?? []).length > 0 && t.visible)
            .map(t => {
              const vp = canvasViewport;
              const CELL = config.gridSize;
              const tokenSize = (t.size || 1) * CELL;
              const sx = t.position.x * vp.scale + vp.x;
              const sy = t.position.y * vp.scale + vp.y;
              const displaySize = tokenSize * vp.scale;
              return (
                <div
                  key={`targeting-${t.id}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: sx,
                    top: sy,
                    width: displaySize,
                    height: displaySize,
                    zIndex: 15,
                  }}
                >
                  <VTTTargetingRing size={displaySize} />
                </div>
              );
            })
          }

          {activePings.map(ping => {
            const vp = canvasViewport;
            const sx = ping.x * vp.scale + vp.x;
            const sy = ping.y * vp.scale + vp.y;
            return (
              <div
                key={ping.id}
                className="absolute pointer-events-none z-20"
                style={{ left: sx, top: sy, transform: 'translate(-50%, -50%)' }}
              >
                <PingAnimation color={ping.color} userName={ping.userName} />
              </div>
            );
          })}

          {role === 'gm' && showGmNotes && (
            <VTTNotesOverlay
              notes={gmNotes}
              role={role}
              pan={{ x: canvasViewport.x, y: canvasViewport.y }}
              zoom={canvasViewport.scale}
              isNoteTool={activeTool === 'note-place'}
              onEdit={note => setEditingNote({ note })}
              onMove={(id, x, y) => {
                const updated = gmNotesRef.current.map(n => n.id === id ? { ...n, x, y } : n);
                handleNotesChange(updated);
              }}
              onDelete={id => {
                const updated = gmNotesRef.current.filter(n => n.id !== id);
                handleNotesChange(updated);
              }}
              onCanvasClick={(wx, wy) => {
                setEditingNote({ note: null, initialX: wx, initialY: wy });
                setActiveTool('select');
              }}
            />
          )}

          {/* -------------------
              Liste des joueurs connectés (overlay bottom-left)
              Inclut le drag & drop pour déplacer un token joueur
              ------------------- */}
          <VTTPlayerList
            users={connectedUsers}
            tokens={tokens}
          />
          
{props.map(prop => (
  <div
    key={prop.id}
    className={`absolute pointer-events-auto select-none ${
      selectedPropId === prop.id ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-transparent' : ''
    } ${draggingPropId === prop.id ? 'cursor-grabbing' : 'cursor-move'}`}
    style={{
      left: prop.position.x * canvasViewport.scale + canvasViewport.x,
      top: prop.position.y * canvasViewport.scale + canvasViewport.y,
      width: prop.width * canvasViewport.scale,
      height: prop.height * canvasViewport.scale,
      opacity: prop.opacity,
      zIndex: selectedPropId === prop.id ? 15 : 5,
      transformOrigin: 'top left',
    }}
    onMouseDown={e => handlePropMouseDown(e, prop)}
    onClick={e => {
      e.stopPropagation();
      setSelectedPropId(prop.id);
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
                  className="absolute bottom-1 right-1 z-20 w-1.5 h-1.5 rounded-[2px] bg-white/80 hover:bg-white border border-black/10 shadow-none cursor-se-resize"
                  onMouseDown={e => handlePropResizeMouseDown(e, prop)}
                  onClick={e => e.stopPropagation()}
                  title="Redimensionner"
                />
              )}
            </div>
          ))}

       

{role === 'gm' && broadcastFrameEnabled && broadcastMode === 'frame' && (
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

        <div className="absolute top-0 right-0 bottom-0 z-30 pointer-events-auto">
          <VTTSidebar
            role={role}
            tokens={tokens}
            config={config}
            selectedTokenId={selectedTokenId || null}
            userId={userId}
            roomId={roomId ?? ''}
            connected={connected}
            connectedCount={connectedUsers.length || 1}
            connectedUsers={connectedUsers}
            activeTab={sidebarActiveTab}
            onChangeTab={setSidebarActiveTab}
            combatInitTokens={combatInitTokens}
                        onDirectLaunchCombatRef={directLaunchCombatRef}
            onSyncTokenHpRef={syncTokenHpRef}
            onSelectToken={setSelectedTokenId}
            onEditToken={setEditingToken}
            onRemoveToken={handleRemoveToken}
            onToggleVisibility={handleToggleVisibility}
            onUpdateMap={handleUpdateMap}
            onBack={leaveRoom}
            onHome={onBack}
            props={props}
            selectedPropId={selectedPropId || null}
            onSelectProp={setSelectedPropId}
            onAddProp={handleAddProp}
            onRemoveProp={handleRemoveProp}
            onUpdateProp={handleUpdateProp}
            onUpdateToken={handleUpdateToken}
            campaignId={campaignId ?? undefined}
            userName={userName}
            pendingChatRoll={pendingChatRoll}
            onChatRollConsumed={() => setPendingChatRoll(null)}
  autoFocusCombatTurn={autoFocusCombatTurn}
  onToggleAutoFocusCombatTurn={() => setAutoFocusCombatTurn((prev) => !prev)}
  onFocusCombatTokenByLabel={focusCombatTokenByLabel}
  onCurrentTurnLabelChange={setCurrentCombatTurnLabel}
  followCameraOnTokenMove={followCameraOnTokenMove}
  onToggleFollowCameraOnTokenMove={() => setFollowCameraOnTokenMove((prev) => {
    const next = !prev;
    try { localStorage.setItem('vtt:setting:followCameraOnTokenMove', String(next)); } catch {}
    return next;
  })}
  lockPlayerMovementOutsideTurn={lockPlayerMovementOutsideTurn}
  onToggleLockPlayerMovementOutsideTurn={() => setLockPlayerMovementOutsideTurn((prev) => !prev)}
  onCombatLaunched={() => setCombatBannerTrigger((n) => n + 1)}
  autoApplyDamage={autoApplyDamage}
  onToggleAutoApplyDamage={() => {
    setAutoApplyDamage((prev) => {
      const next = !prev;
      try { localStorage.setItem('vtt:setting:autoApplyDamage', String(next)); } catch {}
      return next;
    });
  }}
          />
        </div>
      </div>

<VTTModals
  role={role}
  userId={userId}
  tokensRef={tokensRef}

  showAddToken={showAddToken}
  onCloseAddToken={() => setShowAddToken(false)}
  onConfirmAddToken={handleAddToken}

  editingToken={editingToken}
  onCloseEditToken={() => setEditingToken(null)}
  onSaveEditToken={handleEditTokenSave}
  onRemoveEditToken={handleRemoveToken}

  contextMenu={contextMenu}
  onCloseContextMenu={() => setContextMenu(null)}
  selectedTokenIds={selectedTokenIds}
  onEditFromContext={setEditingToken}
  onDeleteFromContext={handleRemoveToken}
  onToggleVisibility={handleToggleVisibility}
  onToggleTorch={(token) => {
    const fresh = tokensRef.current.find(t => t.id === token.id) || token;
    vttService.send({ type: 'UPDATE_TOKEN', tokenId: fresh.id, changes: { lightSource: fresh.lightSource === 'torch' ? 'none' : 'torch' } });
  }}
  onManageBinding={(token) => { const fresh = tokensRef.current.find(t => t.id === token.id); setBindingToken(fresh || token); }}
  onConfigureVision={(token) => { const fresh = tokensRef.current.find(t => t.id === token.id); setVisionToken(fresh || token); }}
  onLaunchCombat={(tokens) => {
    setCombatInitTokens(tokens);
    setSidebarActiveTab('combat');
    // Lance directement le combat sans passer par la préparation
    setTimeout(() => directLaunchCombatRef.current?.(tokens), 50);
  }}
  onToggleTarget={(token) => {
    const fresh = tokensRef.current.find(t => t.id === token.id) || token;
    const isTargeted = (fresh.targetedByUserIds ?? []).includes(userId);
    const sel = selectedTokenIds.length > 1 ? tokensRef.current.filter(t => selectedTokenIds.includes(t.id)) : [fresh];
    sel.forEach(t => {
      const current = t.targetedByUserIds ?? [];
      const next = isTargeted ? current.filter(id => id !== userId) : current.includes(userId) ? current : [...current, userId];
      vttService.send({ type: 'UPDATE_TOKEN', tokenId: t.id, changes: { targetedByUserIds: next } });
    });
  }}

  bindingToken={bindingToken}
  connectedUsers={connectedUsers}
  onCloseBinding={() => setBindingToken(null)}
  onSaveBinding={(controlledByUserIds) => vttService.send({ type: 'UPDATE_TOKEN', tokenId: bindingToken!.id, changes: { controlledByUserIds } })}

  visionToken={visionToken}
  onCloseVision={() => setVisionToken(null)}
  onSaveVision={(changes) => vttService.send({ type: 'UPDATE_TOKEN', tokenId: visionToken!.id, changes })}

  sceneContextMenu={sceneContextMenu}
  onCloseSceneContextMenu={() => setSceneContextMenu(null)}
  scenes={scenes}
  onDeleteScene={handleDeleteScene}
  onOpenSceneConfig={setSceneConfigEdit}

  sceneConfigEdit={sceneConfigEdit}
  onCloseSceneConfig={() => setSceneConfigEdit(null)}
  onSaveSceneConfig={handleSaveSceneConfig}
  onResetImageSize={handleResetImageSize}

  characterSheetToken={
    characterSheetToken
      ? (tokens.find(t => t.id === characterSheetToken.id) ?? characterSheetToken)
      : null
  }
  onCloseCharacterSheet={() => { setCharacterSheetToken(null); setCharacterSheetForcedHp(null); }}
  onSyncTokenHpFromCharacter={handleSyncTokenHpFromCharacter}
  characterSheetForcedHp={characterSheetForcedHp}
 
  monsterStatBlockToken={monsterStatBlockToken}
  onCloseMonsterStatBlock={() => setMonsterStatBlockToken(null)}

  diceRollData={diceRollData}
  onCloseDiceRoll={() => setDiceRollData(null)}
  onDiceRollResult={handleRollResult}
/>
      <CombatBanner trigger={combatBannerTrigger} />

      {editingNote !== undefined && editingNote !== null && (
        <VTTNoteEditModal
          note={editingNote.note}
          initialX={editingNote.initialX}
          initialY={editingNote.initialY}
          onSave={note => {
            const existing = gmNotesRef.current.find(n => n.id === note.id);
            const updated = existing
              ? gmNotesRef.current.map(n => n.id === note.id ? note : n)
              : [...gmNotesRef.current, note];
            handleNotesChange(updated);
            setEditingNote(null);
          }}
          onDelete={id => {
            handleNotesChange(gmNotesRef.current.filter(n => n.id !== id));
            setEditingNote(null);
          }}
          onClose={() => setEditingNote(null)}
        />
      )}
          </div>
    </DiceRollContext.Provider>
  );
}