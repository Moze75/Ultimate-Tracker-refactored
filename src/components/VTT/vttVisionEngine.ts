import type { VTTToken, VTTWall } from '../../types/vtt';

interface VisionZone {
  cx: number;
  cy: number;
  brightRadiusPx: number;
  dimRadiusPx: number;
  brightReveal: number;
  dimReveal: number;
  respectWalls: boolean;
}

export function metersToPixels(meters: number, gridSizePx: number): number {
  return (meters / 1.5) * gridSizePx;
}

export interface VisionRadius {
  cx: number;
  cy: number;
  brightR: number;
  dimR: number;
}

export function getVisionRadii(token: VTTToken, gridSize: number): VisionRadius {
  const CELL = gridSize || 50;
  const size = (token.size || 1) * CELL;
  const cx = token.position.x + size / 2;
  const cy = token.position.y + size / 2;
  const visionMode = token.visionMode || 'none';
  const lightSource = token.lightSource || 'none';
  const visionRange = token.visionRange ?? 18;
  const lightRange = token.lightRange ?? 6;

  let brightR = 0;
  let dimR = 0;

  if (visionMode === 'normal') {
    brightR = Math.max(brightR, metersToPixels(3, CELL));
  } else if (visionMode === 'darkvision') {
    brightR = Math.max(brightR, metersToPixels(3, CELL));
    dimR = Math.max(dimR, metersToPixels(visionRange, CELL));
  }

  if (lightSource !== 'none') {
    let brightM = lightRange;
    let dimM = lightRange * 2;
    if (lightSource === 'torch') { brightM = 6; dimM = 12; }
    else if (lightSource === 'lantern') { brightM = 9; dimM = 18; }
    brightR = Math.max(brightR, metersToPixels(brightM, CELL));
    dimR = Math.max(dimR, metersToPixels(dimM, CELL));
  }

  return { cx, cy, brightR, dimR };
}


export function getVisionRadiiForDay(token: VTTToken, gridSize: number, mapW: number, mapH: number): VisionRadius {
  const CELL = gridSize || 50;
  const size = (token.size || 1) * CELL;
  const cx = token.position.x + size / 2;
  const cy = token.position.y + size / 2;
  const visionMode = token.visionMode || 'none';

  // Aucune vision = ne voit rien
  if (visionMode === 'none') {
    return { cx, cy, brightR: 0, dimR: 0 };
  }

  // De jour, normal et darkvision = vision infinie (bloquée par murs uniquement)
  const infiniteR = Math.max(mapW, mapH) * 1.5;
  return { cx, cy, brightR: infiniteR, dimR: 0 };
}

export function getVisionRadiiForDay(token: VTTToken, gridSize: number, mapW: number, mapH: number): VisionRadius {
  const CELL = gridSize || 50;
  const size = (token.size || 1) * CELL;
  const cx = token.position.x + size / 2;
  const cy = token.position.y + size / 2;
  const visionMode = token.visionMode || 'none';
  const lightSource = token.lightSource || 'none';

  // Pas de vision = pas de radii
  if (visionMode === 'none' && lightSource === 'none') {
    return { cx, cy, brightR: 0, dimR: 0 };
  }

  // De jour, vision normale ou darkvision = vision infinie (bloquée par les murs)
  const infiniteR = Math.max(mapW, mapH) * 1.5;

  if (visionMode === 'normal' || visionMode === 'darkvision') {
    return { cx, cy, brightR: infiniteR, dimR: 0 };
  }

  // Vision 'none' mais avec lumière → seule la lumière éclaire
  if (lightSource !== 'none') {
    const lightRange = token.lightRange ?? 6;
    let brightM = lightRange;
    let dimM = lightRange * 2;
    if (lightSource === 'torch') { brightM = 6; dimM = 12; }
    else if (lightSource === 'lantern') { brightM = 9; dimM = 18; }
    return { cx, cy, brightR: metersToPixels(brightM, CELL), dimR: metersToPixels(dimM, CELL) };
  }

  return { cx, cy, brightR: 0, dimR: 0 };
}

