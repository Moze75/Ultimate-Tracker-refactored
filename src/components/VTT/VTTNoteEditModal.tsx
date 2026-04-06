import React, { useState, useRef } from 'react';
import {
  StickyNote, Skull, Gem, Key, AlertTriangle, Eye, Crown, Swords,
  Map, Lock, Flame, MessageSquare, Bookmark, Star, ShieldAlert, DoorOpen,
  X, Trash2, Bold, Italic, Strikethrough, Code, Minus, List,
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
      else if (match[7]) parts.push(<code key={k} className="bg-gray-700 px-1 rounded text-amber-300 text-xs font-mono">{match[7]}</code>);
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return <span key={i}>{parts}{i < arr.length - 1 && <br />}</span>;
  });
}

interface FormatAction {
  icon: React.ReactNode;
  title: string;
  apply: (selected: string, before: string, after: string) => { text: string; selStart: number; selEnd: number };
}

function wrapSelection(selected: string, prefix: string, suffix: string, full: string, selStart: number, selEnd: number) {
  if (selected) {
    const isAlready = selected.startsWith(prefix) && selected.endsWith(suffix);
    const newSel = isAlready
      ? selected.slice(prefix.length, selected.length - suffix.length)
      : prefix + selected + suffix;
    const newText = full.slice(0, selStart) + newSel + full.slice(selEnd);
    return { text: newText, selStart, selEnd: selStart + newSel.length };
  }
  const newText = full.slice(0, selStart) + prefix + suffix + full.slice(selEnd);
  return { text: newText, selStart: selStart + prefix.length, selEnd: selStart + prefix.length };
}

export function VTTNoteEditModal({ note, initialX = 0, initialY = 0, onSave, onDelete, onClose }: VTTNoteEditModalProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [icon, setIcon] = useState<VTTNoteIcon>(note?.icon ?? 'StickyNote');
  const [size, setSize] = useState(note?.size ?? 32);
  const [color, setColor] = useState(note?.color ?? '#facc15');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (prefix: string, suffix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: ss, selectionEnd: se } = ta;
    const selected = body.slice(ss, se);
    const result = wrapSelection(selected, prefix, suffix, body, ss, se);
    setBody(result.text);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(result.selStart, result.selEnd);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: ss } = ta;
    const lineStart = body.lastIndexOf('\n', ss - 1) + 1;
    const lineContent = body.slice(lineStart);
    const lineEnd = lineContent.indexOf('\n');
    const lineText = lineEnd === -1 ? lineContent : lineContent.slice(0, lineEnd);
    const hasPrefix = lineText.startsWith(prefix);
    const newLine = hasPrefix ? lineText.slice(prefix.length) : prefix + lineText;
    const newBody = body.slice(0, lineStart) + newLine + body.slice(lineStart + lineText.length);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = lineStart + newLine.length;
      ta.setSelectionRange(newPos, newPos);
    });
  };

  const FORMAT_ACTIONS: FormatAction[] = [
    {
      icon: <Bold size={13} />,
      title: 'Gras (**texte**)',
      apply: (_sel, _b, _a) => { applyFormat('**', '**'); return { text: body, selStart: 0, selEnd: 0 }; },
    },
    {
      icon: <Italic size={13} />,
      title: 'Italique (*texte*)',
      apply: () => { applyFormat('*', '*'); return { text: body, selStart: 0, selEnd: 0 }; },
    },
    {
      icon: <Strikethrough size={13} />,
      title: 'Barré (~~texte~~)',
      apply: () => { applyFormat('~~', '~~'); return { text: body, selStart: 0, selEnd: 0 }; },
    },
    {
      icon: <Code size={13} />,
      title: 'Code (`texte`)',
      apply: () => { applyFormat('`', '`'); return { text: body, selStart: 0, selEnd: 0 }; },
    },
    {
      icon: <Minus size={13} />,
      title: 'Séparateur (---)',
      apply: () => {
        const ta = textareaRef.current;
        if (!ta) return { text: body, selStart: 0, selEnd: 0 };
        const ss = ta.selectionStart;
        const newBody = body.slice(0, ss) + '\n---\n' + body.slice(ss);
        setBody(newBody);
        requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ss + 5, ss + 5); });
        return { text: newBody, selStart: ss + 5, selEnd: ss + 5 };
      },
    },
    {
      icon: <List size={13} />,
      title: 'Liste (- item)',
      apply: () => { applyLinePrefix('- '); return { text: body, selStart: 0, selEnd: 0 }; },
    },
  ];

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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[500px] max-h-[90vh] flex flex-col overflow-hidden">

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
                    {t === 'edit' ? 'Markdown' : 'Apercu'}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'edit' && (
              <div className="flex items-center gap-0.5 mb-1 px-1 py-1 bg-gray-800 border border-gray-700 rounded-t-lg border-b-0">
                {FORMAT_ACTIONS.map((action, i) => (
                  <button
                    key={i}
                    type="button"
                    title={action.title}
                    onMouseDown={e => { e.preventDefault(); action.apply('', '', ''); }}
                    className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors"
                  >
                    {action.icon}
                  </button>
                ))}
                <div className="flex-1" />
                <div className="relative group">
                  <button
                    type="button"
                    className="w-4 h-4 rounded-full border border-gray-500 text-[9px] text-gray-400 hover:text-gray-200 hover:border-gray-300 transition-colors flex items-center justify-center font-bold"
                    title="Aide markdown"
                  >
                    i
                  </button>
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-gray-950 border border-gray-700 rounded-lg shadow-xl z-10 p-2.5 space-y-1 hidden group-hover:block pointer-events-none text-[10px] text-gray-400 leading-relaxed">
                    <p className="text-gray-300 font-semibold mb-1">Syntaxe Markdown</p>
                    <p><code className="text-amber-400">**gras**</code> → <strong>gras</strong></p>
                    <p><code className="text-amber-400">*italique*</code> → <em>italique</em></p>
                    <p><code className="text-amber-400">~~barre~~</code> → <s>barre</s></p>
                    <p><code className="text-amber-400">`code`</code> → code</p>
                    <p><code className="text-amber-400">- item</code> → liste</p>
                    <p><code className="text-amber-400">---</code> → separateur</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'edit' ? (
              <textarea
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Contenu de la note..."
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 rounded-b-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors resize-none"
              />
            ) : (
              <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 min-h-[120px] leading-relaxed">
                {body ? renderMarkdown(body) : <span className="text-gray-600 italic">Aucun contenu</span>}
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
                title="Couleur personnalisee"
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
