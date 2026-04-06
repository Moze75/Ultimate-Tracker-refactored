import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  StickyNote, Skull, Gem, Key, AlertTriangle, Eye, Crown, Swords,
  Map, Lock, Flame, MessageSquare, Bookmark, Star, ShieldAlert, DoorOpen,
  X, Pencil,
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
  currentClientX: number;
  currentClientY: number;
  moved: boolean;
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i, arr) => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|~~(.+?)~~|`(.+?)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      const k = match.index;
      if (match[2]) parts.push(<strong key={k}><em>{match[2]}</em></strong>);
      else if (match[3]) parts.push(<strong key={k}>{match[3]}</strong>);
      else if (match[4]) parts.push(<em key={k}>{match[4]}</em>);
      else if (match[5]) parts.push(<em key={k}>{match[5]}</em>);
      else if (match[6]) parts.push(<s key={k}>{match[6]}</s>);
      else if (match[7]) parts.push(<code key={k} className="bg-gray-700 px-1 rounded text-amber-300 text-xs">{match[7]}</code>);
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>;
  });
}

interface NotePreviewPopupProps {
  note: VTTNote;
  screenX: number;
  screenY: number;
  onClose: () => void;
  onEdit: () => void;
}

function NotePreviewPopup({ note, screenX, screenY, onClose, onEdit }: NotePreviewPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const Icon = ICON_MAP[note.icon] ?? StickyNote;

  const [pos, setPos] = useState({ left: screenX + 14, top: screenY - 10 });

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;
    const rect = popup.getBoundingClientRect();
    let left = screenX + 14;
    let top = screenY - 10;
    if (left + rect.width > window.innerWidth - 8) left = screenX - rect.width - 14;
    if (top + rect.height > window.innerHeight - 8) top = window.innerHeight - rect.height - 8;
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [screenX, screenY]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick, true);
    return () => document.removeEventListener('mousedown', handleClick, true);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="fixed z-[300] w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: `${note.color}40`, backgroundColor: `${note.color}12` }}
      >
        <Icon size={15} style={{ color: note.color, flexShrink: 0 }} />
        <span className="flex-1 text-sm font-semibold truncate" style={{ color: note.color }}>
          {note.title || 'Note sans titre'}
        </span>
        <button
          onClick={onEdit}
          className="p-1 rounded text-gray-400 hover:text-amber-400 transition-colors"
          title="Modifier"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded text-gray-400 hover:text-gray-200 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      {note.body ? (
        <div className="px-3 py-3 text-sm text-gray-300 leading-relaxed max-h-64 overflow-y-auto">
          {renderMarkdown(note.body)}
        </div>
      ) : (
        <div className="px-3 py-3 text-sm text-gray-600 italic">Aucun contenu</div>
      )}
    </div>
  );
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
  const [dragPos, setDragPos] = useState<{ noteId: string; clientX: number; clientY: number } | null>(null);
  const [previewNote, setPreviewNote] = useState<{ note: VTTNote; sx: number; sy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startClientX;
    const dy = e.clientY - drag.startClientY;
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.moved = true;
    }
    if (drag.moved) {
      drag.currentClientX = e.clientX;
      drag.currentClientY = e.clientY;
      setDragPos({ noteId: drag.noteId, clientX: e.clientX, clientY: e.clientY });
    }
  }, []);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.moved) {
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const newWorldX = (sx - pan.x) / zoom;
      const newWorldY = (sy - pan.y) / zoom;
      onMove(drag.noteId, newWorldX, newWorldY);
    }
    dragRef.current = null;
    setDragPos(null);
  }, [pan, zoom, onMove]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
      ref={containerRef}
      className={`absolute inset-0 ${isNoteTool ? 'cursor-crosshair' : ''}`}
      style={{ zIndex: 18, pointerEvents: isNoteTool ? 'auto' : 'none' }}
      onClick={handleOverlayClick}
    >
      {notes.map(note => {
        const isDragging = dragPos?.noteId === note.id;
        let sx: number;
        let sy: number;

        if (isDragging && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          sx = dragPos.clientX - rect.left;
          sy = dragPos.clientY - rect.top;
        } else {
          sx = note.x * zoom + pan.x;
          sy = note.y * zoom + pan.y;
        }

        const Icon = ICON_MAP[note.icon] ?? StickyNote;

        return (
          <div
            key={note.id}
            className="absolute"
            style={{
              left: sx,
              top: sy,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'auto',
              zIndex: isDragging ? 25 : 18,
              userSelect: 'none',
              transition: isDragging ? 'none' : undefined,
            }}
            onMouseDown={e => {
              e.stopPropagation();
              dragRef.current = {
                noteId: note.id,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startWorldX: note.x,
                startWorldY: note.y,
                currentClientX: e.clientX,
                currentClientY: e.clientY,
                moved: false,
              };
            }}
            onClick={e => {
              e.stopPropagation();
              if (dragRef.current?.moved) return;
              if (dragPos?.noteId === note.id) return;
              setPreviewNote({
                note,
                sx: e.clientX,
                sy: e.clientY,
              });
            }}
            onDoubleClick={e => {
              e.stopPropagation();
              setPreviewNote(null);
              onEdit(note);
            }}
            onContextMenu={e => {
              e.preventDefault();
              e.stopPropagation();
              setPreviewNote(null);
              if (window.confirm(`Supprimer la note "${note.title || 'Sans titre'}" ?`)) {
                onDelete(note.id);
              }
            }}
          >
            <div
              className="flex items-center justify-center rounded-full shadow-lg"
              style={{
                width: note.size,
                height: note.size,
                backgroundColor: `${note.color}22`,
                border: `2px solid ${note.color}`,
                cursor: isDragging ? 'grabbing' : 'grab',
                filter: `drop-shadow(0 2px 8px ${note.color}88)`,
                transform: isDragging ? 'scale(1.15)' : undefined,
                transition: isDragging ? 'none' : 'transform 0.15s',
              }}
            >
              <Icon size={note.size * 0.5} style={{ color: note.color }} />
            </div>

            {!isDragging && note.title && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-lg bg-gray-800 border border-gray-700/80 text-gray-200 text-xs shadow-xl whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100"
                style={{ zIndex: 9999 }}
              />
            )}
          </div>
        );
      })}

      {previewNote && (
        <NotePreviewPopup
          note={previewNote.note}
          screenX={previewNote.sx}
          screenY={previewNote.sy}
          onClose={() => setPreviewNote(null)}
          onEdit={() => { setPreviewNote(null); onEdit(previewNote.note); }}
        />
      )}
    </div>
  );
}
