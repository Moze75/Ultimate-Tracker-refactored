import { useEffect, useRef } from 'react';
import type { VTTToken, VTTDoor, VTTWindow } from '../../types/vtt';
import { wallBlocksToken, getDoorT1T2, getWindowT1T2 } from './vttCanvasUtils';
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
  // -------------------
  // Rectangle de sélection fog (fog-rect-reveal / fog-rect-erase)
  // -------------------
  fogRectRef: React.MutableRefObject<{ x1: number; y1: number; x2: number; y2: number } | null>;
  isDragSelectingRef: React.MutableRefObject<boolean>;
  onSelectTokenRef: React.MutableRefObject<(id: string | null) => void>;
  onSelectTokensRef: React.MutableRefObject<((ids: string[]) => void) | undefined>;
  onMoveTokenRef: React.MutableRefObject<
    (id: string, pos: { x: number; y: number }, options?: { localCameraFollow?: boolean }) => void
  >;
  onRevealFogRef: React.MutableRefObject<(stroke: any) => void>;
  onResizeTokenRef: React.MutableRefObject<((id: string, size: number) => void) | undefined>;
  onRightClickTokenRef: React.MutableRefObject<((token: VTTToken, x: number, y: number) => void) | undefined>;
  onCalibrationPointRef: React.MutableRefObject<((pos: { x: number; y: number }) => void) | undefined>;
  onWallAddedRef: React.MutableRefObject<((wall: any) => void) | undefined>;
  onWallUpdatedRef: React.MutableRefObject<((wall: any) => void) | undefined>;
  onWallRemovedRef: React.MutableRefObject<((wallId: string) => void) | undefined>;
  doorsRef: React.MutableRefObject<VTTDoor[]>;
  onDoorAddedRef: React.MutableRefObject<((door: VTTDoor) => void) | undefined>;
  onDoorToggledRef: React.MutableRefObject<((doorId: string, open: boolean) => void) | undefined>;
  onDoorRemovedRef: React.MutableRefObject<((doorId: string) => void) | undefined>;
  doorInProgressRef: React.MutableRefObject<{ wallId: string; segmentIndex: number; t: number; worldX: number; worldY: number } | null>;
  doorPreviewPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  selectedDoorRef: React.MutableRefObject<string | null>;
  hoveredDoorRef: React.MutableRefObject<string | null>;
  selectedDoorEndpointRef: React.MutableRefObject<{ doorId: string; endpoint: 't1' | 't2' } | null>;
  windowsRef: React.MutableRefObject<VTTWindow[]>;
  onWindowAddedRef: React.MutableRefObject<((win: VTTWindow) => void) | undefined>;
  onWindowRemovedRef: React.MutableRefObject<((windowId: string) => void) | undefined>;
  windowInProgressRef: React.MutableRefObject<{ wallId: string; segmentIndex: number; t: number; worldX: number; worldY: number } | null>;
  windowPreviewPosRef: React.MutableRefObject<{ x: number; y: number } | null>;
  hoveredWindowRef: React.MutableRefObject<string | null>;
  selectedWindowRef: React.MutableRefObject<string | null>;
  selectedWindowEndpointRef: React.MutableRefObject<{ windowId: string; endpoint: 't1' | 't2' } | null>;
    selectedWallPointRef: React.MutableRefObject<{ wallId: string; pointIndex: number } | null>;
  selectedWallPointsRef: React.MutableRefObject<{ wallId: string; pointIndex: number }[]>;
  onViewportChangeRef: React.MutableRefObject<((vp: { x: number; y: number; scale: number }) => void) | undefined>;
  onTokenDoubleClickRef: React.MutableRefObject<((token: VTTToken) => void) | undefined>;
  fogCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  fogBrushRef?: React.MutableRefObject<number>;
  drawRef: React.MutableRefObject<() => void>;
  // -------------------
  // paintFogAt : peinture fog, accepte un stroke rectangle optionnel
  // -------------------
  paintFogAt: (wx: number, wy: number, rectStroke?: any) => void;
  // -------------------
  // flushFogBatch : envoie tous les strokes accumulés au mouseUp
  // -------------------
  flushFogBatch: () => void;
  getCanvasXY: (clientX: number, clientY: number) => { x: number; y: number };
  screenToWorld: (sx: number, sy: number) => { x: number; y: number };
  getTokenAt: (wx: number, wy: number) => VTTToken | null;
  snapToGrid: (wx: number, wy: number) => { x: number; y: number };
  activeTool: VTTActiveTool;
  followCameraOnTokenMoveRef: React.MutableRefObject<boolean>;
  centerOnWorldPosition: (x: number, y: number) => void;
  centerOnWorldPositionImmediate: (x: number, y: number) => void;
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
  fogRectRef,
  isDragSelectingRef,
  onSelectTokenRef,
  onSelectTokensRef,
  onMoveTokenRef,
  // -------------------
  // Ref vers le handler fog (utilisé par fog-rect pour envoyer le stroke rectangle)
  // -------------------
  onRevealFogRef,
  onResizeTokenRef,
  onRightClickTokenRef,
    onCalibrationPointRef,
    onWallAddedRef,
    onWallUpdatedRef,
    onWallRemovedRef,
    doorsRef,
    onDoorAddedRef,
    onDoorToggledRef,
    onDoorRemovedRef,
    doorInProgressRef,
    doorPreviewPosRef,
    selectedDoorRef,
    hoveredDoorRef,
    selectedDoorEndpointRef,
    windowsRef,
    onWindowAddedRef,
    onWindowRemovedRef,
    windowInProgressRef,
    windowPreviewPosRef,
    hoveredWindowRef,
    selectedWindowRef,
    selectedWindowEndpointRef,
    selectedWallPointRef,
    selectedWallPointsRef,
    onViewportChangeRef,
    onTokenDoubleClickRef,
    drawRef,
    paintFogAt,
    flushFogBatch,
    getCanvasXY,
    screenToWorld,
    getTokenAt,
    snapToGrid,
    activeTool,
    followCameraOnTokenMoveRef,
    centerOnWorldPosition,
    centerOnWorldPositionImmediate,
}: VTTCanvasRefs) {


  // Refs internes pour l'édition de points de mur (wall-select)
  // Ajout de la propriété phase pour suivre l'état du drag d'un point de mur
  interface DraggingWallPoint {
    wallId: string;
    pointIndex: number;
    originalX: number;
    originalY: number;
    phase?: 'selected' | 'moving';
  }
  const draggingWallPointRef = useRef<DraggingWallPoint | null>(null);

  // Ref interne pour le drag d'une porte en mode wall-select
  const draggingDoorRef = useRef<{
    doorId: string;
    wallId: string;
    segmentIndex: number;
  } | null>(null);

  // Ref interne pour le drag d'un endpoint de porte (t1 ou t2) en mode wall-select
  const draggingDoorEndpointRef = useRef<{
    doorId: string;
    wallId: string;
    segmentIndex: number;
    endpoint: 't1' | 't2';
  } | null>(null);

  // Refs internes pour le drag d'une fenêtre et de ses endpoints en mode wall-select
  const draggingWindowRef = useRef<{
    windowId: string;
    wallId: string;
    segmentIndex: number;
  } | null>(null);

  const draggingWindowEndpointRef = useRef<{
    windowId: string;
    wallId: string;
    segmentIndex: number;
    endpoint: 't1' | 't2';
  } | null>(null);

 const SNAP_RADIUS_PX = 14;
  const snapWallPoint = (
    pos: { x: number; y: number },
    walls: any[],
    wallIdToIgnore?: string,
    pointIndexToIgnore?: number
  ): { x: number; y: number } => {
    const scale = viewportRef.current.scale;
    let best: { x: number; y: number } | null = null;
    let bestDist = SNAP_RADIUS_PX / scale;
    for (const w of walls) {
      for (let pi = 0; pi < w.points.length; pi++) {
        if (w.id === wallIdToIgnore && pi === pointIndexToIgnore) continue;
        const pt = w.points[pi];
        const dx = pt.x - pos.x;
        const dy = pt.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          best = pt;
        }
      }
    }
    return best ?? pos;
  };

  /**
 * Après la création d'un nouveau mur, aligne les points existants d'autres murs
 * qui sont co-localisés (dans le rayon de snap) avec les points du nouveau mur.
 * Cela garantit que les nœuds partagés ont exactement les mêmes coordonnées,
 * même si un léger décalage subsistait avant le snap.
 */
