import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { VTTScene } from '../../types/vtt';

interface VTTSceneBarProps {
  scenes: VTTScene[];
  activeSceneId: string | null;
  onSwitchScene: (sceneId: string) => void;
  onCreateScene: (name: string) => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onRightClickScene?: (sceneId: string, x: number, y: number) => void;
}

export function VTTSceneBar({
  scenes,
  activeSceneId,
  onSwitchScene,
  onCreateScene,
  onRenameScene,
  onDeleteScene,
  onRightClickScene,
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
    <div className="flex items-center h-10 px-2 gap-1.5 overflow-x-auto shrink-0 scrollbar-hide">
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
              onContextMenu={e => {
                e.preventDefault();
                onRightClickScene?.(scene.id, e.clientX, e.clientY);
              }}
              className={`flex items-center gap-1.5 h-8 px-6 rounded-md text-xs font-medium transition-all whitespace-nowrap min-w-[160px] justify-center ${
                scene.id === activeSceneId
                  ? 'bg-amber-600/90 text-white shadow-sm'
                  : 'bg-gray-800/70 text-gray-300 hover:text-white hover:bg-gray-700/80 backdrop-blur-sm'
              }`}
            >
              {scene.name}
              <span
                className="flex items-center gap-0.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <span
                  onClick={e => startEdit(scene, e)}
                  className="p-0.5 rounded hover:bg-black/20 cursor-pointer"
                >
                  <Pencil size={9} />
                </span>
                {scenes.length > 1 && (
                  <span
                    onClick={e => { e.stopPropagation(); if (window.confirm(`Supprimer "${scene.name}" ?`)) onDeleteScene(scene.id); }}
                    className="p-0.5 rounded hover:bg-red-700/40 cursor-pointer text-red-400"
                  >
                    <Trash2 size={9} />
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
            placeholder="Nom..."
            className="h-6 w-24 px-1.5 bg-gray-700 border border-amber-500 rounded text-xs text-white outline-none"
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
          className="flex items-center gap-1 h-8 px-3 rounded-md bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80 transition-colors shrink-0 text-xs backdrop-blur-sm border border-gray-700/40"
          title="Nouvelle scène"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
