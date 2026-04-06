import React, { useState } from 'react';
import {
  StickyNote, Skull, Gem, Key, AlertTriangle, Eye, Crown, Swords,
  Map, Lock, Flame, MessageSquare, Bookmark, Star, ShieldAlert, DoorOpen,
  X, Trash2,
} from 'lucide-react';
import type { VTTNote, VTTNoteIcon } from '../../types/vtt';

export interface VTTNoteEditModalProps {
  note: VTTNote | null;
  initialX?: number;
  initialY?: number;
  onSave: (note: VTTNote) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const ICONS: { key: VTTNoteIcon; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { key: 'StickyNote',    Icon: StickyNote },
  { key: 'Skull',         Icon: Skull },
  { key: 'Gem',           Icon: Gem },
  { key: 'Key',           Icon: Key },
  { key: 'AlertTriangle', Icon: AlertTriangle },
  { key: 'Eye',           Icon: Eye },
  { key: 'Crown',         Icon: Crown },
  { key: 'Swords',        Icon: Swords },
  { key: 'Map',           Icon: Map },
  { key: 'Lock',          Icon: Lock },
  { key: 'Flame',         Icon: Flame },
  { key: 'MessageSquare', Icon: MessageSquare },
  { key: 'Bookmark',      Icon: Bookmark },
  { key: 'Star',          Icon: Star },
  { key: 'ShieldAlert',   Icon: ShieldAlert },
  { key: 'DoorOpen',      Icon: DoorOpen },
];

const PRESET_COLORS = [
  '#facc15', '#ef4444', '#60a5fa', '#4ade80',
  '#a78bfa', '#fb923c', '#f1f5f9', '#f472b6',
];

function simpleMarkdown(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const parts: React.ReactNode[] = [];
    const boldItalicRegex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = boldItalicRegex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      if (match[2]) parts.push(<strong key={i + '-' + match.index}><em>{match[2]}</em></strong>);
      else if (match[3]) parts.push(<strong key={i + '-' + match.index}>{match[3]}</strong>);
      else if (match[4]) parts.push(<em key={i + '-' + match.index}>{match[4]}</em>);
      else if (match[5]) parts.push(<em key={i + '-' + match.index}>{match[5]}</em>);
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={i}>{parts}{i < text.split('\n').length - 1 && <br />}</span>;
  });
}

export function VTTNoteEditModal({ note, initialX = 0, initialY = 0, onSave, onDelete, onClose }: VTTNoteEditModalProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [icon, setIcon] = useState<VTTNoteIcon>(note?.icon ?? 'StickyNote');
  const [size, setSize] = useState(note?.size ?? 32);
  const [color, setColor] = useState(note?.color ?? '#facc15');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  const handleSave = () => {
    onSave({
      id: note?.id ?? crypto.randomUUID(),
      x: note?.x ?? initialX,
      y: note?.y ?? initialY,
      title: title.trim(),
      body,
      icon,
      size,
      color,
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[480px] max-h-[90vh] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <span className="text-sm font-semibold text-gray-200">{note ? 'Modifier la note' : 'Nouvelle note'}</span>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium block mb-1">Titre</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de la note..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Corps</label>
              <div className="flex gap-1">
                {(['edit', 'preview'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${tab === t ? 'bg-amber-600/30 text-amber-400 border border-amber-600/40' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {t === 'edit' ? 'Markdown' : 'Aperçu'}
                  </button>
                ))}
              </div>
            </div>
            {tab === 'edit' ? (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Contenu de la note (markdown)..."
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors resize-none"
              />
            ) : (
              <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 min-h-[120px]">
                {body ? simpleMarkdown(body) : <span className="text-gray-600 italic">Aucun contenu</span>}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium block mb-1.5">Icone</label>
            <div className="grid grid-cols-8 gap-1">
              {ICONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setIcon(key)}
                  className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                    icon === key
                      ? 'bg-amber-600/30 border border-amber-600/60'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-500'
                  }`}
                  title={key}
                >
                  <Icon size={16} className={icon === key ? 'text-amber-400' : 'text-gray-400'} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Taille</label>
              <span className="text-[10px] text-gray-400">{size}px</span>
            </div>
            <input
              type="range"
              min={24}
              max={64}
              step={4}
              value={size}
              onChange={e => setSize(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wide font-medium block mb-1.5">Couleur</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                title="Couleur personnalisée"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-700">
          {note && (
            <button
              onClick={() => { if (window.confirm('Supprimer cette note ?')) { onDelete(note.id); } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-900/30 border border-red-700/50 text-red-400 hover:bg-red-900/50 transition-colors"
            >
              <Trash2 size={12} />
              Supprimer
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
