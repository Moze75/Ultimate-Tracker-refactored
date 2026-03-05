import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { VTTToken, VTTRoomConfig, VTTFogState, VTTFogStroke, VTTRole, VTTWall } from '../../types/vtt';
import type { VTTActiveTool } from './VTTLeftToolbar';
import { getTimeOfDayOverlay } from './VTTLeftToolbar';
import { drawDayVisionOverlay, drawNightVisionOverlay } from './vttVisionEngine';
import { getVisionRadii, metersToPixels, buildVisibilityPolygon } from './vttVisionEngine';

export interface VTTCanvasHandle {
  getViewportCenter: () => { x: number; y: number };
}

interface VTTCanvasProps {
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
  onAddTokenAtPos?: (token: Omit<VTTToken, 'id'>, worldPos: { x: number; y: number }) => void;
  onResizeToken?: (tokenId: string, size: number) => void;
  calibrationPoints?: { x: number; y: number }[];
  onCalibrationPoint?: (worldPos: { x: number; y: number }) => void;
  walls?: VTTWall[];
  onWallAdded?: (wall: VTTWall) => void;
  showWalls?: boolean;
  forceViewport?: { x: number; y: number; width: number; height: number } | null;
  onViewportChange?: (vp: { x: number; y: number; scale: number }) => void;
}

function segmentsIntersect(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function punchVisionHoles(
  fctx: CanvasRenderingContext2D,
  visionTokens: VTTToken[],
  gridSize: number,
  walls: VTTWall[],
  mapW: number,
  mapH: number,
  isDay: boolean = false
) {
  const wallSegs = walls.length > 0
    ? walls.flatMap(w => {
        const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (let i = 0; i < w.points.length - 1; i++) {
          segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
        }
        return segs;
      })
    : [];

  fctx.globalCompositeOperation = 'destination-out';
  for (const token of visionTokens) {
const baseRadii = getVisionRadii(token, gridSize);
const visionMode = token.visionMode || 'none';

// De jour : seule une vraie vision (normal/darkvision) perce à l'infini
// Si vision = none => aucune ouverture (même si lumière)
const hasDayVision = visionMode === 'normal' || visionMode === 'darkvision';
const infiniteR = Math.max(mapW, mapH) * 1.5;

const radii = isDay
  ? (hasDayVision
      ? { ...baseRadii, brightR: infiniteR, dimR: 0 }
      : { ...baseRadii, brightR: 0, dimR: 0 })
  : baseRadii;

const maxR = Math.max(radii.brightR, radii.dimR);
if (maxR <= 0) continue;

    // Clip par le polygone de visibilité si des murs existent
    const hasPoly = wallSegs.length > 0;
    let poly: Float64Array | null = null;
    if (hasPoly) {
      poly = buildVisibilityPolygon(radii.cx, radii.cy, maxR, wallSegs, mapW, mapH);
    }

    fctx.save();
    if (poly && poly.length >= 6) {
      fctx.beginPath();
      fctx.moveTo(poly[0], poly[1]);
      for (let pi = 2; pi < poly.length; pi += 2) fctx.lineTo(poly[pi], poly[pi + 1]);
      fctx.closePath();
      fctx.clip();
    }

    if (radii.dimR > radii.brightR) {
      const grad = fctx.createRadialGradient(
        radii.cx, radii.cy, radii.brightR,
        radii.cx, radii.cy, radii.dimR
      );
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.85, 'rgba(0,0,0,0.5)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      fctx.fillStyle = grad;
      fctx.beginPath();
      fctx.arc(radii.cx, radii.cy, radii.dimR, 0, Math.PI * 2);
      fctx.fill();
    }

    if (radii.brightR > 0) {
      fctx.fillStyle = 'rgba(0,0,0,1)';
      fctx.beginPath();
      fctx.arc(radii.cx, radii.cy, radii.brightR, 0, Math.PI * 2);
      fctx.fill();
    }

    fctx.restore();
  }
  fctx.globalCompositeOperation = 'source-over';
}

function wallBlocksToken(newX: number, newY: number, sizeInPx: number, walls: VTTWall[]): boolean {
  const rx = newX, ry = newY, rw = sizeInPx, rh = sizeInPx;
  const boxEdges: [number, number, number, number][] = [
    [rx, ry, rx + rw, ry],
    [rx + rw, ry, rx + rw, ry + rh],
    [rx + rw, ry + rh, rx, ry + rh],
    [rx, ry + rh, rx, ry],
  ];
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i], p2 = wall.points[i + 1];
      for (const [ex1, ey1, ex2, ey2] of boxEdges) {
        if (segmentsIntersect(p1.x, p1.y, p2.x, p2.y, ex1, ey1, ex2, ey2)) return true;
      }
    }
  }
  return false;
}

