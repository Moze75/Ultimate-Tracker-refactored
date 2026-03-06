import type { VTTToken } from '../../types/vtt';

export interface DrawTokenOptions {
  ctx: CanvasRenderingContext2D;
  token: VTTToken;
  CELL: number;
  scale: number;
  vpX: number;   // viewport offset X (vp.x)
  vpY: number;   // viewport offset Y (vp.y)
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
  vpX,
  vpY,
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
      const ZOOM = token.imageZoom ?? 1.8;
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

    ctx.restore(); // fin du bloc surcouches monde

  // --- Barre HP + Nom : dessin en coordonnées ÉCRAN proportionnel au token ---
  const screenCX = cx * scale + vpX;
  const screenCY = cy * scale + vpY;
  const screenR  = r * scale;  // rayon du token en px écran

  const hasHp    = token.maxHp != null && token.maxHp > 0 && token.hp != null;
  const hasLabel = !!token.showLabel;

  if (hasHp || hasLabel) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset → coordonnées écran pures

    // Dimensions proportionnelles au token (screenR), avec plancher/plafond
    const BAR_W  = Math.max(16, Math.min(screenR * 1.4, 80));  // 70% du diamètre, entre 16 et 80px
    const BAR_H  = Math.max(3,  Math.min(screenR * 0.10, 8));  // 10% du rayon, entre 3 et 8px
    const GAP    = Math.max(3,  screenR * 0.08);               // espace token → barre

    // ── Barre HP ──────────────────────────────────────────────────────────────
    if (hasHp) {
      const barScreenY = screenCY + screenR + GAP;
      const pct = Math.max(0, Math.min(1, token.hp! / token.maxHp!));
      const hpColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
      // fond
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      ctx.beginPath();
      ctx.roundRect(screenCX - BAR_W / 2, barScreenY, BAR_W, BAR_H, BAR_H / 2);
      ctx.fill();
      // remplissage
      if (pct > 0) {
        ctx.fillStyle = hpColor;
        ctx.beginPath();
        ctx.roundRect(screenCX - BAR_W / 2, barScreenY, BAR_W * pct, BAR_H, BAR_H / 2);
        ctx.fill();
      }
    }

    // ── Nom du token ──────────────────────────────────────────────────────────
    if (hasLabel) {
      const FONT_PX  = Math.max(9, Math.min(screenR * 0.22, 14)); // entre 9 et 14px
      const PAD      = Math.max(2, screenR * 0.07);
      const labelOffY = hasHp
        ? screenR + GAP + BAR_H + Math.max(2, GAP * 0.5)
        : screenR + GAP;
      const labelScreenY = screenCY + labelOffY;
      ctx.font = `bold ${FONT_PX}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(token.label).width + PAD * 2;
      const th = FONT_PX + PAD * 2;
      // fond arrondi
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath();
      ctx.roundRect(screenCX - tw / 2, labelScreenY, tw, th, th / 3);
      ctx.fill();
      // texte
      ctx.fillStyle = 'white';
      ctx.fillText(token.label, screenCX, labelScreenY + PAD);
    }

    ctx.restore();
  }
}