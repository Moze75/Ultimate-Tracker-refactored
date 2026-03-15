import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { VTTClientEvent, VTTServerEvent, VTTRoomConfig, VTTToken, VTTFogState, VTTFogStroke, VTTWall, VTTDoor, VTTWindow, VTTConnectedUser, VTTPing } from '../types/vtt';

type MessageHandler = (event: VTTServerEvent) => void;
type ConnectionHandler = (connected: boolean) => void;
type PresenceHandler = (users: VTTConnectedUser[]) => void;

export interface BroadcastViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

type BroadcastViewportHandler = (viewport: BroadcastViewport) => void;
type PlayerViewportHandler = (viewport: BroadcastViewport | null) => void;

const DEFAULT_CONFIG: VTTRoomConfig = {
  mapImageUrl: '',
  gridSize: 60,
  snapToGrid: true,
  fogEnabled: true,
  fogPersistent: false,
  mapWidth: 3000,
  mapHeight: 2000,
};

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateTokenId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// -------------------
// Normalisation du brouillard de guerre persisté
// -------------------
function normalizeFogState(fog?: VTTFogState | null): VTTFogState {
  return {
    revealedCells: [...(fog?.revealedCells || [])],
    strokes: [...(fog?.strokes || [])],
    exploredStrokes: [...(fog?.exploredStrokes || [])],
    seenDoors: fog?.seenDoors != null ? [...fog.seenDoors] : undefined,
  };
}

interface LocalState {
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  walls: VTTWall[];
  doors: VTTDoor[];
  windows: VTTWindow[];
}

class VTTService {
  private channel: RealtimeChannel | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private userName: string | null = null;
  private isGM = false;
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private presenceHandlers: PresenceHandler[] = [];
private broadcastViewportHandlers: BroadcastViewportHandler[] = [];
private playerViewportHandlers: PlayerViewportHandler[] = [];
private pingHandlers: ((ping: VTTPing) => void)[] = [];
private localState: LocalState = {
  config: DEFAULT_CONFIG,
  tokens: [],
  fogState: { revealedCells: [], strokes: [], exploredStrokes: [] },
  walls: [],
  doors: [],
  windows: [],
};
  private persistDebounce: ReturnType<typeof setTimeout> | null = null;
  private suppressNotifs = false;
  private activeSceneId: string | null = null;

  private requestedRole: 'gm' | 'player' | null = null;

  // -------------------
  // -------------------
  // Callback déclenché quand un joueur distant envoie vtt-broadcast-request
  // Permet à VTTPage d'envoyer le masque exploré au nouveau connecté
  // -------------------
  private onBroadcastRequestCallback: (() => void) | null = null;

  connect(roomId: string, userId: string, _authToken: string, userName?: string, requestedRole?: 'gm' | 'player') {
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName || null;
    this.requestedRole = requestedRole || null;
    this.activeSceneId = null;
    this._connectAsync().catch(e => console.error('[VTT] connect error:', e));
  }

