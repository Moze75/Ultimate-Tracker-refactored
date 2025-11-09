import React from 'react';
import { X } from 'lucide-react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS } from '../hooks/useDiceSettings';

interface DiceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: DiceSettings;
  onSave: (settings: DiceSettings) => void;
}

export function DiceSettingsModal({ open, onClose, settings, onSave }: DiceSettingsModalProps) {
  const [localSettings, setLocalSettings] = React.useState<DiceSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  if (!open) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_DICE_SETTINGS);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Paramètres des dés 3D</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Thème
            </label>
            <select
              value={localSettings.theme}
              onChange={(e) => setLocalSettings({ ...localSettings, theme: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="default">Par défaut</option>
              <option value="gemstone">Pierre précieuse</option>
              <option value="metal">Métal</option>
              <option value="wood">Bois</option>
            </select>
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Couleur du thème
            </label>
            <input
              type="color"
              value={localSettings.themeColor}
              onChange={(e) => setLocalSettings({ ...localSettings, themeColor: e.target.value })}
              className="w-full h-10 rounded cursor-pointer"
            />
          </div>

          {/* Sounds */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Sons activés
            </label>
            <button
              onClick={() => setLocalSettings({ ...localSettings, soundsEnabled: !localSettings.soundsEnabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                localSettings.soundsEnabled ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  localSettings.soundsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Scale */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Échelle : {localSettings.scale}
            </label>
            <input
              type="range"
              min="3"
              max="10"
              step="0.5"
              value={localSettings.scale}
              onChange={(e) => setLocalSettings({ ...localSettings, scale: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Gravity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Gravité : {localSettings.gravity}
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={localSettings.gravity}
              onChange={(e) => setLocalSettings({ ...localSettings, gravity: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Friction */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Friction : {localSettings.friction}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.friction}
              onChange={(e) => setLocalSettings({ ...localSettings, friction: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Restitution */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Rebond : {localSettings.restitution}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.restitution}
              onChange={(e) => setLocalSettings({ ...localSettings, restitution: parseFloat(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Réinitialiser
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}