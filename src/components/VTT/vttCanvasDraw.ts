import type React from 'react';
import type { VTTToken, VTTWall, VTTDoor, VTTFogStroke, VTTRoomConfig, VTTFogState } from '../../types/vtt';
import { getEffectiveWallSegments, getDoorT1T2 } from './vttCanvasUtils';
import { getTimeOfDayOverlay } from './VTTLeftToolbar';
import { drawDayVisionOverlay, drawNightVisionOverlay } from './vttVisionEngine';
import { getVisionRadii, metersToPixels, buildVisibilityPolygon } from './vttVisionEngine';
import { pointInPolygon } from './vttCanvasUtils';
import { punchVisionHoles } from './vttCanvasPunch';
import { buildFogCanvas } from './vttCanvasFog';
import { drawToken } from './vttCanvasTokenRenderer';

export interface VTTDrawContext {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  mapImgRef: React.MutableRefObject<HTMLImageElement | null>;
  mapLoadedRef: React.MutableRefObject<boolean>;
  tokenImageCache: React.MutableRefObject<Map<string, HTMLImageElement>>;
  viewportRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  forceViewportRef: React.MutableRefObject<{ x: number; y: number; width: number; height: number } | null>;
  spectatorModeRef: React.MutableRefObject<'none' | 'player-vision'>;
  configRef: React.MutableRefObject<VTTRoomConfig>;
  fogStateRef: React.MutableRefObject<VTTFogState>;
  roleRef: React.MutableRefObject<string>;
  userIdRef: React.MutableRefObject<string>;
  selectedTokenIdRef: React.MutableRefObject<string | null>;
  selectedTokenIdsRef: React.MutableRefObject<string[]>;
  tokensRef: React.MutableRefObject<VTTToken[]>;
  wallsRef: React.MutableRefObject<VTTWall[] | undefined>;
  doorsRef: React.MutableRefObject<VTTDoor[]>;
  activeToolRef: React.MutableRefObject<string>;
  showWallsRef: React.MutableRefObject<boolean>;
  wallPointsRef: React.MutableRefObject<{ x: number; y: number }[]>;
  wallPreviewPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
    selectedWallPointRef: React.MutableRefObject<{ wallId: string; pointIndex: number } | null>;
  selectedWallPointsRef: React.MutableRefObject<{ wallId: string; pointIndex: number }[]>;
  measureStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  measureEndRef: React.MutableRefObject<{ x: number; y: number } | null>;
  selectionRectRef: React.MutableRefObject<{ x1: number; y1: number; x2: number; y2: number } | null>;
  calibrationPointsRef: React.MutableRefObject<{ x: number; y: number }[] | undefined>;
  fogCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  fogCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  // -------------------
  // Cache du masque inversé du fog (fogInv)
  // Opaque là où le fog a été levé, transparent là où le fog est actif.
  // Recalculé uniquement quand fogCanvasRef est invalidé (changement de strokes).
  // -------------------
  fogInvCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  fogInvVersionRef: React.MutableRefObject<number>;
  visionCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  visionCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  dayVisionCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  dayVisionCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  exploredCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  exploredCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  // -------------------
  // Flag de protection contre la recréation du canvas exploré
  // pendant une restauration de snapshot asynchrone
  // -------------------
  exploredCanvasRestoringRef: React.MutableRefObject<boolean>;
  drawRef: React.MutableRefObject<() => void>;
  doorInProgressRef: React.MutableRefObject<{ wallId: string; segmentIndex: number; t: number; worldX: number; worldY: number } | null>;
  doorPreviewPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  selectedDoorRef: React.MutableRefObject<string | null>;
  hoveredDoorRef?: React.MutableRefObject<string | null>;
  selectedDoorEndpointRef?: React.MutableRefObject<{ doorId: string; endpoint: 't1' | 't2' } | null>;
  seenDoorsRef: React.MutableRefObject<Set<string>>;
  onSeenDoorsUpdate?: (newSeenIds: string[]) => void;
}

// -------------------
// Construit ou récupère le masque inversé du fog depuis le cache.
// Le fogInv est recalculé uniquement si fogInvCanvasRef est null
// (invalidé par VTTCanvas quand les strokes changent).
// En animation torche (~60fps), cela évite de créer un canvas
// mapW×mapH + fillRect + drawImage à chaque frame.
// -------------------
function getOrBuildFogInv(ctx2d: VTTDrawContext, mapW: number, mapH: number): HTMLCanvasElement | null {
  if (!ctx2d.fogCanvasRef.current || !mapW || !mapH) return null;

  // Réutiliser le cache s'il existe et correspond à la bonne taille
  const cached = ctx2d.fogInvCanvasRef.current;
  if (cached && cached.width === mapW && cached.height === mapH) {
    return cached;
  }

  // Reconstruire le masque inversé du fog
  const fogInv = document.createElement('canvas');
  fogInv.width = mapW;
  fogInv.height = mapH;
  const fogInvCtx = fogInv.getContext('2d')!;
  fogInvCtx.fillStyle = 'rgba(0,0,0,1)';
  fogInvCtx.fillRect(0, 0, mapW, mapH);
  fogInvCtx.globalCompositeOperation = 'destination-out';
  fogInvCtx.drawImage(ctx2d.fogCanvasRef.current, 0, 0);
  fogInvCtx.globalCompositeOperation = 'source-over';

  // Mettre en cache
  ctx2d.fogInvCanvasRef.current = fogInv;
  return fogInv;
}

