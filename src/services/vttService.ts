import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { VTTClientEvent, VTTServerEvent, VTTRoomConfig, VTTToken, VTTFogState, VTTFogStroke } from '../types/vtt';

type MessageHandler = (event: VTTServerEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

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
}

class VTTService {
  private channel: RealtimeChannel | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private isGM = false;
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private localState: LocalState = { config: DEFAULT_CONFIG, tokens: [], fogState: { revealedCells: [] } };
  private persistDebounce: ReturnType<typeof setTimeout> | null = null;

  connect(roomId: string, userId: string, _authToken: string) {
    this.roomId = roomId;
    this.userId = userId;
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

    this.isGM = data.gm_user_id === userId;
    const stateJson = data.state_json as Partial<LocalState> || {};
    this.localState = {
      config: { ...DEFAULT_CONFIG, ...(stateJson.config || {}) },
      tokens: stateJson.tokens || [],
      fogState: stateJson.fogState || { revealedCells: [] },
    };

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
          this.localState.tokens = [...this.localState.tokens, serverEvent.token];
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
        }
        this.messageHandlers.forEach(h => h(serverEvent));
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: { user_id?: string }) => {
          if (p.user_id && p.user_id !== userId) {
            this.messageHandlers.forEach(h => h({ type: 'USER_JOINED', userId: p.user_id! }));
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: { user_id?: string }) => {
          if (p.user_id) {
            this.messageHandlers.forEach(h => h({ type: 'USER_LEFT', userId: p.user_id! }));
          }
        });
      })
      .subscribe(async (status) => {
        const ok = status === 'SUBSCRIBED';
        this.connectionHandlers.forEach(h => h(ok));
        if (ok) {
          await this.channel?.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });
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
        this._schedulePersist();
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
    }

    if (serverEvent) {
      this.channel.send({ type: 'broadcast', event: 'vtt', payload: serverEvent }).catch(console.error);
      this._notifyLocal(serverEvent);
    }
  }

  private _notifyLocal(event: VTTServerEvent) {
    if (event.type === 'FOG_UPDATED') return;
    this.messageHandlers.forEach(h => h(event));
  }

  private _schedulePersist() {
    if (this.persistDebounce) clearTimeout(this.persistDebounce);
    this.persistDebounce = setTimeout(() => this._persistNow(), 500);
  }

  private _persistNow() {
    if (!this.roomId) return;
    const state = { ...this.localState };
    supabase
      .from('vtt_rooms')
      .update({ state_json: state, updated_at: new Date().toISOString() })
      .eq('id', this.roomId)
      .then(({ error }) => {
        if (error) console.error('[VTT] Persist error:', error);
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
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.localState = { config: DEFAULT_CONFIG, tokens: [], fogState: { revealedCells: [] } };
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
  if (error) throw new Error('Erreur création room VTT: ' + error.message);
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
