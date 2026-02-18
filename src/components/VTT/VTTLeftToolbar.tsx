import React from 'react';
import { MousePointer2, Eye, EyeOff, Plus, ChevronLeft, Minus } from 'lucide-react';
import type { VTTRole } from '../../types/vtt';

interface VTTLeftToolbarProps {
  role: VTTRole;
  activeTool: 'select' | 'fog-reveal' | 'fog-erase';
  fogBrushSize: number;
  onToolChange: (tool: 'select' | 'fog-reveal' | 'fog-erase') => void;
  onFogBrushSizeChange: (size: number) => void;
  onAddToken: () => void;
  onBack: () => void;
}

export function VTTLeftToolbar({
  role,
  activeTool,
  fogBrushSize,
  onToolChange,
  onFogBrushSizeChange,
  onAddToken,
  onBack,
}: VTTLeftToolbarProps) {
  return (
    <div className="flex flex-col items-center w-12 bg-gray-900/95 border-r border-gray-700/60 py-2 gap-1 shrink-0">
      <button
        onClick={onBack}
        title="Retour au lobby"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors mb-1"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="w-6 h-px bg-gray-700 my-1" />

      <ToolBtn
        icon={<MousePointer2 size={17} />}
        label="Sélection (S)"
        active={activeTool === 'select'}
        onClick={() => onToolChange('select')}
      />

      {role === 'gm' && (
        <>
          <ToolBtn
            icon={<Eye size={17} />}
            label="Révéler brouillard (R)"
            active={activeTool === 'fog-reveal'}
            onClick={() => onToolChange('fog-reveal')}
          />
          <ToolBtn
            icon={<EyeOff size={17} />}
            label="Masquer brouillard (E)"
            active={activeTool === 'fog-erase'}
            onClick={() => onToolChange('fog-erase')}
          />
        </>
      )}

      <div className="w-6 h-px bg-gray-700 my-1" />

      <ToolBtn
        icon={<Plus size={17} />}
        label="Ajouter token (T)"
        active={false}
        onClick={onAddToken}
      />

      {role === 'gm' && (activeTool === 'fog-reveal' || activeTool === 'fog-erase') && (
        <>
          <div className="w-6 h-px bg-gray-700 my-1" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-gray-500 uppercase tracking-wide">Taille</span>
            <button
              onClick={() => onFogBrushSizeChange(Math.min(6, fogBrushSize + 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs"
            >
              +
            </button>
            <span className="text-xs text-gray-300 font-mono">{fogBrushSize}</span>
            <button
              onClick={() => onFogBrushSizeChange(Math.max(1, fogBrushSize - 1))}
              className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs"
            >
              <Minus size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ToolBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {icon}
    </button>
  );
}
