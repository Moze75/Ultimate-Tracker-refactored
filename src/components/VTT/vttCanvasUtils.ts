import type { VTTWall, VTTDoor, VTTWindow, VTTRoomConfig } from '../../types/vtt';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export function clampViewport(
  vp: Viewport,
  cfg: Pick<VTTRoomConfig, 'clampToMap' | 'panMargin' | 'mapWidth' | 'mapHeight'>,
  canvasWidth: number,
  canvasHeight: number,
): Viewport {
  const hasMargin = cfg.panMargin !== undefined && cfg.panMargin !== null;
  if (!cfg.clampToMap && !hasMargin) return vp;

  const rawMapW = cfg.mapWidth ?? 3000;
  const rawMapH = cfg.mapHeight ?? 2000;

  let scale = vp.scale;

  if (cfg.clampToMap) {
    const minScale = Math.max(canvasWidth / rawMapW, canvasHeight / rawMapH);
    scale = Math.max(scale, minScale);
  } else if (hasMargin) {
    const margin = cfg.panMargin ?? 200;
    const minScaleX = (canvasWidth - 2 * margin) / rawMapW;
    const minScaleY = (canvasHeight - 2 * margin) / rawMapH;
    const minScale = Math.max(minScaleX, minScaleY);
    if (minScale > 0) scale = Math.max(scale, minScale);
  }

  const margin = cfg.clampToMap ? 0 : (cfg.panMargin ?? 200);
  const mapW = rawMapW * scale;
  const mapH = rawMapH * scale;

  const minX = canvasWidth - mapW - margin;
  const maxX = margin;
  const minY = canvasHeight - mapH - margin;
  const maxY = margin;

  return {
    scale,
    x: Math.min(maxX, Math.max(minX, vp.x)),
    y: Math.min(maxY, Math.max(minY, vp.y)),
  };
}

export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const d1x = bx - ax, d1y = by - ay;
  const d2x = dx - cx, d2y = dy - cy;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false;
  const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
  const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function getDoorT1T2(door: VTTDoor, segLen: number): { t1: number; t2: number; tCenter: number } {
  if (typeof door.t1 === 'number' && typeof door.t2 === 'number') {
    return { t1: door.t1, t2: door.t2, tCenter: (door.t1 + door.t2) / 2 };
  }
  const t = typeof door.t === 'number' ? door.t : 0.5;
  const hw = segLen > 0 ? (typeof door.width === 'number' ? door.width : 60) / 2 / segLen : 0.15;
  return { t1: Math.max(0.01, t - hw), t2: Math.min(0.99, t + hw), tCenter: t };
}

export function getWindowT1T2(win: VTTWindow, segLen: number): { t1: number; t2: number; tCenter: number } {
  if (typeof win.t1 === 'number' && typeof win.t2 === 'number') {
    return { t1: win.t1, t2: win.t2, tCenter: (win.t1 + win.t2) / 2 };
  }
  const t = typeof win.t === 'number' ? win.t : 0.5;
  const hw = segLen > 0 ? (typeof win.width === 'number' ? win.width : 60) / 2 / segLen : 0.15;
  return { t1: Math.max(0.01, t - hw), t2: Math.min(0.99, t + hw), tCenter: t };
}

function getSubSegmentsExcludingDoors(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  dx: number,
  dy: number,
  segLen: number,
  openDoors: VTTDoor[]
): [number, number, number, number][] {
  if (openDoors.length === 0) {
    return [[p1.x, p1.y, p2.x, p2.y]];
  }
  const gaps = openDoors.map(d => {
    const ext = getDoorT1T2(d, segLen);
    return { t1: ext.t1, t2: ext.t2 };
  });
  gaps.sort((a, b) => a.t1 - b.t1);
  const merged: { t1: number; t2: number }[] = [];
  for (const gap of gaps) {
    if (merged.length === 0 || gap.t1 > merged[merged.length - 1].t2) {
      merged.push({ ...gap });
    } else {
      merged[merged.length - 1].t2 = Math.max(merged[merged.length - 1].t2, gap.t2);
    }
  }
  const result: [number, number, number, number][] = [];
  let prevT = 0;
  for (const gap of merged) {
    if (gap.t1 > prevT + 0.001) {
      result.push([
        p1.x + dx * prevT, p1.y + dy * prevT,
        p1.x + dx * gap.t1, p1.y + dy * gap.t1,
      ]);
    }
    prevT = gap.t2;
  }
  if (prevT < 0.999) {
    result.push([p1.x + dx * prevT, p1.y + dy * prevT, p2.x, p2.y]);
  }
  return result;
}

