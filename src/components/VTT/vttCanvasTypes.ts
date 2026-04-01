import type { VTTToken, VTTRoomConfig, VTTFogState, VTTFogStroke, VTTRole, VTTWall, VTTDoor, VTTWindow } from '../../types/vtt';
import type { VTTActiveTool } from './VTTLeftToolbar';

export interface VTTCanvasHandle {
  getViewportCenter: () => { x: number; y: number };
  centerOnWorldPosition: (x: number, y: number) => void;
  // -------------------
  // Permet à VTTPage de déclencher la sauvegarde du snapshot
  // avant de quitter vers le lobby
  // -------------------
  saveExploredMaskSnapshot: () => void;
  // -------------------
  // Encode le canvas exploré en WebP compressé pour broadcast Realtime
  // Utilisé par VTTPage au changement de scène pour transmettre
  // la mémoire du fog aux clients distants sans passer par Supabase Storage
  // Retourne null si le canvas est absent ou vide
  // -------------------
  getExploredMaskDataUrl: () => { dataUrl: string; width: number; height: number } | null;
}

export interface VTTCanvasProps {
  // -------------------
  // Identifiant de la scène active — nécessaire pour save/restore du masque exploré
  // Doit être fourni par VTTBroadcastPage aussi, pas seulement VTTPage
  // -------------------
  sceneId?: string;
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  role: VTTRole;
  userId: string;
  activeTool: VTTActiveTool;
  fogBrushSize: number;
  onMoveToken: (tokenId: string, position: { x: number; y: number }) => void;
  // -------------------
  // Accepte un stroke unique OU un batch de strokes pour le painting continu
  // -------------------
  onRevealFog: (strokeOrBatch: VTTFogStroke | VTTFogStroke[]) => void;
  selectedTokenId: string | null;
  onSelectToken: (id: string | null) => void;
  selectedTokenIds?: string[];
  onSelectTokens?: (ids: string[]) => void;
  onRightClickToken?: (token: VTTToken, screenX: number, screenY: number) => void;
  onMapDimensions?: (w: number, h: number) => void;
  onDropToken?: (tokenId: string, worldPos: { x: number; y: number }) => void;
    onDropProp?: (propData: { url: string; name: string; isVideo: boolean }, worldPos: { x: number; y: number }) => void;
  onAddTokenAtPos?: (token: Omit<VTTToken, 'id'>, worldPos: { x: number; y: number }) => void;
  onResizeToken?: (tokenId: string, size: number) => void;
  calibrationPoints?: { x: number; y: number }[];
  onCalibrationPoint?: (worldPos: { x: number; y: number }) => void;
  walls?: VTTWall[];
  onWallAdded?: (wall: VTTWall) => void;
  onWallUpdated?: (wall: VTTWall) => void;
  onWallRemoved?: (wallId: string) => void;
  showWalls?: boolean;
  doors?: VTTDoor[];
  onDoorAdded?: (door: VTTDoor) => void;
  onDoorToggled?: (doorId: string, open: boolean) => void;
  onDoorRemoved?: (doorId: string) => void;
  windows?: VTTWindow[];
  onWindowAdded?: (win: VTTWindow) => void;
  onWindowRemoved?: (windowId: string) => void;
  forceViewport?: { x: number; y: number; width: number; height: number } | null;
  initialViewport?: { x: number; y: number; scale: number } | null;
  onViewportChange?: (vp: { x: number; y: number; scale: number }) => void;
  spectatorMode?: 'none' | 'player-vision';
  onSeenDoorsUpdate?: (seenIds: string[]) => void;
  fogResetSignal?: number;
  onTokenDoubleClick?: (token: VTTToken) => void;
}