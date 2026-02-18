import { supabase } from '../lib/supabase';
import type { VTTClientEvent, VTTServerEvent, VTTServerState } from '../types/vtt';

type MessageHandler = (event: VTTServerEvent) => void;
type ConnectionHandler = (connected: boolean) => void;

const VTT_SERVER_URL = import.meta.env.VITE_VTT_SERVER_URL || 'http://localhost:3002';

function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

class VTTService {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private userId: string | null = null;
  private token: string | null = null;
  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 16000;
  private shouldReconnect = false;

  connect(roomId: string, userId: string, authToken: string) {
    this.roomId = roomId;
    this.userId = userId;
    this.token = authToken;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect() {
    if (this.ws) {
      this.ws.close();
    }

    const url = `${VTT_SERVER_URL.replace(/^http/, 'ws')}/vtt?roomId=${this.roomId}&userId=${this.userId}&token=${this.token}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectDelay = 1000;
        this.connectionHandlers.forEach(h => h(true));
      };

      this.ws.onmessage = (event) => {
        try {
          const data: VTTServerEvent = JSON.parse(event.data);
          this.messageHandlers.forEach(h => h(data));
        } catch (e) {
          console.error('[VTT] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.connectionHandlers.forEach(h => h(false));
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
            this._connect();
          }, this.reconnectDelay);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[VTT] WebSocket error:', err);
      };
    } catch (e) {
      console.error('[VTT] Connection failed:', e);
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => {
          this._connect();
        }, this.reconnectDelay);
      }
    }
  }

  send(event: VTTClientEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
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
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.roomId = null;
    this.userId = null;
    this.token = null;
    this.messageHandlers = [];
    this.connectionHandlers = [];
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
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
