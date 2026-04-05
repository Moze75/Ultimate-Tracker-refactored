import type { VTTToken } from '../../types/vtt';

// -------------------
// Registre des shakes (tokenId → timestamp du hit)
// Durée : 400ms, décroissance sinusoïdale
// -------------------
const SHAKE_DURATION_MS = 400;
const shakeRegistry = new Map<string, number>();

export function triggerTokenShake(tokenId: string): void {
  shakeRegistry.set(tokenId, performance.now());
}

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
  // -------------------
  // Timestamp animé pour le ciblage pulsant
  // -------------------
  // Passé depuis la boucle de rendu du canvas (requestAnimationFrame)
  // pour animer l'anneau de ciblage sans état React.
  animTime?: number;
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
  animTime = 0,
}: DrawTokenOptions): void {
  const px = token.position.x;
  const py = token.position.y;
  const size = (token.size || 1) * CELL;
  const cx = px + size / 2;
  const cy = py + size / 2;
  const r = size / 2 - 4;

  // --- Calcul offset shake ---
  let shakeOffsetX = 0;
  const shakeStart = shakeRegistry.get(token.id);
  if (shakeStart !== undefined) {
    const elapsed = performance.now() - shakeStart;
    if (elapsed < SHAKE_DURATION_MS) {
      const t = elapsed / SHAKE_DURATION_MS;
      const decay = 1 - t;           // décroissance linéaire
      const freq = 28;               // fréquence des oscillations
      shakeOffsetX = Math.sin(t * freq) * decay * size * 0.10;
    } else {
      shakeRegistry.delete(token.id);
    }
  }

  // --- Dessin image / couleur ---
  ctx.save();
  ctx.translate(cx + shakeOffsetX, cy);
  ctx.rotate((token.rotation || 0) * Math.PI / 180);  ctx.rotate((token.rotation || 0) * Math.PI / 180);

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
  ctx.translate(cx + shakeOffsetX, cy);

  if (multiIds.length > 1 && multiIds.includes(token.id) && token.id !== currentSelectedId) {
    const pad = 4 / scale;
    ctx.strokeStyle = 'rgba(99,179,237,0.9)';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
  }

  // -------------------
  // Gestion du resize des tokens
  // -------------------
  // Le contour de selection reste visible,
  // mais le point de redimensionnement est masque.
  if (token.id === currentSelectedId) {
    const pad = 5 / scale;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5 / scale;
    ctx.setLineDash([]);
    ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
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

  // --- Barre HP EN HAUT du token ---
  if (token.maxHp != null && token.maxHp > 0 && token.hp != null) {
    const BAR_W = CELL * 0.8;
    const BAR_H = CELL * 0.07;
      const barY  = -r - BAR_H - CELL * 0.12;   // au-dessus du token
    const pct   = Math.max(0, Math.min(1, token.hp / token.maxHp));
    const hpColor = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.beginPath();
    ctx.roundRect(-BAR_W / 2, barY, BAR_W, BAR_H, BAR_H / 2);
    ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = hpColor;
      ctx.beginPath();
      ctx.roundRect(-BAR_W / 2, barY, BAR_W * pct, BAR_H, BAR_H / 2);
      ctx.fill();
    }
  }

   // --- Overlay mort (skull) si HP = 0 ---
  if (token.maxHp != null && token.maxHp > 0 && token.hp != null && token.hp <= 0) {
    // Voile rouge semi-transparent sur le token
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120, 0, 0, 0.45)';
    ctx.fill();

    // Skull emoji centré
    const skullSize = Math.max(12, size * 0.38);
    ctx.font = `${skullSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.90;
    ctx.fillText('☠️', 0, 0);
    ctx.globalAlpha = 1.0;
  }
  
  // --- Nom du token EN BAS, texte seul sans fond ---
  if (token.showLabel) {
    const FONT_SZ = CELL * 0.18;
    const labelY  = r + CELL * 0.06;
    ctx.font = `bold ${FONT_SZ}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = CELL * 0.08;
    ctx.fillStyle = 'white';
    ctx.fillText(token.label, 0, labelY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // -------------------
  // Anneau de ciblage pulsant
  // -------------------
  // Dessiné À L'EXTÉRIEUR du token (r + offset) pour ne jamais
  // couvrir l'image. L'animation est pilotée par animTime (ms depuis
  // le début de la session) — pas d'état React, rendu pur canvas.
  // L'anneau est rouge vif avec une opacité oscillante.
  // Un icône viseur (petit cercle + croix) est affiché au-dessus.
  if (token.targetedByUserIds && token.targetedByUserIds.length > 0) {
    const targetCount = token.targetedByUserIds.length;
    // Pulsation : opacity entre 0.5 et 1.0 à ~1Hz
    const pulse = 0.5 + 0.5 * Math.sin(animTime / 500);
    const ringR = r + 6 / scale;
    const ringWidth = 2.5 / scale;

    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.6 + 0.4 * pulse})`; // rouge-500 pulsant
    ctx.lineWidth = ringWidth;
    // Tirets pour distinguer de la bordure de contrôle
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.stroke();
    ctx.setLineDash([]);

    // -------------------
    // Badge nombre de ciblants (si > 1)
    // -------------------
    // Affiché en haut à droite du token pour indiquer
    // combien de joueurs ciblent ce token simultanément.
    if (targetCount > 1) {
      const badgeR = CELL * 0.12;
      const badgeX = ringR * 0.7;
      const badgeY = -ringR * 0.7;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239,68,68,0.95)';
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = `bold ${badgeR * 1.2}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(targetCount), badgeX, badgeY);
    }
  }

  ctx.restore();
}