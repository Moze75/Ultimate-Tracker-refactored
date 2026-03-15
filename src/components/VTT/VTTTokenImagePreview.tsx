import React, { useRef, useCallback } from 'react';

interface PreviewImageProps {
  src: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
  containerSize: number;
}

function PreviewImage({ src, offsetX, offsetY, zoom, containerSize }: PreviewImageProps) {
  const [aspect, setAspect] = React.useState(1);
  const side = containerSize * zoom;
  const excess = side - containerSize;
  const dw = aspect >= 1 ? side : side * aspect;
  const dh = aspect >= 1 ? side / aspect : side;
  const left = -(excess / 2) - offsetX * (excess / 2) + (side - dw) / 2;
  const top = -(excess / 2) - offsetY * (excess / 2) + (side - dh) / 2;
  return (
    <img
      src={src}
      alt=""
      className="absolute pointer-events-none"
      style={{ width: dw, height: dh, left, top }}
      draggable={false}
      onLoad={e => {
        const img = e.target as HTMLImageElement;
        setAspect(img.naturalWidth / img.naturalHeight);
      }}
      onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
    />
  );
}

export interface TokenImagePreviewState {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

interface VTTTokenImagePreviewProps {
  imageUrl: string;
  offsetX: number;
  offsetY: number;
  zoom: number;
  onOffsetXChange: (v: number) => void;
  onOffsetYChange: (v: number) => void;
  onZoomChange: (v: number) => void;
  onReset: () => void;
}

export function VTTTokenImagePreview({
  imageUrl,
  offsetX,
  offsetY,
  zoom,
  onOffsetXChange,
  onOffsetYChange,
  onZoomChange,
  onReset,
}: VTTTokenImagePreviewProps) {
  const isDragging = useRef(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onZoomChange(Math.max(1.0, Math.min(4.0, parseFloat((zoom + delta).toFixed(2)))));
  }, [zoom, onZoomChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    let lastX = e.clientX;
    let lastY = e.clientY;
    const onMove = (me: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = me.clientX - lastX;
      const dy = me.clientY - lastY;
      lastX = me.clientX;
      lastY = me.clientY;
      onOffsetXChange(Math.max(-1, Math.min(1, offsetX - dx / 40)));
      onOffsetYChange(Math.max(-1, Math.min(1, offsetY - dy / 40)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [offsetX, offsetY, onOffsetXChange, onOffsetYChange]);

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-2">
        Position de l'image <span className="text-gray-600">(glisser pour ajuster)</span>
      </label>
      <div className="flex gap-4 items-start">
        <div
          className="w-32 h-32 rounded-full overflow-hidden bg-gray-700 shrink-0 border-2 border-gray-600 relative cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          title="Glisser pour repositionner · Molette pour zoomer"
        >
          <PreviewImage
            src={imageUrl}
            offsetX={offsetX}
            offsetY={offsetY}
            zoom={zoom}
            containerSize={128}
          />
          <div className="absolute inset-0 rounded-full ring-1 ring-white/10 pointer-events-none" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Horizontal</span>
              <span className="text-gray-400">{offsetX > 0 ? '+' : ''}{Math.round(offsetX * 100)}%</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={offsetX}
              onChange={e => onOffsetXChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Vertical</span>
              <span className="text-gray-400">{offsetY > 0 ? '+' : ''}{Math.round(offsetY * 100)}%</span>
            </div>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.05}
              value={offsetY}
              onChange={e => onOffsetYChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Zoom</span>
              <span className="text-gray-400">{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={1.0}
              max={4.0}
              step={0.1}
              value={zoom}
              onChange={e => onZoomChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
          <button
            onClick={onReset}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline"
          >
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  );
}
