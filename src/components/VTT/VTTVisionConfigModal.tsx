import React, { useState } from 'react';
import { X, Eye, Moon, Flame, Lightbulb, Ban } from 'lucide-react';
import type { VTTToken, VTTVisionMode, VTTLightSource } from '../../types/vtt';

interface VTTVisionConfigModalProps {
  token: VTTToken;
  onSave: (changes: Partial<VTTToken>) => void;
  onClose: () => void;
}

const VISION_MODES: { value: VTTVisionMode; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'Aucune', desc: 'Pas de vision propre', icon: <Ban size={14} /> },
  { value: 'normal', label: 'Normale', desc: 'Vision de proximite (3 m) la nuit', icon: <Eye size={14} /> },
  { value: 'darkvision', label: 'Nyctalopie', desc: 'Vision dans le noir (18 m par defaut)', icon: <Moon size={14} /> },
];

const LIGHT_SOURCES: { value: VTTLightSource; label: string; desc: string; icon: React.ReactNode; brightM: number; dimM: number }[] = [
  { value: 'none', label: 'Aucune', desc: 'Pas de source de lumiere', icon: <Ban size={14} />, brightM: 0, dimM: 0 },
  { value: 'torch', label: 'Torche', desc: '6 m lumineux + 6 m attenue', icon: <Flame size={14} />, brightM: 6, dimM: 12 },
  { value: 'lantern', label: 'Lanterne', desc: '9 m lumineux + 9 m attenue', icon: <Lightbulb size={14} />, brightM: 9, dimM: 18 },
  { value: 'custom', label: 'Personnalise', desc: 'Definir manuellement', icon: <Lightbulb size={14} />, brightM: 6, dimM: 12 },
];

export function VTTVisionConfigModal({ token, onSave, onClose }: VTTVisionConfigModalProps) {
  const [visionMode, setVisionMode] = useState<VTTVisionMode>(token.visionMode || 'none');
  const [visionRange, setVisionRange] = useState(token.visionRange ?? 18);
  const [lightSource, setLightSource] = useState<VTTLightSource>(token.lightSource || 'none');
  const [lightRange, setLightRange] = useState(token.lightRange ?? 6);

  const handleSave = () => {
    onSave({ visionMode, visionRange, lightSource, lightRange });
    onClose();
  };

  const isNight = true;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-white">Vision & Lumiere</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{token.label}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Mode de vision</label>
            <div className="grid grid-cols-3 gap-1.5">
              {VISION_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setVisionMode(mode.value)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-[10px] transition-colors border ${
                    visionMode === mode.value
                      ? 'bg-amber-600/20 border-amber-500/60 text-amber-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {mode.icon}
                  <span className="font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              {VISION_MODES.find(m => m.value === visionMode)?.desc}
            </p>
          </div>

          {visionMode === 'darkvision' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Portee de la nyctalopie</label>
                <span className="text-xs font-mono text-amber-400 font-bold">{visionRange} m</span>
              </div>
              <input
                type="range"
                min={3}
                max={36}
                step={1.5}
                value={visionRange}
                onChange={e => setVisionRange(parseFloat(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>3 m</span>
                <span>18 m</span>
                <span>36 m</span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-700/60">
            <label className="block text-xs font-medium text-gray-300 mb-2">Source de lumiere</label>
            <div className="grid grid-cols-2 gap-1.5">
              {LIGHT_SOURCES.map(source => (
                <button
                  key={source.value}
                  onClick={() => {
                    setLightSource(source.value);
                    if (source.value !== 'custom') setLightRange(source.brightM);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg text-[11px] transition-colors border ${
                    lightSource === source.value
                      ? 'bg-orange-600/20 border-orange-500/60 text-orange-300'
                      : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {source.icon}
                  <div className="text-left">
                    <span className="font-medium block">{source.label}</span>
                    {source.value !== 'none' && source.value !== 'custom' && (
                      <span className="text-[9px] opacity-70">{source.brightM}m + {source.dimM - source.brightM}m</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {lightSource === 'custom' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-400">Rayon lumineux</label>
                <span className="text-xs font-mono text-orange-400 font-bold">{lightRange} m</span>
              </div>
              <input
                type="range"
                min={1.5}
                max={30}
                step={1.5}
                value={lightRange}
                onChange={e => setLightRange(parseFloat(e.target.value))}
                className="w-full accent-orange-500"
              />
              <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
                <span>1.5 m</span>
                <span>15 m</span>
                <span>30 m</span>
              </div>
            </div>
          )}

          {isNight && (
            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-900/40">
              <p className="text-[10px] text-blue-300/80 leading-relaxed">
                <strong className="text-blue-300">Effet de nuit :</strong> La vision est limitee. Les tokens avec <strong>Nyctalopie</strong> voient dans le noir. Les <strong>torches</strong> eclairent la zone autour du token.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <div className="flex-1" />
          <button onClick={onClose} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