function pointInPolygon(x: number, y: number, poly: Float64Array): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; i += 2) {
    const xi = poly[i], yi = poly[i + 1];
    const xj = poly[j], yj = poly[j + 1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

export const VTTCanvas = forwardRef<VTTCanvasHandle, VTTCanvasProps>(function VTTCanvas({
  config,
  tokens,
  fogState,
  role,
  userId,
  activeTool,
  fogBrushSize,
  onMoveToken,
  onRevealFog,
  selectedTokenId,
  onSelectToken,
  selectedTokenIds = [],
  onSelectTokens,
  onRightClickToken,
  onMapDimensions,
  onDropToken,
  onAddTokenAtPos,
  onResizeToken,
  calibrationPoints,
  onCalibrationPoint,
  walls,
  onWallAdded,
  showWalls = false,
  forceViewport: forceViewportProp = null,
  onViewportChange,
}: VTTCanvasProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brushOverlayRef = useRef<HTMLDivElement>(null);

  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);
  const tokenImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });

  useImperativeHandle(ref, () => ({
    getViewportCenter: () => {
      const vp = viewportRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      return {
        x: (canvas.width / 2 - vp.x) / vp.scale,
        y: (canvas.height / 2 - vp.y) / vp.scale,
      };
    },
  }));

  const draggingTokenRef = useRef<{ id: string; offsetX: number; offsetY: number; multiInitial?: Map<string, { x: number; y: number }> } | null>(null);
  const resizingTokenRef = useRef<{ id: string; tokenPx: number; tokenPy: number } | null>(null);
  const isPaintingFogRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const selectionRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const isDragSelectingRef = useRef(false);
  const selectedTokenIdsRef = useRef(selectedTokenIds);
  selectedTokenIdsRef.current = selectedTokenIds;
  const onSelectTokensRef = useRef(onSelectTokens);
  onSelectTokensRef.current = onSelectTokens;

  const [mapLoading, setMapLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync all props to refs so native event handlers always read current values
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const selectedTokenIdRef = useRef(selectedTokenId);
  selectedTokenIdRef.current = selectedTokenId;
  const configRef = useRef(config);
  configRef.current = config;
  const fogStateRef = useRef(fogState);
  fogStateRef.current = fogState;
  const roleRef = useRef(role);
  roleRef.current = role;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const fogBrushSizeRef = useRef(fogBrushSize);
  fogBrushSizeRef.current = fogBrushSize;
  const onMoveTokenRef = useRef(onMoveToken);
  onMoveTokenRef.current = onMoveToken;
  const onRevealFogRef = useRef(onRevealFog);
  onRevealFogRef.current = onRevealFog;
  const onSelectTokenRef = useRef(onSelectToken);
  onSelectTokenRef.current = onSelectToken;
  const onRightClickTokenRef = useRef(onRightClickToken);
  onRightClickTokenRef.current = onRightClickToken;
  const onMapDimensionsRef = useRef(onMapDimensions);
  onMapDimensionsRef.current = onMapDimensions;
  const onDropTokenRef = useRef(onDropToken);
  onDropTokenRef.current = onDropToken;
  const onAddTokenAtPosRef = useRef(onAddTokenAtPos);
  onAddTokenAtPosRef.current = onAddTokenAtPos;
  const onResizeTokenRef = useRef(onResizeToken);
  onResizeTokenRef.current = onResizeToken;
  const onCalibrationPointRef = useRef(onCalibrationPoint);
  onCalibrationPointRef.current = onCalibrationPoint;
  const calibrationPointsRef = useRef(calibrationPoints);
  calibrationPointsRef.current = calibrationPoints;
  const wallsRef = useRef(walls);
  wallsRef.current = walls;
  const onWallAddedRef = useRef(onWallAdded);
  onWallAddedRef.current = onWallAdded;
  const showWallsRef = useRef(showWalls);
  showWallsRef.current = showWalls;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const wallPointsRef = useRef<{ x: number; y: number }[]>([]);
  const wallPreviewPosRef = useRef<{ x: number; y: number } | null>(null);
  const measureStartRef = useRef<{ x: number; y: number } | null>(null);
  const measureEndRef = useRef<{ x: number; y: number } | null>(null);
  const measureLockedRef = useRef(false);

  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogCanvasSizeRef = useRef({ w: 0, h: 0 });
  const visionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visionCanvasSizeRef = useRef({ w: 0, h: 0 });
  const dayVisionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dayVisionCanvasSizeRef = useRef({ w: 0, h: 0 });
    const exploredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exploredCanvasSizeRef = useRef({ w: 0, h: 0 });
  const torchAnimRef = useRef<number | null>(null);
  const forceViewportRef = useRef(forceViewportProp);
  forceViewportRef.current = forceViewportProp;

  // drawRef allows image load callbacks to always call latest draw
  const drawRef = useRef<() => void>(() => {});

  const getCanvasXY = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const screenToWorld = (sx: number, sy: number) => {
    const vp = viewportRef.current;
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
  };

  const getTokenAt = (wx: number, wy: number): VTTToken | null => {
    const toks = tokensRef.current;
    const c = configRef.current.gridSize || 50;
    for (let i = toks.length - 1; i >= 0; i--) {
      const t = toks[i];
      if (roleRef.current === 'player' && !t.visible) continue;
      const size = (t.size || 1) * c;
      if (wx >= t.position.x && wx <= t.position.x + size &&
          wy >= t.position.y && wy <= t.position.y + size) {
        return t;
      }
    }
    return null;
  };

  const snapToGrid = (wx: number, wy: number) => {
    const cfg = configRef.current;
    if (!cfg.snapToGrid) return { x: wx, y: wy };
    const c = cfg.gridSize || 50;
    const ox = ((cfg.gridOffsetX || 0) % c + c) % c;
    const oy = ((cfg.gridOffsetY || 0) % c + c) % c;
    return {
      x: Math.round((wx - ox) / c) * c + ox,
      y: Math.round((wy - oy) / c) * c + oy,
    };
  };

  const paintFogAt = (wx: number, wy: number) => {
    const erase = activeToolRef.current === 'fog-erase';
    const stroke: VTTFogStroke = { x: wx, y: wy, r: fogBrushSizeRef.current, erase };
    applyStrokeToFogCanvas(stroke);
    onRevealFogRef.current(stroke);
  };

  const buildFogCanvas = (strokes: VTTFogStroke[], mapW: number, mapH: number) => {
    let fc = fogCanvasRef.current;
    if (!fc || fogCanvasSizeRef.current.w !== mapW || fogCanvasSizeRef.current.h !== mapH) {
      fc = document.createElement('canvas');
      fc.width = mapW;
      fc.height = mapH;
      fogCanvasRef.current = fc;
      fogCanvasSizeRef.current = { w: mapW, h: mapH };
    }
    const fctx = fc.getContext('2d')!;
    fctx.clearRect(0, 0, mapW, mapH);
    fctx.fillStyle = '#000';
    fctx.fillRect(0, 0, mapW, mapH);
    fctx.globalCompositeOperation = 'destination-out';
    for (const s of strokes) {
      if (!s.erase) {
        fctx.beginPath();
        fctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        fctx.fill();
      }
    }
    fctx.globalCompositeOperation = 'source-over';
    for (const s of strokes) {
      if (s.erase) {
        fctx.beginPath();
        fctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        fctx.fillStyle = '#000';
        fctx.fill();
      }
    }
    fctx.globalCompositeOperation = 'source-over';
  };

  const applyStrokeToFogCanvas = (stroke: VTTFogStroke) => {
    const fc = fogCanvasRef.current;
    if (!fc) return;
    const fctx = fc.getContext('2d')!;
    if (!stroke.erase) {
      fctx.globalCompositeOperation = 'destination-out';
      fctx.beginPath();
      fctx.arc(stroke.x, stroke.y, stroke.r, 0, Math.PI * 2);
      fctx.fill();
    } else {
      fctx.globalCompositeOperation = 'source-over';
      fctx.fillStyle = '#000';
      fctx.beginPath();
      fctx.arc(stroke.x, stroke.y, stroke.r, 0, Math.PI * 2);
      fctx.fill();
    }
    fctx.globalCompositeOperation = 'source-over';
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    if (forceViewportRef.current && W > 0 && H > 0) {
      const fv = forceViewportRef.current;
      const scale = Math.min(W / fv.width, H / fv.height);
      const offsetX = (W - fv.width * scale) / 2;
      const offsetY = (H - fv.height * scale) / 2;
      viewportRef.current = { x: -fv.x * scale + offsetX, y: -fv.y * scale + offsetY, scale };
    }

    const vp = viewportRef.current;
    const cfg = configRef.current;
    const CELL = cfg.gridSize || 50;
    const fog = fogStateRef.current;
    const curRole = roleRef.current;
    const curUserId = userIdRef.current;
    const currentSelectedId = selectedTokenIdRef.current;
    const multiIds = selectedTokenIdsRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    const mapW = cfg.mapWidth || 2000;
    const mapH = cfg.mapHeight || 2000;

    if (mapImgRef.current && mapLoadedRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, mapW, mapH);
    } else {
      ctx.fillStyle = '#1a1f2e';
      ctx.fillRect(0, 0, mapW, mapH);
    }

    if (CELL > 0) {
      const gridColor = cfg.gridColor || 'rgba(255,255,255,0.15)';
      const ox = ((cfg.gridOffsetX || 0) % CELL + CELL) % CELL;
      const oy = ((cfg.gridOffsetY || 0) % CELL + CELL) % CELL;
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = (cfg.gridLineWidth || 1) / vp.scale;
      for (let gx = ox; gx <= mapW; gx += CELL) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, mapH); ctx.stroke();
      }
      for (let gy = oy; gy <= mapH; gy += CELL) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(mapW, gy); ctx.stroke();
      }
    }

