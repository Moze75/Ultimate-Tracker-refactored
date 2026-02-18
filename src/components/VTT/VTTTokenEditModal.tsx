import React, { useState } from 'react';
import { X, Eye, EyeOff, Compass } from 'lucide-react';
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
  const [size, setSize] = useState<1 | 2 | 3>(token.size);
  const [visible, setVisible] = useState(token.visible);
  const [hp, setHp] = useState(token.hp != null ? String(token.hp) : '');
  const [maxHp, setMaxHp] = useState(token.maxHp != null ? String(token.maxHp) : '');

  const handleSave = () => {
    onSave({
      label: label.trim() || token.label,
      imageUrl: imageUrl.trim() || null,
      color,
      size,
      visible,
      hp: hp !== '' ? parseInt(hp) : undefined,
      maxHp: maxHp !== '' ? parseInt(maxHp) : undefined,
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
            <label className="block text-xs text-gray-400 mb-1">Taille</label>
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    size === s
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s}×{s}
                </button>
              ))}
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

          <div className="pt-1 border-t border-gray-700/60">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Compass size={12} />
              <span>Vision — disponible prochainement</span>
            </div>
          </div>
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
