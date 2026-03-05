import type { VTTWall } from '../../types/vtt';

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

export function wallBlocksToken(
  newX: number, newY: number, sizeInPx: number, walls: VTTWall[]
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
      for (const [ex1, ey1, ex2, ey2] of boxEdges) {
        if (segmentsIntersect(p1.x, p1.y, p2.x, p2.y, ex1, ey1, ex2, ey2)) return true;
      }
    }
  }
  return false;
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