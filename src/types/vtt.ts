export type VTTRole = 'gm' | 'player';

export type VTTVisionMode = 'none' | 'normal' | 'darkvision';
export type VTTLightSource = 'none' | 'torch' | 'lantern' | 'custom';

export interface VTTToken {
  id: string;
  characterId: string | null;
  monsterSlug?: string;
  ownerUserId: string;
  controlledByUserIds?: string[];
  // -------------------
  // Ciblage : liste des userId qui ciblent ce token
  // -------------------
  // Un joueur peut cibler n'importe quel token via clic droit.
  // Le tableau peut contenir plusieurs userId simultanément.
  // Propagé via TOKEN_UPDATED broadcast à tous les clients.
  targetedByUserIds?: string[];
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
export type VTTWeatherType = 'clouds' | 'crows' | 'embers' | 'fog' | 'rain';

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
  savedViewport?: { x: number; y: number; scale: number };  // vue enregistrée par le GM
}

// -------------------
// Stroke de brouillard de guerre
// shape = 'circle' (défaut, pinceau) ou 'rect' (outil rectangle)
// Pour 'rect' : x,y = coin haut-gauche, w,h = dimensions du rectangle, r ignoré
// -------------------
export interface VTTFogStroke {
  x: number;
  y: number;
  r: number;
  erase: boolean;
  shape?: 'circle' | 'rect';
  w?: number;
  h?: number;
}

export interface VTTFogState {
  revealedCells: string[];
  strokes?: VTTFogStroke[];

  // -------------------
  // Gestion de la mémoire explorée persistée par scène
  // -------------------
  exploredStrokes?: VTTFogStroke[];

  // -------------------
  // IDs des portes déjà vues par les joueurs (mémoire persistée)
  // -------------------
  seenDoors?: string[];
}

export interface VTTWall {
  id: string;
  points: { x: number; y: number }[];
}

export interface VTTDoor {
  id: string;
  wallId: string;
  segmentIndex: number;
  t1?: number;
  t2?: number;
  t?: number;
  width?: number;
  open: boolean;
}

export interface VTTWindow {
  id: string;
  wallId: string;
  segmentIndex: number;
  t1?: number;
  t2?: number;
  t?: number;
  width?: number;
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
  doors?: VTTDoor[];
  windows?: VTTWindow[];
  props?: VTTProp[];
}

