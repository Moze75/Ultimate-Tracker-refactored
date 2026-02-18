export type VTTRole = 'gm' | 'player';

export interface VTTToken {
  id: string;
  characterId: string | null;
  ownerUserId: string;
  label: string;
  imageUrl: string | null;
  position: { x: number; y: number };
  size: number;
  rotation: number;
  visible: boolean;
  color: string;
  hp?: number;
  maxHp?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
}

export interface VTTRoomConfig {
  mapImageUrl: string;
  gridSize: number;
  snapToGrid: boolean;
  fogEnabled: boolean;
  fogPersistent: boolean;
  mapWidth: number;
  mapHeight: number;
}

export interface VTTFogStroke {
  gridLineWidth?: number;
  x: number;
  y: number;
  r: number;
  erase: boolean;
}

export interface VTTFogState {
  revealedCells: string[];
  strokes?: VTTFogStroke[];
}

export interface VTTProp {
  id: string;
  label: string;
  imageUrl: string | null;
  position: { x: number; y: number };
  width: number;
  height: number;
  opacity: number;
  locked: boolean;
}

export interface VTTScene {
  id: string;
  roomId: string;
  name: string;
  orderIndex: number;
  config: VTTRoomConfig;
  fogState: VTTFogState;
  tokens: VTTToken[];
}

export interface VTTRoom {
  id: string;
  name: string;
  gmUserId: string;
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  connectedUsers: string[];
  lastSnapshot: number;
}

export interface VTTServerState {
  room: VTTRoom;
  yourRole: VTTRole;
  yourUserId: string;
}

export type VTTClientEvent =
  | { type: 'MOVE_TOKEN_REQUEST'; tokenId: string; position: { x: number; y: number } }
  | { type: 'REVEAL_FOG'; cells: string[]; erase?: boolean; stroke?: VTTFogStroke }
  | { type: 'RESET_FOG' }
  | { type: 'ADD_TOKEN'; token: Omit<VTTToken, 'id'> }
  | { type: 'REMOVE_TOKEN'; tokenId: string }
  | { type: 'UPDATE_MAP'; config: Partial<VTTRoomConfig> }
  | { type: 'UPDATE_TOKEN'; tokenId: string; changes: Partial<VTTToken> }
  | { type: 'ADD_PROP'; prop: Omit<VTTProp, 'id'> }
  | { type: 'REMOVE_PROP'; propId: string }
  | { type: 'UPDATE_PROP'; propId: string; changes: Partial<VTTProp> };

export type VTTServerEvent =
  | { type: 'STATE_SYNC'; state: VTTServerState }
  | { type: 'TOKEN_MOVED'; tokenId: string; position: { x: number; y: number } }
  | { type: 'TOKEN_ADDED'; token: VTTToken }
  | { type: 'TOKEN_REMOVED'; tokenId: string }
  | { type: 'TOKEN_UPDATED'; tokenId: string; changes: Partial<VTTToken> }
  | { type: 'FOG_UPDATED'; fogState: VTTFogState }
  | { type: 'MAP_UPDATED'; config: Partial<VTTRoomConfig> }
  | { type: 'USER_JOINED'; userId: string }
  | { type: 'USER_LEFT'; userId: string }
  | { type: 'ERROR'; message: string };
