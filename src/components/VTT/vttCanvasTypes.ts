import type { VTTToken, VTTRoomConfig, VTTFogState, VTTFogStroke, VTTRole, VTTWall } from '../../types/vtt';
import type { VTTActiveTool } from './VTTLeftToolbar';

export interface VTTCanvasHandle {
  getViewportCenter: () => { x: number; y: number };
}

export interface VTTCanvasProps {
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  role: VTTRole;
  userId: string;
  activeTool: VTTActiveTool;
  fogBrushSize: number;
  onMoveToken: (tokenId: string, position: { x: number; y: number }) => void;
  onRevealFog: (stroke: VTTFogStroke) => void;
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
  forceViewport?: { x: number; y: number; width: number; height: number } | null;
  initialViewport?: { x: number; y: number; scale: number } | null;
  onViewportChange?: (vp: { x: number; y: number; scale: number }) => void;
}