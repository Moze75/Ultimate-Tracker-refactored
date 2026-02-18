import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Eye, EyeOff, UserPlus, Cloud, X, RefreshCw, Grid3X3, Crosshair, Trash2 } from 'lucide-react';
import type { VTTRole, VTTRoomConfig } from '../../types/vtt';

interface VTTLeftToolbarProps {
  role: VTTRole;
  activeTool: 'select' | 'fog-reveal' | 'fog-erase' | 'grid-calibrate';
  fogBrushSize: number;
  config: VTTRoomConfig;
  onToolChange: (tool: 'select' | 'fog-reveal' | 'fog-erase' | 'grid-calibrate') => void;
  onFogBrushSizeChange: (size: number) => void;
  onAddToken: () => void;
  onResetFog: () => void;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
  onBack: () => void;
  calibrationPoints?: { x: number; y: number }[];
  onClearCalibration?: () => void;
  onApplyCalibration?: () => void;
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
  calibrationPoints = [],
  onClearCalibration,
  onApplyCalibration,
}: VTTLeftToolbarProps) {
  const [fogPopupOpen, setFogPopupOpen] = useState(false);
  const [gridPopupOpen, setGridPopupOpen] = useState(false);
  const fogPopupRef = useRef<HTMLDivElement>(null);
  const fogBtnRef = useRef<HTMLDivElement>(null);
  const gridPopupRef = useRef<HTMLDivElement>(null);
  const gridBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fogPopupOpen && !gridPopupOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fogPopupOpen &&
        fogPopupRef.current && !fogPopupRef.current.contains(target) &&
        fogBtnRef.current && !fogBtnRef.current.contains(target)) {
        setFogPopupOpen(false);
      }
      if (gridPopupOpen &&
        gridPopupRef.current && !gridPopupRef.current.contains(target) &&
        gridBtnRef.current && !gridBtnRef.current.contains(target)) {
        setGridPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fogPopupOpen, gridPopupOpen]);

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';
  const isGridTool = activeTool === 'grid-calibrate';

  return (
    <div className="relative flex flex-col items-center w-12 bg-gray-900/95 border-r border-gray-700/60 py-2 gap-1 shrink-0">
      <ToolBtn
        icon={<MousePointer2 size={17} />}
        label="Sélection"
        active={activeTool === 'select'}
        onClick={() => { onToolChange('select'); setFogPopupOpen(false); setGridPopupOpen(false); }}
      />

      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700 my-1" />

          <div ref={fogBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Cloud size={17} />}
              label="Brouillard de guerre"
              active={isFogTool || fogPopupOpen}
              onClick={() => {
                const opening = !fogPopupOpen;
                setFogPopupOpen(opening);
                setGridPopupOpen(false);
                if (opening && !isFogTool) onToolChange('fog-reveal');
              }}
            />
          </div>

          <div ref={gridBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Grid3X3 size={17} />}
              label="Paramètres de grille"
              active={isGridTool || gridPopupOpen}
              onClick={() => {
                const opening = !gridPopupOpen;
                setGridPopupOpen(opening);
                setFogPopupOpen(false);
                if (!opening && isGridTool) onToolChange('select');
              }}
            />
          </div>
        </>
      )}

      <div className="w-6 h-px bg-gray-700 my-1" />

      <ToolBtn
        icon={<UserPlus size={17} />}
        label="Ajouter un token"
        active={false}
        onClick={onAddToken}
      />

      {fogPopupOpen && role === 'gm' && (
        <div
          ref={fogPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-56"
          style={{ top: '60px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Brouillard de guerre</span>
            <button onClick={() => setFogPopupOpen(false)} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
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
                type="range" min={4} max={200} step={2}
                value={fogBrushSize}
                onChange={e => onFogBrushSizeChange(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>4px</span><span>200px</span>
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

      {gridPopupOpen && role === 'gm' && (
        <div
          ref={gridPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-64"
          style={{ top: '108px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Paramètres de grille</span>
            <button onClick={() => { setGridPopupOpen(false); if (isGridTool) onToolChange('select'); }} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Taille des cases</span>
                <span className="text-xs font-mono text-amber-400 font-bold">{config.gridSize}px</span>
              </div>
              <input
                type="range" min={20} max={200} step={2}
                value={config.gridSize}
                onChange={e => onUpdateMap({ gridSize: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>20px</span><span>200px</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Aligner sur la grille</span>
              <button
                onClick={() => onUpdateMap({ snapToGrid: !config.snapToGrid })}
                className={`w-9 h-5 rounded-full transition-colors ${config.snapToGrid ? 'bg-amber-600' : 'bg-gray-700'}`}
              >
                <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${config.snapToGrid ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-400">Couleur de la grille</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={hexFromGridColor(config.gridColor || 'rgba(255,255,255,0.15)')}
                  onChange={e => onUpdateMap({ gridColor: hexToRgba(e.target.value, gridOpacity(config.gridColor)) })}
                  className="w-8 h-7 rounded cursor-pointer border border-gray-600 bg-transparent"
                />
                <div className="flex-1">
                  <input
                    type="range" min={0} max={100} step={5}
                    value={Math.round(gridOpacity(config.gridColor) * 100)}
                    onChange={e => onUpdateMap({ gridColor: hexToRgba(hexFromGridColor(config.gridColor || '#ffffff'), parseInt(e.target.value) / 100) })}
                    className="w-full accent-amber-500"
                  />
                </div>
                <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(gridOpacity(config.gridColor) * 100)}%</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Décalage X</span>
                <span className="text-xs font-mono text-gray-400">{config.gridOffsetX ?? 0}px</span>
              </div>
              <input
                type="range" min={0} max={config.gridSize - 1} step={1}
                value={config.gridOffsetX ?? 0}
                onChange={e => onUpdateMap({ gridOffsetX: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Décalage Y</span>
                <span className="text-xs font-mono text-gray-400">{config.gridOffsetY ?? 0}px</span>
              </div>
              <input
                type="range" min={0} max={config.gridSize - 1} step={1}
                value={config.gridOffsetY ?? 0}
                onChange={e => onUpdateMap({ gridOffsetY: parseInt(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="pt-2 border-t border-gray-700/60 space-y-2">
              <p className="text-[10px] text-gray-500 leading-relaxed">
                Méthode : cliquez sur 2 intersections adjacentes <strong className="text-gray-400">horizontalement ou verticalement</strong>. Un 3e clic repart de zéro. La distance = taille d'une case.
              </p>
              <button
                onClick={() => {
                  onToolChange(activeTool === 'grid-calibrate' ? 'select' : 'grid-calibrate');
                }}
                className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors border ${
                  activeTool === 'grid-calibrate'
                    ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-amber-300 hover:border-amber-600/40'
                }`}
              >
                <Crosshair size={12} />
                {activeTool === 'grid-calibrate' ? `Calibration (${calibrationPoints.length} point${calibrationPoints.length !== 1 ? 's' : ''})` : 'Calibrer la grille'}
              </button>

              {calibrationPoints.length >= 2 && (
                <div className="flex gap-1.5">
                  <button
                    onClick={onApplyCalibration}
                    className="flex-1 py-1.5 rounded text-xs bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                  >
                    Appliquer
                  </button>
                  <button
                    onClick={onClearCalibration}
                    className="p-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hexFromGridColor(color: string): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return color.startsWith('#') ? color : '#ffffff';
  const r = parseInt(m[1]).toString(16).padStart(2, '0');
  const g = parseInt(m[2]).toString(16).padStart(2, '0');
  const b = parseInt(m[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function gridOpacity(color?: string): number {
  if (!color) return 0.15;
  const m = color.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  if (!m) return 1;
  return parseFloat(m[1]);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
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
