import React, { useState, useRef } from 'react';
import { Plus, Trash2, Lock, Unlock, Image, Type } from 'lucide-react';
import type { VTTProp } from '../../types/vtt';

interface VTTPropsPanelProps {
  props: VTTProp[];
  selectedPropId: string | null;
  role: 'gm' | 'player';
  onSelectProp: (id: string | null) => void;
  onAddProp: (prop: Omit<VTTProp, 'id'>) => void;
  onRemoveProp: (propId: string) => void;
  onUpdateProp: (propId: string, changes: Partial<VTTProp>) => void;
}

export function VTTPropsPanel({
  props,
  selectedPropId,
  role,
  onSelectProp,
  onAddProp,
  onRemoveProp,
  onUpdateProp,
}: VTTPropsPanelProps) {
  const [addMode, setAddMode] = useState<'image' | 'text' | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    onAddProp({
      label: newLabel || 'Prop',
      imageUrl: newImageUrl.trim(),
      position: { x: 100, y: 100 },
      width: 150,
      height: 150,
      opacity: 1,
      locked: false,
    });
    setNewLabel('');
    setNewImageUrl('');
    setAddMode(null);
  };

  const handleAddText = () => {
    if (!newLabel.trim()) return;
    onAddProp({
      label: newLabel.trim(),
      imageUrl: null,
      position: { x: 100, y: 100 },
      width: 120,
      height: 40,
      opacity: 1,
      locked: false,
    });
    setNewLabel('');
    setAddMode(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onAddProp({
        label: newLabel || file.name.replace(/\.[^.]+$/, ''),
        imageUrl: dataUrl,
        position: { x: 100, y: 100 },
        width: 150,
        height: 150,
        opacity: 1,
        locked: false,
      });
      setNewLabel('');
      setAddMode(null);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-full">
      {role === 'gm' && (
        <div className="p-2 border-b border-gray-700/60 space-y-2">
          {addMode === null && (
            <div className="flex gap-1">
              <button
                onClick={() => { setAddMode('image'); setNewLabel(''); setNewImageUrl(''); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded text-xs transition-colors"
              >
                <Image size={11} /> Image
              </button>
              <button
                onClick={() => { setAddMode('text'); setNewLabel(''); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white rounded text-xs transition-colors"
              >
                <Type size={11} /> Texte
              </button>
            </div>
          )}

          {addMode === 'image' && (
            <div className="space-y-1.5">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Nom (optionnel)"
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="text"
                value={newImageUrl}
                onChange={e => setNewImageUrl(e.target.value)}
                placeholder="URL de l'image..."
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleAddImageUrl}
                  disabled={!newImageUrl.trim()}
                  className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> Ajouter URL
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                >
                  Fichier...
                </button>
              </div>
              <button
                onClick={() => setAddMode(null)}
                className="w-full py-1 text-gray-500 hover:text-gray-300 text-xs transition-colors"
              >
                Annuler
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>
          )}

          {addMode === 'text' && (
            <div className="space-y-1.5">
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Texte à afficher..."
                className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-xs outline-none focus:ring-1 focus:ring-amber-500"
                onKeyDown={e => e.key === 'Enter' && handleAddText()}
                autoFocus
              />
              <div className="flex gap-1">
                <button
                  onClick={handleAddText}
                  disabled={!newLabel.trim()}
                  className="flex-1 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded text-xs transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> Ajouter
                </button>
                <button
                  onClick={() => setAddMode(null)}
                  className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-xs transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {props.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">Aucun prop</p>
        )}
        {props.map(prop => {
          const isSelected = prop.id === selectedPropId;
          return (
            <div
              key={prop.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                isSelected
                  ? 'bg-amber-500/15 border border-amber-500/40'
                  : 'hover:bg-gray-800 border border-transparent'
              }`}
              draggable={role === 'gm'}
              onDragStart={e => {
                e.dataTransfer.setData('application/vtt-prop-id', prop.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onSelectProp(isSelected ? null : prop.id)}
            >
              <div className="w-6 h-6 rounded shrink-0 bg-gray-700 flex items-center justify-center overflow-hidden">
                {prop.imageUrl ? (
                  <img src={prop.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Type size={11} className="text-gray-400" />
                )}
              </div>
              <p className={`flex-1 text-xs truncate ${isSelected ? 'text-amber-300' : 'text-gray-300'}`}>
                {prop.label}
              </p>
              {role === 'gm' && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); onUpdateProp(prop.id, { locked: !prop.locked }); }}
                    className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                    title={prop.locked ? 'Déverrouiller' : 'Verrouiller'}
                  >
                    {prop.locked ? <Lock size={11} /> : <Unlock size={11} />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveProp(prop.id); }}
                    className="p-1 rounded hover:bg-red-700/40 text-gray-400 hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {props.length > 0 && role === 'gm' && (
        <div className="p-2 border-t border-gray-700/60">
          <p className="text-[10px] text-gray-600 text-center">
            Glisser-déposer sur la carte pour repositionner
          </p>
        </div>
      )}
    </div>
  );
}
