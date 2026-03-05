import { useEffect, useRef } from 'react';
import type { VTTToken } from '../../types/vtt';
import { wallBlocksToken } from './vttCanvasUtils';
import { pointInPolygon } from './vttCanvasUtils';
import type { VTTActiveTool } from './VTTLeftToolbar';

export interface VTTCanvasRefs {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  brushOverlayRef: React.RefObject<HTMLDivElement>;
  viewportRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  tokensRef: React.MutableRefObject<VTTToken[]>;
  configRef: React.MutableRefObject<any>;
  roleRef: React.MutableRefObject<string>;
  userIdRef: React.MutableRefObject<string>;
  activeToolRef: React.MutableRefObject<VTTActiveTool>;
  fogBrushSizeRef: React.MutableRefObject<number>;
  wallsRef: React.MutableRefObject<any[]>;
  wallPointsRef: React.MutableRefObject<{ x: number; y: number }[]>;
  wallPreviewPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  measureStartRef: React.MutableRefObject<{ x: number; y: number } | null>;
  measureEndRef: React.MutableRefObject<{ x: number; y: number } | null>;
  measureLockedRef: React.MutableRefObject<boolean>;
  selectedTokenIdRef: React.MutableRefObject<string | null>;
  selectedTokenIdsRef: React.MutableRefObject<string[]>;
  draggingTokenRef: React.MutableRefObject<{ id: string; offsetX: number; offsetY: number; multiInitial?: Map<string, { x: number; y: number }> } | null>;
  resizingTokenRef: React.MutableRefObject<{ id: string; tokenPx: number; tokenPy: number } | null>;
  isPaintingFogRef: React.MutableRefObject<boolean>;
  lastPanRef: React.MutableRefObject<{ x: number; y: number } | null>;
  isPanningRef: React.MutableRefObject<boolean>;
  selectionRectRef: React.MutableRefObject<{ x1: number; y1: number; x2: number; y2: number } | null>;
  isDragSelectingRef: React.MutableRefObject<boolean>;
  onSelectTokenRef: React.MutableRefObject<(id: string | null) => void>;
  onSelectTokensRef: React.MutableRefObject<((ids: string[]) => void) | undefined>;
  onMoveTokenRef: React.MutableRefObject<(id: string, pos: { x: number; y: number }) => void>;
  onRevealFogRef: React.MutableRefObject<(stroke: any) => void>;
  onResizeTokenRef: React.MutableRefObject<((id: string, size: number) => void) | undefined>;
  onRightClickTokenRef: React.MutableRefObject<((token: VTTToken, x: number, y: number) => void) | undefined>;
  onCalibrationPointRef: React.MutableRefObject<((pos: { x: number; y: number }) => void) | undefined>;
  onWallAddedRef: React.MutableRefObject<((wall: any) => void) | undefined>;
  onWallUpdatedRef: React.MutableRefObject<((wall: any) => void) | undefined>;
  onWallRemovedRef: React.MutableRefObject<((wallId: string) => void) | undefined>;
    selectedWallPointRef: React.MutableRefObject<{ wallId: string; pointIndex: number } | null>;
  onViewportChangeRef: React.MutableRefObject<((vp: { x: number; y: number; scale: number }) => void) | undefined>;
  fogCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  fogBrushRef?: React.MutableRefObject<number>;
  drawRef: React.MutableRefObject<() => void>;
  paintFogAt: (wx: number, wy: number) => void;
  getCanvasXY: (clientX: number, clientY: number) => { x: number; y: number };
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  getTokenAt: (wx: number, wy: number) => VTTToken | null;
  snapToGrid: (wx: number, wy: number) => { x: number; y: number };
  activeTool: VTTActiveTool;
}

// État interne partagé pour l'édition de murs (wall-select)
// wallEditStateRef : { wallId, pointIndex } du point en cours de drag

