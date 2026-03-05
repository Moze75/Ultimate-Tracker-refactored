import type { VTTToken, VTTWall } from '../../types/vtt';
import { getVisionRadii, buildVisibilityPolygon } from './vttVisionEngine';

export function punchVisionHoles(
  fctx: CanvasRenderingContext2D,
  visionTokens: VTTToken[],
  gridSize: number,
  walls: VTTWall[],
  mapW: number,
  mapH: number,
  isDay: boolean = false
): void {
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
    const hasDayVision = visionMode === 'normal' || visionMode === 'darkvision';
    const infiniteR = Math.max(mapW, mapH) * 1.5;

    const radii = isDay
      ? (hasDayVision
          ? { ...baseRadii, brightR: infiniteR, dimR: 0 }
          : { ...baseRadii, brightR: 0, dimR: 0 })
      : baseRadii;

    const maxR = Math.max(radii.brightR, radii.dimR);
    if (maxR <= 0) continue;

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