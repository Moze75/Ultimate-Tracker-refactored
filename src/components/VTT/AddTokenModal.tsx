import React, { useState, useEffect } from 'react';
import { X, User, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { VTTToken } from '../../types/vtt';

interface AddTokenModalProps {
  onConfirm: (token: Omit<VTTToken, 'id'>) => void;
  onClose: () => void;
  userId: string;
}

interface PlayerCharacter {
  id: string;
  name: string;
  avatar_url: string | null;
  class: string | null;
  level: number | null;
  current_hp: number | null;
  max_hp: number | null;
}

const TOKEN_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

export function AddTokenModal({ onConfirm, onClose, userId }: AddTokenModalProps) {
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [size, setSize] = useState<number>(1);
  const [color, setColor] = useState(TOKEN_COLORS[0]);
  const [hp, setHp] = useState('');
  const [maxHp, setMaxHp] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    supabase
      .from('players')
      .select('id, name, avatar_url, class, level, current_hp, max_hp')
      .eq('user_id', userId)
      .order('name')
      .then(({ data }) => {
        if (data) setCharacters(data);
      });
  }, [userId]);

  const selectCharacter = (char: PlayerCharacter) => {
    setSelectedCharId(char.id);
    setLabel(char.name || '');
    setImageUrl(char.avatar_url || '');
    setHp(char.current_hp != null ? String(char.current_hp) : '');
    setMaxHp(char.max_hp != null ? String(char.max_hp) : '');
  };

  const buildTokenData = (char: PlayerCharacter): Omit<VTTToken, 'id'> => ({
    characterId: char.id,
    ownerUserId: userId,
    label: char.name || 'Token',
    imageUrl: char.avatar_url || null,
    position: { x: 0, y: 0 },
    size: 1,
    rotation: 0,
    visible: true,
    color: TOKEN_COLORS[0],
    hp: char.current_hp ?? undefined,
    maxHp: char.max_hp ?? undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onConfirm({
      characterId: selectedCharId,
      ownerUserId: userId,
      label: label.trim(),
      imageUrl: imageUrl.trim() || null,
      position: { x: 60, y: 60 },
      size,
      rotation: 0,
      visible: true,
      color,
      hp: hp ? parseInt(hp) : undefined,
      maxHp: maxHp ? parseInt(maxHp) : undefined,
    });
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all ${
        isDragging ? 'bg-black/5 pointer-events-none' : 'bg-black/70'
      }`}
    >
      <div
        className={`bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm border border-gray-700 max-h-[90vh] flex flex-col transition-all ${
          isDragging ? 'opacity-30 pointer-events-none scale-95' : 'opacity-100'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h3 className="text-white font-semibold">Ajouter un token</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {characters.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Mes personnages</p>
              <p className="text-[11px] text-amber-400/70 mb-2 flex items-center gap-1">
                <GripVertical size={11} />
                Glisser sur la carte pour placer directement
              </p>
              <div className="space-y-2">
                {characters.map(char => (
                  <div
                    key={char.id}
                    draggable
                    onDragStart={e => {
                      const data = buildTokenData(char);
                      e.dataTransfer.setData('application/vtt-new-token', JSON.stringify(data));
                      e.dataTransfer.effectAllowed = 'copy';
                      setIsDragging(true);
                    }}
                    onDragEnd={e => {
                      setIsDragging(false);
                      if (e.dataTransfer.dropEffect !== 'none') {
                        onClose();
                      }
                    }}
                    onClick={() => selectCharacter(char)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                      selectedCharId === char.id
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/50 hover:bg-gray-700'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-gray-600 flex items-center justify-center">
                      {char.avatar_url ? (
                        <img
                          src={char.avatar_url}
                          alt={char.name}
                          draggable={false}
                          className="w-full h-full object-cover pointer-events-none"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <User size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium truncate">{char.name}</p>
                      <p className="text-xs text-gray-400">
                        {[char.class, char.level ? `Niv. ${char.level}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <GripVertical size={14} className="text-gray-500 shrink-0" />
                    {selectedCharId === char.id && (
                      <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Nom *</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Nom du token..."
                maxLength={20}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                autoFocus={characters.length === 0}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1">Image (URL)</label>
              <input
                type="text"
                value={imageUrl}
                onChange={e => {
                  setImageUrl(e.target.value);
                  setSelectedCharId(null);
                }}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-300 mb-1">PV actuels</label>
                <input
                  type="number"
                  value={hp}
                  onChange={e => setHp(e.target.value)}
                  placeholder="—"
                  min={0}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-300 mb-1">PV max</label>
                <input
                  type="number"
                  value={maxHp}
                  onChange={e => setMaxHp(e.target.value)}
                  placeholder="—"
                  min={0}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-2">Taille</label>
              <div className="flex gap-2">
                {([1, 2, 3]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                      size === s
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {s === 1 ? '1×1' : s === 2 ? '2×2' : '3×3'}
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

            <div className="flex gap-2 pt-1">
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
    </div>
  );
}