export function useVTTCanvasEvents({
  canvasRef,
  brushOverlayRef,
  viewportRef,
  tokensRef,
  configRef,
  roleRef,
  userIdRef,
  activeToolRef,
  fogBrushSizeRef,
  wallsRef,
  wallPointsRef,
  wallPreviewPosRef,
  measureStartRef,
  measureEndRef,
  measureLockedRef,
  selectedTokenIdRef,
  selectedTokenIdsRef,
  draggingTokenRef,
  resizingTokenRef,
  isPaintingFogRef,
  lastPanRef,
  isPanningRef,
  selectionRectRef,
  isDragSelectingRef,
  onSelectTokenRef,
  onSelectTokensRef,
  onMoveTokenRef,
  onResizeTokenRef,
  onRightClickTokenRef,
  onCalibrationPointRef,
    onWallAddedRef,
    onWallUpdatedRef,
    onWallRemovedRef,
    selectedWallPointRef,
    onViewportChangeRef,
  drawRef,
  paintFogAt,
  getCanvasXY,
  screenToWorld,
  getTokenAt,
  snapToGrid,
  activeTool,
}: VTTCanvasRefs) {


  // Refs internes pour l'édition de points de mur (wall-select)
  // null = rien, phase 'selected' = point highlighté, phase 'moving' = point suit la souris
  const draggingWallPointRef = useRef<{
    wallId: string;
    pointIndex: number;
    phase: 'selected' | 'moving';
  } | null>(null);
  
  // Reset wall/measure state when tool changes
  useEffect(() => {
    if (activeTool !== 'wall-draw') {
      wallPointsRef.current = [];
      wallPreviewPosRef.current = null;
    }
    if (activeTool !== 'wall-select') {
      draggingWallPointRef.current = null;
    }
    if (activeTool !== 'measure') {
      measureStartRef.current = null;
      measureEndRef.current = null;
      measureLockedRef.current = false;
    }
    drawRef.current();
  }, [activeTool]);

  // Native mouse/wheel events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        isPanningRef.current = true;
        return;
      }
      if (e.button !== 0) return;

      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);
      const tool = activeToolRef.current;

      if (tool === 'select') {
        const selId = selectedTokenIdRef.current;
        if (selId) {
          const selToken = tokensRef.current.find(t => t.id === selId);
          if (selToken) {
            const CELL2 = configRef.current.gridSize || 50;
            const tokenPxSize = (selToken.size || 1) * CELL2;
            const vp2 = viewportRef.current;
            const pad2 = 5 / vp2.scale;
            const handleWx = selToken.position.x + tokenPxSize + pad2;
            const handleWy = selToken.position.y + tokenPxSize + pad2;
            const distPx = Math.sqrt(
              Math.pow((wp.x - handleWx) * vp2.scale, 2) +
              Math.pow((wp.y - handleWy) * vp2.scale, 2)
            );
            if (distPx < 12) {
              resizingTokenRef.current = { id: selId, tokenPx: selToken.position.x, tokenPy: selToken.position.y };
              return;
            }
          }
        }

        const token = getTokenAt(wp.x, wp.y);
        if (token) {
          const canControl = roleRef.current === 'gm' || (token.controlledByUserIds?.includes(userIdRef.current) ?? false);
          if (roleRef.current === 'player' && !canControl) return;

          if (canControl) {
            const multiSel = selectedTokenIdsRef.current;
            if (multiSel.length > 1 && multiSel.includes(token.id)) {
              const initialPositions = new Map<string, { x: number; y: number }>();
              tokensRef.current.forEach(t => {
                if (multiSel.includes(t.id)) initialPositions.set(t.id, { ...t.position });
              });
              draggingTokenRef.current = {
                id: token.id,
                offsetX: wp.x - token.position.x,
                offsetY: wp.y - token.position.y,
                multiInitial: initialPositions,
              };
            } else {
              draggingTokenRef.current = {
                id: token.id,
                offsetX: wp.x - token.position.x,
                offsetY: wp.y - token.position.y,
              };
            }
          }

          onSelectTokenRef.current(token.id);
          if (selectedTokenIdsRef.current.length <= 1 || !selectedTokenIdsRef.current.includes(token.id)) {
            onSelectTokensRef.current?.([token.id]);
          }
        } else {
          isDragSelectingRef.current = true;
          selectionRectRef.current = { x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y };
          onSelectTokenRef.current(null);
          onSelectTokensRef.current?.([]);
        }
      } else if ((tool === 'fog-reveal' || tool === 'fog-erase') && roleRef.current === 'gm') {
        isPaintingFogRef.current = true;
        paintFogAt(wp.x, wp.y);
      } else if (tool === 'grid-calibrate' && roleRef.current === 'gm') {
        onCalibrationPointRef.current?.({ x: wp.x, y: wp.y });
      } else if (tool === 'wall-draw' && roleRef.current === 'gm') {
        wallPointsRef.current = [...wallPointsRef.current, { x: wp.x, y: wp.y }];
        wallPreviewPosRef.current = null;
        drawRef.current();
      } else if (tool === 'wall-select' && roleRef.current === 'gm') {
        const vp = viewportRef.current;
        const HIT_RADIUS_PX = 12;
        const currentWalls = wallsRef.current || [];
        const current = draggingWallPointRef.current;

        // Si un point est déjà en phase 'selected' ou 'moving' :
        // un clic n'importe où repose le point à la position cliquée
        if (current) {
          const wall = currentWalls.find(w => w.id === current.wallId);
          if (wall) {
            const newPoints = wall.points.map((pt, i) =>
              i === current.pointIndex ? { x: wp.x, y: wp.y } : pt
            );
            const updatedWall = { ...wall, points: newPoints };
            wallsRef.current = currentWalls.map(w => w.id === current.wallId ? updatedWall : w);
            onWallUpdatedRef.current?.(updatedWall);
          }
                    selectedWallPointRef.current = null;
         
          draggingWallPointRef.current = null;
          drawRef.current();
          return;
        }

        // Sinon : chercher un point à cliquer → le passer en 'selected'
        let found = false;
        for (const wall of currentWalls) {
          for (let pi = 0; pi < wall.points.length; pi++) {
            const pt = wall.points[pi];
            const dx = (pt.x - wp.x) * vp.scale;
            const dy = (pt.y - wp.y) * vp.scale;
            if (Math.sqrt(dx * dx + dy * dy) < HIT_RADIUS_PX) {
              draggingWallPointRef.current = {
                wallId: wall.id,
                pointIndex: pi,
                phase: 'selected',
              };
                            selectedWallPointRef.current = { wallId: wall.id, pointIndex: pi };
              found = true;
              break;
            }
          }
          if (found) break;
        }
        // Clic dans le vide = désélectionner
        if (!found) {
          draggingWallPointRef.current = null;
        }
        drawRef.current();
      } else if (tool === 'measure') {
        if (measureLockedRef.current) {
          measureStartRef.current = null;
          measureEndRef.current = null;
          measureLockedRef.current = false;
          drawRef.current();
        } else if (!measureStartRef.current) {
          measureStartRef.current = { x: wp.x, y: wp.y };
          measureEndRef.current = { x: wp.x, y: wp.y };
          measureLockedRef.current = false;
        } else {
          measureLockedRef.current = true;
        }
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const tool = activeToolRef.current;
      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);

      // En mode wall-select : clic droit sur un segment = suppression du mur entier
      if (tool === 'wall-select' && roleRef.current === 'gm') {
        const vp = viewportRef.current;
        const HIT_PX = 8;
        const currentWalls = wallsRef.current || [];
        for (const wall of currentWalls) {
          for (let i = 0; i < wall.points.length - 1; i++) {
            const p1 = wall.points[i];
            const p2 = wall.points[i + 1];
            // Distance point-segment en pixels écran
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            let t = lenSq > 0 ? ((wp.x - p1.x) * dx + (wp.y - p1.y) * dy) / lenSq : 0;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * dx, projY = p1.y + t * dy;
            const distPx = Math.sqrt(Math.pow((wp.x - projX) * vp.scale, 2) + Math.pow((wp.y - projY) * vp.scale, 2));
            if (distPx < HIT_PX) {
              onWallRemovedRef.current?.(wall.id);
              return;
            }
          }
        }
        return; // En mode wall-select, ne pas ouvrir le menu token
      }

      const cb = onRightClickTokenRef.current;
      if (!cb) return;
      const token = getTokenAt(wp.x, wp.y);
      if (token) {
        const canEdit = roleRef.current === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userIdRef.current));
        if (canEdit) cb(token, e.clientX, e.clientY);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const tool = activeToolRef.current;
      const overlay = brushOverlayRef.current;

      if (overlay) {
        const isFog = tool === 'fog-reveal' || tool === 'fog-erase';
        if (isFog) {
          const vp = viewportRef.current;
          const brushPx = fogBrushSizeRef.current * vp.scale;
          overlay.style.display = 'block';
          overlay.style.left = `${e.clientX}px`;
          overlay.style.top = `${e.clientY}px`;
          overlay.style.width = `${brushPx * 2}px`;
          overlay.style.height = `${brushPx * 2}px`;
          overlay.style.borderColor = tool === 'fog-reveal'
            ? 'rgba(251,191,36,0.8)'
            : 'rgba(239,68,68,0.8)';
          overlay.style.backgroundColor = tool === 'fog-reveal'
            ? 'rgba(251,191,36,0.08)'
            : 'rgba(239,68,68,0.08)';
        } else {
          overlay.style.display = 'none';
        }
      }

      if (activeToolRef.current === 'wall-select' && draggingWallPointRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const drag = draggingWallPointRef.current;
        // Passer en phase 'moving' dès qu'on bouge avec un point sélectionné
        drag.phase = 'moving';
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === drag.wallId);
        if (wall) {
          const newPoints = wall.points.map((pt, i) =>
            i === drag.pointIndex ? { x: wp2.x, y: wp2.y } : pt
          );
          const updatedWall = { ...wall, points: newPoints };
          // Mise à jour locale immédiate pour le rendu fluide (sans sauvegarder)
          wallsRef.current = currentWalls.map(w => w.id === drag.wallId ? updatedWall : w);
          drawRef.current();
        }
      }

      if (activeToolRef.current === 'measure' && measureStartRef.current && !measureLockedRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        measureEndRef.current = screenToWorld(sp2.x, sp2.y);
        drawRef.current();
      }

      if (isPanningRef.current && lastPanRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
        onViewportChangeRef.current?.(viewportRef.current);
        drawRef.current();
        return;
      }

      if (resizingTokenRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const { id: rId, tokenPx, tokenPy } = resizingTokenRef.current;
        const CELLR = configRef.current.gridSize || 50;
        const rawPx = Math.max(wp2.x - tokenPx, wp2.y - tokenPy, CELLR * 0.1);
        const newSize = Math.max(Math.round((rawPx / CELLR) * 10) / 10, 0.1);
        onResizeTokenRef.current?.(rId, newSize);
        return;
      }

      if (isDragSelectingRef.current && selectionRectRef.current) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        selectionRectRef.current.x2 = wp.x;
        selectionRectRef.current.y2 = wp.y;
        drawRef.current();
      } else if (draggingTokenRef.current) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        const drag = draggingTokenRef.current;
        const nx = wp.x - drag.offsetX;
        const ny = wp.y - drag.offsetY;
        const snapped = snapToGrid(nx, ny);
        if (drag.multiInitial && drag.multiInitial.size > 1) {
          const primaryInit = drag.multiInitial.get(drag.id)!;
          const dx = snapped.x - primaryInit.x;
          const dy = snapped.y - primaryInit.y;
          const currentWalls = wallsRef.current || [];
          if (currentWalls.length > 0) {
            let blocked = false;
            drag.multiInitial.forEach((initPos, tid) => {
              if (blocked) return;
              const newPos = snapToGrid(initPos.x + dx, initPos.y + dy);
              const mt = tokensRef.current.find(t => t.id === tid);
              const mSize = (mt?.size || 1) * (configRef.current.gridSize || 50);
              if (wallBlocksToken(newPos.x, newPos.y, mSize, currentWalls)) blocked = true;
            });
            if (blocked) return;
          }
          drag.multiInitial.forEach((initPos, tid) => {
            const newPos = snapToGrid(initPos.x + dx, initPos.y + dy);
            onMoveTokenRef.current(tid, newPos);
          });
        } else {
          const movingToken = tokensRef.current.find(t => t.id === drag.id);
          const tokenSizePx = (movingToken?.size || 1) * (configRef.current.gridSize || 50);
          const currentWalls = wallsRef.current || [];
          if (currentWalls.length > 0 && wallBlocksToken(snapped.x, snapped.y, tokenSizePx, currentWalls)) return;
          onMoveTokenRef.current(drag.id, snapped);
        }
      } else if (isPaintingFogRef.current && roleRef.current === 'gm') {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        paintFogAt(wp.x, wp.y);
      }
    };

    const onMouseUp = () => {
      if (isDragSelectingRef.current && selectionRectRef.current) {
        const rect = selectionRectRef.current;
        const x1 = Math.min(rect.x1, rect.x2);
        const y1 = Math.min(rect.y1, rect.y2);
        const x2 = Math.max(rect.x1, rect.x2);
        const y2 = Math.max(rect.y1, rect.y2);
        const minSize = 5 / viewportRef.current.scale;
        if (x2 - x1 > minSize || y2 - y1 > minSize) {
          const CELL2 = configRef.current.gridSize || 50;
          const found = tokensRef.current.filter(t => {
            if (roleRef.current === 'player' && !t.visible) return false;
            if (roleRef.current === 'player' && !(t.controlledByUserIds?.includes(userIdRef.current) ?? false)) return false;
            const ts = (t.size || 1) * CELL2;
            return t.position.x < x2 && t.position.x + ts > x1 &&
                   t.position.y < y2 && t.position.y + ts > y1;
          });
          if (found.length > 0) {
            onSelectTokensRef.current?.(found.map(t => t.id));
            onSelectTokenRef.current(found[0].id);
          }
        }
      }
      // En wall-select : ne pas annuler la sélection au mouseUp (le clic suivant repose)
      // On ne fait rien ici pour draggingWallPointRef
      isDragSelectingRef.current = false;
      selectionRectRef.current = null;
      draggingTokenRef.current = null;
      resizingTokenRef.current = null;
      isPaintingFogRef.current = false;
      isPanningRef.current = false;
      lastPanRef.current = null;
      drawRef.current();
    };

    const onMouseLeave = () => {
      onMouseUp();
      if (brushOverlayRef.current) brushOverlayRef.current.style.display = 'none';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sp = getCanvasXY(e.clientX, e.clientY);
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const vp = viewportRef.current;
      const newScale = Math.max(0.2, Math.min(4, vp.scale * delta));
      const wx = (sp.x - vp.x) / vp.scale;
      const wy = (sp.y - vp.y) / vp.scale;
      viewportRef.current = { scale: newScale, x: sp.x - wx * newScale, y: sp.y - wy * newScale };
      onViewportChangeRef.current?.(viewportRef.current);
      drawRef.current();
    };

    const onDblClick = (e: MouseEvent) => {
      if (activeToolRef.current === 'wall-draw' && roleRef.current === 'gm') {
        const pts = wallPointsRef.current;
        if (pts.length >= 2) {
          onWallAddedRef.current?.({ id: crypto.randomUUID(), points: [...pts] });
        }
        wallPointsRef.current = [];
        wallPreviewPosRef.current = null;
        drawRef.current();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Keyboard events (arrows + Escape)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeToolRef.current === 'measure') {
        measureStartRef.current = null;
        measureEndRef.current = null;
        measureLockedRef.current = false;
        drawRef.current();
        return;
      }
      if (e.key === 'Escape' && activeToolRef.current === 'wall-select') {
        // Annuler : remettre le point à sa position d'origine n'est pas stocké,
        // donc on re-fetch depuis wallsRef (déjà à jour car mise à jour locale)
                selectedWallPointRef.current = null;
        draggingWallPointRef.current = null;
        drawRef.current();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeToolRef.current === 'wall-select') {
        const sel = draggingWallPointRef.current;
        if (sel && roleRef.current === 'gm') {
          const currentWalls = wallsRef.current || [];
          const wall = currentWalls.find(w => w.id === sel.wallId);
          if (wall) {
            const newPoints = wall.points.filter((_, i) => i !== sel.pointIndex);
            if (newPoints.length < 2) {
              // Moins de 2 points : supprimer le mur entier
              onWallRemovedRef.current?.(wall.id);
            } else {
              const updatedWall = { ...wall, points: newPoints };
              wallsRef.current = currentWalls.map(w => w.id === sel.wallId ? updatedWall : w);
              onWallUpdatedRef.current?.(updatedWall);
            }
          }
          draggingWallPointRef.current = null;
          drawRef.current();
        }
        return;
      }
      if (e.key === 'Escape' && activeToolRef.current === 'wall-draw') {
        const pts = wallPointsRef.current;
        if (pts.length >= 2) {
          onWallAddedRef.current?.({ id: crypto.randomUUID(), points: [...pts] });
        }
        wallPointsRef.current = [];
        wallPreviewPosRef.current = null;
        drawRef.current();
        return;
      }
      const selId = selectedTokenIdRef.current;
      if (!selId) return;
      const token = tokensRef.current.find(t => t.id === selId);
      if (!token) return;
      const canMove = roleRef.current === 'gm' || (token.controlledByUserIds && token.controlledByUserIds.includes(userIdRef.current));
      if (!canMove) return;
      const c = configRef.current.gridSize || 50;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -c;
      else if (e.key === 'ArrowRight') dx = c;
      else if (e.key === 'ArrowUp') dy = -c;
      else if (e.key === 'ArrowDown') dy = c;
      else return;
      e.preventDefault();
      const newX = token.position.x + dx;
      const newY = token.position.y + dy;
      const tokenSizePx = (token.size || 1) * c;
      const currentWalls = wallsRef.current || [];
      if (currentWalls.length > 0 && wallBlocksToken(newX, newY, tokenSizePx, currentWalls)) return;
      onMoveTokenRef.current(selId, { x: newX, y: newY });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
}