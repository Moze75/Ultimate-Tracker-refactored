import type { VTTFogStroke } from '../../types/vtt';

export function buildFogCanvas(
  strokes: VTTFogStroke[],
  mapW: number,
  mapH: number,
  fogCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
  fogCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>
): void {
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
}

export function applyStrokeToFogCanvas(
  stroke: VTTFogStroke,
  fogCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
): void {
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
}