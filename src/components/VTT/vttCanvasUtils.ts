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

function isPointOnDoorGap(
  wallId: string,
  segIdx: number,
  segT: number,
  doors: VTTDoor[]
): boolean {
  for (const door of doors) {
    if (!door.open) continue;
    if (door.wallId !== wallId || door.segmentIndex !== segIdx) continue;
    const hw = 0.5;
    if (segT >= door.t - hw && segT <= door.t + hw) return true;
  }
  return false;
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
      // Check if an open door covers this segment entirely (skip it)
      const openDoorOnSeg = doors.some(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      if (openDoorOnSeg) continue;
      for (const [ex1, ey1, ex2, ey2] of boxEdges) {
        if (segmentsIntersect(p1.x, p1.y, p2.x, p2.y, ex1, ey1, ex2, ey2)) return true;
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
      const openDoor = doors.find(d => d.open && d.wallId === wall.id && d.segmentIndex === i);
      if (openDoor) {
        // Split segment around the door gap
        const p1 = wall.points[i], p2 = wall.points[i + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        if (segLen < 1) continue;
        const doorHalfT = (openDoor.width / 2) / segLen;
        const t1 = Math.max(0, openDoor.t - doorHalfT);
        const t2 = Math.min(1, openDoor.t + doorHalfT);
        if (t1 > 0.01) {
          segs.push({ x1: p1.x, y1: p1.y, x2: p1.x + dx * t1, y2: p1.y + dy * t1 });
        }
        if (t2 < 0.99) {
          segs.push({ x1: p1.x + dx * t2, y1: p1.y + dy * t2, x2: p2.x, y2: p2.y });
        }
      } else {
        segs.push({ x1: wall.points[i].x, y1: wall.points[i].y, x2: wall.points[i + 1].x, y2: wall.points[i + 1].y });
      }
    }
  }
  return segs;
}

// suppress unused warning
void isPointOnDoorGap;

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