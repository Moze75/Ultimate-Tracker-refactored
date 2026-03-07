import type React from 'react';
import type { VTTToken, VTTWall, VTTFogStroke, VTTRoomConfig, VTTFogState } from '../../types/vtt';
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
  configRef: React.MutableRefObject<VTTRoomConfig>;
  fogStateRef: React.MutableRefObject<VTTFogState>;
  roleRef: React.MutableRefObject<string>;
  userIdRef: React.MutableRefObject<string>;
  selectedTokenIdRef: React.MutableRefObject<string | null>;
  selectedTokenIdsRef: React.MutableRefObject<string[]>;
  tokensRef: React.MutableRefObject<VTTToken[]>;
  wallsRef: React.MutableRefObject<VTTWall[] | undefined>;
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
  visionCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  visionCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  dayVisionCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  dayVisionCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  exploredCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  exploredCanvasSizeRef: React.MutableRefObject<{ w: number; h: number }>;
  drawRef: React.MutableRefObject<() => void>;
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

  // myControlledTokens = tokens que CE joueur contrôle (pour calculer SA vision)
  const myControlledTokens = ctx2d.tokensRef.current.filter(t => {
    if (!t.visible) return false;
    if (curRole !== 'player') return true;
    // Un joueur ne contrôle un token QUE s'il figure dans controlledByUserIds.
    // On N'utilise PAS ownerUserId : un joueur peut posséder plusieurs tokens
    // mais ne doit voir QUE la vision du token qu'il a sélectionné dans le lobby.
    // ownerUserId est réservé à l'administration (qui peut éditer/supprimer).
    return t.controlledByUserIds?.includes(curUserId) ?? false;
  });

  // myVisionTokens = mes tokens qui ont une vision active
  const myVisionTokens = myControlledTokens.filter(
    t => t.visionMode === 'normal' || t.visionMode === 'darkvision'
  );

  // directlyVisibleTokenIds = tous les tokens visibles depuis ma vision
  const directlyVisibleTokenIds = new Set<string>();

  if (curRole === 'player') {
    const wallSegs = currentWalls.length > 0
      ? currentWalls.flatMap(w => {
          const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
          for (let i = 0; i < w.points.length - 1; i++) {
            segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
          }
          return segs;
        })
      : [];

    const viewers = isNight
      ? myControlledTokens.filter(t =>
          (t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none')
        )
      : myVisionTokens;

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

  // Détermine si un token est visible pour le joueur courant
  const hasWalls = currentWalls.length > 0;
  const hasVision = myVisionTokens.length > 0;

  const isTokenVisibleToPlayer = (token: VTTToken): boolean => {
    // Token du joueur lui-même : toujours visible
    if (myControlledTokens.some(mt => mt.id === token.id)) return true;
    // Sans vision active : rien n'est visible (le blackout s'en chargera)
    if (!hasVision) return false;
    // Sans murs : tout token visible est vu (pas d'occlusion)
    if (!hasWalls) return true;
    // Avec murs : seulement les tokens dans le polygone de vision
    return directlyVisibleTokenIds.has(token.id);
  };

  ctx2d.tokensRef.current.forEach(token => {
    if (!token.visible && curRole === 'player') return;
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
  if (curRole === 'player' && myVisionTokens.length === 0) {
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
              : myControlledTokens.filter(t =>
                  (t.visionMode === 'darkvision') || (t.lightSource && t.lightSource !== 'none')
                ))
          : (isDay
              ? ctx2d.tokensRef.current.filter(t => t.visible && (t.visionMode === 'normal' || t.visionMode === 'darkvision'))
              : ctx2d.tokensRef.current.filter(t => t.visible && (
                  (t.lightSource && t.lightSource !== 'none') || (t.visionMode === 'darkvision')
                )));

      if (fogPunchTokens.length > 0) {
        punchVisionHoles(vCtx, fogPunchTokens, CELL, currentWalls, mapW, mapH, isDay);
      }

          // De jour avec murs et vision active : le fog est géré par dayVision, pas besoin d'opacité élevée
      const hasDayWallVision = isDay && curRole === 'player' && currentWalls.length > 0 && myVisionTokens.length > 0;
      const fogAlpha = curRole === 'gm' ? 0.5 : (isNight ? 0.6 : (hasDayWallVision ? 0.0 : 0.95));
      ctx.globalAlpha = fogAlpha;
      ctx.drawImage(vc, 0, 0, mapW, mapH);
      ctx.globalAlpha = 1;
    }
  }

  // --- VISION DE JOUR ---
  if (isDay && curRole === 'player' && currentWalls.length > 0) {
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

      // --- exploredCanvas : mémoire permanente des zones déjà vues (noir = jamais vu, transparent = déjà exploré)
      let evc = ctx2d.exploredCanvasRef.current;
      if (!evc || ctx2d.exploredCanvasSizeRef.current.w !== mapW || ctx2d.exploredCanvasSizeRef.current.h !== mapH) {
        evc = document.createElement('canvas');
        evc.width = mapW;
        evc.height = mapH;
        const eCtx2 = evc.getContext('2d')!;
        eCtx2.fillStyle = 'rgba(0,0,0,1)';
        eCtx2.fillRect(0, 0, mapW, mapH);
        ctx2d.exploredCanvasRef.current = evc;
        ctx2d.exploredCanvasSizeRef.current = { w: mapW, h: mapH };
      }
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

      // cvc : copie de dvc sur laquelle on applique la transparence des zones explorées
      const cvc = document.createElement('canvas');
      cvc.width = mapW;
      cvc.height = mapH;
      const cCtx = cvc.getContext('2d')!;
      cCtx.drawImage(dvc, 0, 0); // copie de dvc : noir avec trous là où on voit

      // De jour : on efface seulement 35% du noir sur les zones explorées
      // → reste 65% de noir = voile bien visible (zones inexplorées = 100% noir)
      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.globalAlpha = 0.35;
      cCtx.drawImage(invCanvas, 0, 0);
      cCtx.globalAlpha = 1;
      cCtx.globalCompositeOperation = 'source-over';

      ctx.drawImage(cvc, 0, 0, mapW, mapH);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(0, 0, mapW, mapH);
    }
  }

  // --- MASQUE NOIR jour sans vision ---
  if (isDay && curRole === 'player' && myVisionTokens.length === 0) {
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.fillRect(0, 0, mapW, mapH);
  }

  // --- VISION DE NUIT ---
  if (isNight && curRole === 'player') {
    const playerTokens = myControlledTokens.filter(t =>
      (t.visionMode && t.visionMode !== 'none') || (t.lightSource && t.lightSource !== 'none')
    );
    if (playerTokens.length > 0) {
      // Canvas temporaire local pour la vision de nuit
      // On ne réutilise PAS visionCanvasRef (déjà utilisé par le fog)
      const nvc = document.createElement('canvas');
      nvc.width = mapW;
      nvc.height = mapH;
      const nCtx = nvc.getContext('2d')!;
      const tod = timeOfDay != null ? getTimeOfDayOverlay(timeOfDay) : { color: 'rgba(0,0,0,ALPHA)', opacity: 0.65, label: '' };
      drawNightVisionOverlay(nCtx, mapW, mapH, playerTokens, currentWalls, CELL, tod.opacity, tod.color);

      let evc = ctx2d.exploredCanvasRef.current;
      if (!evc || ctx2d.exploredCanvasSizeRef.current.w !== mapW || ctx2d.exploredCanvasSizeRef.current.h !== mapH) {
        evc = document.createElement('canvas');
        evc.width = mapW;
        evc.height = mapH;
        const eCtx2 = evc.getContext('2d')!;
        eCtx2.fillStyle = 'rgba(0,0,0,1)';
        eCtx2.fillRect(0, 0, mapW, mapH);
        ctx2d.exploredCanvasRef.current = evc;
        ctx2d.exploredCanvasSizeRef.current = { w: mapW, h: mapH };
      }
      const eCtx = evc.getContext('2d')!;

      const wallSegs = currentWalls.length > 0
        ? currentWalls.flatMap(w => {
            const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
            for (let i = 0; i < w.points.length - 1; i++) {
              segs.push({ x1: w.points[i].x, y1: w.points[i].y, x2: w.points[i + 1].x, y2: w.points[i + 1].y });
            }
            return segs;
          })
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

      const cvc = document.createElement('canvas');
      cvc.width = mapW;
      cvc.height = mapH;
      const cCtx = cvc.getContext('2d')!;
      cCtx.drawImage(nvc, 0, 0);

      const invCanvas = document.createElement('canvas');
      invCanvas.width = mapW;
      invCanvas.height = mapH;
      const invCtx = invCanvas.getContext('2d')!;
      invCtx.fillStyle = 'rgba(0,0,0,1)';
      invCtx.fillRect(0, 0, mapW, mapH);
      invCtx.globalCompositeOperation = 'destination-out';
      invCtx.drawImage(evc, 0, 0);
      invCtx.globalCompositeOperation = 'source-over';

      cCtx.globalCompositeOperation = 'destination-out';
      cCtx.globalAlpha = 0.70;
      cCtx.drawImage(invCanvas, 0, 0);
      cCtx.globalAlpha = 1;
      cCtx.globalCompositeOperation = 'source-over';

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