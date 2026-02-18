import React, { useRef, useEffect, useCallback, useState } from 'react';
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
  onMapDimensions,
}: VTTCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fogCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const mapLoadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tokenImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const draggingTokenRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const isPaintingFogRef = useRef(false);
  const lastPanRef = useRef<{ x: number; y: number } | null>(null);
  const isPanningRef = useRef(false);

  const CELL = config.gridSize || 50;

  const worldToScreen = useCallback((wx: number, wy: number) => {
    const vp = viewportRef.current;
    return { x: wx * vp.scale + vp.x, y: wy * vp.scale + vp.y };
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number) => {
    const vp = viewportRef.current;
    return { x: (sx - vp.x) / vp.scale, y: (sy - vp.y) / vp.scale };
  }, []);

  const snapToGrid = useCallback((wx: number, wy: number) => {
    if (!config.snapToGrid) return { x: wx, y: wy };
    return {
      x: Math.round(wx / CELL) * CELL,
      y: Math.round(wy / CELL) * CELL,
    };
  }, [config.snapToGrid, CELL]);

  const worldCellKey = useCallback((wx: number, wy: number) => {
    return `${Math.floor(wx / CELL)},${Math.floor(wy / CELL)}`;
  }, [CELL]);

  useEffect(() => {
    if (!config.mapImageUrl) {
      mapLoadedRef.current = false;
      mapImgRef.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      mapImgRef.current = img;
      mapLoadedRef.current = true;
      if (onMapDimensions && img.naturalWidth > 0) {
        onMapDimensions(img.naturalWidth, img.naturalHeight);
      }
      draw();
    };
    img.onerror = () => {
      mapImgRef.current = null;
      mapLoadedRef.current = false;
      draw();
    };
    img.src = config.mapImageUrl;
  }, [config.mapImageUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const vp = viewportRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.scale, vp.scale);

    const mapW = config.mapWidth || 2000;
    const mapH = config.mapHeight || 2000;

    if (mapImgRef.current && mapLoadedRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, mapW, mapH);
    } else {
      ctx.fillStyle = '#1a1f2e';
      ctx.fillRect(0, 0, mapW, mapH);
    }

    if (config.gridSize > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1 / vp.scale;
      for (let gx = 0; gx <= mapW; gx += CELL) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, mapH);
        ctx.stroke();
      }
      for (let gy = 0; gy <= mapH; gy += CELL) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(mapW, gy);
        ctx.stroke();
      }
    }

    tokens.forEach(token => {
      if (!token.visible && role === 'player') return;

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
          img.onload = () => draw();
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

      if (token.id === selectedTokenId) {
        ctx.beginPath();
        ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3 / vp.scale;
        ctx.stroke();
      }

      const owned = token.ownerUserId === userId;
      ctx.beginPath();
      ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = owned ? '#22c55e' : '#94a3b8';
      ctx.lineWidth = 2 / vp.scale;
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.max(10, size * 0.25) / vp.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(token.label?.slice(0, 2) || '?', 0, 0);

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
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${size * 0.3 / vp.scale}px sans-serif`;
        ctx.fillText('👁', 0, 0);
      }

      ctx.restore();
    });

    if (config.fogEnabled) {
      const mapW = config.mapWidth || 2000;
      const mapH = config.mapHeight || 2000;
      const cols = Math.ceil(mapW / CELL);
      const rows = Math.ceil(mapH / CELL);
      const revealed = new Set(fogState.revealedCells);

      ctx.fillStyle = role === 'gm' ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.92)';

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (!revealed.has(`${col},${row}`)) {
            ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
          }
        }
      }
    }

    ctx.restore();
  }, [config, tokens, fogState, role, userId, selectedTokenId, CELL]);

  useEffect(() => {
    draw();
  }, [draw]);

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

  const getCanvasPos = (e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getTokenAt = useCallback((wx: number, wy: number): VTTToken | null => {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      const size = (t.size || 1) * CELL;
      if (wx >= t.position.x && wx <= t.position.x + size &&
          wy >= t.position.y && wy <= t.position.y + size) {
        return t;
      }
    }
    return null;
  }, [tokens, CELL]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      isPanningRef.current = true;
      return;
    }

    const sp = getCanvasPos(e);
    const wp = screenToWorld(sp.x, sp.y);

    if (activeTool === 'select') {
      const token = getTokenAt(wp.x, wp.y);
      if (token) {
        const canMove = role === 'gm' || token.ownerUserId === userId;
        if (canMove) {
          draggingTokenRef.current = {
            id: token.id,
            offsetX: wp.x - token.position.x,
            offsetY: wp.y - token.position.y,
          };
          onSelectToken(token.id);
        } else {
          onSelectToken(token.id);
        }
      } else {
        onSelectToken(null);
      }
    } else if ((activeTool === 'fog-reveal' || activeTool === 'fog-erase') && role === 'gm') {
      isPaintingFogRef.current = true;
      const cell = worldCellKey(wp.x, wp.y);
      const cells: string[] = [];
      const bx = Math.floor(wp.x / CELL);
      const by = Math.floor(wp.y / CELL);
      for (let dy = -fogBrushSize + 1; dy < fogBrushSize; dy++) {
        for (let dx = -fogBrushSize + 1; dx < fogBrushSize; dx++) {
          if (dx * dx + dy * dy < fogBrushSize * fogBrushSize) {
            cells.push(`${bx + dx},${by + dy}`);
          }
        }
      }
      onRevealFog(cells);
      void cell;
    }
  }, [activeTool, role, userId, screenToWorld, getTokenAt, onSelectToken, onRevealFog, worldCellKey, fogBrushSize, CELL]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanningRef.current && lastPanRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setViewport(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
      return;
    }

    if (draggingTokenRef.current) {
      const sp = getCanvasPos(e);
      const wp = screenToWorld(sp.x, sp.y);
      const nx = wp.x - draggingTokenRef.current.offsetX;
      const ny = wp.y - draggingTokenRef.current.offsetY;
      const snapped = snapToGrid(nx, ny);
      onMoveToken(draggingTokenRef.current.id, snapped);
    } else if (isPaintingFogRef.current && role === 'gm') {
      const sp = getCanvasPos(e);
      const wp = screenToWorld(sp.x, sp.y);
      const bx = Math.floor(wp.x / CELL);
      const by = Math.floor(wp.y / CELL);
      const cells: string[] = [];
      for (let dy = -fogBrushSize + 1; dy < fogBrushSize; dy++) {
        for (let dx = -fogBrushSize + 1; dx < fogBrushSize; dx++) {
          if (dx * dx + dy * dy < fogBrushSize * fogBrushSize) {
            cells.push(`${bx + dx},${by + dy}`);
          }
        }
      }
      onRevealFog(cells);
    }
  }, [screenToWorld, snapToGrid, onMoveToken, onRevealFog, role, fogBrushSize, CELL]);

  const handleMouseUp = useCallback(() => {
    draggingTokenRef.current = null;
    isPaintingFogRef.current = false;
    isPanningRef.current = false;
    lastPanRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const sp = getCanvasPos(e);
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(v => {
      const newScale = Math.max(0.2, Math.min(4, v.scale * delta));
      const wx = (sp.x - v.x) / v.scale;
      const wy = (sp.y - v.y) / v.scale;
      return {
        scale: newScale,
        x: sp.x - wx * newScale,
        y: sp.y - wy * newScale,
      };
    });
  }, []);

  useEffect(() => {
    draw();
  }, [viewport, draw]);

  const cursor =
    activeTool === 'fog-reveal' ? 'crosshair' :
    activeTool === 'fog-erase' ? 'cell' :
    draggingTokenRef.current ? 'grabbing' :
    isPanningRef.current ? 'grabbing' :
    'default';

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-gray-950">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      <canvas ref={fogCanvasRef} className="hidden" />
    </div>
  );
}