  private async _connectAsync() {
    const roomId = this.roomId!;
    const userId = this.userId!;

    const { data, error } = await supabase
      .from('vtt_rooms')
      .select('gm_user_id, state_json, name')
      .eq('id', roomId)
      .maybeSingle();

    if (error || !data) {
      console.error('[VTT] Room not found:', error);
      this.messageHandlers.forEach(h => h({ type: 'ERROR', message: 'Room introuvable.' }));
      return;
    }

    if (this.requestedRole) {
      this.isGM = this.requestedRole === 'gm' && data.gm_user_id === userId;
    } else {
      this.isGM = data.gm_user_id === userId;
    }
    const stateJson = data.state_json as Partial<LocalState> || {};
    this.localState = {
      config: { ...DEFAULT_CONFIG, ...(stateJson.config || {}) },
      tokens: stateJson.tokens || [],
      fogState: normalizeFogState(stateJson.fogState || { revealedCells: [] }),
      windows: stateJson.windows || [],
      walls: stateJson.walls || [],
      doors: stateJson.doors || [],
    };

    // Les murs sont stockés par scène (vtt_scenes), pas dans vtt_rooms.
    // On charge la scène active pour récupérer les murs courants.
    // Utilise select('*') pour ne pas échouer si une colonne optionnelle (ex: doors) n'existe pas encore.
    try {
const { data: scenes, error: scenesError } = await supabase
  .from('vtt_scenes')
  .select('id, walls, doors, windows, fog_state')
  .eq('room_id', roomId)
  .order('order_index', { ascending: true });

let resolvedScenes = scenes;

if (scenesError) {
  // Colonne optionnelle absente (ex: migration doors non appliquée) → fallback sans doors
  const { data: fallback } = await supabase
    .from('vtt_scenes')
    .select('id, walls, fog_state')
    .eq('room_id', roomId)
    .order('order_index', { ascending: true });
  resolvedScenes = fallback;
}

if (resolvedScenes && resolvedScenes.length > 0) {
  const activeScene = this.activeSceneId
    ? resolvedScenes.find((scene: Record<string, unknown>) => scene.id === this.activeSceneId) ?? resolvedScenes[0]
    : resolvedScenes[0];

  if (activeScene?.walls) {
    this.localState.walls = activeScene.walls;
  }

  if (activeScene?.doors) {
    this.localState.doors = activeScene.doors;
  }

  if (activeScene?.windows) {
    this.localState.windows = activeScene.windows;
  }

  // -------------------
  // Chargement du brouillard de guerre de la scène active
  // -------------------
  if (activeScene?.fog_state && typeof activeScene.fog_state === 'object') {
    this.localState.fogState = normalizeFogState(activeScene.fog_state as VTTFogState);
  }

  // Mémorise le sceneId actif pour les sauvegardes fog ultérieures
  if (activeScene?.id) {
    this.activeSceneId = activeScene.id;
  }
}
    } catch {
      // Silencieux : on garde les valeurs déjà chargées
    }

    const initialEvent: VTTServerEvent = {
      type: 'STATE_SYNC',
      state: {
        room: {
          id: roomId,
          name: data.name,
          gmUserId: data.gm_user_id,
          config: this.localState.config,
          tokens: this.localState.tokens,
          fogState: this.localState.fogState,
          windows: this.localState.windows,
          walls: this.localState.walls,
          doors: this.localState.doors,
          connectedUsers: [userId],
          lastSnapshot: Date.now(),
        },
        yourRole: this.isGM ? 'gm' : 'player',
        yourUserId: userId,
        // -------------------
        // SceneId actif : permet au joueur de connaître la scène dès la connexion
        // Sans cela, activeSceneId reste null et le masque exploré n'est jamais restauré
        // -------------------
        activeSceneId: this.activeSceneId,
      },
    };
    this.messageHandlers.forEach(h => h(initialEvent));

    this.channel = supabase.channel(`vtt-room-${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    // ===================================
    // Réponse aux demandes d'état initial (broadcast-request)
    // ===================================
    // Le MJ renvoie config/tokens/fog/walls/sceneId au joueur qui se connecte,
    // puis déclenche le callback pour que VTTPage envoie aussi le masque exploré
    if (this.isGM) {
      this.channel.on('broadcast', { event: 'vtt-broadcast-request' }, () => {
        console.log('[VTT] Broadcast requested state → sending vtt-broadcast-init');
        this.channel?.send({
          type: 'broadcast',
          event: 'vtt-broadcast-init',
          payload: {
            config: this.localState.config,
            tokens: this.localState.tokens,
            fogState: this.localState.fogState,
            windows: this.localState.windows,
            walls: this.localState.walls,
            doors: this.localState.doors,
            sceneId: this.activeSceneId,
          },
        }).catch(console.error);

        // -------------------
        // Envoi du masque exploré au joueur qui vient de se connecter
        // Le callback est enregistré par VTTPage via onBroadcastRequest()
        // -------------------
        if (this.onBroadcastRequestCallback) {
          this.onBroadcastRequestCallback();
        }
      });
    }

    this.channel
      .on('broadcast', { event: 'vtt' }, ({ payload }) => {
        const serverEvent = payload as VTTServerEvent;
        if (serverEvent.type === 'TOKEN_ADDED') {
          const exists = this.localState.tokens.some(t => t.id === serverEvent.token.id);
          if (!exists) {
            this.localState.tokens = [...this.localState.tokens, serverEvent.token];
          }
        } else if (serverEvent.type === 'TOKEN_MOVED') {
          this.localState.tokens = this.localState.tokens.map(t =>
            t.id === serverEvent.tokenId ? { ...t, position: serverEvent.position } : t
          );
        } else if (serverEvent.type === 'TOKEN_REMOVED') {
          this.localState.tokens = this.localState.tokens.filter(t => t.id !== serverEvent.tokenId);
        } else if (serverEvent.type === 'TOKEN_UPDATED') {
          this.localState.tokens = this.localState.tokens.map(t =>
            t.id === serverEvent.tokenId ? { ...t, ...serverEvent.changes } : t
          );
        } else if (serverEvent.type === 'FOG_UPDATED') {
          this.localState.fogState = normalizeFogState(serverEvent.fogState);
        } else if (serverEvent.type === 'MAP_UPDATED') {
          this.localState.config = { ...this.localState.config, ...serverEvent.config };
        } else if (serverEvent.type === 'SCENE_SWITCHED') {
          this.localState.config = serverEvent.config;
          this.localState.tokens = serverEvent.tokens;
          this.localState.fogState = normalizeFogState(serverEvent.fogState);
          this.localState.windows = serverEvent.windows || [];
          this.localState.walls = serverEvent.walls;
          this.localState.doors = serverEvent.doors || [];
          if (serverEvent.sceneId) {
            this.activeSceneId = serverEvent.sceneId;
          }
        } else if (serverEvent.type === 'WALLS_UPDATED') {
          this.localState.walls = serverEvent.walls;
        } else if (serverEvent.type === 'WINDOWS_UPDATED') {
          this.localState.windows = serverEvent.windows;
        } else if (serverEvent.type === 'DOORS_UPDATED') {
          this.localState.doors = serverEvent.doors;
        } else if (serverEvent.type === 'WEATHER_UPDATED') {
          this.localState.config = { ...this.localState.config, weatherEffects: serverEvent.effects };
        }
        this.messageHandlers.forEach(h => h(serverEvent));
      })
.on('broadcast', { event: 'vtt-viewport' }, ({ payload }) => {
  const vp = payload as BroadcastViewport;
  this.broadcastViewportHandlers.forEach(h => h(vp));
})
.on('broadcast', { event: 'vtt-player-viewport' }, ({ payload }) => {
  const vp = (payload ?? null) as BroadcastViewport | null;
  this.playerViewportHandlers.forEach(h => h(vp));
})
.on('broadcast', { event: 'vtt-ping' }, ({ payload }) => {
  const ping = payload as VTTPing;
  this.pingHandlers.forEach(h => h(ping));
  this.messageHandlers.forEach(handler => handler({ type: 'PING_RECEIVED', ping }));
})
      .on('presence', { event: 'sync' }, () => {
        this._emitPresence();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: Record<string, unknown>) => {
          if (p.user_id && p.user_id !== userId) {
            this.messageHandlers.forEach(h => h({
              type: 'USER_JOINED',
              userId: p.user_id as string,
              name: (p.name as string) || undefined,
            }));
          }
        });
        this._emitPresence();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: Record<string, unknown>) => {
          if (p.user_id) {
            this.messageHandlers.forEach(h => h({ type: 'USER_LEFT', userId: p.user_id as string }));
          }
        });
        this._emitPresence();
      })
      .subscribe(async (status) => {
        const ok = status === 'SUBSCRIBED';
        this.connectionHandlers.forEach(h => h(ok));
        if (ok) {
          await this.channel?.track({
            user_id: userId,
            name: this.userName || 'Inconnu',
            role: this.isGM ? 'gm' : 'player',
            online_at: new Date().toISOString(),
          });
        }
      });
  }

  // -------------------
   // ===================================
  // Broadcast du masque exploré (fog)
  // ===================================
  // Encode et envoie le canvas exploré aux clients distants
  // via Supabase Realtime. Contourne le localStorage (local uniquement).
  broadcastExploredMask(sceneId: string, maskData: { dataUrl: string; width: number; height: number }): void {
    if (!this.channel) {
      console.warn('[VTT] broadcastExploredMask: pas de channel actif');
      return;
    }

    this.channel.send({
      type: 'broadcast',
      event: 'vtt-fog-explored',
      payload: { sceneId, ...maskData },
    }).catch((e: unknown) => console.warn('[VTT] broadcastExploredMask error', e));
  }

  private _emitPresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState();
    const users: VTTConnectedUser[] = [];
    for (const key of Object.keys(state)) {
      const presences = state[key] as Array<Record<string, unknown>>;
      if (presences.length > 0) {
        const p = presences[0];
        users.push({
          userId: (p.user_id as string) || key,
          name: (p.name as string) || 'Inconnu',
          role: (p.role as 'gm' | 'player') || 'player',
        });
      }
    }
    this.presenceHandlers.forEach(h => h(users));
  }

  send(event: VTTClientEvent) {
    if (!this.channel || !this.roomId) return;

    let serverEvent: VTTServerEvent | null = null;

    switch (event.type) {
      case 'MOVE_TOKEN_REQUEST':
        serverEvent = { type: 'TOKEN_MOVED', tokenId: event.tokenId, position: event.position };
        this.localState.tokens = this.localState.tokens.map(t =>
          t.id === event.tokenId ? { ...t, position: event.position } : t
        );
        this._schedulePersist();
        break;

      case 'ADD_TOKEN': {
        const token: VTTToken = { ...event.token, id: generateTokenId() };
        serverEvent = { type: 'TOKEN_ADDED', token };
        this.localState.tokens = [...this.localState.tokens, token];
        this._persistNow();
        break;
      }

      case 'REMOVE_TOKEN':
        serverEvent = { type: 'TOKEN_REMOVED', tokenId: event.tokenId };
        this.localState.tokens = this.localState.tokens.filter(t => t.id !== event.tokenId);
        this._persistNow();
        break;

      case 'UPDATE_TOKEN':
        serverEvent = { type: 'TOKEN_UPDATED', tokenId: event.tokenId, changes: event.changes };
        this.localState.tokens = this.localState.tokens.map(t =>
          t.id === event.tokenId ? { ...t, ...event.changes } : t
        );
        this._persistNow();
        break;

             // -------------------
      // Gestion de la levée du brouillard de guerre persistée
      // Supporte un batch de strokes pour le painting continu.
      // Un seul broadcast + une seule RPC Supabase pour tout le batch.
      // -------------------
      case 'REVEAL_FOG': {
        const batch: VTTFogStroke[] = event.batch || (event.stroke ? [event.stroke] : []);

        const strokes: VTTFogStroke[] = [...(this.localState.fogState.strokes || []), ...batch];
        const exploredStrokes: VTTFogStroke[] = [
          ...(this.localState.fogState.exploredStrokes || []),
          ...batch.filter(s => !s.erase),
        ];

        const newFog: VTTFogState = {
          revealedCells: [...(this.localState.fogState.revealedCells || [])],
          strokes,
          exploredStrokes,
          seenDoors: this.localState.fogState.seenDoors,
        };

        serverEvent = { type: 'FOG_UPDATED', fogState: newFog };
        this.localState.fogState = newFog;

        // -------------------
        // UNE SEULE sauvegarde RPC pour tout le batch
        // -------------------
        this._saveFogToScene(newFog);
        break;
      }

      case 'RESET_FOG': {
        const newFog: VTTFogState = { revealedCells: [], strokes: [], exploredStrokes: [], seenDoors: [] };
        serverEvent = { type: 'FOG_UPDATED', fogState: newFog };
        this.localState.fogState = newFog;
        this._saveFogToScene(newFog);
        this._persistNow();
        break;
      }

      case 'UPDATE_MAP':
        this.localState.config = { ...this.localState.config, ...event.config };
        serverEvent = { type: 'MAP_UPDATED', config: event.config };
        this._persistNow();
        break;

      case 'SWITCH_SCENE':
        this.localState.config = event.config;
        this.localState.tokens = event.tokens;
        this.localState.fogState = normalizeFogState(event.fogState);
        this.localState.windows = event.windows || [];
        this.localState.walls = event.walls;
        this.localState.doors = event.doors || [];
        if (event.sceneId) {
          this.activeSceneId = event.sceneId;
        }
        serverEvent = {
          type: 'SCENE_SWITCHED',
          sceneId: event.sceneId,
          config: event.config,
          tokens: event.tokens,
          fogState: event.fogState,
          windows: event.windows || [],
          walls: event.walls,
          doors: event.doors || [],
        };
        this._persistNow();
        break;

      case 'UPDATE_WEATHER':
        serverEvent = { type: 'WEATHER_UPDATED', effects: event.effects };
        this.localState.config = { ...this.localState.config, weatherEffects: event.effects };
        this._persistNow();
        break;

        
      case 'UPDATE_WALLS':
        this.localState.walls = event.walls;
        serverEvent = { type: 'WALLS_UPDATED', walls: event.walls };
        this._persistNow();
        break;

      case 'UPDATE_DOORS':
        this.localState.doors = event.doors;
        serverEvent = { type: 'DOORS_UPDATED', doors: event.doors };
        this._persistNow();
        break;

      case 'UPDATE_WINDOWS':
        this.localState.windows = event.windows;
        serverEvent = { type: 'WINDOWS_UPDATED', windows: event.windows };
        this._persistNow();
        break;
    }

    if (serverEvent) {
      this.channel.send({ type: 'broadcast', event: 'vtt', payload: serverEvent }).catch(console.error);
      this._notifyLocal(serverEvent);
    }
  }

  suppressLocalNotifications(suppress: boolean) {
    this.suppressNotifs = suppress;
  }

  private _notifyLocal(event: VTTServerEvent) {
    if (this.suppressNotifs) return;
    if (event.type === 'FOG_UPDATED') return;
    this.messageHandlers.forEach(h => h(event));
  }

  private _schedulePersist() {
    if (this.persistDebounce) clearTimeout(this.persistDebounce);
    this.persistDebounce = setTimeout(() => this._persistNow(), 500);
  }

  private _persistNow() {
    if (!this.roomId) return;
    // Les murs, portes et fenêtres sont par scène → on ne les persiste PAS dans la room globale
    const { walls: _walls, doors: _doors, windows: _windows, ...stateWithoutWalls } = this.localState;
    supabase
      .from('vtt_rooms')
      .update({ state_json: stateWithoutWalls, updated_at: new Date().toISOString() })
      .eq('id', this.roomId)
      .then(({ error }) => {
        if (error) console.error('[VTT] Persist error:', error);
      });
    // Le fog est sauvegardé exclusivement via _saveFogToScene() dans le case REVEAL_FOG
  }

  // -------------------
  // Persistance du brouillard de guerre par scène
  // Debouncé à 500ms pour éviter de spammer Supabase pendant le painting.
  // Le dernier state (le plus complet) est toujours celui qui est sauvegardé.
  // -------------------
  private _fogSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingFogState: VTTFogState | null = null;

  private _saveFogToScene(fogState: VTTFogState) {
    if (!this.activeSceneId) return;

    // Mémorise le dernier state à sauvegarder
    this._pendingFogState = fogState;

    // Si un timer est déjà en cours, on laisse le debounce faire son travail
    if (this._fogSaveTimer) return;

    this._fogSaveTimer = setTimeout(() => {
      this._fogSaveTimer = null;
      const stateToSave = this._pendingFogState;
      this._pendingFogState = null;
      if (!stateToSave || !this.activeSceneId) return;

      const sceneId = this.activeSceneId;
      supabase
        .rpc('update_scene_fog_state', {
          p_scene_id: sceneId,
          p_fog_state: stateToSave,
        })
        .then(({ error }) => {
          if (error) console.error('[VTT] _saveFogToScene error:', error);
        });
    }, 500);
  }
  
  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    };
  }

  onConnectionChange(handler: ConnectionHandler) {
    this.connectionHandlers.push(handler);
    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(h => h !== handler);
    };
  }

  onPresenceChange(handler: PresenceHandler) {
    this.presenceHandlers.push(handler);
    return () => {
      this.presenceHandlers = this.presenceHandlers.filter(h => h !== handler);
    };
  }

  setActiveSceneId(sceneId: string | null) {
    this.activeSceneId = sceneId;
  }

  // -------------------
  // Enregistrement du callback de réponse au broadcast-request
  // Appelé par VTTPage pour fournir le masque exploré aux nouveaux connectés
  // -------------------
  onBroadcastRequest(callback: (() => void) | null) {
    this.onBroadcastRequestCallback = callback;
    return () => {
      if (this.onBroadcastRequestCallback === callback) {
        this.onBroadcastRequestCallback = null;
      }
    };
  }

    updateLocalState(config: VTTRoomConfig, tokens: VTTToken[], fogState: VTTFogState, walls: VTTWall[], doors: VTTDoor[] = [], windows: VTTWindow[] = []) {
    this.localState = { config, tokens, fogState, walls, doors, windows };
  }
  
sendBroadcastViewport(viewport: BroadcastViewport) {
  if (!this.channel) return;
  this.channel.send({ type: 'broadcast', event: 'vtt-viewport', payload: viewport }).catch(console.error);
}

sendPlayerViewport(viewport: BroadcastViewport | null) {
  if (!this.channel) return;
  this.channel.send({ type: 'broadcast', event: 'vtt-player-viewport', payload: viewport }).catch(console.error);
}

sendPing(x: number, y: number, userName: string, color: string) {
  if (!this.channel) return;
  const ping: VTTPing = {
    id: Math.random().toString(36).slice(2, 10),
    x,
    y,
    userId: this.userId || '',
    userName,
    color,
    createdAt: Date.now(),
  };
  this.channel.send({ type: 'broadcast', event: 'vtt-ping', payload: ping }).catch(console.error);
  this.pingHandlers.forEach(h => h(ping));
  this.messageHandlers.forEach(handler => handler({ type: 'PING_RECEIVED', ping }));
}

onPing(handler: (ping: VTTPing) => void) {
  this.pingHandlers.push(handler);
  return () => {
    this.pingHandlers = this.pingHandlers.filter(h => h !== handler);
  };
}

onBroadcastViewport(handler: BroadcastViewportHandler) {
  this.broadcastViewportHandlers.push(handler);
  return () => {
    this.broadcastViewportHandlers = this.broadcastViewportHandlers.filter(h => h !== handler);
  };
}

onPlayerViewport(handler: PlayerViewportHandler) {
  this.playerViewportHandlers.push(handler);
  return () => {
    this.playerViewportHandlers = this.playerViewportHandlers.filter(h => h !== handler);
  };
}

  disconnect() {
    if (this.persistDebounce) {
      clearTimeout(this.persistDebounce);
      this._persistNow();
    }
    // -------------------
    // Flush la sauvegarde fog en cours avant déconnexion
    // -------------------
    if (this._fogSaveTimer) {
      clearTimeout(this._fogSaveTimer);
      this._fogSaveTimer = null;
      if (this._pendingFogState && this.activeSceneId) {
        supabase
          .rpc('update_scene_fog_state', {
            p_scene_id: this.activeSceneId,
            p_fog_state: this._pendingFogState,
          })
          .catch(console.error);
        this._pendingFogState = null;
      }
    }
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.roomId = null;
    this.userId = null;
    this.userName = null;
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.presenceHandlers = [];
this.broadcastViewportHandlers = [];
this.playerViewportHandlers = [];
// -------------------
// Nettoyage du callback broadcast-request
// -------------------
this.onBroadcastRequestCallback = null;
this.localState = {
  config: DEFAULT_CONFIG,
  tokens: [],
  fogState: { revealedCells: [], strokes: [], exploredStrokes: [] },
  walls: [],
};
    this.activeSceneId = null;
  }

  isConnected() {
    return this.channel !== null;
  }
}

export const vttService = new VTTService();

export async function createVTTRoom(name: string, userId: string, _authToken: string, campaignId?: string): Promise<{ roomId: string }> {
  const roomId = generateRoomId();
  const payload: Record<string, unknown> = { id: roomId, name, gm_user_id: userId, state_json: {} };
  if (campaignId) payload.campaign_id = campaignId;
  const { error } = await supabase
    .from('vtt_rooms')
    .insert(payload);
  if (error) throw new Error('Erreur creation room VTT: ' + error.message);
  return { roomId };
}

export async function listVTTRooms(userId: string, _authToken: string): Promise<Array<{ id: string; name: string; gmUserId: string; createdAt: string }>> {
  const { data, error } = await supabase
    .from('vtt_rooms')
    .select('id, name, gm_user_id, created_at')
    .eq('gm_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    gmUserId: r.gm_user_id,
    createdAt: r.created_at,
  }));
}

export async function deleteVTTRoom(roomId: string, _authToken: string): Promise<void> {
  await supabase.from('vtt_rooms').delete().eq('id', roomId);
}
