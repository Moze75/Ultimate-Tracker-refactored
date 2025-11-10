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
          
          {/* Style des dés (Colorset) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Style des dés
            </label>
            <select
              value={localSettings.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="">💎 Couleur unie personnalisée</option>
              
              <optgroup label="🎯 Types de dégâts D&D">
                <option value="fire">🔥 Feu</option>
                <option value="ice">❄️ Glace</option>
                <option value="poison">☠️ Poison</option>
                <option value="acid">🧪 Acide</option>
                <option value="thunder">⚡ Tonnerre</option>
                <option value="lightning">⚡ Foudre</option>
                <option value="water">💧 Eau</option>
                <option value="air">💨 Air</option>
                <option value="earth">🌍 Terre</option>
                <option value="force">✨ Force</option>
                <option value="psychic">🧠 Psychique</option>
                <option value="necrotic">💀 Nécrotique</option>
                <option value="radiant">☀️ Radiant</option>
              </optgroup>
              
              <optgroup label="🎨 Sets personnalisés">
                <option value="bronze">⚱️ Bronze Thyléen</option>
                <option value="dragons">🐉 Dragons</option>
                <option value="tigerking">🐯 Tigre/Léopard/Guépard</option>
                <option value="birdup">🦜 Oiseaux</option>
                <option value="astralsea">🌌 Mer Astrale</option>
                <option value="glitterparty">✨ Paillettes</option>
                <option value="starynight">🌃 Nuit Étoilée</option>
                <option value="bloodmoon">🌙 Lune de Sang</option>
                <option value="pinkdreams">💖 Rêves Roses</option>
                <option value="breebaby">🌅 Coucher de Soleil Pastel</option>
                <option value="inspired">💡 Inspiré</option>
              </optgroup>
              
              <optgroup label="🎨 Couleurs de base">
                <option value="black">⚫ Noir</option>
                <option value="white">⚪ Blanc</option>
                <option value="rainbow">🌈 Arc-en-ciel</option>
              </optgroup>
              
              <optgroup label="🎮 Autres">
                <option value="covid">🦠 COViD</option>
                <option value="acleaf">🍃 Animal Crossing</option>
                <option value="isabelle">🐕 Isabelle</option>
                <option value="thecage">🎬 Nicolas Cage</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {localSettings.theme 
                ? "Style prédéfini avec texture et couleurs intégrées" 
                : "Créez votre propre couleur personnalisée ci-dessous"}
            </p>
          </div>

          {/* Matériau des dés */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Matériau des dés
            </label>
            <select
              value={localSettings.themeMaterial}
              onChange={(e) => handleChange('themeMaterial', e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="none">Mat (aucun effet)</option>
              <option value="plastic">🧊 Plastique</option>
              <option value="metal">⚙️ Métal</option>
              <option value="wood">🪵 Bois</option>
              <option value="glass">💎 Verre</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Le matériau affecte la brillance et les reflets
            </p>
          </div>

          {/* Couleur personnalisée - seulement si pas de colorset prédéfini */}
          {!localSettings.theme && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Couleur personnalisée : {localSettings.themeColor}
              </label>
              <p className="text-xs text-gray-400 mb-3">
                Choisissez la couleur principale de vos dés
              </p>
              
              {/* Palettes de couleurs prédéfinies */}
              <div className="grid grid-cols-6 gap-2 mb-3">
                <button 
                  onClick={() => handleChange('themeColor', '#ff0000')} 
                  className="w-10 h-10 rounded-lg bg-red-500 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Rouge"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#ff8800')} 
                  className="w-10 h-10 rounded-lg bg-orange-500 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Orange"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#ffd700')} 
                  className="w-10 h-10 rounded-lg hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  style={{backgroundColor: '#ffd700'}}
                  title="Or"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#00ff00')} 
                  className="w-10 h-10 rounded-lg bg-green-500 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Vert"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#0088ff')} 
                  className="w-10 h-10 rounded-lg bg-blue-500 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Bleu"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#8800ff')} 
                  className="w-10 h-10 rounded-lg bg-purple-600 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Violet"
                  type="button"
                />
                
                <button 
                  onClick={() => handleChange('themeColor', '#ff00ff')} 
                  className="w-10 h-10 rounded-lg bg-pink-500 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Rose"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#00ffff')} 
                  className="w-10 h-10 rounded-lg bg-cyan-400 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Cyan"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#8B4513')} 
                  className="w-10 h-10 rounded-lg hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  style={{backgroundColor: '#8B4513'}}
                  title="Marron"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#C0C0C0')} 
                  className="w-10 h-10 rounded-lg hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  style={{backgroundColor: '#C0C0C0'}}
                  title="Argent"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#ffffff')} 
                  className="w-10 h-10 rounded-lg bg-white border border-gray-600 hover:ring-2 ring-purple-500 transition-all shadow-md hover:scale-105" 
                  title="Blanc"
                  type="button"
                />
                <button 
                  onClick={() => handleChange('themeColor', '#000000')} 
                  className="w-10 h-10 rounded-lg bg-black border border-gray-600 hover:ring-2 ring-white transition-all shadow-md hover:scale-105" 
                  title="Noir"
                  type="button"
                />
              </div>
              
              {/* Sélecteur de couleur personnalisé */}
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
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500"
                  placeholder="#ff0000"
                />
              </div>
            </div>
          )}

          {/* Info si colorset sélectionné */}
          {localSettings.theme && (
            <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-3">
              <p className="text-xs text-blue-200">
                ℹ️ <strong>Note :</strong> Les styles prédéfinis ont leurs propres couleurs et textures intégrées. 
                Pour utiliser une couleur personnalisée, sélectionnez "Couleur unie personnalisée".
              </p>
            </div>
          )}

          {/* Sons activés */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-300">
              🔊 Sons activés
            </label>
            <button
              type="button"
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

          {/* Échelle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              📏 Échelle des dés : {localSettings.scale}
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

          {/* Gravité */}
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    🌍 Gravité : {localSettings.gravity}x
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
    <span>Faible (0.5x)</span>
    <span>Normale (1x)</span>
    <span>Forte (2x)</span>
  </div>
  <p className="text-xs text-gray-400 mt-1">
    Multiplie la gravité par défaut (400). Plus c'est élevé, plus les dés tombent vite.
  </p>
</div>

{/* ✅ NOUVEAU : Force de lancer (strength) */}
<div>
  <label className="block text-sm font-medium text-gray-300 mb-2">
    💪 Force de lancer : {localSettings.strength || 1}
  </label>
  <input
    type="range"
    min="0.5"
    max="3"
    step="0.1"
    value={localSettings.strength || 1}
    onChange={(e) => handleChange('strength', parseFloat(e.target.value))}
    className="w-full accent-purple-600"
  />
  <div className="flex justify-between text-xs text-gray-500 mt-1">
    <span>Doux (0.5)</span>
    <span>Normal (1)</span>
    <span>Fort (3)</span>
  </div>
  <p className="text-xs text-gray-400 mt-1">
    Contrôle la vitesse initiale des dés. Plus c'est élevé, plus le lancer est violent.
  </p>
</div>
        </div> 

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            🔄 Réinitialiser
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              💾 Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}