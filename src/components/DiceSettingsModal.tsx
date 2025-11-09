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
    console.log('🔵 [DiceSettingsModal] useEffect - Props settings:', settings);
    setLocalSettings(settings);
  }, [settings]);

  React.useEffect(() => {
    console.log('🟢 [DiceSettingsModal] Modal ouvert:', open);
    if (open) {
      console.log('📥 [DiceSettingsModal] Settings reçus:', settings);
      console.log('📦 [DiceSettingsModal] LocalSettings actuel:', localSettings);
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💾 [DiceSettingsModal] handleSave APPELÉ');
    console.log('📤 [DiceSettingsModal] LocalSettings à sauvegarder:', localSettings);
    console.log('🔍 [DiceSettingsModal] Comparaison:');
    console.log('   - Avant (settings prop):', settings);
    console.log('   - Après (localSettings):', localSettings);
    console.log('   - Changé:', JSON.stringify(settings) !== JSON.stringify(localSettings));
    
    try {
      console.log('🔄 [DiceSettingsModal] Appel de onSave...');
      onSave(localSettings);
      console.log('✅ [DiceSettingsModal] onSave terminé');
      console.log('🚪 [DiceSettingsModal] Fermeture du modal...');
      onClose();
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } catch (error) {
      console.error('❌ [DiceSettingsModal] Erreur dans handleSave:', error);
    }
  };

  const handleReset = () => {
    console.log('🔄 [DiceSettingsModal] Réinitialisation aux valeurs par défaut');
    console.log('   - Valeurs par défaut:', DEFAULT_DICE_SETTINGS);
    setLocalSettings(DEFAULT_DICE_SETTINGS);
  };

  const handleChange = (key: keyof DiceSettings, value: any) => {
    console.log(`🔧 [DiceSettingsModal] Changement: ${key} = ${value}`);
    setLocalSettings(prev => {
      const updated = { ...prev, [key]: value };
      console.log('   - Nouveau state local:', updated);
      return updated;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-md w-full my-8">
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
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Texture */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Texture des dés
            </label>
            <select
              value={localSettings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="default">Par défaut</option>
              <option value="astral">Astral</option>
              <option value="bronze01">Bronze 1</option>
              <option value="bronze02">Bronze 2</option>
              <option value="bronze03">Bronze 3</option>
              <option value="bronze04">Bronze 4</option>
              <option value="cheetah">Guépard</option>
              <option value="cloudy">Nuageux</option>
              <option value="dragon">Dragon</option>
              <option value="feather">Plume</option>
              <option value="fire">Feu</option>
              <option value="glitter">Paillettes</option>
              <option value="ice">Glace</option>
              <option value="leopard">Léopard</option>
              <option value="lizard">Lézard</option>
              <option value="marble">Marbre</option>
              <option value="metal">Métal</option>
              <option value="paper">Papier</option>
              <option value="skulls">Crânes</option>
              <option value="speckles">Tacheté</option>
              <option value="stainedglass">Vitrail</option>
              <option value="stars">Étoiles</option>
              <option value="stone">Pierre</option>
              <option value="tiger">Tigre</option>
              <option value="water">Eau</option>
              <option value="wood">Bois</option>
            </select>
          </div>

          {/* Theme Color */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Couleur du thème : {localSettings.themeColor}
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={localSettings.themeColor}
                onChange={(e) => handleChange('themeColor', e.target.value)}
                className="w-16 h-10 rounded cursor-pointer border border-gray-600"
              />
              <input
                type="text"
                value={localSettings.themeColor}
                onChange={(e) => handleChange('themeColor', e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                placeholder="#8b5cf6"
              />
            </div>
          </div>

          {/* Sounds */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              Sons activés
            </label>
            <button
              onClick={() => handleChange('soundsEnabled', !localSettings.soundsEnabled)}
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
              onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Petit (3)</span>
              <span>Grand (10)</span>
            </div>
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
              onChange={(e) => handleChange('gravity', parseFloat(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Faible (0.5)</span>
              <span>Forte (2)</span>
            </div>
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
              onChange={(e) => handleChange('friction', parseFloat(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Glissant (0)</span>
              <span>Rugueux (1)</span>
            </div>
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
              onChange={(e) => handleChange('restitution', parseFloat(e.target.value))}
              className="w-full accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Aucun (0)</span>
              <span>Élastique (1)</span>
            </div>
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