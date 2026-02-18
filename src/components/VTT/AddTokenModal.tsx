import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { VTTToken } from '../../types/vtt';

interface AddTokenModalProps {
  onConfirm: (token: Omit<VTTToken, 'id'>) => void;
  onClose: () => void;
  userId: string;
}

const TOKEN_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

export function AddTokenModal({ onConfirm, onClose, userId }: AddTokenModalProps) {
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [size, setSize] = useState<1 | 2 | 3>(1);
  const [color, setColor] = useState(TOKEN_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onConfirm({
      characterId: null,
      ownerUserId: userId,
      label: label.trim(),
      imageUrl: imageUrl.trim() || null,
      position: { x: 0, y: 0 },
      size,
      rotation: 0,
      visible: true,
      color,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Ajouter un token</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Nom *</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Nom du personnage..."
              maxLength={20}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Image (URL optionnelle)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Taille</label>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                    size === s
                      ? 'bg-amber-600 border-amber-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {s === 1 ? 'Petit (1x1)' : s === 2 ? 'Moyen (2x2)' : 'Grand (3x3)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Couleur</label>
            <div className="flex gap-2 flex-wrap">
              {TOKEN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
