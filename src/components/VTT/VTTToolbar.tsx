import React from 'react';
import { MousePointer2, Eye, EyeOff, Plus, Trash2, RefreshCw, ZoomIn, ZoomOut, Layers } from 'lucide-react';
import type { VTTRole, VTTToken } from '../../types/vtt';

interface VTTToolbarProps {
  role: VTTRole;
  activeTool: 'select' | 'fog-reveal' | 'fog-erase';
  fogBrushSize: number;
  connectedCount: number;
  connected: boolean;
  selectedToken: VTTToken | null;
  onToolChange: (tool: 'select' | 'fog-reveal' | 'fog-erase') => void;
  onFogBrushSizeChange: (size: number) => void;
  onAddToken: () => void;
  onRemoveToken: () => void;
  onToggleTokenVisibility: () => void;
  onResetFog: () => void;
  onBack: () => void;
}

export function VTTToolbar({
  role,
  activeTool,
  fogBrushSize,
  connectedCount,
  connected,
  selectedToken,
  onToolChange,
  onFogBrushSizeChange,
  onAddToken,
  onRemoveToken,
  onToggleTokenVisibility,
  onResetFog,
  onBack,
}: VTTToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/95 border-b border-gray-700/60 flex-wrap">
      <button
        onClick={onBack}
        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
      >
        ← Retour
      </button>

      <div className="w-px h-6 bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolBtn
          icon={<MousePointer2 size={16} />}
          label="Sélection"
          active={activeTool === 'select'}
          onClick={() => onToolChange('select')}
        />
        {role === 'gm' && (
          <>
            <ToolBtn
              icon={<Eye size={16} />}
              label="Révéler brouillard"
              active={activeTool === 'fog-reveal'}
              onClick={() => onToolChange('fog-reveal')}
            />
            <ToolBtn
              icon={<EyeOff size={16} />}
              label="Masquer brouillard"
              active={activeTool === 'fog-erase'}
              onClick={() => onToolChange('fog-erase')}
            />
          </>
        )}
      </div>

      {role === 'gm' && (activeTool === 'fog-reveal' || activeTool === 'fog-erase') && (
        <>
          <div className="w-px h-6 bg-gray-700" />
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400">Pinceau</span>
            <input
              type="range"
              min={1}
              max={5}
              value={fogBrushSize}
              onChange={e => onFogBrushSizeChange(parseInt(e.target.value))}
              className="w-20 accent-amber-500"
            />
            <span className="text-xs text-gray-300 w-4">{fogBrushSize}</span>
          </div>
        </>
      )}

      <div className="w-px h-6 bg-gray-700" />

      <div className="flex items-center gap-1">
        <ToolBtn
          icon={<Plus size={16} />}
          label="Ajouter token"
          active={false}
          onClick={onAddToken}
        />
        {selectedToken && (
          <>
            <ToolBtn
              icon={<EyeOff size={16} />}
              label={selectedToken.visible ? 'Masquer token' : 'Afficher token'}
              active={false}
              onClick={onToggleTokenVisibility}
              disabled={role !== 'gm'}
            />
            <ToolBtn
              icon={<Trash2 size={16} />}
              label="Supprimer token"
              active={false}
              onClick={onRemoveToken}
              danger
              disabled={role !== 'gm' && selectedToken.ownerUserId !== undefined}
            />
          </>
        )}
      </div>

      {role === 'gm' && (
        <>
          <div className="w-px h-6 bg-gray-700" />
          <button
            onClick={onResetFog}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            title="Réinitialiser le brouillard"
          >
            <RefreshCw size={14} />
            Reset brouillard
          </button>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-red-400'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {connected ? `${connectedCount} connecté${connectedCount > 1 ? 's' : ''}` : 'Déconnecté'}
        </span>
      </div>
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  active,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2 rounded-lg transition-colors text-sm ${
        active
          ? 'bg-amber-600 text-white'
          : danger
          ? 'bg-red-900/40 hover:bg-red-700/50 text-red-400 hover:text-red-300'
          : disabled
          ? 'bg-gray-800/30 text-gray-600 cursor-not-allowed'
          : 'bg-gray-700/60 hover:bg-gray-600 text-gray-300'
      }`}
    >
      {icon}
    </button>
  );
}
