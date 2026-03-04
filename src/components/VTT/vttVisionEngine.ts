import type { VTTToken, VTTWall } from '../../types/vtt';

interface VisionSource {
  cx: number;
  cy: number;
  brightRadiusPx: number;
  dimRadiusPx: number;
  brightAlpha: number;
  dimAlpha: number;
  isProximity: boolean;
}

function metersToPixels(meters: number, gridSizePx: number): number {
  return (meters / 1.5) * gridSizePx;
}

function rayIntersectsWall(
  ox: number, oy: number,
  dx: number, dy: number,
  walls: VTTWall[]
): number {
  let minT = 1;
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i], p2 = wall.points[i + 1];
      const wx = p2.x - p1.x, wy = p2.y - p1.y;
      const denom = dx * wy - dy * wx;
      if (Math.abs(denom) < 1e-10) continue;
      const t = ((p1.x - ox) * wy - (p1.y - oy) * wx) / denom;
      const u = ((p1.x - ox) * dy - (p1.y - oy) * dx) / denom;
      if (t >= 0 && t < minT && u >= 0 && u <= 1) {
        minT = t;
      }
    }
  }
  return minT;
}

function buildVisibilityPolygon(
  cx: number, cy: number,
  maxRadius: number,
  walls: VTTWall[],
  mapW: number, mapH: number
): { x: number; y: number }[] {
  const endpoints: { angle: number; x: number; y: number }[] = [];

  const corners = [
    { x: 0, y: 0 },
    { x: mapW, y: 0 },
    { x: mapW, y: mapH },
    { x: 0, y: mapH },
  ];
  for (const c of corners) {
    endpoints.push({ angle: Math.atan2(c.y - cy, c.x - cx), x: c.x, y: c.y });
  }

  for (const wall of walls) {
    for (const pt of wall.points) {
      const dx = pt.x - cx, dy = pt.y - cy;
      if (dx * dx + dy * dy > (maxRadius + 50) * (maxRadius + 50)) continue;
      endpoints.push({ angle: Math.atan2(dy, dx), x: pt.x, y: pt.y });
    }
  }

  const angles: number[] = [];
  const TINY = 0.0001;
  for (const ep of endpoints) {
    angles.push(ep.angle - TINY, ep.angle, ep.angle + TINY);
  }
  const step = Math.PI / 36;
  for (let a = -Math.PI; a < Math.PI; a += step) {
    angles.push(a);
  }

  angles.sort((a, b) => a - b);

  const polygon: { x: number; y: number }[] = [];
  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const t = rayIntersectsWall(cx, cy, dx * maxRadius, dy * maxRadius, walls);
    polygon.push({
      x: cx + dx * maxRadius * t,
      y: cy + dy * maxRadius * t,
    });
  }

  return polygon;
}

export function drawVisionOverlay(
  overlayCtx: CanvasRenderingContext2D,
  mapW: number,
  mapH: number,
  tokens: VTTToken[],
  walls: VTTWall[],
  gridSize: number,
  nightOpacity: number,
  nightColor: string,
  isGM: boolean
) {
  overlayCtx.clearRect(0, 0, mapW, mapH);

  const fillColor = nightColor.replace('ALPHA', String(nightOpacity));
  overlayCtx.fillStyle = fillColor;
  overlayCtx.fillRect(0, 0, mapW, mapH);

  if (isGM) return;

  const CELL = gridSize || 50;
  const sources: VisionSource[] = [];

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
      sources.push({
        cx, cy,
        brightRadiusPx: metersToPixels(3, CELL),
        dimRadiusPx: metersToPixels(3, CELL),
        brightAlpha: 0.3,
        dimAlpha: 0.3,
        isProximity: true,
      });
    } else if (visionMode === 'darkvision') {
      sources.push({
        cx, cy,
        brightRadiusPx: metersToPixels(3, CELL),
        dimRadiusPx: metersToPixels(visionRange, CELL),
        brightAlpha: 1.0,
        dimAlpha: 0.65,
        isProximity: false,
      });
    }

    if (lightSource !== 'none') {
      let brightM = lightRange;
      let dimM = lightRange * 2;
      if (lightSource === 'torch') { brightM = 6; dimM = 12; }
      else if (lightSource === 'lantern') { brightM = 9; dimM = 18; }
      sources.push({
        cx, cy,
        brightRadiusPx: metersToPixels(brightM, CELL),
        dimRadiusPx: metersToPixels(dimM, CELL),
        brightAlpha: 1.0,
        dimAlpha: 0.65,
        isProximity: false,
      });
    }
  }

  if (sources.length === 0) return;

  const hasWalls = walls.length > 0;

  overlayCtx.save();
  overlayCtx.globalCompositeOperation = 'destination-out';

  for (const src of sources) {
    const maxR = Math.max(src.brightRadiusPx, src.dimRadiusPx);

    if (hasWalls && !src.isProximity) {
      const poly = buildVisibilityPolygon(src.cx, src.cy, maxR, walls, mapW, mapH);
      if (poly.length < 3) continue;

      overlayCtx.save();
      overlayCtx.beginPath();
      overlayCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        overlayCtx.lineTo(poly[i].x, poly[i].y);
      }
      overlayCtx.closePath();
      overlayCtx.clip();

      if (src.brightRadiusPx < src.dimRadiusPx) {
        const grad = overlayCtx.createRadialGradient(
          src.cx, src.cy, 0,
          src.cx, src.cy, src.dimRadiusPx
        );
        grad.addColorStop(0, `rgba(0,0,0,${src.brightAlpha})`);
        grad.addColorStop(src.brightRadiusPx / src.dimRadiusPx, `rgba(0,0,0,${src.brightAlpha})`);
        grad.addColorStop(1, `rgba(0,0,0,${src.dimAlpha})`);
        overlayCtx.fillStyle = grad;
      } else {
        overlayCtx.fillStyle = `rgba(0,0,0,${src.brightAlpha})`;
      }
      overlayCtx.beginPath();
      overlayCtx.arc(src.cx, src.cy, src.dimRadiusPx, 0, Math.PI * 2);
      overlayCtx.fill();
      overlayCtx.restore();
    } else {
      if (src.brightRadiusPx < src.dimRadiusPx) {
        const grad = overlayCtx.createRadialGradient(
          src.cx, src.cy, 0,
          src.cx, src.cy, src.dimRadiusPx
        );
        grad.addColorStop(0, `rgba(0,0,0,${src.brightAlpha})`);
        grad.addColorStop(src.brightRadiusPx / src.dimRadiusPx, `rgba(0,0,0,${src.brightAlpha})`);
        grad.addColorStop(1, `rgba(0,0,0,${src.dimAlpha})`);
        overlayCtx.fillStyle = grad;
      } else {
        overlayCtx.fillStyle = `rgba(0,0,0,${src.brightAlpha})`;
      }
      overlayCtx.beginPath();
      overlayCtx.arc(src.cx, src.cy, maxR, 0, Math.PI * 2);
      overlayCtx.fill();
    }
  }

  overlayCtx.restore();
}