export function drawVTTCanvas(ctx2d: VTTDrawContext): void {
  const canvas = ctx2d.canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); 
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  if (ctx2d.forceViewportRef.current && W > 0 && H > 0) {
    const fv = ctx2d.forceViewportRef.current;
    const scale = Math.min(W / fv.width, H / fv.height);
    const offsetX = (W - fv.width * scale) / 2;
    const offsetY = (H - fv.height * scale) / 2;
    ctx2d.viewportRef.current = { x: -fv.x * scale + offsetX, y: -fv.y * scale + offsetY, scale };
  }

  const vp = ctx2d.viewportRef.current;
  const cfg = ctx2d.configRef.current;
  const CELL = cfg.gridSize || 50;
  const fog = ctx2d.fogStateRef.current;
  const curRole = ctx2d.roleRef.current;
  const curUserId = ctx2d.userIdRef.current;
  const currentSelectedId = ctx2d.selectedTokenIdRef.current;
  const multiIds = ctx2d.selectedTokenIdsRef.current;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(vp.x, vp.y);
  ctx.scale(vp.scale, vp.scale);

  const mapW = cfg.mapWidth || 2000;
  const mapH = cfg.mapHeight || 2000;

  if (ctx2d.mapImgRef.current && ctx2d.mapLoadedRef.current) {
    ctx.drawImage(ctx2d.mapImgRef.current, 0, 0, mapW, mapH);
  } else {
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, mapW, mapH);
  }

  if (CELL > 0) {
    const gridColor = cfg.gridColor || 'rgba(255,255,255,0.15)';
    const ox = ((cfg.gridOffsetX || 0) % CELL + CELL) % CELL;
    const oy = ((cfg.gridOffsetY || 0) % CELL + CELL) % CELL;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = (cfg.gridLineWidth || 1) / vp.scale;
    for (let gx = ox; gx <= mapW; gx += CELL) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, mapH); ctx.stroke();
    }
    for (let gy = oy; gy <= mapH; gy += CELL) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(mapW, gy); ctx.stroke();
    }
  }

  const timeOfDay = cfg.timeOfDay;
  const isNight = timeOfDay != null && (timeOfDay >= 19 || timeOfDay < 5);
  const isDay = !isNight;
const currentWalls = ctx2d.wallsRef.current || [];
const isPlayerVisionSpectator = ctx2d.spectatorModeRef.current === 'player-vision';

// myControlledTokens = tokens que CE joueur contrôle (pour calculer SA vision)
const myControlledTokens = ctx2d.tokensRef.current.filter(t => {
  if (!t.visible) return false;
  if (curRole !== 'player') return true;

  if (isPlayerVisionSpectator) {
    return (t.controlledByUserIds?.length || 0) > 0;
  }

  // Un joueur ne contrôle un token QUE s'il figure dans controlledByUserIds.
  // On N'utilise PAS ownerUserId : un joueur peut posséder plusieurs tokens
  // mais ne doit voir QUE la vision du token qu'il a sélectionné dans le lobby.
  // ownerUserId est réservé à l'administration (qui peut éditer/supprimer).
  return t.controlledByUserIds?.includes(curUserId) ?? false;
});

const spectatorDayVisionTokens = ctx2d.tokensRef.current.filter(t =>
  !!t.visible &&
  (t.controlledByUserIds?.length || 0) > 0 &&
  (t.visionMode === 'normal' || t.visionMode === 'darkvision')
);

