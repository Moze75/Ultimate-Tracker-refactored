import type { VTTWall, VTTDoor } from '../../types/vtt';

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
  newX: number, newY: number, sizeInPx: number, walls: VTTWall[], doors: VTTDoor[] = []
): boolean {
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
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      const openDoors = doors.filter(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      const subSegs = getSubSegmentsExcludingDoors(p1, p2, dx, dy, segLen, openDoors);
      for (const [sx1, sy1, sx2, sy2] of subSegs) {
        for (const [ex1, ey1, ex2, ey2] of boxEdges) {
          if (segmentsIntersect(sx1, sy1, sx2, sy2, ex1, ey1, ex2, ey2)) return true;
        }
      }
    }
  }
  return false;
}

export function getEffectiveWallSegments(
  walls: VTTWall[],
  doors: VTTDoor[]
): { x1: number; y1: number; x2: number; y2: number }[] {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const wall of walls) {
    for (let i = 0; i < wall.points.length - 1; i++) {
      const p1 = wall.points[i], p2 = wall.points[i + 1];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen < 1) continue;
      const openDoors = doors.filter(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      const subSegs = getSubSegmentsExcludingDoors(p1, p2, dx, dy, segLen, openDoors);
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