export interface VTTRoom {
  id: string;
  name: string;
  gmUserId: string;
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  walls: VTTWall[];
  doors?: VTTDoor[];
  windows?: VTTWindow[];
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

export interface VTTPing {
  id: string;
  x: number;
  y: number;
  userId: string;
  userName: string;
  color: string;
  createdAt: number;
}

export type VTTClientEvent =
  | { type: 'MOVE_TOKEN_REQUEST'; tokenId: string; position: { x: number; y: number } }
  // -------------------
  // batch : envoi groupé de strokes (painting continu, performance)
  // -------------------
  | { type: 'REVEAL_FOG'; cells: string[]; erase?: boolean; stroke?: VTTFogStroke; batch?: VTTFogStroke[] }
  | { type: 'RESET_FOG' }
  | { type: 'ADD_TOKEN'; token: Omit<VTTToken, 'id'> }
  | { type: 'REMOVE_TOKEN'; tokenId: string }
  | { type: 'UPDATE_MAP'; config: Partial<VTTRoomConfig> }
  | { type: 'UPDATE_TOKEN'; tokenId: string; changes: Partial<VTTToken> }
  | { type: 'ADD_PROP'; prop: Omit<VTTProp, 'id'> }
  | { type: 'REMOVE_PROP'; propId: string }
  | { type: 'UPDATE_PROP'; propId: string; changes: Partial<VTTProp> }
  | { type: 'SWITCH_SCENE'; sceneId?: string; config: VTTRoomConfig; tokens: VTTToken[]; fogState: VTTFogState; walls: VTTWall[]; doors?: VTTDoor[]; windows?: VTTWindow[] }
  | { type: 'UPDATE_WALLS'; walls: VTTWall[] }
  | { type: 'UPDATE_DOORS'; doors: VTTDoor[] }
  | { type: 'UPDATE_WINDOWS'; windows: VTTWindow[] }
  | { type: 'UPDATE_WEATHER'; effects: VTTWeatherEffect[] }
| { type: 'SEND_PING'; x: number; y: number }
| { type: 'SEND_CHAT'; message: VTTChatMessage };

// -------------------
// Type VTTChatMessage — message du chat live VTT
// -------------------
// kind='text'  → message libre tapé dans le champ chat
// kind='roll'  → jet de dés auto-publié depuis DiceBox3D
// L'avatar (tokenImageUrl / tokenColor) est résolu à l'envoi
// et embarqué dans le message pour éviter une re-résolution côté client.
export type VTTChatMessage = {
  id: string;
  userId: string;
  userName: string;
  tokenLabel?: string;
  tokenImageUrl?: string | null;
  tokenColor?: string;
  role: 'gm' | 'player';
  timestamp: number;
  kind: 'text' | 'roll';
  // kind='text'
  text?: string;
  // kind='roll'
  attackName?: string;
  diceFormula?: string;
  modifier?: number;
  rolls?: number[];
  diceTotal?: number;
  total?: number;
};

export type VTTServerEvent =
  | { type: 'STATE_SYNC'; state: VTTServerState }
  | { type: 'TOKEN_MOVED'; tokenId: string; position: { x: number; y: number } }
  | { type: 'TOKEN_ADDED'; token: VTTToken }
  | { type: 'TOKEN_REMOVED'; tokenId: string }
  | { type: 'TOKEN_UPDATED'; tokenId: string; changes: Partial<VTTToken> }
  | { type: 'FOG_UPDATED'; fogState: VTTFogState }
  | { type: 'MAP_UPDATED'; config: Partial<VTTRoomConfig> }
  | { type: 'SCENE_SWITCHED'; sceneId?: string; config: VTTRoomConfig; tokens: VTTToken[]; fogState: VTTFogState; walls: VTTWall[]; doors?: VTTDoor[]; windows?: VTTWindow[] }
  | { type: 'WALLS_UPDATED'; walls: VTTWall[] }
  | { type: 'DOORS_UPDATED'; doors: VTTDoor[] }
  | { type: 'WINDOWS_UPDATED'; windows: VTTWindow[] }
  | { type: 'WEATHER_UPDATED'; effects: VTTWeatherEffect[] }
  | { type: 'PING_RECEIVED'; ping: VTTPing }
  | { type: 'USER_JOINED'; userId: string; name?: string }
  | { type: 'USER_LEFT'; userId: string }
  | { type: 'CHAT_RECEIVED'; message: VTTChatMessage }
  | { type: 'ERROR'; message: string };


// ===================================
// Chat live VTT
// ===================================
// Message unique transporté par Supabase Realtime (event vtt-chat).
// Pas de persistance DB — 100% in-memory côté client, limité à 20 messages.
// kind='text' : message libre
// kind='roll'  : jet de dés auto-publié depuis DiceBox3D
export type VTTChatMessage = {
  id: string;
  userId: string;
  userName: string;
  // -------------------
  // Résolution de l'avatar du joueur à l'envoi
  // embed dans le message pour éviter la re-résolution côté client
  // -------------------
  tokenLabel?: string;
  tokenImageUrl?: string | null;
  tokenColor?: string;
  role: 'gm' | 'player';
  timestamp: number;
  kind: 'text' | 'roll';
  // -------------------
  // Champs pour kind='text'
  // -------------------
  text?: string;
  // -------------------
  // Champs pour kind='roll'
  // -------------------
  attackName?: string;
  diceFormula?: string;
  modifier?: number;
  rolls?: number[];
  diceTotal?: number;
  total?: number;
}; 