export function wallBlocksToken(
  newX: number, newY: number, sizeInPx: number, walls: VTTWall[], doors: VTTDoor[] = [],
  oldX?: number, oldY?: number
): boolean {
  const half = sizeInPx / 2;
  const newCx = newX + half;
  const newCy = newY + half;

  const hasPrev = oldX !== undefined && oldY !== undefined;
  const oldCx = hasPrev ? (oldX! + half) : newCx;
  const oldCy = hasPrev ? (oldY! + half) : newCy;

  const moveDx = newCx - oldCx;
  const moveDy = newCy - oldCy;
  const isStationary = Math.abs(moveDx) < 0.5 && Math.abs(moveDy) < 0.5;

  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i], p2 = wall.points[i + 1];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      const openDoors = doors.filter(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      const subSegs = getSubSegmentsExcludingDoors(p1, p2, dx, dy, segLen, openDoors);

      for (const [sx1, sy1, sx2, sy2] of subSegs) {
        if (isStationary) {
          const SAMPLE_OFFSETS: [number, number][] = [
            [0, 0],
            [half * 0.7, 0], [-half * 0.7, 0],
            [0, half * 0.7], [0, -half * 0.7],
          ];
          let crossCount = 0;
          for (const [ox, oy] of SAMPLE_OFFSETS) {
            const rayEndX = newCx + ox + (sx2 - sx1) * 10000;
            const rayEndY = newCy + oy + (sy2 - sy1) * 10000;
            if (segmentsIntersect(sx1, sy1, sx2, sy2, newCx + ox, newCy + oy, rayEndX, rayEndY)) {
              crossCount++;
            }
          }
          if (crossCount > 0) return true;
        } else {
          if (segmentsIntersect(oldCx, oldCy, newCx, newCy, sx1, sy1, sx2, sy2)) return true;
          const perpLen = half * 0.8;
          const moveLen = Math.sqrt(moveDx * moveDx + moveDy * moveDy);
          if (moveLen > 0.5) {
            const perpX = (-moveDy / moveLen) * perpLen;
            const perpY = (moveDx / moveLen) * perpLen;
            if (segmentsIntersect(oldCx + perpX, oldCy + perpY, newCx + perpX, newCy + perpY, sx1, sy1, sx2, sy2)) return true;
            if (segmentsIntersect(oldCx - perpX, oldCy - perpY, newCx - perpX, newCy - perpY, sx1, sy1, sx2, sy2)) return true;
          }
        }
      }
    }
  }
  return false;
}

export function getEffectiveWallSegments(
  walls: VTTWall[],
  doors: VTTDoor[],
  windows: VTTWindow[] = []
): { x1: number; y1: number; x2: number; y2: number }[] {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i], p2 = wall.points[i + 1];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      const openDoors = doors.filter(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      const winsOnSeg = windows.filter(w => w.wallId === wall.id && w.segmentIndex === i);
      const gapsAsOpenDoors: VTTDoor[] = winsOnSeg.map(w => {
        const ext = getWindowT1T2(w, segLen);
        return { id: w.id, wallId: w.wallId, segmentIndex: w.segmentIndex, t1: ext.t1, t2: ext.t2, open: true };
      });
      const allGaps = [...openDoors, ...gapsAsOpenDoors];
      const subSegs = getSubSegmentsExcludingDoors(p1, p2, dx, dy, segLen, allGaps);
      for (const [x1, y1, x2, y2] of subSegs) {
        segs.push({ x1, y1, x2, y2 });
      }
    }
  }
  return segs;
}

export function pointInPolygon(x: number, y: number, poly: Float64Array): boolean {
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
