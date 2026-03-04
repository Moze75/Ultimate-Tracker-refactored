import React, { useRef, useCallback, useEffect, useState } from 'react';

interface VTTBroadcastFrameProps {
  frame: { x: number; y: number; width: number; height: number };
  onChange: (frame: { x: number; y: number; width: number; height: number }) => void;
  aspectRatio: string;
  lockRatio: boolean;
  viewport: { x: number; y: number; scale: number };
}

function parseRatio(ratio: string): number | null {
  if (ratio === 'free') return null;
  const [w, h] = ratio.split(':').map(Number);
  if (w > 0 && h > 0) return w / h;
  return null;
}

export function VTTBroadcastFrame({ frame, onChange, aspectRatio, lockRatio, viewport }: VTTBroadcastFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef<string | null>(null);
  const startPos = useRef({ mx: 0, my: 0, fx: 0, fy: 0, fw: 0, fh: 0 });
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  const screenFrame = {
    x: frame.x * viewport.scale + viewport.x,
    y: frame.y * viewport.scale + viewport.y,
    width: frame.width * viewport.scale,
    height: frame.height * viewport.scale,
  };

  const applyRatioConstraint = useCallback((f: { x: number; y: number; width: number; height: number }, handle: string) => {
    const ratio = parseRatio(aspectRatio);
    if (!ratio || !lockRatio) return f;
    const newF = { ...f };

    if (handle === 'move') return newF;

    if (handle.includes('e') || handle.includes('w')) {
      newF.height = newF.width / ratio;
    } else {
      newF.width = newF.height * ratio;
    }

    if (handle.includes('n')) {
      newF.y = f.y + f.height - newF.height;
    }
    if (handle.includes('w')) {
      newF.x = f.x + f.width - newF.width;
    }

    return newF;
  }, [aspectRatio, lockRatio]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (handle === 'move') {
      isDragging.current = true;
    } else {
      isResizing.current = handle;
    }
    startPos.current = { mx: e.clientX, my: e.clientY, fx: frame.x, fy: frame.y, fw: frame.width, fh: frame.height };

    const onMove = (me: MouseEvent) => {
      const dx = (me.clientX - startPos.current.mx) / viewport.scale;
      const dy = (me.clientY - startPos.current.my) / viewport.scale;

      if (isDragging.current) {
        onChange({
          x: startPos.current.fx + dx,
          y: startPos.current.fy + dy,
          width: startPos.current.fw,
          height: startPos.current.fh,
        });
        return;
      }

      const h = isResizing.current;
      if (!h) return;

      let newX = startPos.current.fx;
      let newY = startPos.current.fy;
      let newW = startPos.current.fw;
      let newH = startPos.current.fh;

      if (h.includes('e')) newW = Math.max(50, startPos.current.fw + dx);
      if (h.includes('w')) { newW = Math.max(50, startPos.current.fw - dx); newX = startPos.current.fx + dx; }
      if (h.includes('s')) newH = Math.max(50, startPos.current.fh + dy);
      if (h.includes('n')) { newH = Math.max(50, startPos.current.fh - dy); newY = startPos.current.fy + dy; }

      onChange(applyRatioConstraint({ x: newX, y: newY, width: newW, height: newH }, h));
    };

    const onUp = () => {
      isDragging.current = false;
      isResizing.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [frame, viewport.scale, onChange, applyRatioConstraint]);

  useEffect(() => {
    const ratio = parseRatio(aspectRatio);
    if (ratio && lockRatio) {
      const newHeight = frame.width / ratio;
      if (Math.abs(newHeight - frame.height) > 1) {
        onChange({ ...frame, height: newHeight });
      }
    }
  }, [aspectRatio, lockRatio]);

  const handles = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const handleCursors: Record<string, string> = {
    n: 'ns-resize', ne: 'nesw-resize', e: 'ew-resize', se: 'nwse-resize',
    s: 'ns-resize', sw: 'nesw-resize', w: 'ew-resize', nw: 'nwse-resize',
  };

  const handlePositions: Record<string, React.CSSProperties> = {
    n: { top: -4, left: '50%', transform: 'translateX(-50%)' },
    ne: { top: -4, right: -4 },
    e: { top: '50%', right: -4, transform: 'translateY(-50%)' },
    se: { bottom: -4, right: -4 },
    s: { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
    sw: { bottom: -4, left: -4 },
    w: { top: '50%', left: -4, transform: 'translateY(-50%)' },
    nw: { top: -4, left: -4 },
  };

  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: `
            linear-gradient(to right, rgba(0,0,0,0.45) ${screenFrame.x}px, transparent ${screenFrame.x}px, transparent ${screenFrame.x + screenFrame.width}px, rgba(0,0,0,0.45) ${screenFrame.x + screenFrame.width}px),
            linear-gradient(to bottom, rgba(0,0,0,0.45) ${screenFrame.y}px, transparent ${screenFrame.y}px, transparent ${screenFrame.y + screenFrame.height}px, rgba(0,0,0,0.45) ${screenFrame.y + screenFrame.height}px)
          `,
          backgroundBlendMode: 'darken',
        }}
      />

      <div
        ref={frameRef}
        className="absolute z-30 border-2 border-dashed border-teal-400/80"
        style={{
          left: screenFrame.x,
          top: screenFrame.y,
          width: screenFrame.width,
          height: screenFrame.height,
          cursor: 'move',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.2)',
        }}
        onMouseDown={e => handleMouseDown(e, 'move')}
      >
        <div className="absolute -top-6 left-0 px-2 py-0.5 bg-teal-900/80 border border-teal-700/60 rounded text-teal-300 text-[10px] font-medium whitespace-nowrap pointer-events-none">
          Broadcast ({Math.round(frame.width)} x {Math.round(frame.height)})
        </div>

        {handles.map(h => (
          <div
            key={h}
            className={`absolute w-3 h-3 rounded-sm transition-colors ${
              hoveredHandle === h ? 'bg-teal-400' : 'bg-teal-500/80'
            } border border-teal-300/60`}
            style={{ ...handlePositions[h], cursor: handleCursors[h] }}
            onMouseDown={e => handleMouseDown(e, h)}
            onMouseEnter={() => setHoveredHandle(h)}
            onMouseLeave={() => setHoveredHandle(null)}
          />
        ))}
      </div>
    </>
  );
}
