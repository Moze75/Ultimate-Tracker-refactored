import React, { useRef, useState, useEffect } from 'react';
import {
  StickyNote, Skull, Gem, Key, AlertTriangle, Eye, Crown, Swords,
  Map, Lock, Flame, MessageSquare, Bookmark, Star, ShieldAlert, DoorOpen,
} from 'lucide-react';
import type { VTTNote, VTTNoteIcon, VTTRole } from '../../types/vtt';

export interface VTTNotesOverlayProps {
  notes: VTTNote[];
  role: VTTRole;
  pan: { x: number; y: number };
  zoom: number;
  isNoteTool: boolean;
  onEdit: (note: VTTNote) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onCanvasClick?: (worldX: number, worldY: number) => void;
}

const ICON_MAP: Record<VTTNoteIcon, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
  StickyNote:    StickyNote,
  Skull:         Skull,
  Gem:           Gem,
  Key:           Key,
  AlertTriangle: AlertTriangle,
  Eye:           Eye,
  Crown:         Crown,
  Swords:        Swords,
  Map:           Map,
  Lock:          Lock,
  Flame:         Flame,
  MessageSquare: MessageSquare,
  Bookmark:      Bookmark,
  Star:          Star,
  ShieldAlert:   ShieldAlert,
  DoorOpen:      DoorOpen,
};

interface DragState {
  noteId: string;
  startClientX: number;
  startClientY: number;
  startWorldX: number;
  startWorldY: number;
  moved: boolean;
}

interface TooltipState {
  noteId: string;
  x: number;
  y: number;
}

export function VTTNotesOverlay({
  notes,
  role,
  pan,
  zoom,
  isNoteTool,
  onEdit,
  onMove,
  onDelete,
  onCanvasClick,
}: VTTNotesOverlayProps) {
  const dragRef = useRef<DragState | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        drag.moved = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.moved) {
        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        const newWorldX = drag.startWorldX + dx / zoom;
        const newWorldY = drag.startWorldY + dy / zoom;
        onMove(drag.noteId, newWorldX, newWorldY);
      }
      dragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [zoom, onMove]);

  if (role !== 'gm') return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!isNoteTool) return;
    if (e.target !== e.currentTarget) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const wx = (sx - pan.x) / zoom;
    const wy = (sy - pan.y) / zoom;
    onCanvasClick?.(wx, wy);
  };

  return (
    <div
      className={`absolute inset-0 ${isNoteTool ? 'cursor-crosshair' : ''}`}
      style={{ zIndex: 18, pointerEvents: isNoteTool ? 'auto' : 'none' }}
      onClick={handleOverlayClick}
    >
      {notes.map(note => {
        const sx = note.x * zoom + pan.x;
        const sy = note.y * zoom + pan.y;
        const Icon = ICON_MAP[note.icon] ?? StickyNote;
        const isHovered = tooltip?.noteId === note.id;

        return (
          <div
            key={note.id}
            className="absolute"
            style={{
              left: sx,
              top: sy,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              zIndex: 18,
              userSelect: 'none',
            }}
            onMouseEnter={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setTooltip({ noteId: note.id, x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setTooltip(null)}
            onMouseDown={e => {
              e.stopPropagation();
              dragRef.current = {
                noteId: note.id,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startWorldX: note.x,
                startWorldY: note.y,
                moved: false,
              };
            }}
            onDoubleClick={e => {
              e.stopPropagation();
              if (!dragRef.current?.moved) {
                onEdit(note);
              }
            }}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              if (window.confirm(`Supprimer la note "${note.title || 'Sans titre'}" ?`)) {
                onDelete(note.id);
              }
            }}
          >
            <div
              className="flex items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
              style={{
                width: note.size,
                height: note.size,
                backgroundColor: `${note.color}22`,
                border: `2px solid ${note.color}`,
                cursor: 'grab',
                filter: `drop-shadow(0 2px 6px ${note.color}66)`,
              }}
            >
              <Icon size={note.size * 0.5} style={{ color: note.color }} />
            </div>

            {isHovered && note.title && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700/80 text-gray-200 text-xs shadow-xl whitespace-nowrap pointer-events-none"
                style={{ zIndex: 9999 }}
              >
                {note.title}
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
                  style={{ borderTopColor: '#374151' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
