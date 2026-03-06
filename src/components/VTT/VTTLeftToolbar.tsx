import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Eye, EyeOff, UserPlus, Cloud, X, RefreshCw, Grid3x3 as Grid3X3, Crosshair, Trash2, Sun, Moon, Fence, Ruler, MonitorPlay, ExternalLink, Copy, Check, RectangleHorizontal, Lock, Unlock, Clock, Sunrise, Sunset, Sparkles, Wind } from 'lucide-react';
import type { VTTWeatherEffect, VTTWeatherType } from '../../types/vtt';
import type { VTTRole, VTTRoomConfig } from '../../types/vtt';

export type VTTActiveTool = 'select' | 'fog-reveal' | 'fog-erase' | 'grid-calibrate' | 'wall-draw' | 'wall-select' | 'measure';

interface VTTLeftToolbarProps {
  role: VTTRole;
  activeTool: VTTActiveTool;
  fogBrushSize: number;
  config: VTTRoomConfig;
  onToolChange: (tool: VTTActiveTool) => void;
  onFogBrushSizeChange: (size: number) => void;
  onAddToken: () => void;
  onResetFog: () => void;
  onRevealAll?: () => void;
  onMaskAll?: () => void;
  onUpdateMap: (changes: Partial<VTTRoomConfig>) => void;
  onBack: () => void;
  calibrationPoints?: { x: number; y: number }[];
  onClearCalibration?: () => void;
  onApplyCalibration?: () => void;
  wallCount?: number;
  onClearWalls?: () => void;
  showWalls: boolean;
  onToggleShowWalls: () => void;
  roomId?: string;
  broadcastFrameEnabled: boolean;
  onToggleBroadcastFrame: () => void;
  broadcastAspectRatio: string;
  onBroadcastAspectRatioChange: (ratio: string) => void;
  broadcastLockRatio: boolean;
  onToggleBroadcastLockRatio: () => void;
  onOpenBroadcastWindow: () => void;
  broadcastMode: 'frame' | 'follow';
  onBroadcastModeChange: (mode: 'frame' | 'follow') => void;
  weatherEffects: VTTWeatherEffect[];
  onUpdateWeather: (effects: VTTWeatherEffect[]) => void;
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
  onRevealAll,
  onMaskAll,
  onUpdateMap,
  calibrationPoints = [],
  onClearCalibration,
  onApplyCalibration,
  wallCount = 0,
  onClearWalls,
  showWalls,
  onToggleShowWalls,
  roomId,
  broadcastFrameEnabled,
  onToggleBroadcastFrame,
  broadcastAspectRatio,
  onBroadcastAspectRatioChange,
  broadcastLockRatio,
  onToggleBroadcastLockRatio,
  onOpenBroadcastWindow,
  broadcastMode,
  onBroadcastModeChange,
  weatherEffects,
  onUpdateWeather,
}: VTTLeftToolbarProps) {
  const [fogPopupOpen, setFogPopupOpen] = useState(false);
  const [gridPopupOpen, setGridPopupOpen] = useState(false);
  const [wallPopupOpen, setWallPopupOpen] = useState(false);
  const [weatherPopupOpen, setWeatherPopupOpen] = useState(false);
  const weatherBtnRef = useRef<HTMLDivElement>(null);
  const weatherPopupRef = useRef<HTMLDivElement>(null);
  const [broadcastPopupOpen, setBroadcastPopupOpen] = useState(false);
  const [timePopupOpen, setTimePopupOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fogPopupRef = useRef<HTMLDivElement>(null);
  const fogBtnRef = useRef<HTMLDivElement>(null);
  const gridPopupRef = useRef<HTMLDivElement>(null);
  const gridBtnRef = useRef<HTMLDivElement>(null);
  const wallPopupRef = useRef<HTMLDivElement>(null);
  const wallBtnRef = useRef<HTMLDivElement>(null);
  const broadcastPopupRef = useRef<HTMLDivElement>(null);
  const broadcastBtnRef = useRef<HTMLDivElement>(null);
  const timePopupRef = useRef<HTMLDivElement>(null);
  const timeBtnRef = useRef<HTMLDivElement>(null);
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

   useEffect(() => {
    if (!fogPopupOpen && !gridPopupOpen && !wallPopupOpen && !broadcastPopupOpen && !timePopupOpen && !weatherPopupOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fogPopupOpen &&
        fogPopupRef.current && !fogPopupRef.current.contains(target) &&
        fogBtnRef.current && !fogBtnRef.current.contains(target)) {
        setFogPopupOpen(false);
      }
      if (gridPopupOpen &&
        activeToolRef.current !== 'grid-calibrate' &&
        gridPopupRef.current && !gridPopupRef.current.contains(target) &&
        gridBtnRef.current && !gridBtnRef.current.contains(target)) {
        setGridPopupOpen(false);
      }
      if (wallPopupOpen &&
        wallPopupRef.current && !wallPopupRef.current.contains(target) &&
        wallBtnRef.current && !wallBtnRef.current.contains(target)) {
        setWallPopupOpen(false);
      }
      if (broadcastPopupOpen &&
        broadcastPopupRef.current && !broadcastPopupRef.current.contains(target) &&
        broadcastBtnRef.current && !broadcastBtnRef.current.contains(target)) {
        setBroadcastPopupOpen(false);
      }
      if (timePopupOpen &&
        timePopupRef.current && !timePopupRef.current.contains(target) &&
        timeBtnRef.current && !timeBtnRef.current.contains(target)) {
        setTimePopupOpen(false);
      }
      if (weatherPopupOpen &&
        weatherPopupRef.current && !weatherPopupRef.current.contains(target) &&
        weatherBtnRef.current && !weatherBtnRef.current.contains(target)) {
        setWeatherPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [fogPopupOpen, gridPopupOpen, wallPopupOpen, broadcastPopupOpen, timePopupOpen, weatherPopupOpen]);

  const isFogTool = activeTool === 'fog-reveal' || activeTool === 'fog-erase';
  const isGridTool = activeTool === 'grid-calibrate';
  const isWallTool = activeTool === 'wall-draw';
  const isWallSelectTool = activeTool === 'wall-select';
  const isAnyWallTool = isWallTool || isWallSelectTool;
  const isMeasureTool = activeTool === 'measure';

  return (
    <div className="relative flex flex-col items-center w-12 bg-gray-900/95 border-r border-gray-700/60 shrink-0" style={{ paddingTop: '4px', paddingBottom: '8px', gap: '4px' }}>

      <div className="w-8 h-8 rounded-lg flex items-center justify-center opacity-20 pointer-events-none mb-1">
        <div className="w-5 h-5 rounded-md bg-gray-500" />
      </div>

      <div className="w-6 h-px bg-gray-700/70 my-0.5" />

      <ToolBtn
        icon={<MousePointer2 size={17} />}
        label="Selection"
        active={activeTool === 'select'}
        onClick={() => { onToolChange('select'); setFogPopupOpen(false); setGridPopupOpen(false); setWallPopupOpen(false); }}
      />

      <ToolBtn
        icon={<Ruler size={17} />}
        label="Mesurer la distance"
        active={isMeasureTool}
        onClick={() => { onToolChange(isMeasureTool ? 'select' : 'measure'); setFogPopupOpen(false); setGridPopupOpen(false); setWallPopupOpen(false); }}
      />

      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700/70 my-0.5" />

          <div ref={fogBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Cloud size={17} />}
              label="Brouillard de guerre"
              active={isFogTool || fogPopupOpen}
              onClick={() => {
                const opening = !fogPopupOpen;
                setFogPopupOpen(opening);
                setGridPopupOpen(false);
                setWallPopupOpen(false);
                if (opening && !isFogTool) onToolChange('fog-reveal');
              }}
            />
          </div>

          <div ref={gridBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Grid3X3 size={17} />}
              label="Parametres de grille"
              active={isGridTool || gridPopupOpen}
              onClick={() => {
                const opening = !gridPopupOpen;
                setGridPopupOpen(opening);
                setFogPopupOpen(false);
                setWallPopupOpen(false);
                if (!opening && isGridTool) onToolChange('select');
              }}
            />
          </div>

          <div ref={wallBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Fence size={17} />}
              label="Murs"
              active={isAnyWallTool || wallPopupOpen}
              onClick={() => {
                const opening = !wallPopupOpen;
                setWallPopupOpen(opening);
                setFogPopupOpen(false);
                setGridPopupOpen(false);
                if (opening && !isAnyWallTool) onToolChange('wall-draw');
              }}
            />
          </div>
        </>
      )}

      {role === 'gm' && (
        <div ref={timeBtnRef} className="w-full flex flex-col items-center">
          <ToolBtn
            icon={<Clock size={17} />}
            label="Heure du jour"
            active={timePopupOpen}
            onClick={() => {
              setTimePopupOpen(v => !v);
              setFogPopupOpen(false);
              setGridPopupOpen(false);
              setWallPopupOpen(false);
              setBroadcastPopupOpen(false);
            }}
          />
        </div>
      )}

      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700/70 my-0.5" />

          <ToolBtn
            icon={<UserPlus size={17} />}
            label="Ajouter un token"
            active={false}
            onClick={onAddToken}
          />
        </>
      )}

      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700/70 my-0.5" />
          <div ref={weatherBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<Wind size={17} />}
              label="Effets météo"
              active={weatherPopupOpen || weatherEffects.length > 0}
              onClick={() => {
                setWeatherPopupOpen(v => !v);
                setFogPopupOpen(false);
                setGridPopupOpen(false);
                setWallPopupOpen(false);
              }}
            />
            {weatherEffects.length > 0 && (
              <span className="text-[8px] text-sky-400 font-bold -mt-0.5">{weatherEffects.length}</span>
            )}
          </div>
        </>
      )}

      {weatherPopupOpen && role === 'gm' && (
        <WeatherPopup
          ref={weatherPopupRef}
          effects={weatherEffects}
          onChange={onUpdateWeather}
          onClose={() => setWeatherPopupOpen(false)}
        />
      )}

      
      {role === 'gm' && (
        <>
          <div className="w-6 h-px bg-gray-700/70 my-0.5" />
          <div ref={broadcastBtnRef} className="w-full flex flex-col items-center">
            <ToolBtn
              icon={<MonitorPlay size={17} />}
              label="Diffusion"
              active={broadcastPopupOpen}
              onClick={() => {
                setBroadcastPopupOpen(v => !v);
                setFogPopupOpen(false);
                setGridPopupOpen(false);
                setWallPopupOpen(false);
              }}
            />
          </div>
        </>
      )}

      {fogPopupOpen && role === 'gm' && (
        <div
          ref={fogPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-56"
          style={{ top: '88px' }}
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
                <Eye size={11} /> Reveler
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

            <div className="pt-1 border-t border-gray-700/60 space-y-1.5">
              <div className="flex gap-1.5">
                <button
                  onClick={() => { onRevealAll?.(); setFogPopupOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-amber-600/40 text-gray-400 hover:text-amber-300 rounded text-xs transition-colors"
                >
                  <Sun size={11} />
                  Tout reveler
                </button>
                <button
                  onClick={() => { onMaskAll?.(); setFogPopupOpen(false); }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-blue-800/60 text-gray-400 hover:text-blue-400 rounded text-xs transition-colors"
                >
                  <Moon size={11} />
                  Tout masquer
                </button>
              </div>
              <button
                onClick={() => { onResetFog(); setFogPopupOpen(false); }}
                className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-red-800/60 text-gray-400 hover:text-red-400 rounded text-xs transition-colors"
              >
                <RefreshCw size={12} />
                Reinitialiser le brouillard
              </button>
            </div>
          </div>
        </div>
      )}

      {gridPopupOpen && role === 'gm' && (
        <div
          ref={gridPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-64"
          style={{ top: '136px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Parametres de grille</span>
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
                <span className="text-xs text-gray-400">Epaisseur du trait</span>
                <span className="text-xs font-mono text-amber-400 font-bold">{config.gridLineWidth ?? 1}px</span>
              </div>
              <input
                type="range" min={1} max={6} step={0.5}
                value={config.gridLineWidth ?? 1}
                onChange={e => onUpdateMap({ gridLineWidth: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>1px</span><span>6px</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">Decalage X</span>
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
                <span className="text-xs text-gray-400">Decalage Y</span>
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
                Methode : cliquez sur 2 intersections adjacentes <strong className="text-gray-400">horizontalement ou verticalement</strong>. Un 3e clic repart de zero. La distance = taille d'une case.
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

       {wallPopupOpen && role === 'gm' && (
        <div
          ref={wallPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-56"
          style={{ top: '184px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Murs de collision</span>
            <button onClick={() => setWallPopupOpen(false)} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">

            {/* Sous-outils : Tracer / Éditer */}
            <div className="flex gap-1">
              <button
                onClick={() => onToolChange('wall-draw')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors border ${
                  isWallTool
                    ? 'bg-red-700/30 border-red-600/60 text-red-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-red-300 hover:border-red-700/40'
                }`}
              >
                <Fence size={12} /> {isWallTool ? 'Tracage actif' : 'Tracer'}
              </button>
              <button
                onClick={() => onToolChange('wall-select')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs font-medium transition-colors border ${
                  isWallSelectTool
                    ? 'bg-orange-700/30 border-orange-600/60 text-orange-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-orange-300 hover:border-orange-700/40'
                }`}
              >
                <MousePointer2 size={12} /> {isWallSelectTool ? 'Édition active' : 'Éditer'}
              </button>
            </div>

            {/* Instructions contextualles selon le sous-outil actif */}
            {isWallTool && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/40">
                <p className="text-[11px] text-red-300/80 leading-relaxed">
                  <strong className="text-red-300">Cliquer</strong> sur la carte pour poser des points.<br />
                  <strong className="text-red-300">Echap</strong> pour terminer le mur en cours.
                </p>
              </div>
            )}
            {isWallSelectTool && (
              <div className="p-2.5 rounded-lg bg-orange-950/40 border border-orange-900/40">
                <p className="text-[11px] text-orange-300/80 leading-relaxed">
                  <strong className="text-orange-300">Glisser</strong> un point pour le déplacer.<br />
                  <strong className="text-orange-300">Clic droit</strong> sur un segment pour supprimer le mur.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Murs tracés</span>
              <span className="text-xs font-mono text-red-400 font-bold">{wallCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Toujours afficher</span>
              <button
                onClick={onToggleShowWalls}
                className={`w-9 h-5 rounded-full transition-colors ${showWalls ? 'bg-amber-600' : 'bg-gray-700'}`}
              >
                <span className={`block w-3.5 h-3.5 rounded-full bg-white mx-0.5 transition-transform ${showWalls ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {wallCount > 0 && (
              <div className="pt-1 border-t border-gray-700/60">
                <button
                  onClick={() => { onClearWalls?.(); }}
                  className="w-full flex items-center justify-center gap-1.5 p-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                  title="Effacer tous les murs"
                >
                  <Trash2 size={12} /> Effacer tous les murs
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {timePopupOpen && role === 'gm' && (
        <TimeOfDayPopup
          ref={timePopupRef}
          hour={config.timeOfDay ?? 12}
          onChange={(h) => onUpdateMap({ timeOfDay: h })}
          onClose={() => setTimePopupOpen(false)}
        />
      )}

      {broadcastPopupOpen && role === 'gm' && (
        <div
          ref={broadcastPopupRef}
          className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-64"
          style={{ bottom: '8px' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-200">Diffusion</span>
            <button onClick={() => setBroadcastPopupOpen(false)} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
              <X size={13} />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
                Projetez la vue joueur sur un ecran ou TV.
              </p>
              <button
                onClick={onOpenBroadcastWindow}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <ExternalLink size={13} />
                Ouvrir la vue
              </button>
            </div>

            <div className="pt-2 border-t border-gray-700/60">
              <button
                onClick={() => {
                  if (!roomId) return;
                  const url = `${window.location.origin}${window.location.pathname}#/vtt-broadcast/${roomId}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                  copied
                    ? 'bg-emerald-700/30 border-emerald-600/50 text-emerald-300'
                    : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                }`}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copie !' : 'Copier le lien'}
              </button>
            </div>

            <div className="pt-2 border-t border-gray-700/60">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mb-2">Mode de diffusion</p>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => onBroadcastModeChange('follow')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors border ${
                    broadcastMode === 'follow'
                      ? 'bg-teal-700/30 border-teal-600/50 text-teal-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <Eye size={11} />
                  Suivre le MJ
                </button>
                <button
                  onClick={() => onBroadcastModeChange('frame')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors border ${
                    broadcastMode === 'frame'
                      ? 'bg-teal-700/30 border-teal-600/50 text-teal-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <RectangleHorizontal size={11} />
                  Cadre
                </button>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                {broadcastMode === 'follow'
                  ? 'Les joueurs voient exactement ce que le MJ voit.'
                  : 'Delimitez la zone visible avec un cadre sur la carte.'}
              </p>
            </div>

            {broadcastMode === 'frame' && (
              <>
                <div className="pt-2 border-t border-gray-700/60">
                  <button
                    onClick={onToggleBroadcastFrame}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      broadcastFrameEnabled
                        ? 'bg-teal-700/30 border-teal-600/50 text-teal-300'
                        : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300'
                    }`}
                  >
                    <RectangleHorizontal size={13} />
                    {broadcastFrameEnabled ? 'Cadre actif' : 'Activer le cadre'}
                  </button>
                </div>

                {broadcastFrameEnabled && (
                  <div className="pt-2 border-t border-gray-700/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Ratio d'ecran</p>
                      <button
                        onClick={onToggleBroadcastLockRatio}
                        className={`p-1 rounded transition-colors ${broadcastLockRatio ? 'text-amber-400 hover:text-amber-300' : 'text-gray-500 hover:text-gray-300'}`}
                        title={broadcastLockRatio ? 'Ratio verrouille' : 'Ratio libre'}
                      >
                        {broadcastLockRatio ? <Lock size={11} /> : <Unlock size={11} />}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { value: '16:9', label: '16:9' },
                        { value: '16:10', label: '16:10' },
                        { value: '4:3', label: '4:3' },
                        { value: '21:9', label: '21:9' },
                        { value: '3:2', label: '3:2' },
                        { value: 'free', label: 'Libre' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => onBroadcastAspectRatioChange(opt.value)}
                          className={`py-1.5 rounded text-[10px] font-medium transition-colors border ${
                            broadcastAspectRatio === opt.value
                              ? 'bg-teal-700/30 border-teal-600/50 text-teal-300'
                              : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
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

export function getTimeOfDayOverlay(hour: number): { color: string; opacity: number; label: string } {
  if (hour >= 7 && hour < 8) return { color: 'rgba(255,160,50,ALPHA)', opacity: 0.06, label: 'Aube' };
  if (hour >= 8 && hour < 10) return { color: 'rgba(255,200,100,ALPHA)', opacity: 0.03, label: 'Matin' };
  if (hour >= 10 && hour < 16) return { color: 'rgba(255,255,200,ALPHA)', opacity: 0, label: 'Journee' };
  if (hour >= 16 && hour < 18) return { color: 'rgba(255,180,80,ALPHA)', opacity: 0.04, label: 'Apres-midi' };
  if (hour >= 18 && hour < 19) return { color: 'rgba(255,120,40,ALPHA)', opacity: 0.08, label: 'Crepuscule' };
  if (hour >= 19 && hour < 20) return { color: 'rgba(200,80,30,ALPHA)', opacity: 0.12, label: 'Soir' };
  if (hour >= 20 && hour < 21) return { color: 'rgba(20,20,60,ALPHA)', opacity: 0.18, label: 'Tombee de la nuit' };
  if (hour >= 21 && hour < 23) return { color: 'rgba(10,10,40,ALPHA)', opacity: 0.25, label: 'Nuit' };
  if (hour >= 23 || hour < 4) return { color: 'rgba(5,5,20,ALPHA)', opacity: 0.30, label: 'Nuit profonde' };
  if (hour >= 4 && hour < 5) return { color: 'rgba(10,10,40,ALPHA)', opacity: 0.22, label: 'Fin de nuit' };
  if (hour >= 5 && hour < 6) return { color: 'rgba(80,50,100,ALPHA)', opacity: 0.10, label: 'Aurore' };
  if (hour >= 6 && hour < 7) return { color: 'rgba(200,120,60,ALPHA)', opacity: 0.06, label: 'Lever du soleil' };
  return { color: 'rgba(0,0,0,ALPHA)', opacity: 0, label: 'Journee' }; 
}

function getTimeIcon(hour: number) {
  if (hour >= 19 || hour < 5) return <Moon size={14} className="text-blue-300" />;
  if (hour >= 5 && hour < 8) return <Sunrise size={14} className="text-amber-400" />;
  if (hour >= 16 && hour < 19) return <Sunset size={14} className="text-orange-400" />;
  return <Sun size={14} className="text-yellow-400" />;
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

const HOUR_PRESETS = [
  { hour: 6, label: 'Aube', icon: Sunrise },
  { hour: 12, label: 'Midi', icon: Sun },
  { hour: 18, label: 'Crepuscule', icon: Sunset },
  { hour: 22, label: 'Nuit', icon: Moon },
];

// ─── WEATHER PRESETS (inspiré de FXMaster — gambit07/fxmaster) ───────────────

const WEATHER_PRESETS: { type: VTTWeatherType; label: string; icon: string }[] = [
  { type: 'rain',          label: 'Pluie',           icon: '🌧' },
  { type: 'acid-rain',     label: 'Pluie acide',     icon: '🧪' },
  { type: 'sunshower',     label: 'Pluie dorée',     icon: '🌦' },
  { type: 'snow',          label: 'Neige',           icon: '❄️' },
  { type: 'blizzard',      label: 'Blizzard',        icon: '🌨' },
  { type: 'fog',           label: 'Brouillard',      icon: '🌫' },
  { type: 'embers',        label: 'Braises',         icon: '🔥' },
  { type: 'leaves',        label: 'Feuilles',        icon: '🍂' },
  { type: 'sandstorm',     label: 'Sable',           icon: '🏜' },
  { type: 'bubbles',       label: 'Bulles',          icon: '🫧' },
  { type: 'spiderwebs',    label: 'Toiles',          icon: '🕸' },
  { type: 'magiccrystals', label: 'Cristaux',        icon: '💎' },
  { type: 'magicstars',    label: 'Étoiles',         icon: '✨' },
];

const DEFAULT_WEATHER: Omit<VTTWeatherEffect, 'type'> = { density: 1.0, speed: 1.0, alpha: 0.8 };

const WeatherPopup = React.forwardRef<HTMLDivElement, {
  effects: VTTWeatherEffect[];
  onChange: (effects: VTTWeatherEffect[]) => void;
  onClose: () => void;
}>(function WeatherPopup({ effects, onChange, onClose }, ref) {
  const [editingType, setEditingType] = React.useState<VTTWeatherType | null>(null);

  const isActive = (type: VTTWeatherType) => effects.some(e => e.type === type);
  const getEffect = (type: VTTWeatherType) => effects.find(e => e.type === type);

  const toggle = (type: VTTWeatherType) => {
    if (isActive(type)) {
      onChange(effects.filter(e => e.type !== type));
      if (editingType === type) setEditingType(null);
    } else {
      onChange([...effects, { type, ...DEFAULT_WEATHER }]);
      setEditingType(type);
    }
  };

  const update = (type: VTTWeatherType, changes: Partial<VTTWeatherEffect>) => {
    onChange(effects.map(e => e.type === type ? { ...e, ...changes } : e));
  };

  const editingEffect = editingType ? getEffect(editingType) : null;

  return (
    <div
      ref={ref}
      className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-64"
      style={{ top: '230px' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Wind size={13} className="text-sky-400" />
          <span className="text-xs font-semibold text-gray-200">Effets météo</span>
          <a
            href="https://github.com/gambit07/fxmaster"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-gray-600 hover:text-gray-400 underline transition-colors"
            title="Inspiré de FXMaster par gambit07"
          >
            FXMaster
          </a>
        </div>
        <div className="flex items-center gap-1">
          {effects.length > 0 && (
            <button
              onClick={() => { onChange([]); setEditingType(null); }}
              className="text-[9px] text-red-400 hover:text-red-300 px-1 py-0.5 rounded hover:bg-red-950/30 transition-colors"
            >
              Tout off
            </button>
          )}
          <button onClick={onClose} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Grille des presets */}
      <div className="grid grid-cols-3 gap-1 mb-3">
        {WEATHER_PRESETS.map(preset => {
          const active = isActive(preset.type);
          return (
            <button
              key={preset.type}
              onClick={() => toggle(preset.type)}
              onContextMenu={e => { e.preventDefault(); if (active) setEditingType(preset.type); }}
              title={preset.label + (active ? ' — clic droit : régler' : '')}
              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-[10px] transition-all ${
                active
                  ? 'border-sky-500/60 bg-sky-900/30 text-sky-200'
                  : 'border-gray-700/60 bg-gray-800/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <span className="text-base leading-none">{preset.icon}</span>
              <span className="leading-tight text-center">{preset.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            </button>
          );
        })}
      </div>

      {/* Panneau de réglage */}
      {editingEffect && editingType && (
        <div className="border-t border-gray-700/60 pt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400 font-medium">
              {WEATHER_PRESETS.find(p => p.type === editingType)?.icon}{' '}
              {WEATHER_PRESETS.find(p => p.type === editingType)?.label}
            </span>
            <button onClick={() => setEditingType(null)} className="text-gray-600 hover:text-gray-400">
              <X size={10} />
            </button>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Densité</span>
              <span className="text-gray-400">{editingEffect.density.toFixed(1)}</span>
            </div>
            <input type="range" min="0.1" max="3" step="0.1"
              value={editingEffect.density}
              onChange={e => update(editingType, { density: parseFloat(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Vitesse</span>
              <span className="text-gray-400">{editingEffect.speed.toFixed(1)}</span>
            </div>
            <input type="range" min="0.2" max="3" step="0.1"
              value={editingEffect.speed}
              onChange={e => update(editingType, { speed: parseFloat(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
              <span>Opacité</span>
              <span className="text-gray-400">{editingEffect.alpha.toFixed(2)}</span>
            </div>
            <input type="range" min="0.05" max="1" step="0.05"
              value={editingEffect.alpha}
              onChange={e => update(editingType, { alpha: parseFloat(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>
        </div>
      )}

      {effects.length === 0 && (
        <p className="text-[10px] text-gray-600 text-center pb-1">Cliquez pour activer un effet</p>
      )}
      {effects.length > 0 && !editingType && (
        <p className="text-[10px] text-gray-600 text-center pb-1">Clic droit sur un effet actif pour régler</p>
      )}
    </div>
  );
});


const TimeOfDayPopup = React.forwardRef<HTMLDivElement, {
  hour: number;
  onChange: (h: number) => void;
  onClose: () => void;
}>(function TimeOfDayPopup({ hour, onChange, onClose }, ref) {
  const overlay = getTimeOfDayOverlay(hour);
  const isNight = hour >= 19 || hour < 5;
  const bgPreview = overlay.opacity > 0
    ? overlay.color.replace('ALPHA', String(Math.min(overlay.opacity + 0.1, 1)))
    : 'rgba(135,206,235,0.2)';

  return (
    <div
      ref={ref}
      className="absolute left-full ml-2 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 w-64"
      style={{ top: '230px' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-amber-400" />
          <span className="text-xs font-semibold text-gray-200">Heure du jour</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-gray-500 hover:text-gray-300 rounded">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-3">
        <div
          className="rounded-lg p-3 border border-gray-700/60 flex items-center gap-3 transition-colors"
          style={{ backgroundColor: bgPreview }}
        >
          {getTimeIcon(hour)}
          <div>
            <span className="text-lg font-bold text-white font-mono">{formatHour(hour)}</span>
            <p className="text-[10px] text-gray-300/80">{overlay.label}</p>
          </div>
          {isNight && (
            <div className="ml-auto px-1.5 py-0.5 bg-blue-900/60 border border-blue-700/50 rounded text-[9px] text-blue-300 font-medium">
              NUIT
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400">Heure</span>
            <span className="text-xs font-mono text-amber-400 font-bold">{formatHour(hour)}</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={0}
              max={23.5}
              step={0.5}
              value={hour}
              onChange={e => onChange(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:30</span>
            </div>
          </div>
        </div>

        <div className="relative h-4 rounded-full overflow-hidden border border-gray-700/60">
          <div className="absolute inset-0 flex">
            <div className="flex-1" style={{ background: 'linear-gradient(to right, #0a0a2e, #0a0a2e 16%, #c87832 21%, #ffc864 29%, #ffffc8 42%, #ffffc8 58%, #ffb450 67%, #c85028 79%, #28286e 83%, #0a0a2e)' }} />
          </div>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm shadow-black"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-4 gap-1">
          {HOUR_PRESETS.map(preset => (
            <button
              key={preset.hour}
              onClick={() => onChange(preset.hour)}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] transition-colors border ${
                Math.abs(hour - preset.hour) < 1
                  ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <preset.icon size={12} />
              {preset.label}
            </button>
          ))}
        </div>

        <div className="pt-1 border-t border-gray-700/60">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Filtre d'ambiance visible par tous les joueurs. La nuit commence a <strong className="text-gray-400">19h</strong>. Les tokens avec vision nocturne ignoreront l'assombrissement.
          </p>
        </div>
      </div>
    </div>
  );
});

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
