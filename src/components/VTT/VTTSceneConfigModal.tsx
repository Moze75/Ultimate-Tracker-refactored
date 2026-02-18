import React, { useState } from 'react';
import { X, Map } from 'lucide-react';
import type { VTTRoomConfig } from '../../types/vtt';

interface VTTSceneConfigModalProps {
  sceneName: string;
  config: VTTRoomConfig;
  onSave: (changes: Partial<VTTRoomConfig>) => void;
  onClose: () => void;
}

export function VTTSceneConfigModal({ sceneName, config, onSave, onClose }: VTTSceneConfigModalProps) {
  const [mapUrl, setMapUrl] = useState(config.mapImageUrl || '');
  const [gridSize, setGridSize] = useState(config.gridSize || 60);
  const [mapWidth, setMapWidth] = useState(config.mapWidth || 3000);
  const [mapHeight, setMapHeight] = useState(config.mapHeight || 2000);

  const handleSave = () => {
    onSave({
      mapImageUrl: mapUrl.trim(),
      gridSize: Math.max(10, Number(gridSize) || 60),
      mapWidth: Math.max(200, Number(mapWidth) || 3000),
      mapHeight: Math.max(200, Number(mapHeight) || 2000),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Map size={15} className="text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Config carte — {sceneName}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">URL de l'image de carte</label>
            <input
              type="text"
              value={mapUrl}
              onChange={e => setMapUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {mapUrl && (
            <div className="w-full h-24 rounded-lg overflow-hidden bg-gray-800 border border-gray-700">
              <img
                src={mapUrl}
                alt="Aperçu"
                className="w-full h-full object-cover"
                onError={e => ((e.target as HTMLImageElement).style.display = 'none')}
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Largeur (px)</label>
              <input
                type="number"
                value={mapWidth}
                onChange={e => setMapWidth(Number(e.target.value))}
                min={200}
                className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Hauteur (px)</label>
              <input
                type="number"
                value={mapHeight}
                onChange={e => setMapHeight(Number(e.target.value))}
                min={200}
                className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Taille de case (px)</label>
            <input
              type="number"
              value={gridSize}
              onChange={e => setGridSize(Number(e.target.value))}
              min={10}
              max={200}
              className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
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