const fuseWallPoints = (
  newPoints: { x: number; y: number }[],
  allWalls: any[],
  onWallUpdated: ((wall: any) => void) | undefined
) => {
  const scale = viewportRef.current.scale;
  const fusionRadius = SNAP_RADIUS_PX / scale;

  for (const newPt of newPoints) {
    for (const wall of allWalls) {
      let changed = false;
      // Aligner les points co-localisés sur newPt
      const fusedPoints = wall.points.map((pt: { x: number; y: number }) => {
        const dx = pt.x - newPt.x;
        const dy = pt.y - newPt.y;
        if (Math.sqrt(dx * dx + dy * dy) < fusionRadius) {
          changed = true;
          return { x: newPt.x, y: newPt.y };
        }
        return pt;
      });
      if (changed) {
        // Dédoublonner : supprimer les points consécutifs identiques
        const deduped = fusedPoints.filter(
          (pt: { x: number; y: number }, i: number) =>
            i === 0 ||
            pt.x !== fusedPoints[i - 1].x ||
            pt.y !== fusedPoints[i - 1].y
        );
        // Ne pas créer un mur avec moins de 2 points
        const finalPoints = deduped.length >= 2 ? deduped : fusedPoints;
        const updatedWall = { ...wall, points: finalPoints };
        const idx = allWalls.findIndex(w => w.id === wall.id);
        if (idx !== -1) allWalls[idx] = updatedWall;
        onWallUpdated?.(updatedWall);
      }
    }
  }
};
  
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
    if (activeTool !== 'door-place') {
      doorInProgressRef.current = null;
      doorPreviewPosRef.current = null;
    }
    if (activeTool !== 'window-place') {
      windowInProgressRef.current = null;
      windowPreviewPosRef.current = null;
    }
    drawRef.current();
  }, [activeTool]);

  // Native mouse/wheel events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;


    const onMouseDown = (e: MouseEvent) => {
      // Nouveau comportement :
      // - Clic droit (bouton 2) = déplacement du canvas
      // - Shift + clic droit = menu contextuel (ciblage)
      // - Clic molette (bouton 1) = ignoré
      // - Alt+gauche = ignoré
      if (e.button === 2 && !e.shiftKey) {
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        isPanningRef.current = true;
        // Empêche le menu contextuel natif
        e.preventDefault();
        return;
      }
      // Shift + clic droit = menu contextuel (ciblage)
      if (e.button === 2 && e.shiftKey) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const token2 = getTokenAt(wp2.x, wp2.y);
        if (token2) {
          e.preventDefault();
          onRightClickTokenRef.current?.(token2, e.clientX, e.clientY);
        }
        return;
      }
      // Désactive le pan au bouton central ou Alt+gauche
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        return;
      }
      if (e.button !== 0) return;

      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);
      const tool = activeToolRef.current;

      // Clic sur une porte en mode select (tous rôles) = toggle open/closed
      if (tool === 'select') {
        const vp0 = viewportRef.current;
        const currentDoors0 = doorsRef.current || [];
        const currentWalls0 = wallsRef.current || [];
        for (const door of currentDoors0) {
          const wall = currentWalls0.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const ddx = (wp.x - cx) * vp0.scale;
          const ddy = (wp.y - cy) * vp0.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            onDoorToggledRef.current?.(door.id, !door.open);
            drawRef.current();
            return;
          }
        }
      }

      if (tool === 'select') {
        const selId = selectedTokenIdRef.current;
        
        // -------------------
        // Gestion du resize des tokens
        // -------------------
        // Le redimensionnement interactif des tokens est reserve au MJ.
        
        if (selId && roleRef.current === 'gm') {
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
              resizingTokenRef.current = {
                id: selId,
                tokenPx: selToken.position.x,
                tokenPy: selToken.position.y,
              };
              return;
            }
          }
        }

        const token = getTokenAt(wp.x, wp.y);
        if (token) {
          const canControl = roleRef.current === 'gm' || (token.controlledByUserIds?.includes(userIdRef.current) ?? false);

          // -------------------
          // Déplacement (drag) — réservé au propriétaire ou MJ
          // -------------------
          // Un joueur peut sélectionner n'importe quel token pour le ciblage,
          // mais seul le MJ ou le propriétaire peut le déplacer.
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

          // -------------------
          // Sélection — accessible à tous les rôles
          // -------------------
          // Permet au joueur de sélectionner plusieurs tokens
          // pour un ciblage groupé via clic droit.
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
        // -------------------
        // Pinceau fog classique
        // -------------------
        isPaintingFogRef.current = true;
        paintFogAt(wp.x, wp.y);
      } else if ((tool === 'fog-rect-reveal' || tool === 'fog-rect-erase') && roleRef.current === 'gm') {
        // -------------------
        // Début du rectangle de sélection fog
        // -------------------
        fogRectRef.current = { x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y };
        drawRef.current();
      } else if (tool === 'grid-calibrate' && roleRef.current === 'gm') {
        onCalibrationPointRef.current?.({ x: wp.x, y: wp.y });
      } else if (tool === 'wall-draw' && roleRef.current === 'gm') {
        const snapped = snapWallPoint(wp, wallsRef.current);
        wallPointsRef.current = [...wallPointsRef.current, snapped];
        wallPreviewPosRef.current = null;
        drawRef.current();
      } else if (tool === 'wall-select' && roleRef.current === 'gm') {
        const vp = viewportRef.current;
        const HIT_RADIUS_PX = 12;
        const currentWalls = wallsRef.current || [];
        const current = draggingWallPointRef.current;

        // Si un point de mur est déjà sélectionné/en déplacement :
        // un clic valide la nouvelle position
        if (current) {
          const wall = currentWalls.find(w => w.id === current.wallId);
          if (wall) {
            const newPoints = wall.points.map((pt: { x: number; y: number }, i: number) =>
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

        // Si un endpoint de porte est en cours de déplacement : valider
        if (draggingDoorEndpointRef.current) {
          const endpointDoor = draggingDoorEndpointRef.current;
          const currentDoors2 = doorsRef.current || [];
          const updatedDoor2 = currentDoors2.find(d => d.id === endpointDoor.doorId);
          if (updatedDoor2) onDoorToggledRef.current?.(updatedDoor2.id, updatedDoor2.open);
          draggingDoorEndpointRef.current = null;
          selectedDoorEndpointRef.current = null;
          drawRef.current();
          return;
        }

        // Si une porte est en cours de déplacement : valider
        if (draggingDoorRef.current) {
          draggingDoorRef.current = null;
          drawRef.current();
          return;
        }

        // Vérifier si on clique sur un endpoint (t1/t2) de porte
        const currentDoors0 = doorsRef.current || [];
        for (const door of currentDoors0) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { t1, t2 } = getDoorT1T2(door, segLen);
          const nx = segDx / segLen, ny = segDy / segLen;
          const ax = p1.x + nx * segLen * t1;
          const ay = p1.y + ny * segLen * t1;
          const bx = p1.x + nx * segLen * t2;
          const by = p1.y + ny * segLen * t2;
          const dax = (wp.x - ax) * vp.scale;
          const day = (wp.y - ay) * vp.scale;
          const dbx = (wp.x - bx) * vp.scale;
          const dby = (wp.y - by) * vp.scale;
          if (Math.sqrt(dax * dax + day * day) < HIT_RADIUS_PX) {
            draggingDoorEndpointRef.current = { doorId: door.id, wallId: door.wallId, segmentIndex: door.segmentIndex, endpoint: 't1' };
            selectedDoorEndpointRef.current = { doorId: door.id, endpoint: 't1' };
            selectedDoorRef.current = door.id;
            draggingDoorRef.current = null;
            draggingWallPointRef.current = null;
            selectedWallPointRef.current = null;
            selectedWallPointsRef.current = [];
            // endpointFound supprimé (inutile)
            drawRef.current();
            return;
          }
          if (Math.sqrt(dbx * dbx + dby * dby) < HIT_RADIUS_PX) {
            draggingDoorEndpointRef.current = { doorId: door.id, wallId: door.wallId, segmentIndex: door.segmentIndex, endpoint: 't2' };
            selectedDoorEndpointRef.current = { doorId: door.id, endpoint: 't2' };
            selectedDoorRef.current = door.id;
            draggingDoorRef.current = null;
            draggingWallPointRef.current = null;
            selectedWallPointRef.current = null;
            selectedWallPointsRef.current = [];
            // endpointFound supprimé (inutile)
            drawRef.current();
            return;
          }
        }

        // Vérifier si on clique sur l'icône d'une porte (sélection porte)
        const currentDoors = doorsRef.current || [];
        let doorFound = false;
        for (const door of currentDoors) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            selectedDoorRef.current = door.id;
            draggingDoorRef.current = { doorId: door.id, wallId: door.wallId, segmentIndex: door.segmentIndex };
            selectedWallPointRef.current = null;
            selectedWallPointsRef.current = [];
            draggingWallPointRef.current = null;
            doorFound = true;
            drawRef.current();
            return;
          }
        }

        if (!doorFound) selectedDoorRef.current = null;

        // Vérifier si on clique sur un endpoint (t1/t2) de fenêtre
        const currentWindows0 = windowsRef.current || [];
        // windowEndpointFound supprimé (inutile)
        for (const win of currentWindows0) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { t1, t2 } = getWindowT1T2(win, segLen);
          const nx = segDx / segLen, ny = segDy / segLen;
          const ax = p1.x + nx * segLen * t1;
          const ay = p1.y + ny * segLen * t1;
          const bx = p1.x + nx * segLen * t2;
          const by = p1.y + ny * segLen * t2;
          const dax = (wp.x - ax) * vp.scale;
          const day = (wp.y - ay) * vp.scale;
          const dbx = (wp.x - bx) * vp.scale;
          const dby = (wp.y - by) * vp.scale;
          if (Math.sqrt(dax * dax + day * day) < HIT_RADIUS_PX) {
            draggingWindowEndpointRef.current = { windowId: win.id, wallId: win.wallId, segmentIndex: win.segmentIndex, endpoint: 't1' };
            selectedWindowEndpointRef.current = { windowId: win.id, endpoint: 't1' };
            selectedWindowRef.current = win.id;
            draggingWindowRef.current = null;
            // windowEndpointFound supprimé (inutile)
            drawRef.current();
            return;
          }
          if (Math.sqrt(dbx * dbx + dby * dby) < HIT_RADIUS_PX) {
            draggingWindowEndpointRef.current = { windowId: win.id, wallId: win.wallId, segmentIndex: win.segmentIndex, endpoint: 't2' };
            selectedWindowEndpointRef.current = { windowId: win.id, endpoint: 't2' };
            selectedWindowRef.current = win.id;
            draggingWindowRef.current = null;
            // windowEndpointFound supprimé (inutile)
            drawRef.current();
            return;
          }
        }

        // Vérifier si on clique sur l'icône d'une fenêtre
        const currentWindows = windowsRef.current || [];
        let windowFound = false;
        for (const win of currentWindows) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getWindowT1T2(win, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            selectedWindowRef.current = win.id;
            draggingWindowRef.current = { windowId: win.id, wallId: win.wallId, segmentIndex: win.segmentIndex };
            windowFound = true;
            drawRef.current();
            return;
          }
        }

        if (!windowFound) selectedWindowRef.current = null;

        // Chercher un point de mur à cliquer
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
                originalX: pt.x,
                originalY: pt.y,
                phase: 'selected',
              };
              selectedWallPointRef.current = { wallId: wall.id, pointIndex: pi };
              found = true;
              break;
            }
          }
          if (found) break;
        }
        // Clic dans le vide = désélectionner tout
        if (!found && !doorFound) {
          draggingWallPointRef.current = null;
          selectedWallPointRef.current = null;
          selectedWallPointsRef.current = [];
          draggingDoorRef.current = null;
          draggingDoorEndpointRef.current = null;
          selectedDoorEndpointRef.current = null;
          isDragSelectingRef.current = true;
          selectionRectRef.current = { x1: wp.x, y1: wp.y, x2: wp.x, y2: wp.y };
        }
        drawRef.current();
      // FIN du bloc wall-select
      } else if (tool === 'door-place') {
        // -------------------
        // Outil porte (GM seulement) : pose en 2 clics sur un segment de mur
        //   1er clic = point de départ (t1), stocké dans doorInProgressRef
        //   2ème clic = point de fin (t2), crée la porte
        // Clic sur icône porte existante = toggle open/closed
        // -------------------
        if (roleRef.current !== 'gm') return;

        const vp = viewportRef.current;
        const currentDoors = doorsRef.current || [];
        const currentWalls = wallsRef.current || [];

        // Vérifier si on clique sur l'icône d'une porte existante
        for (const door of currentDoors) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + segDx * tCenter;
          const cy = p1.y + segDy * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            onDoorToggledRef.current?.(door.id, !door.open);
            drawRef.current();
            return;
          }
        }

        // Trouver le segment de mur le plus proche du clic
        let bestDist = Infinity;
        let bestWallId = '';
        let bestSegIdx = -1;
        let bestT = 0.5;
        let bestWorldX = wp.x;
        let bestWorldY = wp.y;
        for (const wall of currentWalls) {
          for (let i = 0; i < wall.points.length - 1; i++) {
            const p1 = wall.points[i], p2 = wall.points[i + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            let t = lenSq > 0 ? ((wp.x - p1.x) * dx + (wp.y - p1.y) * dy) / lenSq : 0;
            t = Math.max(0.02, Math.min(0.98, t));
            const projX = p1.x + t * dx, projY = p1.y + t * dy;
            const distPx = Math.sqrt(Math.pow((wp.x - projX) * vp.scale, 2) + Math.pow((wp.y - projY) * vp.scale, 2));
            if (distPx < bestDist) {
              bestDist = distPx;
              bestWallId = wall.id;
              bestSegIdx = i;
              bestT = t;
              bestWorldX = projX;
              bestWorldY = projY;
            }
          }
        }

        if (bestSegIdx < 0 || bestDist >= 20) return;

        const inProgress = doorInProgressRef.current;
        if (!inProgress) {
          // 1er clic : stocker le point de départ sur ce segment
          doorInProgressRef.current = {
            wallId: bestWallId,
            segmentIndex: bestSegIdx,
            t: bestT,
            worldX: bestWorldX,
            worldY: bestWorldY,
          };
          drawRef.current();
        } else if (inProgress.wallId === bestWallId && inProgress.segmentIndex === bestSegIdx) {
          // 2ème clic sur le même segment : créer la porte
          const t1 = Math.min(inProgress.t, bestT);
          const t2 = Math.max(inProgress.t, bestT);
          if (t2 - t1 > 0.02) {
            const newDoor: VTTDoor = {
              id: crypto.randomUUID(),
              wallId: bestWallId,
              segmentIndex: bestSegIdx,
              t1,
              t2,
              open: false,
            };
            onDoorAddedRef.current?.(newDoor);
          }
          doorInProgressRef.current = null;
          doorPreviewPosRef.current = null;
          drawRef.current();
        } else {
          // 2ème clic sur un segment différent : annuler et démarrer sur le nouveau segment
          doorInProgressRef.current = {
            wallId: bestWallId,
            segmentIndex: bestSegIdx,
            t: bestT,
            worldX: bestWorldX,
            worldY: bestWorldY,
          };
          drawRef.current();
        }
      } else if (tool === 'window-place') {
        if (roleRef.current !== 'gm') return;

        const vp = viewportRef.current;
        const currentWindows = windowsRef.current || [];
        const currentWalls = wallsRef.current || [];

        for (const win of currentWindows) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getWindowT1T2(win, segLen);
          const cx = p1.x + segDx * tCenter;
          const cy = p1.y + segDy * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            drawRef.current();
            return;
          }
        }

        let bestDist = Infinity;
        let bestWallId = '';
        let bestSegIdx = -1;
        let bestT = 0.5;
        let bestWorldX = wp.x;
        let bestWorldY = wp.y;
        for (const wall of currentWalls) {
          for (let i = 0; i < wall.points.length - 1; i++) {
            const p1 = wall.points[i], p2 = wall.points[i + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            let t = lenSq > 0 ? ((wp.x - p1.x) * dx + (wp.y - p1.y) * dy) / lenSq : 0;
            t = Math.max(0.02, Math.min(0.98, t));
            const projX = p1.x + t * dx, projY = p1.y + t * dy;
            const distPx = Math.sqrt(Math.pow((wp.x - projX) * vp.scale, 2) + Math.pow((wp.y - projY) * vp.scale, 2));
            if (distPx < bestDist) {
              bestDist = distPx;
              bestWallId = wall.id;
              bestSegIdx = i;
              bestT = t;
              bestWorldX = projX;
              bestWorldY = projY;
            }
          }
        }

        if (bestSegIdx < 0 || bestDist >= 20) return;

        const winProgress = windowInProgressRef.current;
        if (!winProgress) {
          windowInProgressRef.current = {
            wallId: bestWallId,
            segmentIndex: bestSegIdx,
            t: bestT,
            worldX: bestWorldX,
            worldY: bestWorldY,
          };
          drawRef.current();
        } else if (winProgress.wallId === bestWallId && winProgress.segmentIndex === bestSegIdx) {
          const t1 = Math.min(winProgress.t, bestT);
          const t2 = Math.max(winProgress.t, bestT);
          if (t2 - t1 > 0.02) {
            const newWindow: VTTWindow = {
              id: crypto.randomUUID(),
              wallId: bestWallId,
              segmentIndex: bestSegIdx,
              t1,
              t2,
            };
            onWindowAddedRef.current?.(newWindow);
          }
          windowInProgressRef.current = null;
          windowPreviewPosRef.current = null;
          drawRef.current();
        } else {
          windowInProgressRef.current = {
            wallId: bestWallId,
            segmentIndex: bestSegIdx,
            t: bestT,
            worldX: bestWorldX,
            worldY: bestWorldY,
          };
          drawRef.current();
        }
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

      // En mode door-place : clic droit = annuler placement en cours OU supprimer porte existante
      if (tool === 'door-place' && roleRef.current === 'gm') {
        // Si un placement est en cours, l'annuler
        if (doorInProgressRef.current) {
          doorInProgressRef.current = null;
          doorPreviewPosRef.current = null;
          drawRef.current();
          return;
        }
        const vp = viewportRef.current;
        const currentDoors = doorsRef.current || [];
        const currentWalls = wallsRef.current || [];
        for (const door of currentDoors) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + segDx * tCenter;
          const cy = p1.y + segDy * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            onDoorRemovedRef.current?.(door.id);
            return;
          }
        }
        return;
      }

      // En mode window-place : clic droit = annuler placement en cours OU supprimer fenêtre existante
      if (tool === 'window-place' && roleRef.current === 'gm') {
        if (windowInProgressRef.current) {
          windowInProgressRef.current = null;
          windowPreviewPosRef.current = null;
          drawRef.current();
          return;
        }
        const vp = viewportRef.current;
        const currentWindows = windowsRef.current || [];
        const currentWalls = wallsRef.current || [];
        for (const win of currentWindows) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getWindowT1T2(win, segLen);
          const cx = p1.x + segDx * tCenter;
          const cy = p1.y + segDy * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 14) {
            onWindowRemovedRef.current?.(win.id);
            return;
          }
        }
        return;
      }

      // En mode wall-select : clic droit sur porte = suppression, sur segment = suppression mur
      if (tool === 'wall-select' && roleRef.current === 'gm') {
        const vp = viewportRef.current;
        const currentWalls = wallsRef.current || [];
        const currentDoors = doorsRef.current || [];

        // Clic droit sur icône porte = supprimer la porte
        for (const door of currentDoors) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 16) {
            onDoorRemovedRef.current?.(door.id);
            if (selectedDoorRef.current === door.id) selectedDoorRef.current = null;
            drawRef.current();
            return;
          }
        }

        // Clic droit sur icône fenêtre = supprimer la fenêtre
        const currentWindows0 = windowsRef.current || [];
        for (const win of currentWindows0) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getWindowT1T2(win, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const ddx = (wp.x - cx) * vp.scale;
          const ddy = (wp.y - cy) * vp.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 16) {
            onWindowRemovedRef.current?.(win.id);
            if (selectedWindowRef.current === win.id) selectedWindowRef.current = null;
            drawRef.current();
            return;
          }
        }

        // Clic droit sur segment = supprimer le mur entier
        const HIT_PX = 8;
        for (const wall of currentWalls) {
          for (let i = 0; i < wall.points.length - 1; i++) {
            const p1 = wall.points[i];
            const p2 = wall.points[i + 1];
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
        return;
      }

      // -------------------
      // Menu contextuel (clic droit) — accessible à tous les rôles
      // -------------------
      // Un joueur peut ouvrir le menu sur n'importe quel token visible
      // pour accéder au ciblage (onToggleTarget).
      // Les actions sensibles (édition, suppression) restent filtrées
      // dans le composant VTTContextMenu selon canEdit.
      const cb = onRightClickTokenRef.current;
      if (!cb) return;
      const token = getTokenAt(wp.x, wp.y);
      if (token) {
        cb(token, e.clientX, e.clientY);
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
        drag.phase = 'moving';
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === drag.wallId);
        if (wall) {
          const snappedPreview = snapWallPoint(wp2, wallsRef.current, drag.wallId, drag.pointIndex);
          const newPoints = wall.points.map((pt, i) =>
            i === drag.pointIndex ? snappedPreview : pt
          );
          const updatedWall = { ...wall, points: newPoints };
          wallsRef.current = currentWalls.map(w => w.id === drag.wallId ? updatedWall : w);
          drawRef.current();
        }
      }
 
      // Déplacement d'un endpoint de porte (t1 ou t2) le long de son segment de mur
      if (activeToolRef.current === 'wall-select' && draggingDoorEndpointRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const dragEp = draggingDoorEndpointRef.current;
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === dragEp.wallId);
        if (wall) {
          const si = dragEp.segmentIndex;
          const pts = wall.points;
          if (si >= 0 && si < pts.length - 1) {
            const p1 = pts[si], p2 = pts[si + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
              let tNew = ((wp2.x - p1.x) * dx + (wp2.y - p1.y) * dy) / lenSq;
              tNew = Math.max(0.01, Math.min(0.99, tNew));
              const currentDoors = doorsRef.current || [];
              const door = currentDoors.find(d => d.id === dragEp.doorId);
              if (door) {
                let updatedDoor;
                if (dragEp.endpoint === 't1') {
                  const t2 = door.t2 ?? 0.99;
                  const newT1 = Math.min(tNew, t2 - 0.02);
                  updatedDoor = { ...door, t1: newT1 };
                } else {
                  const t1 = door.t1 ?? 0.01;
                  const newT2 = Math.max(tNew, t1 + 0.02);
                  updatedDoor = { ...door, t2: newT2 };
                }
                doorsRef.current = currentDoors.map(d => d.id === dragEp.doorId ? updatedDoor : d);
                drawRef.current();
              }
            }
          }
        }
      }

      // Déplacement d'une porte le long de son segment de mur
      if (activeToolRef.current === 'wall-select' && draggingDoorRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const dragDoor = draggingDoorRef.current;
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === dragDoor.wallId);
        if (wall) {
          const si = dragDoor.segmentIndex;
          const pts = wall.points;
          if (si >= 0 && si < pts.length - 1) {
            const p1 = pts[si], p2 = pts[si + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
              let tNew = ((wp2.x - p1.x) * dx + (wp2.y - p1.y) * dy) / lenSq;
              tNew = Math.max(0.01, Math.min(0.99, tNew));
              const currentDoors = doorsRef.current || [];
              const door = currentDoors.find(d => d.id === dragDoor.doorId);
              if (door) {
                const halfWidth = door.width ? door.width / 2 / Math.sqrt(lenSq) : 0.1;
                const newT1 = Math.max(0.01, tNew - halfWidth);
                const newT2 = Math.min(0.99, tNew + halfWidth);
                const updatedDoor = { ...door, t1: newT1, t2: newT2 };
                doorsRef.current = currentDoors.map(d => d.id === dragDoor.doorId ? updatedDoor : d);
                drawRef.current();
              }
            }
          }
        }
      }

      // Déplacement d'un endpoint de fenêtre (t1 ou t2) le long de son segment de mur
      if (activeToolRef.current === 'wall-select' && draggingWindowEndpointRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const dragEpW = draggingWindowEndpointRef.current;
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === dragEpW.wallId);
        if (wall) {
          const si = dragEpW.segmentIndex;
          const pts = wall.points;
          if (si >= 0 && si < pts.length - 1) {
            const p1 = pts[si], p2 = pts[si + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
              let tNew = ((wp2.x - p1.x) * dx + (wp2.y - p1.y) * dy) / lenSq;
              tNew = Math.max(0.01, Math.min(0.99, tNew));
              const currentWindows = windowsRef.current || [];
              const win = currentWindows.find(w => w.id === dragEpW.windowId);
              if (win) {
                let updatedWin;
                if (dragEpW.endpoint === 't1') {
                  const newT1 = Math.min(tNew, (win.t2 ?? 0.9) - 0.02);
                  updatedWin = { ...win, t1: newT1 };
                } else {
                  const newT2 = Math.max(tNew, (win.t1 ?? 0.1) + 0.02);
                  updatedWin = { ...win, t2: newT2 };
                }
                windowsRef.current = currentWindows.map(w => w.id === dragEpW.windowId ? updatedWin : w);
                drawRef.current();
              }
            }
          }
        }
      }

      // Déplacement d'une fenêtre le long de son segment de mur
      if (activeToolRef.current === 'wall-select' && draggingWindowRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const dragWin = draggingWindowRef.current;
        const currentWalls = wallsRef.current || [];
        const wall = currentWalls.find(w => w.id === dragWin.wallId);
        if (wall) {
          const si = dragWin.segmentIndex;
          const pts = wall.points;
          if (si >= 0 && si < pts.length - 1) {
            const p1 = pts[si], p2 = pts[si + 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq > 0) {
              let tNew = ((wp2.x - p1.x) * dx + (wp2.y - p1.y) * dy) / lenSq;
              tNew = Math.max(0.01, Math.min(0.99, tNew));
              const currentWindows = windowsRef.current || [];
              const win = currentWindows.find(w => w.id === dragWin.windowId);
              if (win) {
                const { t1: wt1, t2: wt2 } = getWindowT1T2(win, Math.sqrt(lenSq));
                const halfWidth = (wt2 - wt1) / 2;
                const newT1 = Math.max(0.01, tNew - halfWidth);
                const newT2 = Math.min(0.99, tNew + halfWidth);
                const updatedWin = { ...win, t1: newT1, t2: newT2 };
                windowsRef.current = currentWindows.map(w => w.id === dragWin.windowId ? updatedWin : w);
                drawRef.current();
              }
            }
          }
        }
      }

      if (activeToolRef.current === 'wall-draw') {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const snappedPreview = snapWallPoint(wp2, wallsRef.current);
        wallPreviewPosRef.current = snappedPreview;
        drawRef.current();
      }

      if (activeToolRef.current === 'door-place' && doorInProgressRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        doorPreviewPosRef.current = screenToWorld(sp2.x, sp2.y);
        drawRef.current();
      }

      if (activeToolRef.current === 'window-place' && windowInProgressRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        windowPreviewPosRef.current = screenToWorld(sp2.x, sp2.y);
        drawRef.current();
      }

      // Détection hover porte et fenêtre (mode select uniquement)
      if (activeToolRef.current === 'select') {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const currentDoors = doorsRef.current || [];
        const currentWalls = wallsRef.current || [];
        let foundHoveredDoor: string | null = null;
        for (const door of currentDoors) {
          const wall = currentWalls.find(w => w.id === door.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = door.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getDoorT1T2(door, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const vp0 = viewportRef.current;
          const ddx = (wp2.x - cx) * vp0.scale;
          const ddy = (wp2.y - cy) * vp0.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 18) {
            foundHoveredDoor = door.id;
            break;
          }
        }
        if (hoveredDoorRef.current !== foundHoveredDoor) {
          hoveredDoorRef.current = foundHoveredDoor;
          const canvas = canvasRef.current;
          if (canvas) canvas.style.cursor = foundHoveredDoor ? 'pointer' : 'default';
          drawRef.current();
        }
      } else if (hoveredDoorRef.current !== null) {
        hoveredDoorRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'default';
        drawRef.current();
      }

      // Hover pour les fenêtres (mode select et window-place)
      if (activeToolRef.current === 'select' || activeToolRef.current === 'window-place') {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        const currentWindows = windowsRef.current || [];
        const currentWalls = wallsRef.current || [];
        let foundHoveredWindow: string | null = null;
        for (const win of currentWindows) {
          const wall = currentWalls.find(w => w.id === win.wallId);
          if (!wall) continue;
          const pts = wall.points;
          const si = win.segmentIndex;
          if (si < 0 || si >= pts.length - 1) continue;
          const p1 = pts[si], p2 = pts[si + 1];
          const segDx = p2.x - p1.x, segDy = p2.y - p1.y;
          const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
          if (segLen < 1) continue;
          const { tCenter } = getWindowT1T2(win, segLen);
          const cx = p1.x + (segDx / segLen) * segLen * tCenter;
          const cy = p1.y + (segDy / segLen) * segLen * tCenter;
          const vp0 = viewportRef.current;
          const ddx = (wp2.x - cx) * vp0.scale;
          const ddy = (wp2.y - cy) * vp0.scale;
          if (Math.sqrt(ddx * ddx + ddy * ddy) < 18) {
            foundHoveredWindow = win.id;
            break;
          }
        }
        if (hoveredWindowRef.current !== foundHoveredWindow) {
          hoveredWindowRef.current = foundHoveredWindow;
          drawRef.current();
        }
      } else if (hoveredWindowRef.current !== null) {
        hoveredWindowRef.current = null;
        drawRef.current();
      }

      if (activeToolRef.current === 'measure' && measureStartRef.current && !measureLockedRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        measureEndRef.current = screenToWorld(sp2.x, sp2.y);
        drawRef.current();
      }

      // Rectangle de sélection de points de mur (wall-select, glissé dans le vide)
      if (activeToolRef.current === 'wall-select' && isDragSelectingRef.current && selectionRectRef.current) {
        const sp2 = getCanvasXY(e.clientX, e.clientY);
        const wp2 = screenToWorld(sp2.x, sp2.y);
        selectionRectRef.current.x2 = wp2.x;
        selectionRectRef.current.y2 = wp2.y;
        drawRef.current();
        return;
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

      // -------------------
      // Gestion du resize des tokens
      // -------------------
      // Securite supplementaire : seul le MJ peut appliquer un resize.
      if (resizingTokenRef.current) {
        if (roleRef.current !== 'gm') {
          resizingTokenRef.current = null;
          return;
        }

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
              const curPos = mt?.position;
              if (wallBlocksToken(newPos.x, newPos.y, mSize, currentWalls, doorsRef.current, curPos?.x, curPos?.y)) {
                blocked = true;
              }
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
          const oldPos = movingToken?.position;

          if (
            currentWalls.length > 0 &&
            wallBlocksToken(snapped.x, snapped.y, tokenSizePx, currentWalls, doorsRef.current, oldPos?.x, oldPos?.y)
          ) {
            return;
          }

          onMoveTokenRef.current(drag.id, snapped);


        }
      } else if (isPaintingFogRef.current && roleRef.current === 'gm' && e.buttons === 1) {
        // -------------------
        // Pinceau fog : peinture continue
        // -------------------
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        paintFogAt(wp.x, wp.y);
      } else if (fogRectRef.current && (tool === 'fog-rect-reveal' || tool === 'fog-rect-erase')) {
        // -------------------
        // Rectangle fog : mise à jour du coin opposé pendant le drag
        // -------------------
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        fogRectRef.current.x2 = wp.x;
        fogRectRef.current.y2 = wp.y;
        drawRef.current();
      }
    };

    const onMouseUp = () => {
      // -------------------
      // Finalisation du rectangle de sélection fog (fog-rect-reveal / fog-rect-erase)
      // Au mouseUp, on transforme les coordonnées du rectangle en un stroke
      // rectangulaire et on l'envoie à onRevealFogRef pour persist + broadcast.
      // On applique aussi le stroke localement sur le fogCanvas pour un retour
      // visuel immédiat sans attendre le re-render React.
      // -------------------
      if (fogRectRef.current) {
        const rect = fogRectRef.current;
        const fx1 = Math.min(rect.x1, rect.x2);
        const fy1 = Math.min(rect.y1, rect.y2);
        const fx2 = Math.max(rect.x1, rect.x2);
        const fy2 = Math.max(rect.y1, rect.y2);
        const fw = fx2 - fx1;
        const fh = fy2 - fy1;
        // Ne pas appliquer si le rectangle est trop petit (simple clic sans drag)
        if (fw > 3 && fh > 3) {
          const tool = activeToolRef.current;
          const erase = tool === 'fog-rect-erase';
          const stroke = { x: fx1, y: fy1, r: 0, erase, shape: 'rect' as const, w: fw, h: fh };
          // Envoi direct au handler fog (bypass paintFogAt qui est pensé pour le pinceau)
          onRevealFogRef.current(stroke);
        }
        fogRectRef.current = null;
        drawRef.current();
      }
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
            // -------------------
            // Sélection rectangulaire — filtrage des tokens invisibles
            // -------------------
            // Un joueur ne voit pas les tokens masqués (visible=false).
            // En revanche, il peut sélectionner n'importe quel token visible,
            // même ceux qu'il ne contrôle pas, pour le ciblage groupé.
            if (roleRef.current === 'player' && !t.visible) return false;
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
      // En wall-select : sélection multiple de points par rectangle
      if (activeToolRef.current === 'wall-select' && isDragSelectingRef.current && selectionRectRef.current) {
        const rect = selectionRectRef.current;
        const rx1 = Math.min(rect.x1, rect.x2);
        const ry1 = Math.min(rect.y1, rect.y2);
        const rx2 = Math.max(rect.x1, rect.x2);
        const ry2 = Math.max(rect.y1, rect.y2);
        const minSize = 5 / viewportRef.current.scale;
        if (rx2 - rx1 > minSize || ry2 - ry1 > minSize) {
          const currentWalls = wallsRef.current || [];
          const found: { wallId: string; pointIndex: number }[] = [];
          for (const wall of currentWalls) {
            wall.points.forEach((pt: { x: number; y: number }, pi: number) => {
              if (pt.x >= rx1 && pt.x <= rx2 && pt.y >= ry1 && pt.y <= ry2) {
                found.push({ wallId: wall.id, pointIndex: pi });
              }
            });
          }
          selectedWallPointsRef.current = found;
          selectedWallPointRef.current = null;
          draggingWallPointRef.current = null;
        }
      }
// Persistance + fusion au lâcher en wall-select
if (activeToolRef.current === 'wall-select' && draggingWallPointRef.current) {
  const drag = draggingWallPointRef.current;
  const snapTargetRef = useRef<{ x: number; y: number } | null>(null);
  const currentWalls = wallsRef.current || [];
  const wall = currentWalls.find(w => w.id === drag.wallId);
  if (wall && drag.phase === 'moving') {
    const movedPt = wall.points[drag.pointIndex];
    const scale = viewportRef.current.scale;
    const fusionRadius = SNAP_RADIUS_PX / scale;

    // Chercher un point cible sur un autre mur dans le rayon de fusion
    let targetPt: { x: number; y: number } | null = null;
    for (const other of currentWalls) {
      if (other.id === drag.wallId) continue;
      for (const pt of other.points) {
        const dx = pt.x - movedPt.x;
        const dy = pt.y - movedPt.y;
        if (Math.sqrt(dx * dx + dy * dy) < fusionRadius) {
          targetPt = pt;
          break;
        }
      }
      if (targetPt) break;
    }

    if (targetPt) {
      // Remplacer le point déplacé par les coordonnées exactes du point cible
      // puis supprimer les doublons consécutifs dans le mur source
      const fused = wall.points.map((pt: { x: number; y: number }, i: number) =>
        i === drag.pointIndex ? { x: targetPt!.x, y: targetPt!.y } : pt
      );
      const deduped = fused.filter(
        (pt: { x: number; y: number }, i: number) =>
          i === 0 || pt.x !== fused[i - 1].x || pt.y !== fused[i - 1].y
      );
      const finalPoints = deduped.length >= 2 ? deduped : fused;
      const updatedWall = { ...wall, points: finalPoints };
      wallsRef.current = currentWalls.map(w => w.id === drag.wallId ? updatedWall : w);
      onWallUpdatedRef.current?.(updatedWall);
    } else {
      // Pas de fusion, juste persister la position finale
      onWallUpdatedRef.current?.(wall);
    }
  }
}

// Fin du drag d'un endpoint de porte : persister la nouvelle position
if (activeToolRef.current === 'wall-select' && draggingDoorEndpointRef.current) {
        const dragEp = draggingDoorEndpointRef.current;
        const updatedDoor = (doorsRef.current || []).find(d => d.id === dragEp.doorId);
        if (updatedDoor) {
          onDoorRemovedRef.current?.(updatedDoor.id);
          onDoorAddedRef.current?.(updatedDoor);
        }
        draggingDoorEndpointRef.current = null;
        selectedDoorEndpointRef.current = null;
      }

      // Fin du drag d'une porte : persister la nouvelle position
      if (activeToolRef.current === 'wall-select' && draggingDoorRef.current) {
        const dragDoor = draggingDoorRef.current;
        const updatedDoor = (doorsRef.current || []).find(d => d.id === dragDoor.doorId);
        if (updatedDoor) {
          onDoorRemovedRef.current?.(updatedDoor.id);
          onDoorAddedRef.current?.(updatedDoor);
        }
        draggingDoorRef.current = null;
      }

      // Fin du drag d'un endpoint de fenêtre : persister la nouvelle position
      if (activeToolRef.current === 'wall-select' && draggingWindowEndpointRef.current) {
        const dragEpW = draggingWindowEndpointRef.current;
        const updatedWin = (windowsRef.current || []).find(w => w.id === dragEpW.windowId);
        if (updatedWin) {
          onWindowRemovedRef.current?.(updatedWin.id);
          onWindowAddedRef.current?.(updatedWin);
        }
        draggingWindowEndpointRef.current = null;
        selectedWindowEndpointRef.current = null;
      }

      // Fin du drag d'une fenêtre : persister la nouvelle position
      if (activeToolRef.current === 'wall-select' && draggingWindowRef.current) {
        const dragWin = draggingWindowRef.current;
        const updatedWin = (windowsRef.current || []).find(w => w.id === dragWin.windowId);
        if (updatedWin) {
          onWindowRemovedRef.current?.(updatedWin.id);
          onWindowAddedRef.current?.(updatedWin);
        }
        draggingWindowRef.current = null;
      }

      isDragSelectingRef.current = false;
      selectionRectRef.current = null;
      draggingTokenRef.current = null;
      resizingTokenRef.current = null;
          // -------------------
      // Fin du painting fog : flush le batch accumulé depuis mouseDown
      // Un seul setState + broadcast + RPC pour tout le trait de pinceau
      // -------------------
      if (isPaintingFogRef.current) {
        flushFogBatch();
      }
           isPaintingFogRef.current = false;
      fogRectRef.current = null;
      isPanningRef.current = false;
      lastPanRef.current = null;
      drawRef.current();
    };

    const onMouseLeave = () => {
      if (brushOverlayRef.current) brushOverlayRef.current.style.display = 'none';
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const vp = viewportRef.current;

      // ── Pinch trackpad (ctrlKey=true) ou molette souris → ZOOM ──────────────
      if (e.ctrlKey || e.metaKey) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.2, Math.min(4, vp.scale * delta));
        const wx = (sp.x - vp.x) / vp.scale;
        const wy = (sp.y - vp.y) / vp.scale;
        viewportRef.current = { scale: newScale, x: sp.x - wx * newScale, y: sp.y - wy * newScale };
      } else {
        // ── Scroll 2 doigts trackpad → PAN ────────────────────────────────────
        viewportRef.current = {
          ...vp,
          x: vp.x - e.deltaX,
          y: vp.y - e.deltaY,
        };
      }

      onViewportChangeRef.current?.(viewportRef.current);
      drawRef.current();
    };
 
    const onDblClick = (e: MouseEvent) => {
      if (activeToolRef.current === 'wall-draw' && roleRef.current === 'gm') {
        // handled below
      } else if (activeToolRef.current === 'wall-select' && roleRef.current === 'gm') {
        // handled below
      } else {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        const token = getTokenAt(wp.x, wp.y);
        if (token) {
          onTokenDoubleClickRef.current?.(token);
          return;
        }
      }
if (activeToolRef.current === 'wall-draw' && roleRef.current === 'gm') {
  const pts = wallPointsRef.current;
  if (pts.length >= 2) {
    onWallAddedRef.current?.({ id: crypto.randomUUID(), points: [...pts] });
    // Fusionner les points du nouveau mur avec les points existants co-localisés
    fuseWallPoints(pts, wallsRef.current, onWallUpdatedRef.current);
  }
  wallPointsRef.current = [];
  wallPreviewPosRef.current = null;
  drawRef.current();
  return;
}

      if (activeToolRef.current === 'wall-select' && roleRef.current === 'gm') {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        const vp = viewportRef.current;
        const HIT_PX = 10;
        const currentWalls = wallsRef.current || [];

        let bestWall: any = null;
        let bestSegIndex = -1;
        let bestDist = Infinity;
        let bestProj = { x: 0, y: 0 };

        for (const wall of currentWalls) {
          for (let i = 0; i < wall.points.length - 1; i++) {
            const p1 = wall.points[i];
            const p2 = wall.points[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            let t = lenSq > 0 ? ((wp.x - p1.x) * dx + (wp.y - p1.y) * dy) / lenSq : 0;
            t = Math.max(0, Math.min(1, t));
            const projX = p1.x + t * dx;
            const projY = p1.y + t * dy;
            const distPx = Math.sqrt(
              Math.pow((wp.x - projX) * vp.scale, 2) +
              Math.pow((wp.y - projY) * vp.scale, 2)
            );
            if (distPx < HIT_PX && distPx < bestDist) {
              bestDist = distPx;
              bestWall = wall;
              bestSegIndex = i;
              bestProj = { x: projX, y: projY };
            }
          }
        }

        if (bestWall && bestSegIndex >= 0) {
          // Insérer le nouveau point après l'index du segment
          const newPoints = [
            ...bestWall.points.slice(0, bestSegIndex + 1),
            bestProj,
            ...bestWall.points.slice(bestSegIndex + 1),
          ];
          const updatedWall = { ...bestWall, points: newPoints };
          wallsRef.current = currentWalls.map(w => w.id === bestWall.id ? updatedWall : w);
          onWallUpdatedRef.current?.(updatedWall);
          // Sélectionner immédiatement le nouveau point pour le déplacer
          const newPointIndex = bestSegIndex + 1;
          selectedWallPointRef.current = { wallId: bestWall.id, pointIndex: newPointIndex };
          drawRef.current();
        }
      }
    };

    // ── Touch events (pan 2 doigts + pinch) ─────────────────────────────────
    let lastTouchDist: number | null = null;   // distance entre 2 doigts (pinch)
    let lastTouchMid: { x: number; y: number } | null = null; // milieu des 2 doigts

    const getTouchDist = (t1: Touch, t2: Touch) =>
      Math.sqrt((t2.clientX - t1.clientX) ** 2 + (t2.clientY - t1.clientY) ** 2);

    const getTouchMid = (t1: Touch, t2: Touch) => ({
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    });

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        lastTouchDist = getTouchDist(t1, t2);
        lastTouchMid  = getTouchMid(t1, t2);
        // Annuler tout drag en cours
        isPanningRef.current    = false;
        lastPanRef.current      = null;
        draggingTokenRef.current = null;
      } else if (e.touches.length === 1) {
        // 1 doigt = simuler mousedown pour le pan (bouton central / alt)
        // On ne simule que le pan, pas les actions sur tokens
        lastTouchDist = null;
        lastTouchMid  = null;
        isPanningRef.current  = true;
        lastPanRef.current    = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const newDist = getTouchDist(t1, t2);
        const newMid  = getTouchMid(t1, t2);

        if (lastTouchDist !== null && lastTouchMid !== null) {
          const vp = viewportRef.current;

          // ── Pinch → zoom ──────────────────────────────────────
          const ratio = newDist / lastTouchDist;
          const newScale = Math.max(0.2, Math.min(4, vp.scale * ratio));
          const sp = getCanvasXY(newMid.x, newMid.y);
          const wx = (sp.x - vp.x) / vp.scale;
          const wy = (sp.y - vp.y) / vp.scale;

          // ── Pan 2 doigts ───────────────────────────────────────
          const panDx = newMid.x - lastTouchMid.x;
          const panDy = newMid.y - lastTouchMid.y;

          viewportRef.current = {
            scale: newScale,
            x: sp.x - wx * newScale + panDx,
            y: sp.y - wy * newScale + panDy,
          };
          onViewportChangeRef.current?.(viewportRef.current);
          drawRef.current();
        }

        lastTouchDist = newDist;
        lastTouchMid  = newMid;
      } else if (e.touches.length === 1 && isPanningRef.current && lastPanRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastPanRef.current.x;
        const dy = e.touches[0].clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        viewportRef.current = {
          ...viewportRef.current,
          x: viewportRef.current.x + dx,
          y: viewportRef.current.y + dy,
        };
        onViewportChangeRef.current?.(viewportRef.current);
        drawRef.current();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        lastTouchDist = null;
        lastTouchMid  = null;
      }
      if (e.touches.length === 0) {
        isPanningRef.current = false;
        lastPanRef.current   = null;
      }
    };

    const onWindowMouseMove = (e: MouseEvent) => {
      if (e.buttons === 0) {
        if (isPaintingFogRef.current) {
          if (isPaintingFogRef.current) flushFogBatch();
          isPaintingFogRef.current = false;
        }
        isPanningRef.current = false;
        lastPanRef.current = null;
        return;
      }
      if (isPaintingFogRef.current && roleRef.current === 'gm') {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        paintFogAt(wp.x, wp.y);
      }
      if (isPanningRef.current && lastPanRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
        onViewportChangeRef.current?.(viewportRef.current);
        drawRef.current();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart',  onTouchStart,  { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,   { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd,    { passive: true  });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onWindowMouseMove);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart',  onTouchStart);
      canvas.removeEventListener('touchmove',   onTouchMove);
      canvas.removeEventListener('touchend',    onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onWindowMouseMove);
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
        selectedWallPointRef.current = null;
        selectedWallPointsRef.current = [];
        draggingWallPointRef.current = null;
        draggingDoorRef.current = null;
        draggingDoorEndpointRef.current = null;
        selectedDoorEndpointRef.current = null;
        selectedDoorRef.current = null;
        isDragSelectingRef.current = false;
        selectionRectRef.current = null;
        drawRef.current();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeToolRef.current === 'wall-select') {
        if (roleRef.current !== 'gm') return;

        // Suppression d'une porte sélectionnée
        const selDoor = selectedDoorRef.current;
        if (selDoor) {
          onDoorRemovedRef.current?.(selDoor);
          selectedDoorRef.current = null;
          draggingDoorRef.current = null;
          drawRef.current();
          return;
        }

        let currentWalls = wallsRef.current || [];

        // --- Sélection MULTIPLE (rectangle) ---
        const multiSel = selectedWallPointsRef.current;
        if (multiSel.length > 0) {
          // Grouper les points à supprimer par wallId
          const toDeleteByWall = new Map<string, Set<number>>();
          for (const sp of multiSel) {
            if (!toDeleteByWall.has(sp.wallId)) toDeleteByWall.set(sp.wallId, new Set());
            toDeleteByWall.get(sp.wallId)!.add(sp.pointIndex);
          }
          for (const [wallId, indices] of toDeleteByWall) {
            const wall = currentWalls.find(w => w.id === wallId);
            if (!wall) continue;
            const newPoints = wall.points.filter((_, i) => !indices.has(i));
            if (newPoints.length < 2) {
              onWallRemovedRef.current?.(wallId);
              currentWalls = currentWalls.filter(w => w.id !== wallId);
            } else {
              const updatedWall = { ...wall, points: newPoints };
              currentWalls = currentWalls.map(w => w.id === wallId ? updatedWall : w);
              onWallUpdatedRef.current?.(updatedWall);
            }
          }
          wallsRef.current = currentWalls;
          selectedWallPointsRef.current = [];
          draggingWallPointRef.current = null;
          drawRef.current();
          return;
        }

        // --- Sélection SIMPLE (un seul point) ---
        const sel = draggingWallPointRef.current;
        if (sel) {
          const wall = currentWalls.find(w => w.id === sel.wallId);
          if (wall) {
            const newPoints = wall.points.filter((_, i) => i !== sel.pointIndex);
            if (newPoints.length < 2) {
              onWallRemovedRef.current?.(wall.id);
            } else {
              const updatedWall = { ...wall, points: newPoints };
              wallsRef.current = currentWalls.map(w => w.id === sel.wallId ? updatedWall : w);
              onWallUpdatedRef.current?.(updatedWall);
            }
          }
          draggingWallPointRef.current = null;
          selectedWallPointRef.current = null;
          drawRef.current();
        }
        return;
      }
if (e.key === 'Escape' && activeToolRef.current === 'wall-draw') {
  const pts = wallPointsRef.current;
  if (pts.length >= 2) {
    onWallAddedRef.current?.({ id: crypto.randomUUID(), points: [...pts] });
    // Fusionner les points du nouveau mur avec les points existants co-localisés
    fuseWallPoints(pts, wallsRef.current, onWallUpdatedRef.current);
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
      if (currentWalls.length > 0 && wallBlocksToken(newX, newY, tokenSizePx, currentWalls, doorsRef.current, token.position.x, token.position.y)) return;
onMoveTokenRef.current(selId, { x: newX, y: newY });

if (followCameraOnTokenMoveRef.current) {
  followWorldPosition(
    newX + tokenSizePx / 2,
    newY + tokenSizePx / 2
  );

      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
}