import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { VTTClientEvent, VTTServerEvent, VTTRoomConfig, VTTToken, VTTFogState, VTTFogStroke, VTTWall, VTTConnectedUser } from '../types/vtt';

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

interface LocalState {
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  walls: VTTWall[];
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
  private localState: LocalState = { config: DEFAULT_CONFIG, tokens: [], fogState: { revealedCells: [] }, walls: [] };
  private persistDebounce: ReturnType<typeof setTimeout> | null = null;
  private suppressNotifs = false;
  private activeSceneId: string | null = null;

  private requestedRole: 'gm' | 'player' | null = null;

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
      fogState: stateJson.fogState || { revealedCells: [] },
      walls: stateJson.walls || [],
    };

    // Les murs sont stockés par scène (vtt_scenes), pas dans vtt_rooms.
    // On charge la scène active pour récupérer les murs courants.
    try {
      const { data: scenes } = await supabase
        .from('vtt_scenes')
         .select('id, walls, fog_state')
        .eq('room_id', roomId)
        .order('order_index', { ascending: true })
        .limit(1);
      if (scenes && scenes.length > 0) {
        if (scenes[0].walls) {
          this.localState.walls = scenes[0].walls;
        }
        // Priorité au fog de la scène s'il existe (plus récent que vtt_rooms)
        if (scenes[0].fog_state && typeof scenes[0].fog_state === 'object') {
          this.localState.fogState = scenes[0].fog_state;
        }
        // Mémorise le sceneId actif pour les sauvegardes fog ultérieures
        if (scenes[0].id) {
          this.activeSceneId = scenes[0].id;
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
          walls: this.localState.walls,
          connectedUsers: [userId],
          lastSnapshot: Date.now(),
        },
        yourRole: this.isGM ? 'gm' : 'player',
        yourUserId: userId,
      },
    };
    this.messageHandlers.forEach(h => h(initialEvent));

    this.channel = supabase.channel(`vtt-room-${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

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
          this.localState.fogState = serverEvent.fogState;
        } else if (serverEvent.type === 'MAP_UPDATED') {
          this.localState.config = { ...this.localState.config, ...serverEvent.config };
        } else if (serverEvent.type === 'SCENE_SWITCHED') {
          this.localState.config = serverEvent.config;
          this.localState.tokens = serverEvent.tokens;
          this.localState.fogState = serverEvent.fogState;
          this.localState.walls = serverEvent.walls;
          if (serverEvent.sceneId) {
            this.activeSceneId = serverEvent.sceneId;
          }
        } else if (serverEvent.type === 'WALLS_UPDATED') {
          this.localState.walls = serverEvent.walls;
        }
        this.messageHandlers.forEach(h => h(serverEvent));
      })
      .on('broadcast', { event: 'vtt-viewport' }, ({ payload }) => {
        const vp = payload as BroadcastViewport;
        this.broadcastViewportHandlers.forEach(h => h(vp));
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

      case 'REVEAL_FOG': {
        const stroke = (event as VTTClientEvent & { stroke?: VTTFogStroke }).stroke;
        const strokes: VTTFogStroke[] = [...(this.localState.fogState.strokes || [])];
        if (stroke) strokes.push(stroke);
        const newFog: VTTFogState = { revealedCells: this.localState.fogState.revealedCells, strokes };
        serverEvent = { type: 'FOG_UPDATED', fogState: newFog };
        this.localState.fogState = newFog;
        // Sauvegarde fog directement dans vtt_scenes via RPC (sans debounce,
        // pour éviter qu'un _persistNow ultérieur sauve un fog vide)
        this._saveFogNow(newFog);
        break;
      }

      case 'RESET_FOG': {
        const newFog: VTTFogState = { revealedCells: [], strokes: [] };
        serverEvent = { type: 'FOG_UPDATED', fogState: newFog };
        this.localState.fogState = newFog;
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
        this.localState.fogState = event.fogState;
        this.localState.walls = event.walls;
        if (event.sceneId) {
          this.activeSceneId = event.sceneId;
        }
        serverEvent = {
          type: 'SCENE_SWITCHED',
          sceneId: event.sceneId,
          config: event.config,
          tokens: event.tokens,
          fogState: event.fogState,
          walls: event.walls,
        };
        this._persistNow();
        break;

      case 'UPDATE_WALLS':
        this.localState.walls = event.walls;
        serverEvent = { type: 'WALLS_UPDATED', walls: event.walls };
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
    // Les murs sont par scène → on ne les persiste PAS dans la room globale
    // pour éviter la contamination inter-scènes
    const { walls: _walls, ...stateWithoutWalls } = this.localState;
    supabase
      .from('vtt_rooms')
      .update({ state_json: stateWithoutWalls, updated_at: new Date().toISOString() })
      .eq('id', this.roomId)
      .then(({ error }) => {
        if (error) console.error('[VTT] Persist error:', error);
      });
    // Persist fog_state dans vtt_scenes via RPC (accessible joueurs et GM)
    if (this.activeSceneId) {
      const sceneIdToSave = this.activeSceneId;
      const fogToSave = this.localState.fogState;
      console.log('[VTT] Saving fog to scene', sceneIdToSave, 'strokes:', (fogToSave as {strokes?: unknown[]}).strokes?.length ?? 0);
      supabase
        .rpc('update_scene_fog_state', {
          p_scene_id: sceneIdToSave,
          p_fog_state: fogToSave,
        })
        .then(({ error }) => {
          if (error) console.error('[VTT] Persist fog scene error:', error);
          else console.log('[VTT] Fog saved OK to scene', sceneIdToSave);
        });
    }
  }

  private _saveFogNow(fogState: VTTFogState) {
    if (!this.activeSceneId) return;
    const sceneId = this.activeSceneId;
    console.log('[VTT] _saveFogNow strokes:', (fogState.strokes || []).length);
    supabase
      .rpc('update_scene_fog_state', {
        p_scene_id: sceneId,
        p_fog_state: fogState,
      })
      .then(({ error }) => {
        if (error) console.error('[VTT] _saveFogNow error:', error);
        else console.log('[VTT] _saveFogNow OK strokes:', (fogState.strokes || []).length);
      });
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

  
  sendBroadcastViewport(viewport: BroadcastViewport) {
    if (!this.channel) return;
    this.channel.send({ type: 'broadcast', event: 'vtt-viewport', payload: viewport }).catch(console.error);
  }

  onBroadcastViewport(handler: BroadcastViewportHandler) {
    this.broadcastViewportHandlers.push(handler);
    return () => {
      this.broadcastViewportHandlers = this.broadcastViewportHandlers.filter(h => h !== handler);
    };
  }

  disconnect() {
    if (this.persistDebounce) {
      clearTimeout(this.persistDebounce);
      this._persistNow();
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
    this.localState = { config: DEFAULT_CONFIG, tokens: [], fogState: { revealedCells: [] }, walls: [] };
    this.activeSceneId = null;
  }

  isConnected() {
    return this.channel !== null;
  }
}

export const vttService = new VTTService();

export async function createVTTRoom(name: string, userId: string, _authToken: string): Promise<{ roomId: string }> {
  const roomId = generateRoomId();
  const { error } = await supabase
    .from('vtt_rooms')
    .insert({ id: roomId, name, gm_user_id: userId, state_json: {} });
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
