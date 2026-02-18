import React, { useState } from 'react';
import { Plus, Map, Pencil, Trash2, Check, X } from 'lucide-react';
import type { VTTScene } from '../../types/vtt';

interface VTTSceneBarProps {
  scenes: VTTScene[];
  activeSceneId: string | null;
  onSwitchScene: (sceneId: string) => void;
  onCreateScene: (name: string) => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onDeleteScene: (sceneId: string) => void;
}

export function VTTSceneBar({
  scenes,
  activeSceneId,
  onSwitchScene,
  onCreateScene,
  onRenameScene,
  onDeleteScene,
}: VTTSceneBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const startEdit = (scene: VTTScene, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(scene.id);
    setEditName(scene.name);
  };

  const commitEdit = () => {
    if (editingId && editName.trim()) {
      onRenameScene(editingId, editName.trim());
    }
    setEditingId(null);
  };

  const commitCreate = () => {
    if (newName.trim()) {
      onCreateScene(newName.trim());
    }
    setCreating(false);
    setNewName('');
  };

  return (
    <div className="flex items-center h-9 bg-gray-900/95 border-b border-gray-700/60 px-1 gap-0.5 overflow-x-auto shrink-0 scrollbar-hide">
      <Map size={14} className="text-gray-500 shrink-0 ml-1 mr-1" />

      {scenes.map(scene => (
        <div key={scene.id} className="relative group shrink-0">
          {editingId === scene.id ? (
            <div className="flex items-center gap-1 px-1">
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                className="h-6 w-24 px-1.5 bg-gray-700 border border-amber-500 rounded text-xs text-white outline-none"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
              <button onClick={commitEdit} className="p-0.5 text-emerald-400 hover:text-emerald-300">
                <Check size={12} />
              </button>
              <button onClick={() => setEditingId(null)} className="p-0.5 text-gray-400 hover:text-gray-300">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSwitchScene(scene.id)}
              className={`flex items-center gap-1 h-7 px-3 rounded text-xs font-medium transition-all whitespace-nowrap ${
                scene.id === activeSceneId
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {scene.name}
              <span
                className={`flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${scene.id === activeSceneId ? 'opacity-100' : ''}`}
                onClick={e => e.stopPropagation()}
              >
                <span
                  onClick={e => startEdit(scene, e)}
                  className="p-0.5 rounded hover:bg-black/20 cursor-pointer"
                >
                  <Pencil size={10} />
                </span>
                {scenes.length > 1 && (
                  <span
                    onClick={e => { e.stopPropagation(); if (window.confirm(`Supprimer "${scene.name}" ?`)) onDeleteScene(scene.id); }}
                    className="p-0.5 rounded hover:bg-red-700/40 cursor-pointer text-red-400"
                  >
                    <Trash2 size={10} />
                  </span>
                )}
              </span>
            </button>
          )}
        </div>
      ))}

      {creating ? (
        <div className="flex items-center gap-1 px-1 shrink-0">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitCreate(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
            placeholder="Nom de la scène..."
            className="h-6 w-28 px-1.5 bg-gray-700 border border-amber-500 rounded text-xs text-white outline-none"
            autoFocus
          />
          <button onClick={commitCreate} className="p-0.5 text-emerald-400 hover:text-emerald-300">
            <Check size={12} />
          </button>
          <button onClick={() => { setCreating(false); setNewName(''); }} className="p-0.5 text-gray-400 hover:text-gray-300">
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 h-7 px-2 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors shrink-0 text-xs"
          title="Nouvelle scène"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}
