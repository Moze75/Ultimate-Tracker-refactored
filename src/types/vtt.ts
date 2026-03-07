export type VTTRole = 'gm' | 'player';

export type VTTVisionMode = 'none' | 'normal' | 'darkvision';
export type VTTLightSource = 'none' | 'torch' | 'lantern' | 'custom';

export interface VTTToken {
  id: string;
  characterId: string | null;
  ownerUserId: string;
  controlledByUserIds?: string[];
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
 imageZoom?: number;
    showLabel?: boolean;  // true = nom affiché sur le canvas (visible joueurs)
  visionMode?: VTTVisionMode;
  visionRange?: number;
  visionBrightAlpha?: number;
  visionDimAlpha?: number;
  lightSource?: VTTLightSource;
  lightRange?: number;
  lightBrightAlpha?: number;
  lightDimAlpha?: number;
}

// Inspiré de FXMaster (gambit07/fxmaster) — https://github.com/gambit07/fxmaster
export type VTTWeatherType = 'clouds' | 'crows'; 

export interface VTTWeatherEffect {
  type: VTTWeatherType;
  density: number;   // 0.1 → 3.0
  speed: number;     // 0.2 → 3.0
  alpha: number;     // 0.1 → 1.0
  scale: number;     // 0.2 → 3.0 — FXMaster p.scale (multiplicateur de taille)
}

export interface VTTRoomConfig {
  mapImageUrl: string;
  gridSize: number;
  snapToGrid: boolean;
  fogEnabled: boolean;
  fogPersistent: boolean;
  mapWidth: number;
  mapHeight: number;
  gridColor?: string;
  gridOffsetX?: number;
  gridOffsetY?: number;
  gridLineWidth?: number;
  timeOfDay?: number;
  weatherEffects?: VTTWeatherEffect[];  // effets actifs (cumulables)
}

export interface VTTFogStroke {
  x: number;
  y: number;
  r: number;
  erase: boolean;
}

export interface VTTFogState {
  revealedCells: string[];
  strokes?: VTTFogStroke[];
}

export interface VTTWall {
  id: string;
  points: { x: number; y: number }[];
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
  walls: VTTWall[];
}

export interface VTTRoom {
  id: string;
  name: string;
  gmUserId: string;
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  walls: VTTWall[];
  connectedUsers: string[];
  lastSnapshot: number;
}

export interface VTTServerState {
  room: VTTRoom;
  yourRole: VTTRole;
  yourUserId: string;
}

export interface VTTConnectedUser {
  userId: string;
  name: string;
  role: VTTRole;
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
  | { type: 'UPDATE_PROP'; propId: string; changes: Partial<VTTProp> }
  | { type: 'SWITCH_SCENE'; config: VTTRoomConfig; tokens: VTTToken[]; fogState: VTTFogState; walls: VTTWall[] }
  | { type: 'UPDATE_WALLS'; walls: VTTWall[] }
  | { type: 'UPDATE_WEATHER'; effects: VTTWeatherEffect[] };

export type VTTServerEvent =
  | { type: 'STATE_SYNC'; state: VTTServerState }
  | { type: 'TOKEN_MOVED'; tokenId: string; position: { x: number; y: number } }
  | { type: 'TOKEN_ADDED'; token: VTTToken }
  | { type: 'TOKEN_REMOVED'; tokenId: string }
  | { type: 'TOKEN_UPDATED'; tokenId: string; changes: Partial<VTTToken> }
  | { type: 'FOG_UPDATED'; fogState: VTTFogState }
  | { type: 'MAP_UPDATED'; config: Partial<VTTRoomConfig> }
  | { type: 'SCENE_SWITCHED'; config: VTTRoomConfig; tokens: VTTToken[]; fogState: VTTFogState; walls: VTTWall[] }
  | { type: 'WALLS_UPDATED'; walls: VTTWall[] }
  | { type: 'WEATHER_UPDATED'; effects: VTTWeatherEffect[] }
  | { type: 'USER_JOINED'; userId: string; name?: string }
  | { type: 'USER_LEFT'; userId: string }
  | { type: 'ERROR'; message: string };