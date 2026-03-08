import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { VTTToken, VTTFogStroke, VTTWall } from '../../types/vtt';
import type { VTTCanvasHandle, VTTCanvasProps } from './vttCanvasTypes';
import { wallBlocksToken } from './vttCanvasUtils';
import { applyStrokeToFogCanvas, buildFogCanvas } from './vttCanvasFog';
import { useVTTCanvasEvents } from './useVTTCanvasEvents';
import { drawVTTCanvas } from './vttCanvasDraw';
 

export const VTTCanvas = forwardRef<VTTCanvasHandle, VTTCanvasProps>(function VTTCanvas({
  config,
  tokens,
  fogState,
  role,
  userId,
  activeTool,
  fogBrushSize,
  onMoveToken,
  onRevealFog,
  selectedTokenId,
  onSelectToken,
  selectedTokenIds = [],
  onSelectTokens,
  onRightClickToken,
  onMapDimensions,
  onDropToken,
  onAddTokenAtPos,
  onResizeToken,
  calibrationPoints,
  onCalibrationPoint,
  walls,
  onWallAdded,
  onWallUpdated,
  onWallRemoved,
  showWalls = false,
  forceViewport: forceViewportProp = null,
  initialViewport = null,
  onViewportChange,
}: VTTCanvasProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brushOverlayRef = useRef<HTMLDivElement>(null);

  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);
  const tokenImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });

  useImperativeHandle(ref, () => ({
    getViewportCenter: () => {
      const vp = viewportRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      return {
        x: (canvas.width / 2 - vp.x) / vp.scale,
        y: (canvas.height / 2 - vp.y) / vp.scale,
      };
    },
  }));

  const draggingTokenRef = useRef<{ id: string; offsetX: number; offsetY: number; multiInitial?: Map<string, { x: number; y: number }> } | null>(null);
  const resizingTokenRef = useRef<{ id: string; tokenPx: number; tokenPy: number } | null>(null);
  const isPaintingFogRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const selectionRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    // Ref partagé pour le point de mur sélectionné en mode wall-select (highlight)
  const selectedWallPointRef = useRef<{ wallId: string; pointIndex: number } | null>(null);
    // Ref pour la sélection multiple de points de mur (wall-select)
  const selectedWallPointsRef = useRef<{ wallId: string; pointIndex: number }[]>([]);
  const isDragSelectingRef = useRef(false);
  const selectedTokenIdsRef = useRef(selectedTokenIds);
  selectedTokenIdsRef.current = selectedTokenIds;
  const onSelectTokensRef = useRef(onSelectTokens);
  onSelectTokensRef.current = onSelectTokens;

  const [mapLoading, setMapLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Sync all props to refs so native event handlers always read current values
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const selectedTokenIdRef = useRef(selectedTokenId);
  selectedTokenIdRef.current = selectedTokenId;
  const configRef = useRef(config);
  configRef.current = config;
  const fogStateRef = useRef(fogState);
  fogStateRef.current = fogState;
  const roleRef = useRef(role);
  roleRef.current = role;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const fogBrushSizeRef = useRef(fogBrushSize);
  fogBrushSizeRef.current = fogBrushSize;
  const onMoveTokenRef = useRef(onMoveToken);
  onMoveTokenRef.current = onMoveToken;
  const onRevealFogRef = useRef(onRevealFog);
  onRevealFogRef.current = onRevealFog;
  const onSelectTokenRef = useRef(onSelectToken);
  onSelectTokenRef.current = onSelectToken;
  const onRightClickTokenRef = useRef(onRightClickToken);
  onRightClickTokenRef.current = onRightClickToken;
  const onMapDimensionsRef = useRef(onMapDimensions);
  onMapDimensionsRef.current = onMapDimensions;
  const onDropTokenRef = useRef(onDropToken);
  onDropTokenRef.current = onDropToken;
  const onAddTokenAtPosRef = useRef(onAddTokenAtPos);
  onAddTokenAtPosRef.current = onAddTokenAtPos;
  const onResizeTokenRef = useRef(onResizeToken);
  onResizeTokenRef.current = onResizeToken;
  const onCalibrationPointRef = useRef(onCalibrationPoint);
  onCalibrationPointRef.current = onCalibrationPoint;
  const calibrationPointsRef = useRef(calibrationPoints);
  calibrationPointsRef.current = calibrationPoints;
  const wallsRef = useRef(walls);
  wallsRef.current = walls;
  const onWallAddedRef = useRef(onWallAdded);
    const onWallUpdatedRef = useRef(onWallUpdated);
  onWallUpdatedRef.current = onWallUpdated;
  const onWallRemovedRef = useRef(onWallRemoved);
  onWallRemovedRef.current = onWallRemoved;
  onWallAddedRef.current = onWallAdded;
  const showWallsRef = useRef(showWalls);
  showWallsRef.current = showWalls;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const wallPointsRef = useRef<{ x: number; y: number }[]>([]);
  const wallPreviewPosRef = useRef<{ x: number; y: number } | null>(null); 
  const measureStartRef = useRef<{ x: number; y: number } | null>(null);
  const measureEndRef = useRef<{ x: number; y: number } | null>(null);
  const measureLockedRef = useRef(false);

  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogCanvasSizeRef = useRef({ w: 0, h: 0 });
  const visionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visionCanvasSizeRef = useRef({ w: 0, h: 0 });
  const dayVisionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dayVisionCanvasSizeRef = useRef({ w: 0, h: 0 });
    const exploredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exploredCanvasSizeRef = useRef({ w: 0, h: 0 });
  const torchAnimRef = useRef<number | null>(null);
  const forceViewportRef = useRef(forceViewportProp);
  forceViewportRef.current = forceViewportProp;

  // drawRef allows image load callbacks to always call latest draw
  const drawRef = useRef<() => void>(() => {});

  const getCanvasXY = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const screenToWorld = (sx: number, sy: number) => {
    const vp = viewportRef.current;
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
  };

  const getTokenAt = (wx: number, wy: number): VTTToken | null => {
    const toks = tokensRef.current;
    const c = configRef.current.gridSize || 50;
    for (let i = toks.length - 1; i >= 0; i--) {
      const t = toks[i];
      if (roleRef.current === 'player' && !t.visible) continue;
      const size = (t.size || 1) * c;
      if (wx >= t.position.x && wx <= t.position.x + size &&
          wy >= t.position.y && wy <= t.position.y + size) {
        return t;
      }
    }
    return null;
  };

  const snapToGrid = (wx: number, wy: number) => {
    const cfg = configRef.current;
    if (!cfg.snapToGrid) return { x: wx, y: wy };
    const c = cfg.gridSize || 50;
    const ox = ((cfg.gridOffsetX || 0) % c + c) % c;
    const oy = ((cfg.gridOffsetY || 0) % c + c) % c;
    return {
      x: Math.round((wx - ox) / c) * c + ox,
      y: Math.round((wy - oy) / c) * c + oy,
    };
  };

  const paintFogAt = (wx: number, wy: number) => {
    const erase = activeToolRef.current === 'fog-erase';
    const stroke: VTTFogStroke = { x: wx, y: wy, r: fogBrushSizeRef.current, erase };
    applyStrokeToFogCanvas(stroke, fogCanvasRef);
    onRevealFogRef.current(stroke);
  };

 

    const draw = useCallback(() => {
    drawVTTCanvas({
      canvasRef,
      mapImgRef,
      mapLoadedRef,
      tokenImageCache,
      viewportRef,
      forceViewportRef,
      configRef,
      fogStateRef,
      roleRef,
      userIdRef,
      selectedTokenIdRef,
      selectedTokenIdsRef,
      tokensRef,
      wallsRef,
      activeToolRef,
      showWallsRef,
      wallPointsRef,
      wallPreviewPosRef,
      selectedWallPointRef,
      selectedWallPointsRef,
      measureStartRef,
      measureEndRef,
      selectionRectRef,
      calibrationPointsRef,
      fogCanvasRef,
      fogCanvasSizeRef,
      visionCanvasRef,
      visionCanvasSizeRef,
      dayVisionCanvasRef,
      dayVisionCanvasSizeRef,
      exploredCanvasRef,
      exploredCanvasSizeRef,
      drawRef,
    });
  }, []);

  drawRef.current = draw;

  // Load map image — clear old image immediately to prevent stale map showing
  useEffect(() => {
    if (!config.mapImageUrl) {
      setMapLoading(false);
      mapLoadedRef.current = false;
      mapImgRef.current = null;
      draw();
      return;
    }
    // Immediately clear previous image so canvas shows dark bg while loading
    mapImgRef.current = null;
    mapLoadedRef.current = false;
    setMapLoading(true);
    draw();

    const img = new Image();
    img.onload = () => {
      mapImgRef.current = img;
      mapLoadedRef.current = true;
      setMapLoading(false);
      if (onMapDimensionsRef.current && img.naturalWidth > 0) {
        onMapDimensionsRef.current(img.naturalWidth, img.naturalHeight);
      }
      draw();
    };
    img.onerror = () => {
      mapImgRef.current = null;
      mapLoadedRef.current = false;
      setMapLoading(false);
      draw();
    };
    img.src = config.mapImageUrl;
  }, [config.mapImageUrl, draw]);

  // Rebuild fog canvas when strokes change (network sync, scene switch, reset)
  useEffect(() => {
    const strokes = fogState.strokes || [];
    const mapW = config.mapWidth || 2000;
    const mapH = config.mapHeight || 2000;
    buildFogCanvas(strokes, mapW, mapH, fogCanvasRef, fogCanvasSizeRef);
    // Reset explored memory on scene change
    exploredCanvasRef.current = null;
    exploredCanvasSizeRef.current = { w: 0, h: 0 };
    drawRef.current();
  }, [fogState.strokes, config.mapWidth, config.mapHeight]);

  // Redraw when visual state changes
  useEffect(() => { draw(); }, [draw, tokens, selectedTokenId, selectedTokenIds, config, calibrationPoints, walls, showWalls]);

  useEffect(() => {
    const hasTorch = tokens.some(t => t.visible && t.lightSource === 'torch');
    const hasNightVision = tokens.some(t => t.visible && (t.visionMode === 'darkvision' || t.visionMode === 'normal' || (t.lightSource && t.lightSource !== 'none')));
    const isNight = config.timeOfDay != null && (config.timeOfDay >= 19 || config.timeOfDay < 5);
    if ((hasTorch || hasNightVision) && isNight) {
      let running = true;
      const animate = () => {
        if (!running) return;
        drawRef.current();
        torchAnimRef.current = requestAnimationFrame(animate);
      };
      torchAnimRef.current = requestAnimationFrame(animate);
      return () => {
        running = false;
        if (torchAnimRef.current) cancelAnimationFrame(torchAnimRef.current);
      };
    } else {
      if (torchAnimRef.current) {
        cancelAnimationFrame(torchAnimRef.current);
        torchAnimRef.current = null;
      }
    }
  }, [tokens, config.timeOfDay]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (forceViewportProp) draw();
  }, [forceViewportProp, draw]);

  // Applique la vue initiale sauvegardée (one-shot, ne se ré-applique pas si les coordonnées changent après)
  const initialViewportAppliedRef = useRef(false);
  const lastAppliedInitialViewportRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  useEffect(() => {
    if (!initialViewport) return;
    const prev = lastAppliedInitialViewportRef.current;
    // Ne ré-applique QUE si c'est une valeur différente de la dernière appliquée
    // (protège contre les re-renders React qui recréent l'objet)
    if (
      prev &&
      Math.abs(prev.x - initialViewport.x) < 0.01 &&
      Math.abs(prev.y - initialViewport.y) < 0.01 &&
      Math.abs(prev.scale - initialViewport.scale) < 0.0001
    ) return;
    lastAppliedInitialViewportRef.current = { ...initialViewport };
    viewportRef.current = { x: initialViewport.x, y: initialViewport.y, scale: initialViewport.scale };
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialViewport?.x, initialViewport?.y, initialViewport?.scale]);

  useVTTCanvasEvents({
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
    selectedWallPointsRef,
    onViewportChangeRef,
    drawRef,
    paintFogAt,
    getCanvasXY,
    screenToWorld,
    getTokenAt,
    snapToGrid,
    activeTool,
  });

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';
  const isWallTool = activeTool === 'wall-draw';
  const isWallSelectTool = activeTool === 'wall-select';
  const isAnyWallTool = isWallTool || isWallSelectTool;
  const isMeasureTool = activeTool === 'measure';

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/vtt-token-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    } else if (e.dataTransfer.types.includes('application/vtt-new-token')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.preventDefault();
    const sp = getCanvasXY(e.clientX, e.clientY);
    const wp = screenToWorld(sp.x, sp.y);
    const cfg = configRef.current;
    const CELL = cfg.gridSize || 50;
    const ox = ((cfg.gridOffsetX || 0) % CELL + CELL) % CELL;
    const oy = ((cfg.gridOffsetY || 0) % CELL + CELL) % CELL;
    const snapped = cfg.snapToGrid
      ? { x: Math.round((wp.x - ox) / CELL) * CELL + ox, y: Math.round((wp.y - oy) / CELL) * CELL + oy }
      : wp;

    const newTokenData = e.dataTransfer.getData('application/vtt-new-token');
    if (newTokenData && onAddTokenAtPosRef.current) {
      try {
        const tokenTemplate = JSON.parse(newTokenData) as Omit<VTTToken, 'id'>;
        onAddTokenAtPosRef.current(tokenTemplate, snapped);
      } catch {}
      return;
    }

    const tokenId = e.dataTransfer.getData('application/vtt-token-id');
    if (tokenId && onDropTokenRef.current) {
      onDropTokenRef.current(tokenId, snapped);
    }
  }; 

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-gray-950"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: isFogTool ? 'none' : (isWallTool || isMeasureTool) ? 'crosshair' : 'default' }}
      />

      {isDragOver && (
        <div className="absolute inset-0 pointer-events-none border-2 border-amber-400/60 bg-amber-400/5 z-10 flex items-center justify-center">
          <div className="bg-gray-900/80 border border-amber-500/60 rounded-xl px-4 py-2 text-amber-300 text-sm font-medium shadow-xl">
            Déposer le token ici
          </div>
        </div>
      )}

      {mapLoading && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20 bg-gray-950/60">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/icons/wmremove-transformed.png"
              alt="Chargement..."
              className="w-16 h-16 object-contain animate-spin opacity-80"
            />
            <span className="text-gray-400 text-sm">Chargement de la carte...</span>
          </div>
        </div>
      )}

      <div
        ref={brushOverlayRef}
        className="pointer-events-none fixed rounded-full border-2 -translate-x-1/2 -translate-y-1/2"
        style={{ display: 'none' }}
      />
    </div>
  );
});

VTTCanvas.displayName = 'VTTCanvas';
