import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { VTTToken, VTTFogStroke, VTTWall } from '../../types/vtt';
import type { VTTCanvasHandle, VTTCanvasProps } from './vttCanvasTypes';
import { wallBlocksToken } from './vttCanvasUtils';
import { applyStrokeToFogCanvas, buildFogCanvas } from './vttCanvasFog';
import { useVTTCanvasEvents } from './useVTTCanvasEvents';
import { drawVTTCanvas } from './vttCanvasDraw';



// -------------------
// Gestion du snapshot local du masque exploré
// -------------------
const getExploredMaskStorageKey = (sceneId: string) => `vtt:explored-mask:${sceneId}`;

export const VTTCanvas = forwardRef<VTTCanvasHandle, VTTCanvasProps>(function VTTCanvas({
  sceneId,
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
  onDropProp,
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
  spectatorMode = 'none',
}: VTTCanvasProps, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brushOverlayRef = useRef<HTMLDivElement>(null);

  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);
  const tokenImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });

    const sceneIdRef = useRef<string | null>(sceneId ?? null);

  // -------------------
  // Ref de la fonction save pour éviter la dépendance d'ordre avec useImperativeHandle
  // (useImperativeHandle est déclaré avant saveExploredMaskSnapshot dans le fichier)
  // -------------------
  const saveExploredMaskSnapshotRef = useRef<((targetSceneId?: string | null) => void) | null>(null);

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
    // -------------------
    // Exposé pour VTTPage : sauvegarde le snapshot avant retour lobby
    // Passe par une ref pour éviter le problème d'ordre de déclaration
    // -------------------
    saveExploredMaskSnapshot: () => {

      saveExploredMaskSnapshotRef.current?.(sceneIdRef.current);
    },
    // -------------------
    // Encode le canvas exploré actuel pour broadcast Realtime vers clients distants
    // Résolution réduite à 256px max + WebP pour rester sous 32KB (limite Supabase)
    // -------------------
    getExploredMaskDataUrl: () => {
      const exploredCanvas = exploredCanvasRef.current;
      if (!exploredCanvas || exploredCanvas.width === 0 || exploredCanvas.height === 0) return null;
      try {
        const maxW = 256;
        const scale = Math.min(1, maxW / exploredCanvas.width);
        const sw = Math.max(1, Math.round(exploredCanvas.width * scale));
        const sh = Math.max(1, Math.round(exploredCanvas.height * scale));
        const snap = document.createElement('canvas');
        snap.width = sw;
        snap.height = sh;
        const ctx = snap.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(exploredCanvas, 0, 0, sw, sh);
        // -------------------
        // WebP avec fallback PNG si navigateur non compatible
        // -------------------
        const webpDataUrl = snap.toDataURL('image/webp', 0.85);
        const dataUrl = webpDataUrl.startsWith('data:image/webp')
          ? webpDataUrl
          : snap.toDataURL('image/png');
        return { dataUrl, width: sw, height: sh };
      } catch {
        return null;
      }
    },
  }));

  const draggingTokenRef = useRef<{ id: string; offsetX: number; offsetY: number; multiInitial?: Map<string, { x: number; y: number }> } | null>(null);
  const resizingTokenRef = useRef<{ id: string; tokenPx: number; tokenPy: number } | null>(null);
  const isPaintingFogRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);
  const selectionRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // -------------------
  // Rectangle de sélection fog (fog-rect-reveal / fog-rect-erase)
  // -------------------
  const fogRectRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
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
    const onDropPropRef = useRef(onDropProp);
  onDropPropRef.current = onDropProp;
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
  // -------------------
  // Cache du masque inversé du fog (fogInv)
  // Recalculé uniquement quand fogCanvasRef change, pas à chaque frame.
  // Évite de créer un canvas mapW×mapH à chaque draw() pendant l'animation torche.
  // -------------------
  const fogInvCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fogInvVersionRef = useRef<number>(0);
  const visionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const visionCanvasSizeRef = useRef({ w: 0, h: 0 });
  const dayVisionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dayVisionCanvasSizeRef = useRef({ w: 0, h: 0 });
  const exploredCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exploredCanvasSizeRef = useRef({ w: 0, h: 0 });
  // -------------------
  // Flag de protection : empêche vttCanvasDraw de recréer exploredCanvas
  // pendant qu'une restauration asynchrone est en cours
  // ------------------- 
  const exploredCanvasRestoringRef = useRef(false);
  // -------------------
  // Mémorise la longueur précédente de exploredStrokes
  // pour détecter uniquement un reset fog intentionnel (transition N→0)
  // -------------------

  const torchAnimRef = useRef<number | null>(null);
  const forceViewportRef = useRef(forceViewportProp);
  forceViewportRef.current = forceViewportProp;
  const spectatorModeRef = useRef(spectatorMode);
  spectatorModeRef.current = spectatorMode;

  // drawRef allows image load callbacks to always call latest draw
  const drawRef = useRef<() => void>(() => {});

  // -------------------
  // Gestion du snapshot local du masque exploré
  // -------------------
  const saveExploredMaskSnapshot = useCallback((targetSceneId?: string | null) => {
    const sceneIdToSave = targetSceneId ?? sceneId;
    if (!sceneIdToSave) {
      console.warn('[FOG-SNAPSHOT] save: sceneId manquant, abandon');
      return;
    }

    const exploredCanvas = exploredCanvasRef.current;
    if (!exploredCanvas || exploredCanvas.width === 0 || exploredCanvas.height === 0) {
      console.warn('[FOG-SNAPSHOT] save: canvas invalide ou absent', {
        canvas: !!exploredCanvas,
        w: exploredCanvas?.width,
        h: exploredCanvas?.height,
      });
      return;
    }


    try {
      const maxSnapshotWidth = 512;
      const scale = Math.min(1, maxSnapshotWidth / exploredCanvas.width);
      const snapshotWidth = Math.max(1, Math.round(exploredCanvas.width * scale));
      const snapshotHeight = Math.max(1, Math.round(exploredCanvas.height * scale));

      const snapshotCanvas = document.createElement('canvas');
      snapshotCanvas.width = snapshotWidth;
      snapshotCanvas.height = snapshotHeight;

      const snapshotCtx = snapshotCanvas.getContext('2d');
      if (!snapshotCtx) return;

      snapshotCtx.drawImage(exploredCanvas, 0, 0, snapshotWidth, snapshotHeight);

       // -------------------
      // WebP est 5-8x plus léger que PNG sur un masque monochromatique
      // Fallback PNG si le navigateur ne supporte pas WebP (rare)
      // -------------------
      const webpDataUrl = snapshotCanvas.toDataURL('image/webp', 0.85);
      const dataUrl = webpDataUrl.startsWith('data:image/webp')
        ? webpDataUrl
        : snapshotCanvas.toDataURL('image/png');

      localStorage.setItem(
        getExploredMaskStorageKey(sceneIdToSave),
        JSON.stringify({
          width: snapshotWidth,
          height: snapshotHeight,
          dataUrl,
        })
      );



    } catch (error) {
      console.warn('[FOG-SNAPSHOT] save: ERREUR', error);
    }
  }, [sceneId]);
  // Maintient la ref synchronisée avec la dernière version du callback
  saveExploredMaskSnapshotRef.current = saveExploredMaskSnapshot;

  // -------------------
  // Gestion du snapshot local du masque exploré
  // -------------------
   // -------------------
  // Restauration du snapshot local du masque exploré
  // Utilise exploredCanvasRestoringRef pour protéger le canvas pendant
  // le chargement asynchrone de l'image, afin que vttCanvasDraw ne
  // le recrée pas en noir entre-temps
  // -------------------
  const restoreExploredMaskSnapshot = useCallback(() => {
    if (!sceneId) {
      console.warn('[FOG-SNAPSHOT] restore: sceneId manquant');
      return false;
    }
    console.log('[FOG-SNAPSHOT] restore: tentative pour scène', sceneId);

    const mapW = configRef.current.mapWidth || 2000;
    const mapH = configRef.current.mapHeight || 2000;

    // Réutilise le canvas pré-créé si les dimensions correspondent,
    // sinon en crée un nouveau (cas de changement de taille de carte)
    if (!exploredCanvasRef.current || exploredCanvasRef.current.width !== mapW || exploredCanvasRef.current.height !== mapH) {
      const nextCanvas = document.createElement('canvas');
      nextCanvas.width = mapW;
      nextCanvas.height = mapH;
      const nextCtx = nextCanvas.getContext('2d');
      if (nextCtx) {
        nextCtx.fillStyle = 'rgba(0,0,0,1)';
        nextCtx.fillRect(0, 0, mapW, mapH);
      }
      exploredCanvasRef.current = nextCanvas;
      exploredCanvasSizeRef.current = { w: mapW, h: mapH };
    }

    const targetCanvas = exploredCanvasRef.current;
    const targetCtx = targetCanvas?.getContext('2d');
    if (!targetCanvas || !targetCtx) return false;

       try {
      const raw = localStorage.getItem(getExploredMaskStorageKey(sceneId));
      if (!raw) {
        console.log('[FOG-SNAPSHOT] restore: aucun snapshot en localStorage pour', sceneId);
        return false;
      }
      console.log('[FOG-SNAPSHOT] restore: snapshot trouvé, taille JSON =', raw.length);

      const parsed = JSON.parse(raw) as { width: number; height: number; dataUrl: string };
      if (!parsed?.dataUrl) {
        console.log('[FOG-SNAP] snapshot corrompu pour scène', sceneId);
        return false;
      }



      // -------------------
      // Pose le flag de restauration : vttCanvasDraw ne doit PAS recréer
      // exploredCanvasRef tant que ce flag est true
      // -------------------
      exploredCanvasRestoringRef.current = true;

      const img = new Image();
      img.onload = () => {
        // -------------------
        // On force la réassignation dans exploredCanvasRef : le snapshot prime
        // même si vttCanvasDraw a recréé le canvas entre-temps
        // -------------------

        targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
        targetCtx.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
        exploredCanvasRef.current = targetCanvas;
        exploredCanvasSizeRef.current = { w: targetCanvas.width, h: targetCanvas.height };
        exploredCanvasRestoringRef.current = false;
        drawRef.current();
      };
      img.onerror = () => {
        console.error('[FOG-SNAPSHOT] restore: img.onerror — snapshot corrompu ou inaccessible');
        exploredCanvasRestoringRef.current = false;
      };
      img.src = parsed.dataUrl;

      return true;
    } catch (error) {
      exploredCanvasRestoringRef.current = false;
      console.warn('[VTT] Impossible de restaurer le snapshot local du masque exploré:', error);
      return false;
    }
  }, [sceneId]);

  
  // -------------------
  // Réinitialisation des canvases mémoire au changement de scène
  // -------------------
   useEffect(() => {
    const previousSceneId = sceneIdRef.current;

    // -------------------
    // Sauvegarde de la scène précédente
    // On capture le canvas MAINTENANT, avant tout reset ou redraw
    // On travaille sur une copie gelée pour éviter qu'un draw concurrent l'écrase
    // -------------------
    if (previousSceneId && previousSceneId !== sceneId) {
      const canvasToSave = exploredCanvasRef.current;
      if (canvasToSave && canvasToSave.width > 0 && canvasToSave.height > 0) {
        // -------------------
        // Copie défensive : on clone le canvas MAINTENANT pour éviter
        // qu'un draw suivant l'écrase avant la fin de la sauvegarde
        // -------------------
        const frozenCanvas = document.createElement('canvas');
        frozenCanvas.width = canvasToSave.width;
        frozenCanvas.height = canvasToSave.height;
        const frozenCtx = frozenCanvas.getContext('2d');
        if (frozenCtx) {
          frozenCtx.drawImage(canvasToSave, 0, 0);



          // Sauvegarde depuis la copie gelée
          try {
            const maxW = 512;
            const scale = Math.min(1, maxW / frozenCanvas.width);
            const sw = Math.max(1, Math.round(frozenCanvas.width * scale));
            const sh = Math.max(1, Math.round(frozenCanvas.height * scale));
            const snapCanvas = document.createElement('canvas');
            snapCanvas.width = sw;
            snapCanvas.height = sh;
            const snapCtx = snapCanvas.getContext('2d');
            if (snapCtx) {
              snapCtx.drawImage(frozenCanvas, 0, 0, sw, sh);
              const dataUrl = snapCanvas.toDataURL('image/png');
              localStorage.setItem(
                getExploredMaskStorageKey(previousSceneId),
                JSON.stringify({ width: sw, height: sh, dataUrl })
              );



            }
          } catch (e) {
            console.warn('[FOG-SNAPSHOT] save gelé ERREUR:', e);
          }
        }
      } else {
        console.warn('[FOG-SNAPSHOT] save gelé: canvas absent ou vide au moment du changement de scène');
        // Fallback : tentative via saveExploredMaskSnapshot classique
        saveExploredMaskSnapshot(previousSceneId);
      }
    }

    // -------------------
    // Reset des canvases mémoire après sauvegarde
    // -------------------
    fogCanvasRef.current = null;
    fogCanvasSizeRef.current = { w: 0, h: 0 };

    visionCanvasRef.current = null;
    visionCanvasSizeRef.current = { w: 0, h: 0 };

    dayVisionCanvasRef.current = null;
    dayVisionCanvasSizeRef.current = { w: 0, h: 0 };

    // -------------------
    // Pré-création du canvas exploré AVANT le draw
    // -------------------
    const mapW = configRef.current.mapWidth || 2000;
    const mapH = configRef.current.mapHeight || 2000;
    const preCanvas = document.createElement('canvas');
    preCanvas.width = mapW;
    preCanvas.height = mapH;
    const preCtx = preCanvas.getContext('2d');
    if (preCtx) {
      preCtx.fillStyle = 'rgba(0,0,0,1)';
      preCtx.fillRect(0, 0, mapW, mapH);
    }
    exploredCanvasRef.current = preCanvas;
    exploredCanvasSizeRef.current = { w: mapW, h: mapH };

    sceneIdRef.current = sceneId ?? null;
    prevExploredStrokesLenRef.current = -1;

    drawRef.current();

    restoreExploredMaskSnapshot();
  }, [sceneId, restoreExploredMaskSnapshot, saveExploredMaskSnapshot]);

    // -------------------
  // Gestion du snapshot local du masque exploré + nettoyage RAF peinture fog
  // -------------------
  useEffect(() => {
    return () => {
      // Annule le RAF de peinture fog si en cours
      if (fogPaintRafRef.current) {
        cancelAnimationFrame(fogPaintRafRef.current);
        fogPaintRafRef.current = null;
      }
      saveExploredMaskSnapshot(sceneIdRef.current);
    };
  }, [saveExploredMaskSnapshot]);



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

  // -------------------
  // -------------------
  // Gestion de la peinture du brouillard de guerre
  // Applique le stroke localement sur le fogCanvas pour un retour visuel
  // instantané, puis planifie un seul redraw via requestAnimationFrame.
  // L'envoi au state partagé est différé (batched) pour ne pas provoquer
  // un re-render React + useEffect + draw() supplémentaire à chaque pixel.
  // -------------------
  const fogPaintRafRef = useRef<number | null>(null);
  const fogPaintBatchRef = useRef<VTTFogStroke[]>([]);

  const paintFogAt = (wx: number, wy: number) => {
    const erase = activeToolRef.current === 'fog-erase';
    const stroke: VTTFogStroke = { x: wx, y: wy, r: fogBrushSizeRef.current, erase };

    // -------------------
    // Application locale immédiate sur le fogCanvas (O(1) : 1 seul arc)
    // -------------------
    applyStrokeToFogCanvas(stroke, fogCanvasRef);

    // -------------------
    // Invalidation du cache fogInv UNE SEULE FOIS par frame
    // (pas à chaque mousemove — un seul null suffit)
    // -------------------
    fogInvCanvasRef.current = null;

    // -------------------
    // Accumule le stroke dans le batch pour envoi différé
    // -------------------
    fogPaintBatchRef.current.push(stroke);
    prevStrokesLenRef.current++;

    // -------------------
    // Planifie un seul draw + flush par frame d'animation
    // Si un RAF est déjà en attente, on n'en crée pas un deuxième.
    // Cela regroupe tous les mousemove d'une même frame en un seul draw().
    // -------------------
    if (fogPaintRafRef.current === null) {
      fogPaintRafRef.current = requestAnimationFrame(() => {
        fogPaintRafRef.current = null;
        // -------------------
        // Un seul draw() pour tous les strokes accumulés dans cette frame
        // -------------------
        draw();
        // -------------------
        // Flush batch : envoie TOUS les strokes en UN SEUL appel
        // au lieu de N appels onRevealFog (qui chacun fait setState + RPC + broadcast)
        // -------------------
        const batch = fogPaintBatchRef.current;
        fogPaintBatchRef.current = [];
        if (batch.length > 0) {
          onRevealFogRef.current(batch);
        }
      });
    }
  };

 

    const draw = useCallback(() => {
    drawVTTCanvas({
      canvasRef,
      mapImgRef,
      mapLoadedRef,
      tokenImageCache,
      viewportRef,
      forceViewportRef,
      spectatorModeRef,
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
      // -------------------
      // Rectangle de preview fog (fog-rect-reveal / fog-rect-erase)
      // -------------------
      fogRectRef,
      calibrationPointsRef,
      fogCanvasRef,
      fogCanvasSizeRef,
      // -------------------
      // Refs du cache fogInv (masque inversé du fog pour percement vision)
      // -------------------
      fogInvCanvasRef,
      fogInvVersionRef,
      visionCanvasRef,
      visionCanvasSizeRef,
      dayVisionCanvasRef,
      dayVisionCanvasSizeRef,
      exploredCanvasRef,
      exploredCanvasSizeRef,
      exploredCanvasRestoringRef,
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

  // -------------------
   // -------------------
  // Reconstruction du canvas de brouillard de guerre
  // + détection du reset fog (tout masquer) et du reveal all (tout révéler)
  // + application des strokes erase sur le canvas exploré (mémoire)
  // -------------------
  const prevExploredStrokesLenRef = useRef<number>(-1);
  const prevStrokesLenRef = useRef<number>(0);

  useEffect(() => { 
    const strokes = fogState.strokes || [];
    const exploredStrokes = fogState.exploredStrokes || [];
    const mapW = config.mapWidth || 2000;
    const mapH = config.mapHeight || 2000;

    // -------------------
    // Reconstruction du fogCanvas — incrémentale ou totale
    // On ne reconstruit depuis zéro QUE si :
    //   - le fogCanvas n'existe pas (premier render, changement de scène)
    //   - la taille de la carte a changé
    //   - un reset fog a eu lieu (strokes vide ou diminué)
    // Sinon on applique uniquement les nouveaux strokes → O(1) au lieu de O(N)
    // -------------------
    const prevSLen = prevStrokesLenRef.current;
    const needsFullRebuild =
      !fogCanvasRef.current ||
      fogCanvasSizeRef.current.w !== mapW ||
      fogCanvasSizeRef.current.h !== mapH ||
      strokes.length < prevSLen ||
      strokes.length === 0;

    if (needsFullRebuild) {
      fogCanvasRef.current = null;
      fogCanvasSizeRef.current = { w: 0, h: 0 };
      buildFogCanvas(strokes, mapW, mapH, fogCanvasRef, fogCanvasSizeRef);
    } else if (strokes.length > prevSLen) {
      // Application incrémentale : seuls les nouveaux strokes sont dessinés
      for (let i = prevSLen; i < strokes.length; i++) {
        applyStrokeToFogCanvas(strokes[i], fogCanvasRef);
      }
    }

    // -------------------
    // Invalidation du cache fogInv (masque inversé du fog)
    // Sera recalculé au prochain draw() uniquement
    // -------------------
    fogInvCanvasRef.current = null;
    fogInvVersionRef.current++; 
 
    // -------------------
    // Détection du reset fog (tout masquer)
    // Condition : exploredStrokes passe de > 0 à 0 ET strokes aussi à 0
    // Le prevLen === -1 est ignoré (premier chargement / changement de scène)
    // -------------------
    const prevLen = prevExploredStrokesLenRef.current;
    const currLen = exploredStrokes.length;
    const isIntentionalReset = prevLen > 0 && currLen === 0;
    prevExploredStrokesLenRef.current = currLen;

    if (isIntentionalReset && exploredCanvasRef.current) {
      // Réinitialise le canvas exploré en noir (tout masqué)
      const eCtx = exploredCanvasRef.current.getContext('2d');
      if (eCtx) {
        eCtx.fillStyle = 'rgba(0,0,0,1)';
        eCtx.fillRect(0, 0, mapW, mapH);
      }
      // Supprime le snapshot localStorage pour éviter une restauration fantôme
      if (sceneId) {
        localStorage.removeItem(getExploredMaskStorageKey(sceneId));
      }
    }

    // -------------------
    // Détection du "Tout révéler" : strokes contient un unique stroke géant non-erase
    // qui couvre toute la carte. On applique destination-out sur tout le exploredCanvas
    // pour que la mémoire soit aussi entièrement explorée.
    // -------------------
    if (exploredCanvasRef.current && strokes.length > 0 && exploredStrokes.length > 0) {
      const lastStroke = strokes[strokes.length - 1];
      const diag = Math.sqrt(mapW * mapW + mapH * mapH);
      // Si le dernier stroke est un cercle géant qui couvre la carte → c'est un reveal all
      if (!lastStroke.erase && lastStroke.r >= diag * 0.9) {
        const eCtx = exploredCanvasRef.current.getContext('2d');
        if (eCtx) {
          // Efface tout le noir du canvas exploré → tout est exploré
          eCtx.clearRect(0, 0, mapW, mapH);
        }
      }
    }

    // -------------------
    // Application des strokes erase sur le canvas exploré (mémoire)
    // Quand le MJ utilise le pinceau fog-erase, le stroke erase est ajouté
    // aux strokes mais PAS aux exploredStrokes. Il faut repérer les nouveaux
    // strokes erase et peindre du noir opaque sur le canvas exploré pour
    // effacer la mémoire de cette zone (sinon on voit du gris au lieu du noir).
    // -------------------
    const prevStrokesLen = prevStrokesLenRef.current;
    prevStrokesLenRef.current = strokes.length;

    if (strokes.length > prevStrokesLen && prevStrokesLen >= 0 && exploredCanvasRef.current) {
      const ec = exploredCanvasRef.current;
      const eCtx = ec.getContext('2d');
      if (eCtx) {
        for (let i = prevStrokesLen; i < strokes.length; i++) {
          const s = strokes[i];
          if (s.erase) {
            // Peint du noir opaque → efface la mémoire explorée pour cette zone
            eCtx.globalCompositeOperation = 'source-over';
            eCtx.fillStyle = 'rgba(0,0,0,1)';
            eCtx.beginPath();
            eCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            eCtx.fill();
          }
        }
      }
    }

    // -------------------
    // Redraw seulement si le changement ne vient PAS de paintFogAt
    // (paintFogAt fait déjà son propre draw via RAF, pas besoin d'un 2e)
    // Si fogPaintRafRef est non-null, un RAF est en attente → skip le draw
    // -------------------
    if (!fogPaintRafRef.current) {
      drawRef.current();
    }
  }, [fogState.strokes, fogState.exploredStrokes, config.mapWidth, config.mapHeight, sceneId]);

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
    fogRectRef,
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

  // -------------------
  // Détection de tous les outils fog (pinceau + rectangle)
  // -------------------
  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';
  const isFogRectTool = activeTool === 'fog-rect-reveal' || activeTool === 'fog-rect-erase';
  const isAnyFogTool = isFogTool || isFogRectTool;
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
    } else if (e.dataTransfer.types.includes('application/vtt-prop-url')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
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
      return;
    }

    // Drop depuis la bibliothèque de props
    const propUrl = e.dataTransfer.getData('application/vtt-prop-url');
    if (propUrl && onDropPropRef.current) {
      onDropPropRef.current({
        url: propUrl,
        name: e.dataTransfer.getData('application/vtt-prop-name') || 'Prop',
        isVideo: e.dataTransfer.getData('application/vtt-prop-isvideo') === 'true',
      }, snapped);
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
               style={{ cursor: isFogTool ? 'none' : (isFogRectTool || isWallTool || isMeasureTool) ? 'crosshair' : 'default' }}
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