export function getWallSegments(walls: VTTWall[]): { x1: number; y1: number; x2: number; y2: number }[] {
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

export function buildVisibilityPolygon(
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

function drawPolyPath(ctx: CanvasRenderingContext2D, polygon: Float64Array) {
  ctx.beginPath();
  ctx.moveTo(polygon[0], polygon[1]);
  for (let i = 2; i < polygon.length; i += 2) {
    ctx.lineTo(polygon[i], polygon[i + 1]);
  }
  ctx.closePath();
}

let _flickerPhase = 0;
function getTorchFlicker(): number {
  _flickerPhase += 0.015 + Math.random() * 0.008;
  const base = Math.sin(_flickerPhase * 2.1) * Math.sin(_flickerPhase * 0.9);
  return 0.96 + 0.04 * base;
}

export function drawNightVisionOverlay(
  ctx: CanvasRenderingContext2D,
  mapW: number,
  mapH: number,
  tokens: VTTToken[],
  walls: VTTWall[],
  gridSize: number,
  _nightOpacity: number,
  nightColor: string
) {
  ctx.clearRect(0, 0, mapW, mapH);

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
      const reveal = token.visionBrightAlpha ?? 1.0;
      const visionFlicker = lightSource === 'torch' ? getTorchFlicker() : 1.0;
      zones.push({
        cx, cy,
        brightRadiusPx: metersToPixels(3, CELL) * visionFlicker,
        dimRadiusPx: 0,
        brightReveal: reveal,
        dimReveal: 0,
        respectWalls: true,
      });
    } else if (visionMode === 'darkvision') {
      const brightReveal = token.visionBrightAlpha ?? 1.0;
      const dimReveal = token.visionDimAlpha ?? 0.85;
      zones.push({
        cx, cy,
        brightRadiusPx: metersToPixels(3, CELL),
        dimRadiusPx: metersToPixels(visionRange, CELL),
        brightReveal,
        dimReveal,
        respectWalls: true,
      });
    }

    if (lightSource !== 'none') {
      let brightM = lightRange;
      let dimM = lightRange * 2;
      if (lightSource === 'torch') { brightM = 6; dimM = 12; }
      else if (lightSource === 'lantern') { brightM = 9; dimM = 18; }

      const flicker = lightSource === 'torch' ? getTorchFlicker() : 1.0;
      const lBrightReveal = token.lightBrightAlpha ?? 1.0;
      const lDimReveal = token.lightDimAlpha ?? 0.85;

      zones.push({
        cx, cy,
        brightRadiusPx: metersToPixels(brightM, CELL) * flicker,
        dimRadiusPx: metersToPixels(dimM, CELL) * flicker,
        brightReveal: lBrightReveal,
        dimReveal: lDimReveal,
        respectWalls: true,
      });
    }
  }

  if (zones.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, mapW, mapH);
    return;
  }

  const polyCache = new Map<string, Float64Array>();

  function getPolygon(zone: VisionZone): Float64Array | null {
    if (!zone.respectWalls || wallSegs.length === 0) return null;
    const maxR = Math.max(zone.brightRadiusPx, zone.dimRadiusPx);
    const key = `${zone.cx},${zone.cy},${Math.round(maxR)}`;
    if (polyCache.has(key)) return polyCache.get(key)!;
    const poly = buildVisibilityPolygon(zone.cx, zone.cy, maxR, wallSegs, mapW, mapH);
    polyCache.set(key, poly);
    return poly;
  }

  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, mapW, mapH);

  ctx.globalCompositeOperation = 'destination-out';

  for (const zone of zones) {
    const poly = getPolygon(zone);
    const maxR = Math.max(zone.brightRadiusPx, zone.dimRadiusPx || zone.brightRadiusPx);

    ctx.save();

    if (poly && poly.length >= 6) {
      drawPolyPath(ctx, poly);
      ctx.clip();
    }

    if (zone.dimRadiusPx > 0 && zone.dimRadiusPx > zone.brightRadiusPx) {
      ctx.fillStyle = `rgba(255,255,255,${zone.dimReveal})`;
      ctx.beginPath();
      ctx.arc(zone.cx, zone.cy, zone.dimRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    if (zone.brightRadiusPx > 0) {
      ctx.fillStyle = `rgba(255,255,255,${zone.brightReveal})`;
      ctx.beginPath();
      ctx.arc(zone.cx, zone.cy, zone.brightRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';

  for (const zone of zones) {
    if (zone.dimRadiusPx <= 0 || zone.dimRadiusPx <= zone.brightRadiusPx) continue;
    const poly = getPolygon(zone);

    ctx.save();
    if (poly && poly.length >= 6) {
      drawPolyPath(ctx, poly);
      ctx.clip();
    }

    const edgeFade = Math.max(zone.dimRadiusPx * 0.05, 4);
    const grad = ctx.createRadialGradient(
      zone.cx, zone.cy, zone.dimRadiusPx - edgeFade,
      zone.cx, zone.cy, zone.dimRadiusPx + edgeFade
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.cx, zone.cy, zone.dimRadiusPx + edgeFade + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  for (const zone of zones) {
    if (zone.brightRadiusPx <= 0 || zone.dimRadiusPx <= zone.brightRadiusPx) continue;

    ctx.save();
    const poly = getPolygon(zone);
    if (poly && poly.length >= 6) {
      drawPolyPath(ctx, poly);
      ctx.clip();
    }

    // Transition douce de bright vers dim sans gap noir
    // On ajoute du noir proportionnel à (1-dimReveal) entre bright et bright+fade
    const fadeWidth = Math.max((zone.dimRadiusPx - zone.brightRadiusPx) * 0.15, 4);
    const grad = ctx.createRadialGradient(
      zone.cx, zone.cy, zone.brightRadiusPx,
      zone.cx, zone.cy, zone.brightRadiusPx + fadeWidth
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(0,0,0,${1 - zone.dimReveal})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(zone.cx, zone.cy, zone.brightRadiusPx + fadeWidth + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Teinte de nuit supprimée ici : elle colorait le brouillard opaque en orange/bleu.
  // La teinte d'ambiance est gérée par le filtre heure dans VTTCanvas.
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