const timeOfDay = cfg.timeOfDay;
const isNight = timeOfDay != null && (timeOfDay >= 19 || timeOfDay < 5);
const isDay = !isNight;
const currentWalls = wallsRef.current || [];

    // Tokens strictement appartenant/contrôlés par le joueur courant
const selectedIdsSet = new Set(selectedTokenIdsRef.current || []);

const hasSelectedIds = selectedIdsSet.size > 0;

const myVisibleTokens = tokensRef.current.filter(t => {
  if (!t.visible) return false;
  if (curRole !== 'player') return true;

  // Priorité absolue aux tokens choisis au login
  if (hasSelectedIds) return selectedIdsSet.has(t.id);

  // Fallback si selectedTokenIds n'est pas encore hydraté
  return (t.controlledByUserIds?.includes(curUserId) ?? false);
});

const myVisionTokens = myVisibleTokens.filter(
  t => t.visionMode === 'normal' || t.visionMode === 'darkvision'
);

const directlyVisibleTokenIds = new Set<string>();

if (curRole === 'player') {
  const wallSegs = currentWalls.length > 0
    ? currentWalls.flatMap(w => {
        const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (let i = 0; i < w.points.length - 1; i++) {
          segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
        }
        return segs;
      })
    : [];

  const viewers = isNight
    ? myVisibleTokens.filter(t =>
        (t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none')
      )
    : myVisionTokens;

  for (const viewer of viewers) {
    const radii = getVisionRadii(viewer, CELL);
    const maxR = Math.max(radii.brightR, radii.dimR);
    if (maxR <= 0) continue;

    let poly: Float64Array | null = null;
    if (wallSegs.length > 0) {
      poly = buildVisibilityPolygon(radii.cx, radii.cy, maxR, wallSegs, mapW, mapH);
      if (poly.length < 6) poly = null;
    }
    
tokensRef.current.forEach(token => {
if (!token.visible && curRole === 'player') return;

// Player: ne dessiner un token que s'il est directement visible,
// sauf ses propres tokens (toujours visibles pour le contrôle)


  const px = token.position.x;
  const py = token.position.y;
  const size = (token.size || 1) * CELL;
  const cx = px + size / 2;
  const cy = py + size / 2;
  const r = size / 2 - 4;

  // Dessiner le token (image/couleur)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((token.rotation || 0) * Math.PI / 180);

  if (token.imageUrl) {
    let img = tokenImageCache.current.get(token.imageUrl);
    if (!img) {
      img = new Image();
      img.onload = () => drawRef.current();
      img.src = token.imageUrl;
      tokenImageCache.current.set(token.imageUrl, img);
    }

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();

    if (img.complete && img.naturalWidth > 0) {
      const ZOOM = 1.8;
      const side = r * 2 * ZOOM;
      const excess = side - r * 2;
      const ox = -(token.imageOffsetX || 0) * (excess / 2);
      const oy = -(token.imageOffsetY || 0) * (excess / 2);
      const aspect = img.naturalWidth / img.naturalHeight;

      let dw: number, dh: number;
      if (aspect >= 1) {
        dw = side;
        dh = side / aspect;
      } else {
        dw = side * aspect;
        dh = side;
      }

      const dx = -r - excess / 2 + ox + (side - dw) / 2;
      const dy = -r - excess / 2 + oy + (side - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = token.color || '#3b82f6';
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = token.color || '#3b82f6';
    ctx.fill();
  }
  ctx.restore();

  // Surcouches (sélection, bordure, hp)
  ctx.save();
  ctx.translate(cx, cy);

  if (multiIds.length > 1 && multiIds.includes(token.id) && token.id !== currentSelectedId) {
    const pad = 4 / vp.scale;
    ctx.strokeStyle = 'rgba(99,179,237,0.9)';
    ctx.lineWidth = 2 / vp.scale;
    ctx.setLineDash([4 / vp.scale, 3 / vp.scale]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
    ctx.setLineDash([]);
  }

  if (token.id === currentSelectedId) {
    const pad = 5 / vp.scale;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5 / vp.scale;
    ctx.setLineDash([6 / vp.scale, 3 / vp.scale]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
    ctx.setLineDash([]);

    const hx = size / 2 + pad;
    const hy = size / 2 + pad;
    const hr = 7 / vp.scale;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5 / vp.scale;
    ctx.stroke();
  }

  const controlled = token.controlledByUserIds?.includes(curUserId);
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = controlled ? '#22c55e' : '#94a3b8';
  ctx.lineWidth = 2 / vp.scale;
  ctx.stroke();

  if (!token.imageUrl) {
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(10, size * 0.25) / vp.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(token.label?.slice(0, 2) || '?', 0, 0);
  }

  if (token.maxHp != null && token.maxHp > 0 && token.hp != null) {
    const barW = r * 1.6;
    const barH = Math.max(4, size * 0.07) / vp.scale;
    const barY = r + 6 / vp.scale;
    const pct = Math.max(0, Math.min(1, token.hp / token.maxHp));
    const hpColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW, barH, barH / 2);
    ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(-barW / 2, barY, barW * pct, barH, barH / 2);
      ctx.fill();
    }
  }

  ctx.restore();
});



    for (const t of tokensRef.current) {
      if (!t.visible) continue;
      const ts = (t.size || 1) * CELL;
      const tcx = t.position.x + ts / 2;
      const tcy = t.position.y + ts / 2;

      const dx = tcx - radii.cx;
      const dy = tcy - radii.cy;
      if (dx * dx + dy * dy > maxR * maxR) continue;

      if (poly) {
        if (pointInPolygon(tcx, tcy, poly)) directlyVisibleTokenIds.add(t.id);
      } else {
        directlyVisibleTokenIds.add(t.id);
      }
    }
  }
}
    
// Hard blackout joueur : aucun token avec vision active => tout noir (ignore mémoire explorée)
if (curRole === 'player' && myVisionTokens.length === 0) {
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, mapW, mapH);
  ctx.restore();
  return;
}

// --- FOG DE GUERRE (manuel, GM only) ---
if (cfg.fogEnabled) {
      const strokes = fog.strokes || [];
      if (!fogCanvasRef.current ||
          fogCanvasSizeRef.current.w !== mapW ||
          fogCanvasSizeRef.current.h !== mapH) {
        buildFogCanvas(strokes, mapW, mapH);
      }
      if (fogCanvasRef.current) {
        let vc = visionCanvasRef.current;
        if (!vc || visionCanvasSizeRef.current.w !== mapW || visionCanvasSizeRef.current.h !== mapH) {
          vc = document.createElement('canvas');
          vc.width = mapW;
          vc.height = mapH;
          visionCanvasRef.current = vc;
          visionCanvasSizeRef.current = { w: mapW, h: mapH };
        }
        const vCtx = vc.getContext('2d')!;
        vCtx.clearRect(0, 0, mapW, mapH);
        vCtx.drawImage(fogCanvasRef.current, 0, 0);

        // De jour : la vision (normal/darkvision) + lumière percent le fog
        // De nuit : seule la lumière (torche/lanterne/custom) perce le fog
const fogPunchTokens =
  curRole === 'player'
    ? (isDay
        ? myVisionTokens
        : myVisibleTokens.filter(
            t =>
              (t.visionMode === 'darkvision') ||
              (t.lightSource && t.lightSource !== 'none')
          ))
    : (isDay
        ? tokensRef.current.filter(
            t => t.visible && (t.visionMode === 'normal' || t.visionMode === 'darkvision')
          )
        : tokensRef.current.filter(
            t => t.visible && (
              (t.lightSource && t.lightSource !== 'none') ||
              (t.visionMode === 'darkvision')
            )
          ));
        if (fogPunchTokens.length > 0) {
          punchVisionHoles(vCtx, fogPunchTokens, CELL, currentWalls, mapW, mapH, isDay);
        }

        // De nuit la vision gère déjà l'obscurité, le fog n'est qu'un masque GM complémentaire
        // On réduit son opacité pour ne pas doubler l'effet avec drawNightVisionOverlay
        const fogAlpha = curRole === 'gm' ? 0.5 : (isNight ? 0.6 : 0.95);
        ctx.globalAlpha = fogAlpha;
        ctx.drawImage(vc, 0, 0, mapW, mapH);
        ctx.globalAlpha = 1;
      }
    }

    // --- VISION DE JOUR (murs bloquent la vue) ---
    if (isDay && curRole === 'player' && currentWalls.length > 0) {
const playerTokens = myVisionTokens;
      if (playerTokens.length > 0) { 
        let dvc = dayVisionCanvasRef.current;
        if (!dvc || dayVisionCanvasSizeRef.current.w !== mapW || dayVisionCanvasSizeRef.current.h !== mapH) {
          dvc = document.createElement('canvas');
          dvc.width = mapW;
          dvc.height = mapH;
          dayVisionCanvasRef.current = dvc;
          dayVisionCanvasSizeRef.current = { w: mapW, h: mapH };
        }
        const dvCtx = dvc.getContext('2d')!;
        drawDayVisionOverlay(dvCtx, mapW, mapH, playerTokens, currentWalls, CELL);
        ctx.globalAlpha = 0.65;
        ctx.drawImage(dvc, 0, 0, mapW, mapH);
        ctx.globalAlpha = 1;
} else {
  // Aucun token voyant contrôlé par le joueur => noir total
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, mapW, mapH);
}
    }

    // --- MASQUE NOIR si le joueur n'a aucun token avec vision (jour) ---
    if (isDay && curRole === 'player') {
const hasAnyVision = myVisionTokens.length > 0;
      if (!hasAnyVision) {
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(0, 0, mapW, mapH);
      }
    }

    
    // --- VISION DE NUIT (drawNightVisionOverlay + mémoire pérenne) ---
if (isNight && curRole === 'player') {
  const playerTokens = myVisibleTokens.filter(
    t =>
      (t.visionMode && t.visionMode !== 'none') ||
      (t.lightSource && t.lightSource !== 'none')
  );
      if (playerTokens.length > 0) {
        // --- Canvas de vision live via drawNightVisionOverlay (gère torche/flicker/murs/zones) ---
        let nvc = visionCanvasRef.current;
        if (!nvc || visionCanvasSizeRef.current.w !== mapW || visionCanvasSizeRef.current.h !== mapH) {
          nvc = document.createElement('canvas');
          nvc.width = mapW;
          nvc.height = mapH;
          visionCanvasRef.current = nvc;
          visionCanvasSizeRef.current = { w: mapW, h: mapH };
        }
        const nCtx = nvc.getContext('2d')!;
        const tod = timeOfDay != null ? getTimeOfDayOverlay(timeOfDay) : { color: 'rgba(0,0,0,ALPHA)', opacity: 0.65, label: '' };
        drawNightVisionOverlay(nCtx, mapW, mapH, playerTokens, currentWalls, CELL, tod.opacity, tod.color);
        // nvc est maintenant : noir opaque = pas visible, transparent = visible

        // --- Canvas de mémoire pérenne (explored) ---
        let evc = exploredCanvasRef.current;
        if (!evc || exploredCanvasSizeRef.current.w !== mapW || exploredCanvasSizeRef.current.h !== mapH) {
          evc = document.createElement('canvas');
          evc.width = mapW;
          evc.height = mapH;
          const eCtx2 = evc.getContext('2d')!;
          eCtx2.fillStyle = 'rgba(0,0,0,1)';
          eCtx2.fillRect(0, 0, mapW, mapH);
          exploredCanvasRef.current = evc;
          exploredCanvasSizeRef.current = { w: mapW, h: mapH };
        }
        const eCtx = evc.getContext('2d')!;

        // Percer la mémoire avec ce que drawNightVisionOverlay a rendu visible
        // nvc: noir (opaque) = pas visible, transparent = visible
        // On veut effacer la mémoire (rendre transparent) là où nvc est transparent
        // => destination-out avec l'INVERSE de nvc
        // Plus simple : on utilise les radii + polygone pour percer proprement
        const wallSegs = currentWalls.length > 0
          ? currentWalls.flatMap(w => {
              const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
              for (let i = 0; i < w.points.length - 1; i++) {
                segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
              }
              return segs;
            })
          : [];

        eCtx.globalCompositeOperation = 'destination-out';
        for (const token of playerTokens) {
          if (!token.visible) continue;
          const tSize = (token.size || 1) * CELL;
          const tcx = token.position.x + tSize / 2;
          const tcy = token.position.y + tSize / 2;

          // Calculer maxR directement pour cohérence avec drawNightVisionOverlay
          const vm = token.visionMode || 'none';
          const vr = token.visionRange ?? 18;
          const ls = token.lightSource || 'none';
          const lr = token.lightRange ?? 6;

          let maxR = 0;
          if (vm === 'normal') maxR = metersToPixels(3, CELL);
          else if (vm === 'darkvision') maxR = metersToPixels(vr, CELL);
          if (ls !== 'none') {
            let dimM = lr * 2;
            if (ls === 'torch') dimM = 12;
            else if (ls === 'lantern') dimM = 18;
            maxR = Math.max(maxR, metersToPixels(dimM, CELL));
          }
          if (maxR <= 0) continue;

          if (wallSegs.length > 0) {
            const poly = buildVisibilityPolygon(tcx, tcy, maxR, wallSegs, mapW, mapH);
            if (poly.length >= 6) {
              eCtx.fillStyle = 'rgba(0,0,0,1)';
              eCtx.beginPath();
              eCtx.moveTo(poly[0], poly[1]);
              for (let pi = 2; pi < poly.length; pi += 2) eCtx.lineTo(poly[pi], poly[pi + 1]);
              eCtx.closePath();
              eCtx.fill();
            }
          } else {
            eCtx.fillStyle = 'rgba(0,0,0,1)';
            eCtx.beginPath();
            eCtx.arc(tcx, tcy, maxR, 0, Math.PI * 2);
            eCtx.fill();
          }
        }
        eCtx.globalCompositeOperation = 'source-over';
        // evc: noir = jamais vu, transparent = déjà vu
        // nvc: noir opaque = hors vision, transparent = en vision directe, semi-transparent = dim

        // --- Composer le résultat final ---
        // On construit un canvas composite unique qui contient :
        //   - Zones en vision directe : transparent (carte visible) — géré par nvc
        //   - Zones déjà explorées hors vision : noir à 30% (voile léger)
        //   - Zones jamais vues : noir 100% (totalement masqué)

        // Étape 1 : Créer le canvas "explored fog" = noir à 30% partout SAUF zones déjà vues
        // On inverse evc : zones déjà vues deviennent noires, zones jamais vues transparentes
        // Puis on dessine un voile de 30% clipé sur les zones déjà vues

        // Approche directe : on part de nvc (vision live complète) et on réduit
        // l'opacité du noir sur les zones déjà explorées

        const cvc = document.createElement('canvas');
        cvc.width = mapW;
        cvc.height = mapH;
        const cCtx = cvc.getContext('2d')!;

        // Commencer avec nvc = noir complet sur les zones hors vision
        cCtx.drawImage(nvc, 0, 0);

        // Maintenant, sur les zones "déjà explorées" (evc transparent) ET "hors vision" (cvc noir),
        // on veut réduire le noir de 100% à 30%.
        // On va d'abord isoler le noir qui tombe sur des zones déjà explorées, puis le réduire.

        // Étape 2 : Créer un masque "déjà exploré ET hors vision"
        // = les pixels de cvc qui sont noirs (opaques) ET où evc est transparent
        // On crée un canvas inversé de evc : noir là où evc est transparent, transparent là où evc est noir
        const invCanvas = document.createElement('canvas');
        invCanvas.width = mapW;
        invCanvas.height = mapH;
        const invCtx = invCanvas.getContext('2d')!;
        // Remplir tout en noir
        invCtx.fillStyle = 'rgba(0,0,0,1)';
        invCtx.fillRect(0, 0, mapW, mapH);
        // Effacer les zones jamais vues (où evc est opaque/noir)
        invCtx.globalCompositeOperation = 'destination-out';
        invCtx.drawImage(evc, 0, 0);
        invCtx.globalCompositeOperation = 'source-over';
        // invCanvas = noir là où déjà vu, transparent là où jamais vu

        // Étape 3 : Sur cvc, retirer 70% du noir sur les zones déjà explorées
        // On utilise destination-out avec invCanvas à 70% d'alpha
        // Cela retire 70% de l'opacité de cvc là où invCanvas est opaque (= déjà exploré)
        // Résultat : les zones déjà explorées hors vision passent de noir 100% à noir 30%
        cCtx.globalCompositeOperation = 'destination-out';
        cCtx.globalAlpha = 0.70;
        cCtx.drawImage(invCanvas, 0, 0);
        cCtx.globalAlpha = 1;
        cCtx.globalCompositeOperation = 'source-over';

        // cvc contient maintenant :
        //   - Zones en vision directe : transparent (inchangé depuis nvc) ✓
        //   - Zones déjà explorées hors vision : noir à ~30% ✓
        //   - Zones jamais vues hors vision : noir 100% (inchangé depuis nvc) ✓

        // Étape 4 : Dessiner sur le canvas principal
        ctx.drawImage(cvc, 0, 0, mapW, mapH);

      } else {
        // Joueur sans token avec vision → noir total
        ctx.fillStyle = 'rgba(0,0,0,1)';
        ctx.fillRect(0, 0, mapW, mapH);
      }
    }
    // --- FILTRE HEURE DU JOUR ---
    // La nuit, drawNightVisionOverlay gère l'obscurité + la teinte via nightColor.
    // Ce filtre ne s'applique que de jour / crépuscule / aube (heures non-nuit).
    // Pour le GM la nuit, on applique un léger voile pour l'ambiance mais très atténué.
    if (timeOfDay != null && !isNight) {
      const tod = getTimeOfDayOverlay(timeOfDay);
      if (tod.opacity > 0) {
        const fillColor = tod.color.replace('ALPHA', String(tod.opacity));
        ctx.fillStyle = fillColor;
        ctx.fillRect(0, 0, mapW, mapH);
      }
    } else if (timeOfDay != null && isNight && curRole === 'gm') {
      // GM voit la carte normalement mais avec un léger voile bleuté d'ambiance
      ctx.fillStyle = 'rgba(10,10,40,0.08)';
      ctx.fillRect(0, 0, mapW, mapH);
    }

    const calPts = calibrationPointsRef.current;
    if (calPts && calPts.length > 0) {
      calPts.forEach((pt, i) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8 / vp.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / vp.scale;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${12 / vp.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), pt.x, pt.y);
      });

      if (calPts.length >= 2) {
        const p1 = calPts[0], p2 = calPts[1];
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = 'rgba(245,158,11,0.6)';
        ctx.lineWidth = 2 / vp.scale;
        ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
        ctx.stroke(); 
        ctx.setLineDash([]);
      }
    }

    const shouldDrawWalls = curRole === 'gm' && (activeToolRef.current === 'wall-draw' || showWallsRef.current);
    if (shouldDrawWalls) {
      const committedWalls = wallsRef.current || [];
      const isWallMode = activeToolRef.current === 'wall-draw';
      const wallAlpha = isWallMode ? 0.9 : 0.35;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const wall of committedWalls) {
        if (wall.points.length < 2) continue;
        ctx.strokeStyle = `rgba(239,68,68,${wallAlpha})`;
        ctx.lineWidth = 3 / vp.scale;
        ctx.beginPath();
        ctx.moveTo(wall.points[0].x, wall.points[0].y);
        for (let i = 1; i < wall.points.length; i++) {
          ctx.lineTo(wall.points[i].x, wall.points[i].y);
        }
        ctx.stroke();
        if (isWallMode) {
          ctx.fillStyle = 'rgba(239,68,68,0.85)';
          for (const pt of wall.points) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4 / vp.scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      if (isWallMode) {
        const wPts = wallPointsRef.current;
        if (wPts.length > 0) {
          ctx.strokeStyle = 'rgba(251,146,60,0.85)';
          ctx.lineWidth = 2.5 / vp.scale;
          ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
          ctx.beginPath();
          ctx.moveTo(wPts[0].x, wPts[0].y);
          for (let i = 1; i < wPts.length; i++) {
            ctx.lineTo(wPts[i].x, wPts[i].y);
          }
          const preview = wallPreviewPosRef.current;
          if (preview) ctx.lineTo(preview.x, preview.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#fb923c';
          for (const pt of wPts) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5 / vp.scale, 0, Math.PI * 2);
            ctx.fill();
          }
          if (wPts.length > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5 / vp.scale;
            ctx.beginPath();
            ctx.arc(wPts[0].x, wPts[0].y, 8 / vp.scale, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    const mStart = measureStartRef.current;
    const mEnd = measureEndRef.current;
    if (mStart && mEnd) {
      const dx = mEnd.x - mStart.x;
      const dy = mEnd.y - mStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const gridSz = cfg.gridSize || 50;
      const squares = distPx / gridSz;
      const meters = squares * 1.5;

      ctx.strokeStyle = 'rgba(56,189,248,0.8)';
      ctx.lineWidth = 2.5 / vp.scale;
      ctx.setLineDash([8 / vp.scale, 4 / vp.scale]);
      ctx.beginPath();
      ctx.moveTo(mStart.x, mStart.y);
      ctx.lineTo(mEnd.x, mEnd.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const pt of [mStart, mEnd]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5 / vp.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56,189,248,0.9)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 / vp.scale;
        ctx.stroke();
      }

      const midX = (mStart.x + mEnd.x) / 2;
      const midY = (mStart.y + mEnd.y) / 2;
      const label = `${meters.toFixed(1)} m (${squares.toFixed(1)} cases)`;
      const fontSize = Math.max(12, 14 / vp.scale);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textW = ctx.measureText(label).width;
      const padX = 6 / vp.scale;
      const padY = 4 / vp.scale;
      ctx.fillStyle = 'rgba(15,23,42,0.85)';
      ctx.beginPath();
      ctx.roundRect(midX - textW / 2 - padX, midY - fontSize / 2 - padY, textW + padX * 2, fontSize + padY * 2, 4 / vp.scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.6)';
      ctx.lineWidth = 1 / vp.scale;
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
    }

const selRect = selectionRectRef.current;
if (selRect) {
  const sx = Math.min(selRect.x1, selRect.x2);
  const sy = Math.min(selRect.y1, selRect.y2);
  const sw = Math.abs(selRect.x2 - selRect.x1);
  const sh = Math.abs(selRect.y2 - selRect.y1);
  ctx.fillStyle = 'rgba(59,130,246,0.12)';
  ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = 'rgba(96,165,250,0.85)';
  ctx.lineWidth = 1.5 / vp.scale;
  ctx.setLineDash([5 / vp.scale, 3 / vp.scale]);
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.setLineDash([]);
}



ctx.restore();
  }, []);

  drawRef.current = draw;

  // Load map image — clear old image immediately to prevent stale map showing
  useEffect(() => {
    if (!config.mapImageUrl) {
      setMapLoading(false);
      mapLoadedRef.current = false;
      mapImgRef.current = null;
      draw();
      return;
    }
    // Immediately clear previous image so canvas shows dark bg while loading
    mapImgRef.current = null;
    mapLoadedRef.current = false;
    setMapLoading(true);
    draw();

    const img = new Image();
    img.onload = () => {
      mapImgRef.current = img;
      mapLoadedRef.current = true;
      setMapLoading(false);
      if (onMapDimensionsRef.current && img.naturalWidth > 0) {
        onMapDimensionsRef.current(img.naturalWidth, img.naturalHeight);
      }
      draw();
    };
    img.onerror = () => {
      mapImgRef.current = null;
      mapLoadedRef.current = false;
      setMapLoading(false);
      draw();
    };
    img.src = config.mapImageUrl;
  }, [config.mapImageUrl, draw]);

  // Rebuild fog canvas when strokes change (network sync, scene switch, reset)
  useEffect(() => {
    const strokes = fogState.strokes || [];
    const mapW = config.mapWidth || 2000;
    const mapH = config.mapHeight || 2000;
    buildFogCanvas(strokes, mapW, mapH);
    // Reset explored memory on scene change
    exploredCanvasRef.current = null;
    exploredCanvasSizeRef.current = { w: 0, h: 0 };
    drawRef.current();
  }, [fogState.strokes, config.mapWidth, config.mapHeight]);

  // Redraw when visual state changes
  useEffect(() => { draw(); }, [draw, tokens, selectedTokenId, selectedTokenIds, config, calibrationPoints, walls, showWalls]);

  useEffect(() => {
    const hasTorch = tokens.some(t => t.visible && t.lightSource === 'torch');
    const hasNightVision = tokens.some(t => t.visible && (t.visionMode === 'darkvision' || t.visionMode === 'normal' || (t.lightSource && t.lightSource !== 'none')));
    const isNight = config.timeOfDay != null && (config.timeOfDay >= 19 || config.timeOfDay < 5);
    if ((hasTorch || hasNightVision) && isNight) {
      let running = true;
      const animate = () => {
        if (!running) return;
        drawRef.current();
        torchAnimRef.current = requestAnimationFrame(animate);
      };
      torchAnimRef.current = requestAnimationFrame(animate);
      return () => {
        running = false;
        if (torchAnimRef.current) cancelAnimationFrame(torchAnimRef.current);
      };
    } else {
      if (torchAnimRef.current) {
        cancelAnimationFrame(torchAnimRef.current);
        torchAnimRef.current = null;
      }
    }
  }, [tokens, config.timeOfDay]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (forceViewportProp) draw();
  }, [forceViewportProp, draw]);

  // Native event listeners — single registration, reads from refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        isPanningRef.current = true;
        return;
      }
      if (e.button !== 0) return;

      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);
      const tool = activeToolRef.current;

      if (tool === 'select') {
        const selId = selectedTokenIdRef.current;
        if (selId) {
          const selToken = tokensRef.current.find(t => t.id === selId);
          if (selToken) {
            const CELL2 = configRef.current.gridSize || 50;
            const tokenPxSize = (selToken.size || 1) * CELL2;
            const vp2 = viewportRef.current;
            const pad2 = 5 / vp2.scale;
            const handleWx = selToken.position.x + tokenPxSize + pad2;
            const handleWy = selToken.position.y + tokenPxSize + pad2;
            const distPx = Math.sqrt(
              Math.pow((wp.x - handleWx) * vp2.scale, 2) +
              Math.pow((wp.y - handleWy) * vp2.scale, 2)
            );
            if (distPx < 12) {
              resizingTokenRef.current = { id: selId, tokenPx: selToken.position.x, tokenPy: selToken.position.y };
              return;
            }
          }
        }

const token = getTokenAt(wp.x, wp.y);
if (token) {
  const canControl = roleRef.current === 'gm' || (token.controlledByUserIds?.includes(userIdRef.current) ?? false);

  // Joueur: interdit de sélectionner un token qu'il ne contrôle pas
  if (roleRef.current === 'player' && !canControl) {
    return;
  }

  if (canControl) {
    const multiSel = selectedTokenIdsRef.current;
    if (multiSel.length > 1 && multiSel.includes(token.id)) {
      const initialPositions = new Map<string, { x: number; y: number }>();
      tokensRef.current.forEach(t => {
        if (multiSel.includes(t.id)) initialPositions.set(t.id, { ...t.position });
      });
      draggingTokenRef.current = {
        id: token.id,
        offsetX: wp.x - token.position.x,
        offsetY: wp.y - token.position.y,
        multiInitial: initialPositions,
      };
    } else {
      draggingTokenRef.current = {
        id: token.id,
        offsetX: wp.x - token.position.x,
        offsetY: wp.y - token.position.y,
      };
    }
  }

  onSelectTokenRef.current(token.id);
  if (selectedTokenIdsRef.current.length <= 1 || !selectedTokenIdsRef.current.includes(token.id)) {
    onSelectTokensRef.current?.([token.id]);
  }
} else {
          isDragSelectingRef.current = true;
          selectionRectRef.current = { x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y };
          onSelectTokenRef.current(null);
          onSelectTokensRef.current?.([]);
        }
      } else if ((tool === 'fog-reveal' || tool === 'fog-erase') && roleRef.current === 'gm') {
        isPaintingFogRef.current = true;
        paintFogAt(wp.x, wp.y);
      } else if (tool === 'grid-calibrate' && roleRef.current === 'gm') {
        onCalibrationPointRef.current?.({ x: wp.x, y: wp.y });
      } else if (tool === 'wall-draw' && roleRef.current === 'gm') {
        wallPointsRef.current = [...wallPointsRef.current, { x: wp.x, y: wp.y }];
        wallPreviewPosRef.current = null;
        drawRef.current();
      } else if (tool === 'measure') {
        if (measureLockedRef.current) {
          measureStartRef.current = null;
          measureEndRef.current = null;
          measureLockedRef.current = false;
          drawRef.current();
        } else if (!measureStartRef.current) {
          measureStartRef.current = { x: wp.x, y: wp.y };
          measureEndRef.current = { x: wp.x, y: wp.y };
          measureLockedRef.current = false;
        } else {
          measureLockedRef.current = true;
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const cb = onRightClickTokenRef.current;
      if (!cb) return;
      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);
      const token = getTokenAt(wp.x, wp.y);
      if (token) {
        const canEdit = roleRef.current === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userIdRef.current));
        if (canEdit) cb(token, e.clientX, e.clientY);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const tool = activeToolRef.current;
      const overlay = brushOverlayRef.current;

      if (overlay) {
        const isFog = tool === 'fog-reveal' || tool === 'fog-erase';
        if (isFog) {
          const vp = viewportRef.current;
          const brushPx = fogBrushSizeRef.current * vp.scale;
          overlay.style.display = 'block';
          overlay.style.left = `${e.clientX}px`;
          overlay.style.top = `${e.clientY}px`;
          overlay.style.width = `${brushPx * 2}px`;
          overlay.style.height = `${brushPx * 2}px`;
          overlay.style.borderColor = tool === 'fog-reveal'
            ? 'rgba(251,191,36,0.8)'
            : 'rgba(239,68,68,0.8)';
          overlay.style.backgroundColor = tool === 'fog-reveal'
            ? 'rgba(251,191,36,0.08)'
            : 'rgba(239,68,68,0.08)';
        } else {
          overlay.style.display = 'none';
        }
      }

      if (activeToolRef.current === 'wall-draw' && wallPointsRef.current.length > 0) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        wallPreviewPosRef.current = wp2;
        drawRef.current();
      }

      if (activeToolRef.current === 'measure' && measureStartRef.current && !measureLockedRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        measureEndRef.current = wp2;
        drawRef.current();
      }

      if (isPanningRef.current && lastPanRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
        onViewportChangeRef.current?.(viewportRef.current);
        drawRef.current();
        return;
      }

      if (resizingTokenRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const { id: rId, tokenPx, tokenPy } = resizingTokenRef.current;
        const CELLR = configRef.current.gridSize || 50;
        const rawPx = Math.max(wp2.x - tokenPx, wp2.y - tokenPy, CELLR * 0.1);
        const newSize = Math.max(Math.round((rawPx / CELLR) * 10) / 10, 0.1);
        onResizeTokenRef.current?.(rId, newSize);
        return;
      }

      if (isDragSelectingRef.current && selectionRectRef.current) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        selectionRectRef.current.x2 = wp.x;
        selectionRectRef.current.y2 = wp.y;
        drawRef.current();
      } else if (draggingTokenRef.current) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        const drag = draggingTokenRef.current;
        const nx = wp.x - drag.offsetX;
        const ny = wp.y - drag.offsetY;
        const snapped = snapToGrid(nx, ny);
        if (drag.multiInitial && drag.multiInitial.size > 1) {
          const primaryInit = drag.multiInitial.get(drag.id)!;
          const dx = snapped.x - primaryInit.x;
          const dy = snapped.y - primaryInit.y;
          const currentWalls = wallsRef.current || [];
          if (currentWalls.length > 0) {
            let blocked = false;
            drag.multiInitial.forEach((initPos, tid) => {
              if (blocked) return;
              const newPos = snapToGrid(initPos.x + dx, initPos.y + dy);
              const mt = tokensRef.current.find(t => t.id === tid);
              const mSize = (mt?.size || 1) * (configRef.current.gridSize || 50);
              if (wallBlocksToken(newPos.x, newPos.y, mSize, currentWalls)) blocked = true;
            });
            if (blocked) return;
          }
          drag.multiInitial.forEach((initPos, tid) => {
            const newPos = snapToGrid(initPos.x + dx, initPos.y + dy);
            onMoveTokenRef.current(tid, newPos);
          });
        } else {
          const movingToken = tokensRef.current.find(t => t.id === drag.id);
          const tokenSizePx = (movingToken?.size || 1) * (configRef.current.gridSize || 50);
          const currentWalls = wallsRef.current || [];
          if (currentWalls.length > 0 && wallBlocksToken(snapped.x, snapped.y, tokenSizePx, currentWalls)) {
            return;
          }
          onMoveTokenRef.current(drag.id, snapped);
        }
      } else if (isPaintingFogRef.current && roleRef.current === 'gm') {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        paintFogAt(wp.x, wp.y);
      }
    };

    const onMouseUp = () => {
      if (isDragSelectingRef.current && selectionRectRef.current) {
        const rect = selectionRectRef.current;
        const x1 = Math.min(rect.x1, rect.x2);
        const y1 = Math.min(rect.y1, rect.y2);
        const x2 = Math.max(rect.x1, rect.x2);
        const y2 = Math.max(rect.y1, rect.y2);
        const minSize = 5 / viewportRef.current.scale;
        if (x2 - x1 > minSize || y2 - y1 > minSize) {
          const cfg = configRef.current;
          const CELL2 = cfg.gridSize || 50;
const found = tokensRef.current.filter(t => {
  if (roleRef.current === 'player' && !t.visible) return false;
  if (roleRef.current === 'player' && !(t.controlledByUserIds?.includes(userIdRef.current) ?? false)) return false;
  const ts = (t.size || 1) * CELL2;
  return t.position.x < x2 && t.position.x + ts > x1 &&
         t.position.y < y2 && t.position.y + ts > y1;
});
          if (found.length > 0) {
            onSelectTokensRef.current?.(found.map(t => t.id));
            onSelectTokenRef.current(found[0].id);
          }
        }
      }
      isDragSelectingRef.current = false;
      selectionRectRef.current = null;
      draggingTokenRef.current = null;
      resizingTokenRef.current = null;
      isPaintingFogRef.current = false;
      isPanningRef.current = false;
      lastPanRef.current = null;
      drawRef.current();
    };

    const onMouseLeave = () => {
      onMouseUp();
      if (brushOverlayRef.current) brushOverlayRef.current.style.display = 'none';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sp = getCanvasXY(e.clientX, e.clientY);
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const vp = viewportRef.current;
      const newScale = Math.max(0.2, Math.min(4, vp.scale * delta));
      const wx = (sp.x - vp.x) / vp.scale;
      const wy = (sp.y - vp.y) / vp.scale;
      viewportRef.current = { scale: newScale, x: sp.x - wx * newScale, y: sp.y - wy * newScale };
      onViewportChangeRef.current?.(viewportRef.current);
      drawRef.current();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Arrow key token movement
  useEffect(() => {
    if (activeTool !== 'wall-draw') {
      wallPointsRef.current = [];
      wallPreviewPosRef.current = null;
    }
    if (activeTool !== 'measure') {
      measureStartRef.current = null;
      measureEndRef.current = null;
      measureLockedRef.current = false;
    }
    drawRef.current();
  }, [activeTool]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeToolRef.current === 'measure') {
        measureStartRef.current = null;
        measureEndRef.current = null;
        measureLockedRef.current = false;
        drawRef.current();
        return;
      }
      if (e.key === 'Escape' && activeToolRef.current === 'wall-draw') {
        const pts = wallPointsRef.current;
        if (pts.length >= 2) {
          onWallAddedRef.current?.({ id: crypto.randomUUID(), points: [...pts] });
        }
        wallPointsRef.current = [];
        wallPreviewPosRef.current = null;
        drawRef.current();
        return;
      }
      const selId = selectedTokenIdRef.current;
      if (!selId) return;
      const token = tokensRef.current.find(t => t.id === selId);
      if (!token) return;
      const canMove = roleRef.current === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userIdRef.current));
      if (!canMove) return;
      const c = configRef.current.gridSize || 50;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -c;
      else if (e.key === 'ArrowRight') dx = c;
      else if (e.key === 'ArrowUp') dy = -c;
      else if (e.key === 'ArrowDown') dy = c;
      else return;
      e.preventDefault();
      const newX = token.position.x + dx;
      const newY = token.position.y + dy;
      const tokenSizePx = (token.size || 1) * c;
      const currentWalls = wallsRef.current || [];
      if (currentWalls.length > 0 && wallBlocksToken(newX, newY, tokenSizePx, currentWalls)) return;
      onMoveTokenRef.current(selId, { x: newX, y: newY });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';
  const isWallTool = activeTool === 'wall-draw';
  const isMeasureTool = activeTool === 'measure';

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/vtt-token-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    } else if (e.dataTransfer.types.includes('application/vtt-new-token')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.preventDefault();
    const sp = getCanvasXY(e.clientX, e.clientY);
    const wp = screenToWorld(sp.x, sp.y);
    const cfg = configRef.current;
    const CELL = cfg.gridSize || 50;
    const ox = ((cfg.gridOffsetX || 0) % CELL + CELL) % CELL;
    const oy = ((cfg.gridOffsetY || 0) % CELL + CELL) % CELL;
    const snapped = cfg.snapToGrid
      ? { x: Math.round((wp.x - ox) / CELL) * CELL + ox, y: Math.round((wp.y - oy) / CELL) * CELL + oy }
      : wp;

    const newTokenData = e.dataTransfer.getData('application/vtt-new-token');
    if (newTokenData && onAddTokenAtPosRef.current) {
      try {
        const tokenTemplate = JSON.parse(newTokenData) as Omit<VTTToken, 'id'>;
        onAddTokenAtPosRef.current(tokenTemplate, snapped);
      } catch {}
      return;
    }

    const tokenId = e.dataTransfer.getData('application/vtt-token-id');
    if (tokenId && onDropTokenRef.current) {
      onDropTokenRef.current(tokenId, snapped);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-gray-950"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: isFogTool ? 'none' : (isWallTool || isMeasureTool) ? 'crosshair' : 'default' }}
      />

      {isDragOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-amber-400/60 bg-amber-400/5 z-10 flex items-center justify-center">
          <div className="bg-gray-900/80 border border-amber-500/60 rounded-xl px-4 py-2 text-amber-300 text-sm font-medium shadow-xl">
            Déposer le token ici
          </div>
        </div>
      )}

      {mapLoading && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 bg-gray-950/60">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/icons/wmremove-transformed.png"
              alt="Chargement..."
              className="w-16 h-16 object-contain animate-spin opacity-80"
            />
            <span className="text-gray-400 text-sm">Chargement de la carte...</span>
          </div>
        </div>
      )}

      <div
        ref={brushOverlayRef}
        className="pointer-events-none fixed rounded-full border-2 -translate-x-1/2 -translate-y-1/2"
        style={{ display: 'none' }}
      />
    </div>
  );
});

VTTCanvas.displayName = 'VTTCanvas';