const spectatorNightVisionTokens = ctx2d.tokensRef.current.filter(t =>
  !!t.visible &&
  (t.controlledByUserIds?.length || 0) > 0 &&
  ((t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none'))
);

// myVisionTokens = tokens utilisés pour la vision selon le contexte jour/nuit
const myVisionTokens = isPlayerVisionSpectator
  ? (isNight ? spectatorNightVisionTokens : spectatorDayVisionTokens)
  : myControlledTokens.filter(t =>
      isNight
        ? ((t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none'))
        : (t.visionMode === 'normal' || t.visionMode === 'darkvision')
    ); 

  // directlyVisibleTokenIds = tous les tokens visibles depuis ma vision
  const directlyVisibleTokenIds = new Set<string>();

 if (curRole === 'player') {
  const wallSegs = currentWalls.length > 0
    ? getEffectiveWallSegments(currentWalls, ctx2d.doorsRef.current)
    : [];

  const viewers = isNight
    ? myControlledTokens.filter(t =>
        (t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none')
      )
    : myVisionTokens;

  if (isDay && currentWalls.length === 0 && viewers.length > 0) {
    ctx2d.tokensRef.current.forEach(t => {
      if (t.visible) directlyVisibleTokenIds.add(t.id);
    });
  } else {
    for (const viewer of viewers) {
      const radii = getVisionRadii(viewer, CELL);
      const maxR = Math.max(radii.brightR, radii.dimR);
      if (maxR <= 0) continue;

      let poly: Float64Array | null = null;
      if (wallSegs.length > 0) {
        poly = buildVisibilityPolygon(radii.cx, radii.cy, maxR, wallSegs, mapW, mapH);
        if (poly.length < 6) poly = null;
      }

      for (const t of ctx2d.tokensRef.current) {
        if (!t.visible) continue;
        const ts = (t.size || 1) * CELL;
        const tcx = t.position.x + ts / 2;
        const tcy = t.position.y + ts / 2;
        const dx = tcx - radii.cx;
        const dy = tcy - radii.cy;
        if (dx * dx + dy * dy > maxR * maxR) continue;
        if (poly) {
          if (pointInPolygon(tcx, tcy, poly)) directlyVisibleTokenIds.add(t.id);
        } else {
          directlyVisibleTokenIds.add(t.id);
        }
      }
    }

    // Sans murs : si j'ai une vision, je vois tous les tokens visibles
    if (currentWalls.length === 0 && viewers.length > 0) {
      ctx2d.tokensRef.current.forEach(t => {
        if (t.visible) directlyVisibleTokenIds.add(t.id);
      });
    }
  }
}

  // Détermine si un token est visible pour le joueur courant
  const hasWalls = currentWalls.length > 0;
  const hasVision = myVisionTokens.length > 0;

 const isTokenVisibleToPlayer = (token: VTTToken): boolean => {
  // Les tokens visibles doivent rester affichés aux joueurs,
  // même s'ils ne sont assignés à personne (ex: monstres / PNJ).
  if (token.visible) return true;

  // Sécurité supplémentaire : le token du joueur lui-même reste visible.
  return myControlledTokens.some(mt => mt.id === token.id);
};

ctx2d.tokensRef.current.forEach(token => {
  if (curRole === 'player' && !isTokenVisibleToPlayer(token)) return;
  drawToken({
    ctx,
    token,
    CELL,
    scale: vp.scale,
    currentSelectedId,
    multiIds,
    curUserId,
    tokenImageCache: ctx2d.tokenImageCache.current,
    onImageLoad: () => ctx2d.drawRef.current(),
  });
});

// Hard blackout joueur : aucun token avec vision active => tout noir
// Exception broadcast joueur : spectatorMode = player-vision
if (curRole === 'player' && myVisionTokens.length === 0 && !isPlayerVisionSpectator) {
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, mapW, mapH);
  ctx.restore();
  return;
}

  // --- FOG DE GUERRE ---
  if (cfg.fogEnabled) {
    const strokes = fog.strokes || [];
    if (!ctx2d.fogCanvasRef.current ||
        ctx2d.fogCanvasSizeRef.current.w !== mapW ||
        ctx2d.fogCanvasSizeRef.current.h !== mapH) {
      buildFogCanvas(strokes, mapW, mapH, ctx2d.fogCanvasRef, ctx2d.fogCanvasSizeRef);
    }
    if (ctx2d.fogCanvasRef.current) {
      let vc = ctx2d.visionCanvasRef.current;
      if (!vc || ctx2d.visionCanvasSizeRef.current.w !== mapW || ctx2d.visionCanvasSizeRef.current.h !== mapH) {
        vc = document.createElement('canvas');
        vc.width = mapW;
        vc.height = mapH;
        ctx2d.visionCanvasRef.current = vc;
        ctx2d.visionCanvasSizeRef.current = { w: mapW, h: mapH };
      }
      const vCtx = vc.getContext('2d')!;
      vCtx.clearRect(0, 0, mapW, mapH);
      vCtx.drawImage(ctx2d.fogCanvasRef.current, 0, 0);

const fogPunchTokens =
  curRole === 'player'
    ? (isDay
        ? myVisionTokens
        : myVisionTokens.filter(t =>
            (t.visionMode === 'darkvision') || (t.lightSource && t.lightSource !== 'none')
          ))
    : (isDay
        ? ctx2d.tokensRef.current.filter(t => t.visible && (t.visionMode === 'normal' || t.visionMode === 'darkvision'))
        : ctx2d.tokensRef.current.filter(t => t.visible && (
            (t.lightSource && t.lightSource !== 'none') || (t.visionMode === 'darkvision')
          )));

      if (fogPunchTokens.length > 0) {
        punchVisionHoles(vCtx, fogPunchTokens, CELL, currentWalls, mapW, mapH, isDay, ctx2d.doorsRef.current);
      }

// -------------------
// Gestion du voile de brouillard / mémoire
// -------------------
const hasDayWallVision = isDay && curRole === 'player' && currentWalls.length > 0 && myVisionTokens.length > 0;
const hasLocalSpectatorDayVision = isDay && isPlayerVisionSpectator && currentWalls.length === 0 && myVisionTokens.length > 0;
const fogAlpha = curRole === 'gm'
  ? 0.5
  : (isNight
      ? 0.6
      : ((hasDayWallVision || hasLocalSpectatorDayVision) ? 0.0 : 0.95));
ctx.globalAlpha = fogAlpha;
ctx.drawImage(vc, 0, 0, mapW, mapH);
      ctx.globalAlpha = 1;
    }
  }

  // --- VISION DE JOUR ---
if (!cfg.fogEnabled) {  
  // Brouillard désactivé : aucun masque de vision joueur à appliquer.
} else if (isDay && curRole === 'player' && currentWalls.length === 0 && myVisionTokens.length > 0) {
  // De jour, sans murs, la vision joueur ne doit pas être limitée par un rayon de proximité.
  // On ne rajoute donc aucun masque supplémentaire.
} else if (isDay && curRole === 'player' && currentWalls.length > 0 && (curUserId !== '' || isPlayerVisionSpectator)) {
    const playerTokens = myVisionTokens;
    if (playerTokens.length > 0) {
      const dayWallSegs = currentWalls.flatMap(w => {
        const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
        for (let i = 0; i < w.points.length - 1; i++) {
          segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
        }
        return segs;
      });
      const dayInfiniteR = Math.max(mapW, mapH) * 1.5;

      // -------------------
      // Gestion de la mémoire explorée persistée par scène
      // -------------------
      let evc = ctx2d.exploredCanvasRef.current;
      // -------------------
      // Protection snapshot : si une restauration async est en cours,
      // on NE recrée PAS exploredCanvas (cela écraserait le snapshot en chargement)
      // -------------------
      const isRestoring = ctx2d.exploredCanvasRestoringRef.current;
      if (!isRestoring && (!evc || ctx2d.exploredCanvasSizeRef.current.w !== mapW || ctx2d.exploredCanvasSizeRef.current.h !== mapH)) {
        evc = document.createElement('canvas');
        evc.width = mapW;
        evc.height = mapH;
        const eCtx2 = evc.getContext('2d')!;
        eCtx2.fillStyle = 'rgba(0,0,0,1)';
        eCtx2.fillRect(0, 0, mapW, mapH);

        // Rejouer la mémoire explorée persistée (exploredStrokes serveur)
        const exploredStrokes = ctx2d.fogStateRef.current.exploredStrokes || [];
        eCtx2.globalCompositeOperation = 'destination-out';
        for (const stroke of exploredStrokes) {
          eCtx2.beginPath();
          eCtx2.arc(stroke.x, stroke.y, stroke.r, 0, Math.PI * 2);
          eCtx2.fill();
        }
        eCtx2.globalCompositeOperation = 'source-over';

        ctx2d.exploredCanvasRef.current = evc;
        ctx2d.exploredCanvasSizeRef.current = { w: mapW, h: mapH };
      }
      // Si evc est toujours null après protection (cas improbable), on skip le bloc
      if (!evc) return;
      const eCtx = evc.getContext('2d')!;

      // Graver dans exploredCanvas les zones visibles actuellement (destination-out = effacer le noir)
      eCtx.globalCompositeOperation = 'destination-out';
      for (const token of playerTokens) {
        if (!token.visible) continue;
        const tSize = (token.size || 1) * CELL;
        const tcx = token.position.x + tSize / 2;
        const tcy = token.position.y + tSize / 2;
        const poly = buildVisibilityPolygon(tcx, tcy, dayInfiniteR, dayWallSegs, mapW, mapH);
        if (poly.length >= 6) {
          eCtx.fillStyle = 'rgba(0,0,0,1)';
          eCtx.beginPath();
          eCtx.moveTo(poly[0], poly[1]);
          for (let pi = 2; pi < poly.length; pi += 2) eCtx.lineTo(poly[pi], poly[pi + 1]);
          eCtx.closePath();
          eCtx.fill();
        }
      }
      eCtx.globalCompositeOperation = 'source-over'; 

      // --- Canvas de vision COURANTE : noir sauf dans le polygone de vision actuel
      let dvc = ctx2d.dayVisionCanvasRef.current;
      if (!dvc || ctx2d.dayVisionCanvasSizeRef.current.w !== mapW || ctx2d.dayVisionCanvasSizeRef.current.h !== mapH) {
        dvc = document.createElement('canvas');
        dvc.width = mapW;
        dvc.height = mapH;
        ctx2d.dayVisionCanvasRef.current = dvc;
        ctx2d.dayVisionCanvasSizeRef.current = { w: mapW, h: mapH };
      }
      const dvCtx = dvc.getContext('2d')!;
      dvCtx.clearRect(0, 0, mapW, mapH);
      dvCtx.fillStyle = 'rgba(0,0,0,1)';
      dvCtx.fillRect(0, 0, mapW, mapH);
      dvCtx.globalCompositeOperation = 'destination-out';
      for (const token of playerTokens) {
        if (!token.visible) continue;
        const tSize = (token.size || 1) * CELL;
        const tcx = token.position.x + tSize / 2;
        const tcy = token.position.y + tSize / 2;
        const poly = buildVisibilityPolygon(tcx, tcy, dayInfiniteR, dayWallSegs, mapW, mapH);
        if (poly.length >= 6) {
          dvCtx.fillStyle = 'rgba(0,0,0,1)';
          dvCtx.beginPath();
          dvCtx.moveTo(poly[0], poly[1]);
          for (let pi = 2; pi < poly.length; pi += 2) dvCtx.lineTo(poly[pi], poly[pi + 1]);
          dvCtx.closePath();
          dvCtx.fill();
        }
      }
      dvCtx.globalCompositeOperation = 'source-over';

      // --- Composition finale identique à la nuit ---
      // On NE MODIFIE PAS dvc directement (c'est un ref persistant).
      // On crée un canvas temporaire cvc pour la composition.

      // invCanvas : opaque là où jamais vu, transparent là où exploré
      const invCanvas = document.createElement('canvas');
      invCanvas.width = mapW;
      invCanvas.height = mapH;
      const invCtx = invCanvas.getContext('2d')!;
      invCtx.fillStyle = 'rgba(0,0,0,1)';
      invCtx.fillRect(0, 0, mapW, mapH);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(evc, 0, 0);
      invCtx.globalCompositeOperation = 'source-over';

      // -------------------
      // Composition finale du masque de vision de jour
      // cvc = copie de dvc (noir avec trous là où on voit)
      // -------------------
      const cvc = document.createElement('canvas');
      cvc.width = mapW;
      cvc.height = mapH;
      const cCtx = cvc.getContext('2d')!;
      cCtx.drawImage(dvc, 0, 0);

      // -------------------
      // Atténuation des zones explorées (mémoire)
      // De jour : efface 35% du noir → reste 65% = voile visible
      // -------------------
      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.globalAlpha = 0.35;
      cCtx.drawImage(invCanvas, 0, 0);
      cCtx.globalAlpha = 1;
      cCtx.globalCompositeOperation = 'source-over';

      // -------------------
      // Percement du fog-reveal dans le masque de vision de jour
      // Utilise le cache fogInv pour éviter de recréer un canvas à chaque frame.
      // -------------------
      if (cfg.fogEnabled) {
        const fogInv = getOrBuildFogInv(ctx2d, mapW, mapH);
        if (fogInv) {
          cCtx.globalCompositeOperation = 'destination-out';
          cCtx.drawImage(fogInv, 0, 0);
          cCtx.globalCompositeOperation = 'source-over';
        }
      }

      ctx.drawImage(cvc, 0, 0, mapW, mapH);
    }
  }

  // --- MASQUE NOIR jour sans vision ---
  if (cfg.fogEnabled && isDay && curRole === 'player' && myVisionTokens.length === 0 && curUserId !== '') {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, mapW, mapH);
  }
 
  // --- VISION DE NUIT ---
  if (cfg.fogEnabled && isNight && curRole === 'player' && (curUserId !== '' || isPlayerVisionSpectator)) { 
    const playerTokens = myVisionTokens;
    if (playerTokens.length > 0) {
      // Canvas temporaire local pour la vision de nuit
      // On ne réutilise PAS visionCanvasRef (déjà utilisé par le fog)
      const nvc = document.createElement('canvas');
      nvc.width = mapW;
      nvc.height = mapH; 
      const nCtx = nvc.getContext('2d')!;
      const tod = timeOfDay != null ? getTimeOfDayOverlay(timeOfDay) : { color: 'rgba(0,0,0,ALPHA)', opacity: 0.65, label: '' };
      drawNightVisionOverlay(nCtx, mapW, mapH, playerTokens, currentWalls, CELL, tod.opacity, tod.color);

      // -------------------
      // Gestion de la mémoire explorée persistée par scène
      // -------------------
      let evc = ctx2d.exploredCanvasRef.current;
      // -------------------
      // Protection snapshot : si une restauration async est en cours,
      // on NE recrée PAS exploredCanvas (cela écraserait le snapshot en chargement)
      // -------------------
      const isRestoring = ctx2d.exploredCanvasRestoringRef.current;
      if (!isRestoring && (!evc || ctx2d.exploredCanvasSizeRef.current.w !== mapW || ctx2d.exploredCanvasSizeRef.current.h !== mapH)) {
        evc = document.createElement('canvas');
        evc.width = mapW;
        evc.height = mapH;
        const eCtx2 = evc.getContext('2d')!;
        eCtx2.fillStyle = 'rgba(0,0,0,1)';
        eCtx2.fillRect(0, 0, mapW, mapH);

        // Rejouer la mémoire explorée persistée (exploredStrokes serveur)
        const exploredStrokes = ctx2d.fogStateRef.current.exploredStrokes || [];
        eCtx2.globalCompositeOperation = 'destination-out';
        for (const stroke of exploredStrokes) {
          eCtx2.beginPath();
          eCtx2.arc(stroke.x, stroke.y, stroke.r, 0, Math.PI * 2);
          eCtx2.fill();
        }
        eCtx2.globalCompositeOperation = 'source-over';

        ctx2d.exploredCanvasRef.current = evc;
        ctx2d.exploredCanvasSizeRef.current = { w: mapW, h: mapH };
      }
      // Si evc est toujours null après protection (cas improbable), on skip le bloc
      if (!evc) return;
      const eCtx = evc.getContext('2d')!;

      const wallSegs = currentWalls.length > 0
        ? getEffectiveWallSegments(currentWalls, ctx2d.doorsRef.current)
        : [];

      eCtx.globalCompositeOperation = 'destination-out';
      for (const token of playerTokens) {
        if (!token.visible) continue;
        const tSize = (token.size || 1) * CELL;
        const tcx = token.position.x + tSize / 2;
        const tcy = token.position.y + tSize / 2;
        const vm = token.visionMode || 'none';
        const vr = token.visionRange ?? 18;
        const ls = token.lightSource || 'none';
        const lr = token.lightRange ?? 6;
        let maxR = 0;
        if (vm === 'normal') maxR = metersToPixels(3, CELL);
        else if (vm === 'darkvision') maxR = metersToPixels(vr, CELL);
        if (ls !== 'none') {
          let dimM = lr * 2;
          if (ls === 'torch') dimM = 12;
          else if (ls === 'lantern') dimM = 18;
          maxR = Math.max(maxR, metersToPixels(dimM, CELL));
        }
        if (maxR <= 0) continue;
        if (wallSegs.length > 0) {
          const poly = buildVisibilityPolygon(tcx, tcy, maxR, wallSegs, mapW, mapH);
          if (poly.length >= 6) {
            eCtx.fillStyle = 'rgba(0,0,0,1)';
            eCtx.beginPath();
            eCtx.moveTo(poly[0], poly[1]);
            for (let pi = 2; pi < poly.length; pi += 2) eCtx.lineTo(poly[pi], poly[pi + 1]);
            eCtx.closePath();
            eCtx.fill();
          }
        } else {
          eCtx.fillStyle = 'rgba(0,0,0,1)';
          eCtx.beginPath();
          eCtx.arc(tcx, tcy, maxR, 0, Math.PI * 2);
          eCtx.fill();
        }
      }
      eCtx.globalCompositeOperation = 'source-over';

      // -------------------
      // Composition finale du masque de vision de nuit
      // cvc = copie de nvc (noir partout sauf dans le rayon de vision)
      // -------------------
      const cvc = document.createElement('canvas');
      cvc.width = mapW;
      cvc.height = mapH;
      const cCtx = cvc.getContext('2d')!;
      cCtx.drawImage(nvc, 0, 0);

      // -------------------
      // Atténuation des zones déjà explorées (mémoire)
      // invCanvas = opaque là où JAMAIS exploré, transparent là où déjà exploré
      // -------------------
      const invCanvas = document.createElement('canvas');
      invCanvas.width = mapW;
      invCanvas.height = mapH;
      const invCtx = invCanvas.getContext('2d')!;
      invCtx.fillStyle = 'rgba(0,0,0,1)';
      invCtx.fillRect(0, 0, mapW, mapH);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(evc, 0, 0);
      invCtx.globalCompositeOperation = 'source-over';

      // -------------------
      // Atténuation classique : efface 70% du noir sur les zones explorées
      // → reste 30% de noir = voile semi-transparent sur la mémoire
      // -------------------
      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.globalAlpha = 0.70;
      cCtx.drawImage(invCanvas, 0, 0);
      cCtx.globalAlpha = 1;
      cCtx.globalCompositeOperation = 'source-over';

      // -------------------
      // Percement du fog-reveal dans le masque de nuit composé
      // Utilise le cache fogInv pour éviter de recréer un canvas à chaque frame.
      // -------------------
      if (cfg.fogEnabled) {
        const fogInv = getOrBuildFogInv(ctx2d, mapW, mapH);
        if (fogInv) {
          cCtx.globalCompositeOperation = 'destination-out';
          cCtx.drawImage(fogInv, 0, 0);
          cCtx.globalCompositeOperation = 'source-over';
        }
      }

      ctx.drawImage(cvc, 0, 0, mapW, mapH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, mapW, mapH);
    }
  }

  // --- FILTRE HEURE DU JOUR ---
  if (timeOfDay != null && !isNight) {
    const tod = getTimeOfDayOverlay(timeOfDay);
    if (tod.opacity > 0) {
      ctx.fillStyle = tod.color.replace('ALPHA', String(tod.opacity));
      ctx.fillRect(0, 0, mapW, mapH);
    }
  } else if (timeOfDay != null && isNight && curRole === 'gm') {
    ctx.fillStyle = 'rgba(10,10,40,0.08)';
    ctx.fillRect(0, 0, mapW, mapH);
  }

  // --- POINTS DE CALIBRATION ---
  const calPts = ctx2d.calibrationPointsRef.current;
  if (calPts && calPts.length > 0) {
    calPts.forEach((pt, i) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 8 / vp.scale, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / vp.scale;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${12 / vp.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), pt.x, pt.y);
    });
    if (calPts.length >= 2) {
      const p1 = calPts[0], p2 = calPts[1];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(245,158,11,0.6)';
      ctx.lineWidth = 2 / vp.scale;
      ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // --- MURS ---
  const shouldDrawWalls = curRole === 'gm' && (
    ctx2d.activeToolRef.current === 'wall-draw' ||
    ctx2d.activeToolRef.current === 'wall-select' ||
    ctx2d.showWallsRef.current
  );
  if (shouldDrawWalls) {
    const committedWalls = ctx2d.wallsRef.current || [];
    const isWallMode = ctx2d.activeToolRef.current === 'wall-draw';
    const isWallSelectMode = ctx2d.activeToolRef.current === 'wall-select';
    const wallAlpha = isWallMode ? 0.9 : 0.35;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const wall of committedWalls) {
      if (wall.points.length < 2) continue;
      ctx.strokeStyle = `rgba(239,68,68,${wallAlpha})`;
      ctx.lineWidth = 3 / vp.scale;
      ctx.beginPath();
      ctx.moveTo(wall.points[0].x, wall.points[0].y);
      for (let i = 1; i < wall.points.length; i++) ctx.lineTo(wall.points[i].x, wall.points[i].y);
      ctx.stroke();
      if (isWallMode || isWallSelectMode) {
        const selPt = ctx2d.selectedWallPointRef?.current;
        const selPts = ctx2d.selectedWallPointsRef?.current ?? [];
        wall.points.forEach((pt, pi) => {
          const isSingleHighlighted = isWallSelectMode && selPt?.wallId === wall.id && selPt?.pointIndex === pi;
          const isMultiHighlighted = isWallSelectMode && selPts.some(sp => sp.wallId === wall.id && sp.pointIndex === pi);
          const isHighlighted = isSingleHighlighted || isMultiHighlighted;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, (isHighlighted ? 9 : isWallSelectMode ? 6 : 4) / vp.scale, 0, Math.PI * 2);
          ctx.fillStyle = isHighlighted
            ? 'rgba(255,200,0,1)'
            : isWallSelectMode ? 'rgba(251,146,60,0.9)' : 'rgba(239,68,68,0.85)';
          ctx.fill();
          if (isWallSelectMode) {
            ctx.strokeStyle = isHighlighted ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)';
            ctx.lineWidth = (isHighlighted ? 2.5 : 1.5) / vp.scale;
            ctx.stroke();
          }
        });
      }
    }
    if (isWallMode) {
      const wPts = ctx2d.wallPointsRef.current;
      if (wPts.length > 0) {
        ctx.strokeStyle = 'rgba(251,146,60,0.85)';
        ctx.lineWidth = 2.5 / vp.scale;
        ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
        ctx.beginPath();
        ctx.moveTo(wPts[0].x, wPts[0].y);
        for (let i = 1; i < wPts.length; i++) ctx.lineTo(wPts[i].x, wPts[i].y);
        const preview = ctx2d.wallPreviewPosRef.current;
        if (preview) ctx.lineTo(preview.x, preview.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fb923c';
        for (const pt of wPts) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5 / vp.scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5 / vp.scale;
        ctx.beginPath();
        ctx.arc(wPts[0].x, wPts[0].y, 8 / vp.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // --- PORTES ---
  const doors = ctx2d.doorsRef.current;
  const isDoorMode = ctx2d.activeToolRef.current === 'door-place';
  const selectedDoorId = ctx2d.selectedDoorRef?.current ?? null;
  const hoveredDoorId = ctx2d.hoveredDoorRef?.current ?? null;
  const selectedDoorEndpoint = ctx2d.selectedDoorEndpointRef?.current ?? null;

  // Helper : vérifie si un point monde (wx, wy) est visible par le joueur.
  // Teste la géométrie de vision (polygon de visibilité) plutôt que les canvas rendus.
  const isDoorPointVisible = (wx: number, wy: number): boolean => {
    if (!cfg.fogEnabled) return true;

    // 1. Fog révélé manuellement à cet endroit → toujours visible
    const fogCanvas = ctx2d.fogCanvasRef.current;
    if (fogCanvas) {
      const fogCtx = fogCanvas.getContext('2d');
      if (fogCtx) {
        const fx = Math.round(wx);
        const fy = Math.round(wy);
        if (fx >= 0 && fy >= 0 && fx < fogCanvas.width && fy < fogCanvas.height) {
          const pixel = fogCtx.getImageData(fx, fy, 1, 1).data;
          // fogCanvas : transparent (alpha < 128) = zone révélée manuellement
          if (pixel[3] < 128) return true;
        }
      }
    }

    // 2. Vision de jour sans murs : tout est visible si le joueur a un token
    if (isDay && currentWalls.length === 0 && myVisionTokens.length > 0) return true;

    // 3. Sinon : tester si le point est dans le polygon de visibilité d'un token
    if (myVisionTokens.length === 0) return false;
    const doorWallSegs = currentWalls.length > 0
      ? getEffectiveWallSegments(currentWalls, ctx2d.doorsRef.current)
      : [];
    for (const viewer of myVisionTokens) {
      const radii = getVisionRadii(viewer, CELL);
      const maxR = Math.max(radii.brightR, radii.dimR);
      if (maxR <= 0) continue;
      const dx = wx - radii.cx;
      const dy = wy - radii.cy;
      if (dx * dx + dy * dy > maxR * maxR) continue;
      if (doorWallSegs.length === 0) return true;
      const poly = buildVisibilityPolygon(radii.cx, radii.cy, maxR, doorWallSegs, mapW, mapH);
      if (poly.length >= 6 && pointInPolygon(wx, wy, poly)) return true;
    }
    return false;
  };

  if (doors.length > 0) {
    const committedWalls = ctx2d.wallsRef.current || [];

    for (const door of doors) {
      const wall = committedWalls.find(w => w.id === door.wallId);
      if (!wall) continue;
      const pts = wall.points;
      const si = door.segmentIndex;
      if (si < 0 || si >= pts.length - 1) continue;

      const p1 = pts[si];
      const p2 = pts[si + 1];
      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
      if (segLen < 1) continue;

      const nx = segDx / segLen;
      const ny = segDy / segLen;

      const { t1, t2, tCenter } = getDoorT1T2(door, segLen);
      const ax = p1.x + nx * segLen * t1;
      const ay = p1.y + ny * segLen * t1;
      const bx = p1.x + nx * segLen * t2;
      const by = p1.y + ny * segLen * t2;
      const cx = p1.x + nx * segLen * tCenter;
      const cy = p1.y + ny * segLen * tCenter;
      const doorSpanLen = segLen * (t2 - t1);

      // Côté joueur/spectateur : n'afficher la porte que si visible OU mémorisée (vue précédemment)
      let isMemorized = false;
      if (curRole !== 'gm' && cfg.fogEnabled) {
        const currentlyVisible = isDoorPointVisible(cx, cy);
        if (currentlyVisible) {
          // Mémoriser cette porte si pas déjà mémorisée
          if (!ctx2d.seenDoorsRef.current.has(door.id)) {
            ctx2d.seenDoorsRef.current.add(door.id);
            ctx2d.onSeenDoorsUpdate?.([...ctx2d.seenDoorsRef.current]);
          }
        } else {
          // Hors vision : afficher seulement si mémorisée (vue avant)
          if (ctx2d.seenDoorsRef.current.has(door.id)) {
            isMemorized = true;
          } else {
            continue;
          }
        }
      }

      ctx.save();
      ctx.lineCap = 'round';

      // Portes mémorisées (hors vision) : légèrement atténuées
      if (isMemorized) ctx.globalAlpha = 0.45;

      const isOpen = door.open;

      if (isOpen) {
        const panelLen = doorSpanLen;
        const px = -ny * panelLen;
        const py = nx * panelLen;
        ctx.lineWidth = 3 / vp.scale;
        ctx.strokeStyle = 'rgba(160,160,160,0.9)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + px, ay + py);
        ctx.stroke();
        ctx.setLineDash([4 / vp.scale, 4 / vp.scale]);
        ctx.strokeStyle = 'rgba(160,160,160,0.35)';
        ctx.lineWidth = 2 / vp.scale;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(ax, ay, 4 / vp.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(160,160,160,0.9)';
        ctx.fill();
      } else {
        ctx.lineWidth = 5 / vp.scale;
        ctx.strokeStyle = isDoorMode ? 'rgba(200,200,200,0.95)' : 'rgba(180,180,180,0.8)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.lineWidth = 2 / vp.scale;
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ax, ay, 3 / vp.scale, 0, Math.PI * 2);
        ctx.beginPath();
        ctx.arc(bx, by, 3 / vp.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180,180,180,0.9)';
        ctx.fill();
      }

      // Icone porte au centre du segment
      const isHovered = !isMemorized && hoveredDoorId === door.id;
      const baseIconSize = Math.max(8, Math.min(14, doorSpanLen * 0.12));
      const iconSize = (isHovered ? baseIconSize * 1.35 : baseIconSize) / vp.scale;

      // Halo de hover
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(cx, cy, iconSize * 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, iconSize * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();
      }

      // Dessin de l'icône porte (cadre + panneau + poignée)
      const iconAlpha = isHovered ? 1 : 0.95;
      ctx.strokeStyle = `rgba(255,255,255,${iconAlpha})`;
      ctx.fillStyle = `rgba(255,255,255,${iconAlpha})`;
      const lw = (isHovered ? 1.6 : 1.2) / vp.scale;
      ctx.lineWidth = lw;
      const hw = iconSize * 0.52;
      const hh = iconSize * 0.68;
      ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);
      if (isOpen) {
        ctx.beginPath();
        ctx.moveTo(cx - hw, cy - hh);
        ctx.lineTo(cx - hw * 0.1, cy - hh * 0.55);
        ctx.lineTo(cx - hw * 0.1, cy + hh * 0.65);
        ctx.lineTo(cx - hw, cy + hh);
        ctx.stroke();
      } else {
        const pw = hw * 0.72;
        ctx.beginPath();
        ctx.rect(cx - pw, cy - hh + lw * 2, pw * 2, hh * 2 - lw * 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + hw * 0.3, cy, iconSize * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Indicateur de sélection (GM uniquement)
      if (!isMemorized && selectedDoorId === door.id) {
        ctx.lineWidth = 2.5 / vp.scale;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.setLineDash([4 / vp.scale, 3 / vp.scale]);
        ctx.beginPath();
        ctx.arc(cx, cy, iconSize * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Handles des endpoints t1/t2 en mode wall-select (GM uniquement)
      if (!isMemorized && ctx2d.activeToolRef.current === 'wall-select') {
        const t1SelHighlight = selectedDoorEndpoint?.doorId === door.id && selectedDoorEndpoint?.endpoint === 't1';
        const t2SelHighlight = selectedDoorEndpoint?.doorId === door.id && selectedDoorEndpoint?.endpoint === 't2';
        const handleRadius = (t1SelHighlight ? 9 : 6) / vp.scale;
        ctx.beginPath();
        ctx.arc(ax, ay, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = t1SelHighlight ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,0.9)';
        ctx.fill();
        ctx.strokeStyle = t1SelHighlight ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = (t1SelHighlight ? 2.5 : 1.5) / vp.scale;
        ctx.stroke();
        const handle2Radius = (t2SelHighlight ? 9 : 6) / vp.scale;
        ctx.beginPath();
        ctx.arc(bx, by, handle2Radius, 0, Math.PI * 2);
        ctx.fillStyle = t2SelHighlight ? 'rgba(251,191,36,1)' : 'rgba(96,165,250,0.9)';
        ctx.fill();
        ctx.strokeStyle = t2SelHighlight ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)';
        ctx.lineWidth = (t2SelHighlight ? 2.5 : 1.5) / vp.scale;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // --- PORTE EN COURS DE PLACEMENT (2 clics) ---
  const doorInProgress = ctx2d.doorInProgressRef?.current;
  const doorPreviewPos = ctx2d.doorPreviewPosRef?.current;
  if (isDoorMode && doorInProgress) {
    const committedWalls2 = ctx2d.wallsRef.current || [];
    const wall = committedWalls2.find(w => w.id === doorInProgress.wallId);
    if (wall) {
      const pts = wall.points;
      const si = doorInProgress.segmentIndex;
      if (si >= 0 && si < pts.length - 1) {
        const p1 = pts[si], p2 = pts[si + 1];
        const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
        const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
        if (segLen >= 1) {
          const nx = segDx / segLen, ny = segDy / segLen;
          const fpx = p1.x + nx * segLen * doorInProgress.t;
          const fpy = p1.y + ny * segLen * doorInProgress.t;
          ctx.save();
          ctx.beginPath();
          ctx.arc(fpx, fpy, 6 / vp.scale, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251,191,36,1)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2 / vp.scale;
          ctx.stroke();

          if (doorPreviewPos) {
            const dxP = p2.x - p1.x, dyP = p2.y - p1.y;
            const lenSq = dxP * dxP + dyP * dyP;
            let tPreview = lenSq > 0 ? ((doorPreviewPos.x - p1.x) * dxP + (doorPreviewPos.y - p1.y) * dyP) / lenSq : 0;
            tPreview = Math.max(0.01, Math.min(0.99, tPreview));
            const previewT1 = Math.min(doorInProgress.t, tPreview);
            const previewT2 = Math.max(doorInProgress.t, tPreview);
            if (previewT2 - previewT1 > 0.01) {
              const prx = p1.x + nx * segLen * previewT1;
              const pry = p1.y + ny * segLen * previewT1;
              const prx2 = p1.x + nx * segLen * previewT2;
              const pry2 = p1.y + ny * segLen * previewT2;
              ctx.lineWidth = 4 / vp.scale;
              ctx.lineCap = 'round';
              ctx.strokeStyle = 'rgba(251,191,36,0.7)';
              ctx.setLineDash([6 / vp.scale, 3 / vp.scale]);
              ctx.beginPath();
              ctx.moveTo(prx, pry);
              ctx.lineTo(prx2, pry2);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
          ctx.restore();
        }
      }
    }
  }

  // --- MESURE ---
  const mStart = ctx2d.measureStartRef.current;
  const mEnd = ctx2d.measureEndRef.current;
  if (mStart && mEnd) {
    const dx = mEnd.x - mStart.x;
    const dy = mEnd.y - mStart.y;
    const distPx = Math.sqrt(dx * dx + dy * dy);
    const gridSz = cfg.gridSize || 50;
    const squares = distPx / gridSz;
    const meters = squares * 1.5;
    ctx.strokeStyle = 'rgba(56,189,248,0.8)';
    ctx.lineWidth = 2.5 / vp.scale;
    ctx.setLineDash([8 / vp.scale, 4 / vp.scale]);
    ctx.beginPath();
    ctx.moveTo(mStart.x, mStart.y);
    ctx.lineTo(mEnd.x, mEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const pt of [mStart, mEnd]) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5 / vp.scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / vp.scale;
      ctx.stroke();
    }
    const midX = (mStart.x + mEnd.x) / 2;
    const midY = (mStart.y + mEnd.y) / 2;
    const label = `${meters.toFixed(1)} m (${squares.toFixed(1)} cases)`;
    const fontSize = Math.max(12, 14 / vp.scale);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const textW = ctx.measureText(label).width;
    const padX = 6 / vp.scale;
    const padY = 4 / vp.scale;
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath();
    ctx.roundRect(midX - textW / 2 - padX, midY - fontSize / 2 - padY, textW + padX * 2, fontSize + padY * 2, 4 / vp.scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56,189,248,0.6)';
    ctx.lineWidth = 1 / vp.scale;
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, midX, midY);
  }

  // --- RECTANGLE DE PREVIEW FOG ---
  const fogRect = ctx2d.fogRectRef?.current;
  if (fogRect) {
    const fx = Math.min(fogRect.x1, fogRect.x2);
    const fy = Math.min(fogRect.y1, fogRect.y2);
    const fw = Math.abs(fogRect.x2 - fogRect.x1);
    const fh = Math.abs(fogRect.y2 - fogRect.y1);
    const isReveal = ctx2d.activeToolRef.current === 'fog-rect-reveal';
    ctx.fillStyle = isReveal ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
    ctx.fillRect(fx, fy, fw, fh);
    ctx.strokeStyle = isReveal ? 'rgba(245,158,11,0.8)' : 'rgba(239,68,68,0.8)';
    ctx.lineWidth = 2 / vp.scale;
    ctx.setLineDash([6 / vp.scale, 4 / vp.scale]);
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.setLineDash([]);
    // Label dimensions
    const label = `${Math.round(fw)}×${Math.round(fh)}`;
    const fontSize = Math.max(11, 13 / vp.scale);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = isReveal ? 'rgba(245,158,11,0.9)' : 'rgba(239,68,68,0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, fx + fw / 2, fy - 4 / vp.scale);
  }

  // --- RECTANGLE DE SÉLECTION ---
  const selRect = ctx2d.selectionRectRef.current;
  if (selRect) {
    const sx = Math.min(selRect.x1, selRect.x2);
    const sy = Math.min(selRect.y1, selRect.y2);
    const sw = Math.abs(selRect.x2 - selRect.x1);
    const sh = Math.abs(selRect.y2 - selRect.y1);
    ctx.fillStyle = 'rgba(59,130,246,0.12)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(96,165,250,0.85)';
    ctx.lineWidth = 1.5 / vp.scale;
    ctx.setLineDash([5 / vp.scale, 3 / vp.scale]);
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.setLineDash([]);
  }

  ctx.restore();
}