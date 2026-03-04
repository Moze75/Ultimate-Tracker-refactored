import type { VTTToken, VTTWall } from '../../types/vtt';

interface VisionZone {
  cx: number;
  cy: number;
  innerRadiusPx: number;
  outerRadiusPx: number;
  innerEraseAlpha: number;
  outerEraseAlpha: number;
  respectWalls: boolean;
}

function metersToPixels(meters: number, gridSizePx: number): number {
  return (meters / 1.5) * gridSizePx;
}

function getWallSegments(walls: VTTWall[]): { x1: number; y1: number; x2: number; y2: number }[] {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      segs.push({
        x1: wall.points[i].x, y1: wall.points[i].y,
        x2: wall.points[i + 1].x, y2: wall.points[i + 1].y,
      });
    }
  }
  return segs;
}

function castRay(
  ox: number, oy: number,
  angle: number,
  maxDist: number,
  segments: { x1: number; y1: number; x2: number; y2: number }[]
): number {
  const rdx = Math.cos(angle);
  const rdy = Math.sin(angle);
  let closest = maxDist;

  for (const seg of segments) {
    const sx = seg.x2 - seg.x1;
    const sy = seg.y2 - seg.y1;
    const denom = rdx * sy - rdy * sx;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((seg.x1 - ox) * sy - (seg.y1 - oy) * sx) / denom;
    const u = ((seg.x1 - ox) * rdy - (seg.y1 - oy) * rdx) / denom;
    if (t > 0.5 && t < closest && u >= 0 && u <= 1) {
      closest = t;
    }
  }
  return closest;
}

function buildVisibilityPolygon(
  cx: number, cy: number,
  maxRadius: number,
  segments: { x1: number; y1: number; x2: number; y2: number }[],
  mapW: number, mapH: number
): Float64Array {
  const relevant: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const pad = maxRadius + 40;
  for (const s of segments) {
    const minX = Math.min(s.x1, s.x2);
    const maxX = Math.max(s.x1, s.x2);
    const minY = Math.min(s.y1, s.y2);
    const maxY = Math.max(s.y1, s.y2);
    if (maxX < cx - pad || minX > cx + pad || maxY < cy - pad || minY > cy + pad) continue;
    relevant.push(s);
  }

  const mapSegs: { x1: number; y1: number; x2: number; y2: number }[] = [
    { x1: 0, y1: 0, x2: mapW, y2: 0 },
    { x1: mapW, y1: 0, x2: mapW, y2: mapH },
    { x1: mapW, y1: mapH, x2: 0, y2: mapH },
    { x1: 0, y1: mapH, x2: 0, y2: 0 },
  ];
  const allSegs = [...relevant, ...mapSegs];

  const angles: number[] = [];
  const TINY = 0.00005;

  for (const s of relevant) {
    for (const pt of [{ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }]) {
      const a = Math.atan2(pt.y - cy, pt.x - cx);
      angles.push(a - TINY, a, a + TINY);
    }
  }

  const corners = [
    { x: 0, y: 0 }, { x: mapW, y: 0 },
    { x: mapW, y: mapH }, { x: 0, y: mapH },
  ];
  for (const c of corners) {
    const a = Math.atan2(c.y - cy, c.x - cx);
    angles.push(a - TINY, a, a + TINY);
  }

  const RAY_STEP = Math.PI / 60;
  for (let a = -Math.PI; a < Math.PI; a += RAY_STEP) {
    angles.push(a);
  }

  angles.sort((a, b) => a - b);

  const result = new Float64Array(angles.length * 2);
  for (let i = 0; i < angles.length; i++) {
    const dist = castRay(cx, cy, angles[i], maxRadius, allSegs);
    result[i * 2] = cx + Math.cos(angles[i]) * dist;
    result[i * 2 + 1] = cy + Math.sin(angles[i]) * dist;
  }
  return result;
}

