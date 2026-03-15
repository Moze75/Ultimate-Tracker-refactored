import React, { useState } from 'react';
import { Plus, Check, X, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import type { VTTScene } from '../../types/vtt';

interface VTTSceneBarProps {
  scenes: VTTScene[];
  activeSceneId: string | null;
  onSwitchScene: (sceneId: string) => void;
  onCreateScene: (name: string) => void;
  onRenameScene: (sceneId: string, name: string) => void;
  onDeleteScene: (sceneId: string) => void;
  onRightClickScene?: (sceneId: string, x: number, y: number) => void;
  onSaveView?: () => void;
}

export function VTTSceneBar({
  scenes,
  activeSceneId,
  onSwitchScene,
  onCreateScene,
  onRenameScene,
  onDeleteScene,
  onRightClickScene,
  onSaveView,
}: VTTSceneBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [collapsed, setCollapsed] = useState(false);

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

  const activeScene = scenes.find(s => s.id === activeSceneId);

  const renderScene = (scene: VTTScene) => (
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
          onDoubleClick={e => { e.stopPropagation(); startEdit(scene, e); }}
          onContextMenu={e => {
            e.preventDefault();
            onRightClickScene?.(scene.id, e.clientX, e.clientY);
          }}
          className={`flex items-center gap-1.5 h-8 px-6 rounded-md text-xs font-medium transition-all whitespace-nowrap min-w-[120px] justify-center ${
            scene.id === activeSceneId
              ? 'bg-amber-600/90 text-white shadow-sm'
              : 'bg-gray-800/70 text-gray-300 hover:text-white hover:bg-gray-700/80 backdrop-blur-sm'
          }`}
        >
          {scene.name}
        </button>
      )}
    </div>
  );

  const actions = (
    <>
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

      {onSaveView && (
        <button
          onClick={onSaveView}
          className="flex items-center gap-1 h-8 px-3 rounded-md bg-gray-800/60 text-amber-400 hover:text-amber-200 hover:bg-gray-700/80 transition-colors shrink-0 text-xs backdrop-blur-sm border border-gray-700/40"
          title="Enregistrer la vue (zoom + position)"
        >
          <Bookmark size={12} />
        </button>
      )}
    </>
  );

  return (
    <div className="flex flex-col items-start px-3 pt-1.5 gap-1 max-w-full">
      <div className="flex items-center gap-1.5 flex-wrap max-w-full">
        {collapsed ? (
          <>
            {activeScene && renderScene(activeScene)}
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center gap-1 h-8 px-2 rounded-md bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80 transition-colors shrink-0 text-xs backdrop-blur-sm border border-gray-700/40"
              title="Afficher toutes les scènes"
            >
              <ChevronDown size={12} />
              <span className="text-[10px]">{scenes.length}</span>
            </button>
            {actions}
          </>
        ) : (
          <>
            {scenes.map(renderScene)}
            {scenes.length > 1 && (
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center gap-1 h-8 px-2 rounded-md bg-gray-800/60 text-gray-400 hover:text-gray-200 hover:bg-gray-700/80 transition-colors shrink-0 text-xs backdrop-blur-sm border border-gray-700/40"
                title="Replier les scènes"
              >
                <ChevronUp size={12} />
              </button>
            )}
            {actions}
          </>
        )}
      </div>
    </div>
  );
}
