import type { VTTToken } from '../../types/vtt';

export interface DrawTokenOptions {
  ctx: CanvasRenderingContext2D;
  token: VTTToken;
  CELL: number;
  scale: number;
  currentSelectedId: string | null;
  multiIds: string[];
  curUserId: string;
  tokenImageCache: Map<string, HTMLImageElement>;
  onImageLoad: () => void;
}

export function drawToken({
  ctx,
  token,
  CELL,
  scale,
  currentSelectedId,
  multiIds,
  curUserId,
  tokenImageCache,
  onImageLoad,
}: DrawTokenOptions): void {
  const px = token.position.x;
  const py = token.position.y;
  const size = (token.size || 1) * CELL;
  const cx = px + size / 2;
  const cy = py + size / 2;
  const r = size / 2 - 4;

  // --- Dessin image / couleur ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((token.rotation || 0) * Math.PI / 180);

  if (token.imageUrl) {
    let img = tokenImageCache.get(token.imageUrl);
    if (!img) {
      img = new Image();
      img.onload = onImageLoad;
      img.src = token.imageUrl;
      tokenImageCache.set(token.imageUrl, img);
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
      if (aspect >= 1) { dw = side; dh = side / aspect; }
      else { dw = side * aspect; dh = side; }
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

  // --- Surcouches (sélection, bordure, HP) ---
  ctx.save();
  ctx.translate(cx, cy);

  if (multiIds.length > 1 && multiIds.includes(token.id) && token.id !== currentSelectedId) {
    const pad = 4 / scale;
    ctx.strokeStyle = 'rgba(99,179,237,0.9)';
    ctx.lineWidth = 2 / scale;
    ctx.setLineDash([4 / scale, 3 / scale]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
    ctx.setLineDash([]);
  }

  if (token.id === currentSelectedId) {
    const pad = 5 / scale;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.5 / scale;
    ctx.setLineDash([6 / scale, 3 / scale]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
    ctx.setLineDash([]);
    const hx = size / 2 + pad;
    const hy = size / 2 + pad;
    const hr = 7 / scale;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1.5 / scale;
    ctx.stroke();
  }

  const controlled = token.controlledByUserIds?.includes(curUserId);
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.strokeStyle = controlled ? '#22c55e' : '#94a3b8';
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  if (!token.imageUrl) {
    ctx.fillStyle = 'white';
    ctx.font = `bold ${Math.max(10, size * 0.25) / scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(token.label?.slice(0, 2) || '?', 0, 0);
  }

  if (token.maxHp != null && token.maxHp > 0 && token.hp != null) {
    const barW = r * 1.6;
    const barH = Math.max(4, size * 0.07) / scale;
    const barY = r + 6 / scale;
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
}