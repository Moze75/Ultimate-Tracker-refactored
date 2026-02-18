import React, { useRef, useEffect, useCallback } from 'react';
import type { VTTToken, VTTRoomConfig, VTTFogState, VTTRole } from '../../types/vtt';

interface VTTCanvasProps {
  config: VTTRoomConfig;
  tokens: VTTToken[];
  fogState: VTTFogState;
  role: VTTRole;
  userId: string;
  activeTool: 'select' | 'fog-reveal' | 'fog-erase';
  fogBrushSize: number;
  onMoveToken: (tokenId: string, position: { x: number; y: number }) => void;
  onRevealFog: (cells: string[]) => void;
  selectedTokenId: string | null;
  onSelectToken: (id: string | null) => void;
  onRightClickToken?: (token: VTTToken, screenX: number, screenY: number) => void;
  onMapDimensions?: (w: number, h: number) => void;
}

export function VTTCanvas({
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
  onRightClickToken,
  onMapDimensions,
}: VTTCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const brushOverlayRef = useRef<HTMLDivElement>(null);

  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);
  const tokenImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const viewportRef = useRef({ x: 0, y: 0, scale: 1 });

  const draggingTokenRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const isPaintingFogRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);

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
    return { x: Math.round(wx / c) * c, y: Math.round(wy / c) * c };
  };

  const paintFogAt = (wx: number, wy: number) => {
    const c = configRef.current.gridSize || 50;
    const bx = Math.floor(wx / c);
    const by = Math.floor(wy / c);
    const brushSize = fogBrushSizeRef.current;
    const cells: string[] = [];
    for (let dy = -brushSize + 1; dy < brushSize; dy++) {
      for (let dx = -brushSize + 1; dx < brushSize; dx++) {
        if (dx * dx + dy * dy < brushSize * brushSize) {
          cells.push(`${bx + dx},${by + dy}`);
        }
      }
    }
    onRevealFogRef.current(cells);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const vp = viewportRef.current;
    const cfg = configRef.current;
    const CELL = cfg.gridSize || 50;
    const fog = fogStateRef.current;
    const curRole = roleRef.current;
    const curUserId = userIdRef.current;
    const currentSelectedId = selectedTokenIdRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    const mapW = cfg.mapWidth || 2000;
    const mapH = cfg.mapHeight || 2000;

    if (mapImgRef.current && mapLoadedRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, mapW, mapH);
    } else {
      ctx.fillStyle = '#1a1f2e';
      ctx.fillRect(0, 0, mapW, mapH);
    }

    if (CELL > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1 / vp.scale;
      for (let gx = 0; gx <= mapW; gx += CELL) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, mapH); ctx.stroke();
      }
      for (let gy = 0; gy <= mapH; gy += CELL) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(mapW, gy); ctx.stroke();
      }
    }

    tokensRef.current.forEach(token => {
      if (!token.visible && curRole === 'player') return;
      const px = token.position.x;
      const py = token.position.y;
      const size = (token.size || 1) * CELL;
      const cx = px + size / 2;
      const cy = py + size / 2;
      const r = size / 2 - 4;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((token.rotation || 0) * Math.PI / 180);

      if (token.imageUrl) {
        let img = tokenImageCache.current.get(token.imageUrl);
        if (!img) {
          img = new Image();
          img.onload = () => drawRef.current();
          img.src = token.imageUrl;
          tokenImageCache.current.set(token.imageUrl, img);
        }
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.clip();
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, -r, -r, r * 2, r * 2);
        } else {
          ctx.fillStyle = token.color || '#3b82f6';
          ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = token.color || '#3b82f6';
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, cy);

      if (token.id === currentSelectedId) {
        const pad = 5 / vp.scale;
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5 / vp.scale;
        ctx.setLineDash([6 / vp.scale, 3 / vp.scale]);
        ctx.strokeRect(-size / 2 - pad, -size / 2 - pad, size + pad * 2, size + pad * 2);
        ctx.setLineDash([]);
      }

      const owned = token.ownerUserId === curUserId;
      ctx.beginPath();
      ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = owned ? '#22c55e' : '#94a3b8';
      ctx.lineWidth = 2 / vp.scale;
      ctx.stroke();

      if (!token.imageUrl) {
        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.max(10, size * 0.25) / vp.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(token.label?.slice(0, 2) || '?', 0, 0);
      }

      if (token.maxHp != null && token.maxHp > 0 && token.hp != null) {
        const barW = r * 1.6;
        const barH = Math.max(4, size * 0.07) / vp.scale;
        const barY = r + 6 / vp.scale;
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

      if (!token.visible) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });

    if (cfg.fogEnabled) {
      const cols = Math.ceil(mapW / CELL);
      const rows = Math.ceil(mapH / CELL);
      const revealed = new Set(fog.revealedCells);
      ctx.fillStyle = curRole === 'gm' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.92)';
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (!revealed.has(`${col},${row}`)) {
            ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
          }
        }
      }
    }

    ctx.restore();
  }, []);

  drawRef.current = draw;

  // Load map image
  useEffect(() => {
    if (!config.mapImageUrl) {
      mapLoadedRef.current = false;
      mapImgRef.current = null;
      draw();
      return;
    }
    const img = new Image();
    img.onload = () => {
      mapImgRef.current = img;
      mapLoadedRef.current = true;
      if (onMapDimensionsRef.current && img.naturalWidth > 0) {
        onMapDimensionsRef.current(img.naturalWidth, img.naturalHeight);
      }
      draw();
    };
    img.onerror = () => {
      mapImgRef.current = null;
      mapLoadedRef.current = false;
      draw();
    };
    img.src = config.mapImageUrl;
  }, [config.mapImageUrl, draw]);

  // Redraw when visual state changes
  useEffect(() => { draw(); }, [draw, tokens, fogState, selectedTokenId, config]);

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

  // Native event listeners — single registration, reads from refs
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
        const token = getTokenAt(wp.x, wp.y);
        if (token) {
          const canMove = roleRef.current === 'gm' || token.ownerUserId === userIdRef.current;
          if (canMove) {
            draggingTokenRef.current = {
              id: token.id,
              offsetX: wp.x - token.position.x,
              offsetY: wp.y - token.position.y,
            };
          }
          onSelectTokenRef.current(token.id);
        } else {
          onSelectTokenRef.current(null);
        }
      } else if ((tool === 'fog-reveal' || tool === 'fog-erase') && roleRef.current === 'gm') {
        isPaintingFogRef.current = true;
        paintFogAt(wp.x, wp.y);
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const cb = onRightClickTokenRef.current;
      if (!cb) return;
      const sp = getCanvasXY(e.clientX, e.clientY);
      const wp = screenToWorld(sp.x, sp.y);
      const token = getTokenAt(wp.x, wp.y);
      if (token) {
        const canEdit = roleRef.current === 'gm' || token.ownerUserId === userIdRef.current;
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
          const brushPx = fogBrushSizeRef.current * (configRef.current.gridSize || 50) * vp.scale;
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

      if (isPanningRef.current && lastPanRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        viewportRef.current = { ...viewportRef.current, x: viewportRef.current.x + dx, y: viewportRef.current.y + dy };
        drawRef.current();
        return;
      }

      if (draggingTokenRef.current) {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        const nx = wp.x - draggingTokenRef.current.offsetX;
        const ny = wp.y - draggingTokenRef.current.offsetY;
        const snapped = snapToGrid(nx, ny);
        onMoveTokenRef.current(draggingTokenRef.current.id, snapped);
      } else if (isPaintingFogRef.current && roleRef.current === 'gm') {
        const sp = getCanvasXY(e.clientX, e.clientY);
        const wp = screenToWorld(sp.x, sp.y);
        paintFogAt(wp.x, wp.y);
      }
    };

    const onMouseUp = () => {
      draggingTokenRef.current = null;
      isPaintingFogRef.current = false;
      isPanningRef.current = false;
      lastPanRef.current = null;
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
      drawRef.current();
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Arrow key token movement
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const selId = selectedTokenIdRef.current;
      if (!selId) return;
      const token = tokensRef.current.find(t => t.id === selId);
      if (!token) return;
      const canMove = roleRef.current === 'gm' || token.ownerUserId === userIdRef.current;
      if (!canMove) return;
      const c = configRef.current.gridSize || 50;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -c;
      else if (e.key === 'ArrowRight') dx = c;
      else if (e.key === 'ArrowUp') dy = -c;
      else if (e.key === 'ArrowDown') dy = c;
      else return;
      e.preventDefault();
      onMoveTokenRef.current(selId, { x: token.position.x + dx, y: token.position.y + dy });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-gray-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: isFogTool ? 'none' : 'default' }}
      />
      <div
        ref={brushOverlayRef}
        className="pointer-events-none fixed rounded-full border-2 -translate-x-1/2 -translate-y-1/2"
        style={{ display: 'none' }}
      />
    </div>
  );
}
