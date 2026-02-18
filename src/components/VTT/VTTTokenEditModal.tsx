import React, { useState, useRef, useCallback } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import type { VTTToken } from '../../types/vtt';

interface VTTTokenEditModalProps {
  token: VTTToken;
  role: 'gm' | 'player';
  onSave: (changes: Partial<VTTToken>) => void;
  onRemove: () => void;
  onClose: () => void;
}

const TOKEN_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

export function VTTTokenEditModal({ token, role, onSave, onRemove, onClose }: VTTTokenEditModalProps) {
  const [label, setLabel] = useState(token.label);
  const [imageUrl, setImageUrl] = useState(token.imageUrl || '');
  const [color, setColor] = useState(token.color);
  const [visible, setVisible] = useState(token.visible);
  const [hp, setHp] = useState(token.hp != null ? String(token.hp) : '');
  const [maxHp, setMaxHp] = useState(token.maxHp != null ? String(token.maxHp) : '');
  const [imageOffsetX, setImageOffsetX] = useState(token.imageOffsetX ?? 0);
  const [imageOffsetY, setImageOffsetY] = useState(token.imageOffsetY ?? 0);
  const isDraggingPreview = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingPreview.current = true;
    const onMove = (me: MouseEvent) => {
      if (!isDraggingPreview.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (me.clientX - cx) / (rect.width * 0.5);
      const dy = (me.clientY - cy) / (rect.height * 0.5);
      setImageOffsetX(prev => Math.max(-1, Math.min(1, prev - dx * 0.05)));
      setImageOffsetY(prev => Math.max(-1, Math.min(1, prev - dy * 0.05)));
    };
    const onUp = () => {
      isDraggingPreview.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const handleSave = () => {
    onSave({
      label: label.trim() || token.label,
      imageUrl: imageUrl.trim() || null,
      color,
      visible,
      hp: hp !== '' ? parseInt(hp) : undefined,
      maxHp: maxHp !== '' ? parseInt(maxHp) : undefined,
      imageOffsetX,
      imageOffsetY,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Modifier le token</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nom</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={20}
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Image (URL)</label>
            <div className="flex gap-2 items-center">
              {imageUrl && (
                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-700 shrink-0">
                  <img src={imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                </div>
              )}
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {imageUrl && (
            <div>
              <label className="block text-xs text-gray-400 mb-2">Position de l'image <span className="text-gray-600">(glisser pour ajuster)</span></label>
              <div className="flex gap-4 items-start">
                <div
                  ref={previewRef}
                  className="w-32 h-32 rounded-full overflow-hidden bg-gray-700 shrink-0 border-2 border-gray-600 relative cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handlePreviewMouseDown}
                  title="Glisser pour repositionner"
                >
                  {(() => {
                    const ZOOM = 1.8;
                    const containerSize = 128;
                    const drawSize = containerSize * ZOOM;
                    const excess = drawSize - containerSize;
                    const imgLeft = -(excess / 2) - imageOffsetX * (excess / 2);
                    const imgTop = -(excess / 2) - imageOffsetY * (excess / 2);
                    return (
                      <img
                        src={imageUrl}
                        alt=""
                        className="absolute pointer-events-none"
                        style={{
                          width: drawSize,
                          height: drawSize,
                          left: imgLeft,
                          top: imgTop,
                        }}
                        draggable={false}
                        onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    );
                  })()}
                  <div className="absolute inset-0 rounded-full ring-1 ring-white/10 pointer-events-none" />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>Horizontal</span>
                      <span className="text-gray-400">{imageOffsetX > 0 ? '+' : ''}{Math.round(imageOffsetX * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={imageOffsetX}
                      onChange={e => setImageOffsetX(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                      <span>Vertical</span>
                      <span className="text-gray-400">{imageOffsetY > 0 ? '+' : ''}{Math.round(imageOffsetY * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={imageOffsetY}
                      onChange={e => setImageOffsetY(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                  <button
                    onClick={() => { setImageOffsetX(0); setImageOffsetY(0); }}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors underline"
                  >
                    Centrer
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">PV</label>
              <input
                type="number"
                value={hp}
                onChange={e => setHp(e.target.value)}
                placeholder="—"
                min={0}
                className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">PV max</label>
              <input
                type="number"
                value={maxHp}
                onChange={e => setMaxHp(e.target.value)}
                placeholder="—"
                min={0}
                className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Couleur</label>
            <div className="flex gap-1.5 flex-wrap">
              {TOKEN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {role === 'gm' && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-700/60">
              <span className="text-xs text-gray-400">Visible par les joueurs</span>
              <button
                onClick={() => setVisible(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  visible ? 'bg-emerald-700/40 text-emerald-400 border border-emerald-600/40' : 'bg-gray-700 text-gray-400 border border-gray-600'
                }`}
              >
                {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                {visible ? 'Visible' : 'Caché'}
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          {role === 'gm' && (
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="px-3 py-2 bg-red-900/40 hover:bg-red-700/50 text-red-400 border border-red-800/40 rounded-lg text-xs transition-colors"
            >
              Supprimer
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
