import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Eye, EyeOff, UserPlus, Cloud, X, RefreshCw } from 'lucide-react';
import type { VTTRole, VTTRoomConfig } from '../../types/vtt';

interface VTTLeftToolbarProps {
  role: VTTRole;
  activeTool: 'select' | 'fog-reveal' | 'fog-erase';
  fogBrushSize: number;
  config: VTTRoomConfig;
  onToolChange: (tool: 'select' | 'fog-reveal' | 'fog-erase') => void;
  onFogBrushSizeChange: (size: number) => void;
  onAddToken: () => void;
  onResetFog: () => void;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
  onBack: () => void;
}

export function VTTLeftToolbar({
  role,
  activeTool,
  fogBrushSize,
  config,
  onToolChange,
  onFogBrushSizeChange,
  onAddToken,
  onResetFog,
  onUpdateMap,
}: VTTLeftToolbarProps) {
  const [fogPopupOpen, setFogPopupOpen] = useState(false);
  const fogPopupRef = useRef<HTMLDivElement>(null);
  const fogBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fogPopupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        fogPopupRef.current && !fogPopupRef.current.contains(e.target as Node) &&
        fogBtnRef.current && !fogBtnRef.current.contains(e.target as Node)
      ) {
        setFogPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fogPopupOpen]);

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';

  return (
    <div className="relative flex flex-col items-center w-12 bg-gray-900/95 border-r border-gray-700/60 py-2 gap-1 shrink-0">
      <ToolBtn
        icon={<MousePointer2 size={17} />}
        label="Sélection — déplacer les tokens"
        active={activeTool === 'select'}
        onClick={() => { onToolChange('select'); setFogPopupOpen(false); }}
      />

      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700 my-1" />

          <div ref={fogBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Cloud size={17} />}
              label="Brouillard de guerre"
              active={isFogTool || fogPopupOpen}
              onClick={() => setFogPopupOpen(v => !v)}
            />
          </div>
        </>
      )}

      <div className="w-6 h-px bg-gray-700 my-1" />

      <ToolBtn
        icon={<UserPlus size={17} />}
        label="Ajouter un personnage"
        active={false}
        onClick={onAddToken}
      />

      {fogPopupOpen && role === 'gm' && (
        <div
          ref={fogPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-56"
          style={{ top: '48px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Brouillard de guerre</span>
            <button
              onClick={() => setFogPopupOpen(false)}
              className="p-0.5 text-gray-500 hover:text-gray-300 rounded"
            >
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Activer</span>
              <button
                onClick={() => onUpdateMap({ fogEnabled: !config.fogEnabled })}
                className={`w-9 h-5 rounded-full transition-colors ${config.fogEnabled ? 'bg-amber-600' : 'bg-gray-700'}`}
              >
                <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${config.fogEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => onToolChange('fog-reveal')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                  activeTool === 'fog-reveal' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <Eye size={11} /> Révéler
              </button>
              <button
                onClick={() => onToolChange('fog-erase')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                  activeTool === 'fog-erase' ? 'bg-red-700 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                <EyeOff size={11} /> Masquer
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Rayon du pinceau</span>
                <span className="text-xs font-mono text-amber-400 font-bold">{fogBrushSize}px</span>
              </div>
              <input
                type="range"
                min={4}
                max={120}
                step={2}
                value={fogBrushSize}
                onChange={e => onFogBrushSizeChange(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>4px</span><span>120px</span>
              </div>
            </div>

            <div className="pt-1 border-t border-gray-700/60">
              <button
                onClick={() => { onResetFog(); setFogPopupOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-800/60 text-gray-400 hover:text-red-400 rounded text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Réinitialiser le brouillard
              </button>
            </div>
          </div>
        </div>
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
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative w-full flex justify-center">
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
          active
            ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
      >
        {icon}
      </button>
      {hovered && (
        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-50 whitespace-nowrap">
          <div className="bg-gray-800 border border-gray-700/80 text-gray-200 text-xs px-2.5 py-1 rounded-lg shadow-xl">
            {label}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-700/80" />
        </div>
      )}
    </div>
  );
}