function clipAndDrawZone(
  ctx: CanvasRenderingContext2D,
  zone: VisionZone,
  polygon: Float64Array | null
) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  if (polygon && polygon.length >= 6) {
    ctx.beginPath();
    ctx.moveTo(polygon[0], polygon[1]);
    for (let i = 2; i < polygon.length; i += 2) {
      ctx.lineTo(polygon[i], polygon[i + 1]);
    }
    ctx.closePath();
    ctx.clip();
  }

  const outerR = Math.max(zone.outerRadiusPx, zone.innerRadiusPx);

  if (zone.innerRadiusPx > 0 && zone.innerRadiusPx < outerR) {
    const grad = ctx.createRadialGradient(
      zone.cx, zone.cy, 0,
      zone.cx, zone.cy, outerR
    );
    const ratio = zone.innerRadiusPx / outerR;
    grad.addColorStop(0, `rgba(0,0,0,${zone.innerEraseAlpha})`);
    grad.addColorStop(Math.max(0, ratio - 0.02), `rgba(0,0,0,${zone.innerEraseAlpha})`);
    grad.addColorStop(ratio, `rgba(0,0,0,${zone.outerEraseAlpha})`);
    grad.addColorStop(Math.min(1, 0.95), `rgba(0,0,0,${zone.outerEraseAlpha})`);
    grad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(
      zone.cx, zone.cy, 0,
      zone.cx, zone.cy, outerR
    );
    grad.addColorStop(0, `rgba(0,0,0,${zone.innerEraseAlpha})`);
    grad.addColorStop(0.80, `rgba(0,0,0,${zone.innerEraseAlpha})`);
    grad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = grad;
  }

  ctx.beginPath();
  ctx.arc(zone.cx, zone.cy, outerR + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let _flickerPhase = 0;
function getTorchFlicker(): number {
  _flickerPhase += 0.07 + Math.random() * 0.04;
  return 0.92 + 0.08 * Math.sin(_flickerPhase * 2.3) * Math.sin(_flickerPhase * 1.1);
}

export function drawNightVisionOverlay(
  overlayCtx: CanvasRenderingContext2D,
  mapW: number,
  mapH: number,
  tokens: VTTToken[],
  walls: VTTWall[],
  gridSize: number,
  _nightOpacity: number,
  nightColor: string
) {
  overlayCtx.clearRect(0, 0, mapW, mapH);

  const baseRgb = nightColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const r = baseRgb ? baseRgb[1] : '0';
  const g = baseRgb ? baseRgb[2] : '0';
  const b = baseRgb ? baseRgb[3] : '0';
  overlayCtx.fillStyle = `rgba(${r},${g},${b},1)`;
  overlayCtx.fillRect(0, 0, mapW, mapH);

  const CELL = gridSize || 50;
  const wallSegs = getWallSegments(walls);
  const zones: VisionZone[] = [];

  for (const token of tokens) {
    if (!token.visible) continue;
    const size = (token.size || 1) * CELL;
    const cx = token.position.x + size / 2;
    const cy = token.position.y + size / 2;
    const visionMode = token.visionMode || 'none';
    const lightSource = token.lightSource || 'none';
    const visionRange = token.visionRange ?? 18;
    const lightRange = token.lightRange ?? 6;

    if (visionMode === 'normal') {
      const brightAlpha = token.visionBrightAlpha ?? 1.0;
      zones.push({
        cx, cy,
        innerRadiusPx: 0,
        outerRadiusPx: metersToPixels(3, CELL),
        innerEraseAlpha: brightAlpha,
        outerEraseAlpha: brightAlpha,
        respectWalls: false,
      });
    } else if (visionMode === 'darkvision') {
      const brightAlpha = token.visionBrightAlpha ?? 1.0;
      const dimAlpha = token.visionDimAlpha ?? 0.70;
      zones.push({
        cx, cy,
        innerRadiusPx: metersToPixels(3, CELL),
        outerRadiusPx: metersToPixels(visionRange, CELL),
        innerEraseAlpha: brightAlpha,
        outerEraseAlpha: dimAlpha,
        respectWalls: true,
      });
    }

    if (lightSource !== 'none') {
      let brightM = lightRange;
      let dimM = lightRange * 2;
      if (lightSource === 'torch') { brightM = 6; dimM = 12; }
      else if (lightSource === 'lantern') { brightM = 9; dimM = 18; }

      const flicker = lightSource === 'torch' ? getTorchFlicker() : 1.0;
      const lBrightAlpha = token.lightBrightAlpha ?? 1.0;
      const lDimAlpha = token.lightDimAlpha ?? 0.70;

      zones.push({
        cx, cy,
        innerRadiusPx: metersToPixels(brightM, CELL) * flicker,
        outerRadiusPx: metersToPixels(dimM, CELL) * flicker,
        innerEraseAlpha: lBrightAlpha,
        outerEraseAlpha: lDimAlpha,
        respectWalls: true,
      });
    }
  }

  if (zones.length === 0) return;

  const polyCache = new Map<string, Float64Array>();

  for (const zone of zones) {
    let poly: Float64Array | null = null;
    if (zone.respectWalls && wallSegs.length > 0) {
      const maxR = Math.max(zone.innerRadiusPx, zone.outerRadiusPx);
      const key = `${zone.cx},${zone.cy},${Math.round(maxR)}`;
      if (polyCache.has(key)) {
        poly = polyCache.get(key)!;
      } else {
        poly = buildVisibilityPolygon(zone.cx, zone.cy, maxR, wallSegs, mapW, mapH);
        polyCache.set(key, poly);
      }
    }
    clipAndDrawZone(overlayCtx, zone, poly);
  }
}

export function drawDayVisionOverlay(
  ctx: CanvasRenderingContext2D,
  mapW: number,
  mapH: number,
  tokens: VTTToken[],
  walls: VTTWall[],
  gridSize: number
) {
  if (walls.length === 0) return;

  const wallSegs = getWallSegments(walls);
  const CELL = gridSize || 50;

  const visionTokens = tokens.filter(
    t => t.visible && t.controlledByUserIds && t.controlledByUserIds.length > 0
  );
  if (visionTokens.length === 0) return;

  ctx.clearRect(0, 0, mapW, mapH);
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, mapW, mapH);

  ctx.globalCompositeOperation = 'destination-out';
  for (const token of visionTokens) {
    const size = (token.size || 1) * CELL;
    const cx = token.position.x + size / 2;
    const cy = token.position.y + size / 2;
    const maxR = Math.max(mapW, mapH) * 1.5;

    const poly = buildVisibilityPolygon(cx, cy, maxR, wallSegs, mapW, mapH);
    if (poly.length < 6) continue;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) {
      ctx.lineTo(poly[i], poly[i + 1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';
}
