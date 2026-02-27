import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings, History, Trash2, Image, RefreshCw, Map } from 'lucide-react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS, useDiceSettings } from '../hooks/useDiceSettings';
import { formatRelativeTime, type DiceRollHistoryEntry } from '../hooks/useDiceHistory';
import { useDiceHistoryContext } from '../hooks/useDiceHistoryContext';
import { authService } from '../services/authService';
 
interface DiceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings?: DiceSettings;
  onSave?: (settings: DiceSettings) => void;
  currentBackground?: string;
  onBackgroundChange?: (backgroundUrl: string) => void;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}

type TabType = 'settings' | 'history' | 'background'; 

export function DiceSettingsModal({
  open,
  onClose,
  settings,
  onSave,
  currentBackground,
  onBackgroundChange,
  deviceType,
}: DiceSettingsModalProps) {
  const { settings: contextSettings, updateSettings } = useDiceSettings();
  const effectiveSettings = contextSettings ?? settings ?? DEFAULT_DICE_SETTINGS;

  const [localSettings, setLocalSettings] = useState<DiceSettings>(effectiveSettings);
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const { history, clearHistory, removeEntry } = useDiceHistoryContext();

  React.useEffect(() => {
    setLocalSettings(effectiveSettings);
  }, [effectiveSettings]);

  React.useEffect(() => {
    if (open) {
      setActiveTab('settings');
    }
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    try {
      updateSettings?.(localSettings);
      onSave?.(localSettings);
      window.dispatchEvent(new CustomEvent('dice-settings-changed', { detail: localSettings }));
      onClose();
    } catch (error) {
      console.error('❌ [DiceSettingsModal] Erreur dans handleSave:', error);
    }
  };

 
  
  const handleReset = () => {
    setLocalSettings(DEFAULT_DICE_SETTINGS);
  };

const handleChange = (key: keyof DiceSettings, value: any) => {
  setLocalSettings(prev => ({ ...prev, [key]: value }));
};

  const handleClearHistory = () => {
    if (window.confirm('Êtes-vous sûr de vouloir effacer tout l\'historique des jets de dés ?')) {
      clearHistory();
    }
  };

  const handleRemoveEntry = (id: string) => {
    removeEntry(id);
  };

const modalContent = (
  <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
    <div className="min-h-screen flex items-center justify-center p-4">
        <div className="frame-card frame-card--light frame-card--no-frame rounded-lg shadow-xl max-w-md w-full my-8">
        {/* Header */}
               <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
          <div>
            <h2 className="text-xl font-bold text-white">Paramètres de l'app</h2>
            <p className="text-xs text-gray-500 mt-1">Version 2.1.3</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

          {/* Tabs */} 
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'settings'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              <Settings className="w-4 h-4" />
              Dés 3D
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              <History className="w-4 h-4" />
              Historique 
              {history.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                  {history.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'background'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/30'
              }`}
            >
              <Image className="w-4 h-4" />
              Fond
            </button> 
          </div>

          {/* Content */}
          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {activeTab === 'settings' ? (
              <SettingsTab
                localSettings={localSettings}
                handleChange={handleChange}
              />
            ) : activeTab === 'history' ? (
              <HistoryTab
                history={history}
                onClearHistory={handleClearHistory}
                onRemoveEntry={handleRemoveEntry}
              />
            ) : (
              <BackgroundTab
                currentBackground={currentBackground}
                onBackgroundChange={onBackgroundChange}
                deviceType={deviceType}
              />
            )}
          </div>

          {/* Footer - seulement pour l'onglet paramètres */}
          {activeTab === 'settings' && (
                  <div className="flex items-center justify-between p-4 border-t border-gray-700/30 bg-black/10">
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
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

// Composant pour l'onglet Paramètres
function SettingsTab({
  localSettings,
  handleChange,
}: {
  localSettings: DiceSettings;
  handleChange: (key: keyof DiceSettings, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Style des dés */}
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

      {/* Couleur personnalisée */}
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
        <label className="text-sm font-medium text-gray-300">🔊 Sons activés</label>
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

      {/* Taille */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          📏 Taille des dés : {localSettings.baseScale}
        </label>
        <input
          type="range"
          min="3"
          max="10"
          step="0.5"
          value={localSettings.baseScale}
          onChange={(e) => handleChange('baseScale', parseFloat(e.target.value))}
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
          <span>Forte (2x)</span>
        </div>
      </div>

      {/* Force */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          💪 Force de lancer : {localSettings.strength}
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={localSettings.strength}
          onChange={(e) => handleChange('strength', parseFloat(e.target.value))}
          className="w-full accent-purple-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Doux (0.5)</span>
          <span>Fort (3)</span>
        </div>
      </div>

      {/* Volume Physique (Dés) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          🎲 Volume physique des dés : {localSettings.volume}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={localSettings.volume}
          onChange={(e) => handleChange('volume', parseInt(e.target.value))}
          className="w-full accent-purple-600"
          disabled={!localSettings.soundsEnabled}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Muet (0%)</span>
          <span>Fort (100%)</span>
        </div>
      </div>

      {/* Volume FX (Sons d'ambiance/UI) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          🔊 Volume des effets sonores : {localSettings.fxVolume ?? 50}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={localSettings.fxVolume ?? 50}
          onChange={(e) => handleChange('fxVolume', parseInt(e.target.value))}
          className="w-full accent-purple-600"
          disabled={!localSettings.soundsEnabled}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Muet (0%)</span>
          <span>Fort (100%)</span>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">🔧 Dépannage</h3>
        <div className="bg-gray-900/50 rounded-lg p-4 space-y-3">
          <p className="text-xs text-gray-400">
            Si vous rencontrez des problèmes de connexion ou d'affichage, vous pouvez nettoyer complètement le cache de l'application.
          </p>
          <button
            onClick={async () => {
              if (window.confirm('⚠️ Cette action va :\n\n• Nettoyer tout le cache\n• Vous déconnecter\n• Recharger l\'application\n\nVoulez-vous continuer ?')) {
                await authService.clearCacheAndSignOut();
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors text-sm font-medium"
          >
            <RefreshCw size={16} />
            Nettoyer le cache et redémarrer
          </button>
          <p className="text-xs text-gray-500 italic">
            ⚠️ Vous devrez vous reconnecter après cette action
          </p>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-vtt'));
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm font-medium border border-gray-600"
          >
            <Map size={16} />
            VTT Beta
          </button>
        </div>
      </div>


    </div>
  );
}

// Composant pour l'onglet Historique
function HistoryTab({
  history,
  onClearHistory,
  onRemoveEntry,
}: {
  history: DiceRollHistoryEntry[];
  onClearHistory: () => void;
  onRemoveEntry: (id: string) => void;
}) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-400 mb-2">Aucun jet de dés enregistré</p>
        <p className="text-sm text-gray-500">
          Lancez des dés pour voir l'historique apparaître ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header avec bouton effacer */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <p className="text-sm text-gray-400">
          {history.length} / 20 jets enregistrés
        </p>
        <button
          onClick={onClearHistory}
          className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Tout effacer
        </button>
      </div>

      {/* Liste des jets */}
      <div className="space-y-2">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50 hover:border-purple-500/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">{entry.attackName}</p>
                <p className="text-xs text-gray-500">{formatRelativeTime(entry.timestamp)}</p>
              </div>
              <button
                onClick={() => onRemoveEntry(entry.id)}
                className="p-1 hover:bg-red-600/20 rounded transition-colors text-gray-500 hover:text-red-400"
                title="Supprimer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-purple-400">{entry.total}</span>
              <div className="flex-1 text-xs text-gray-400">
                <p>
                  {entry.diceFormula} → [{entry.rolls.join(', ')}] = {entry.diceTotal}
                </p>
                {entry.modifier !== 0 && (
                  <p className="text-orange-400">
                    {entry.modifier >= 0 ? '+' : ''}{entry.modifier}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div> 
    </div>
  );
}

// Composant pour l'onglet Fond d'écran
// Composant pour l'onglet Fond d'écran
function BackgroundTab({
  currentBackground,
  onBackgroundChange,
  deviceType,
}: {
  currentBackground?: string;
  onBackgroundChange?: (backgroundUrl: string) => void;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
}) {
  // 🆕 Liste des fonds d'écran (images)
  const backgroundImages = [ 
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Averne%201.png', name: 'Averne 1', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Averne%202.png', name: 'Averne 2', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Cave.png', name: 'Cave', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Desert%201.png', name: 'Desert 1', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Desert%202.png', name: 'Desert 2', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Dragon%201.png', name: 'Dragon 1', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Dragon%202.png', name: 'Dragon 2', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Forest%201.png', name: 'Forest 1', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Forest%202.png', name: 'Forest 2', type: 'image' as const },
    { url: '/fondecran/forest.png', name: 'forest', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Magic.png', name: 'Magic', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Mountain%201.png', name: 'Mountain 1', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Mountain%202.png', name: 'Mountain 2', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Mountain%203.png', name: 'Mountain 3', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Table.png', name: 'Table', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Toits.png', name: 'Toits', type: 'image' as const },
      { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Underwater.png', name: 'Underwater', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/War.png', name: 'War', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/War%202.png', name: 'War 2', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/War%203.png', name: 'War 3', type: 'image' as const },
    { url: 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/backscreen/Ascendance.jpg', name: 'Ascendance', type: 'image' as const },
  ];

  // 🆕 Liste des fonds de couleur
const backgroundColors = [
  // Couleurs de base essentielles
  { url: 'color:#000000', name: 'Noir Absolu', color: '#000000', type: 'color' as const },
  { url: 'color:#0f0f23', name: 'Bleu Nuit', color: '#0f0f23', type: 'color' as const },
  
  // Variations de bleu foncé
  { url: 'color:#0a1628', name: 'Bleu Minuit', color: '#0a1628', type: 'color' as const },
  { url: 'color:#0d1b2a', name: 'Bleu Océan Profond', color: '#0d1b2a', type: 'color' as const },
  { url: 'color:#1b263b', name: 'Bleu Marine', color: '#1b263b', type: 'color' as const },
  { url: 'color:#15202b', name: 'Bleu Crépuscule', color: '#15202b', type: 'color' as const },
  { url: 'color:#1a2332', name: 'Bleu Acier Sombre', color: '#1a2332', type: 'color' as const },
  { url: 'color:#0c1821', name: 'Bleu Abyssal', color: '#0c1821', type: 'color' as const },
  { url: 'color:#1c2541', name: 'Bleu Nuit Étoilée', color: '#1c2541', type: 'color' as const },
  { url: 'color:#0b1d2e', name: 'Bleu Glacier', color: '#0b1d2e', type: 'color' as const },
  
  // Couleurs sombres neutres (réduites)
  { url: 'color:#1a1410', name: 'Caverne Obscure', color: '#1a1410', type: 'color' as const },
  { url: 'color:#2d2416', name: 'Bois Sombre', color: '#2d2416', type: 'color' as const },
  { url: 'color:#1e1e2e', name: 'Nuit Profonde', color: '#1e1e2e', type: 'color' as const },
  { url: 'color:#2b1e1e', name: 'Pierre Ancienne', color: '#2b1e1e', type: 'color' as const },
  { url: 'color:#1a2318', name: 'Forêt Nocturne', color: '#1a2318', type: 'color' as const },
  { url: 'color:#221a2d', name: 'Crypte Violette', color: '#221a2d', type: 'color' as const },
  
  // Ton ocre minimal (1 seul)
  { url: 'color:#3a2f1f', name: 'Parchemin Vieilli', color: '#3a2f1f', type: 'color' as const },
  
  // Gradients bleutés
  { url: 'gradient:linear-gradient(135deg, #0a1628 0%, #1b263b 100%)', name: 'Mer Nocturne', gradient: 'linear-gradient(135deg, #0a1628 0%, #1b263b 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #0d1b2a 0%, #1c2541 100%)', name: 'Aurore Boréale Sombre', gradient: 'linear-gradient(135deg, #0d1b2a 0%, #1c2541 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #0c1821 0%, #15202b 100%)', name: 'Profondeurs Marines', gradient: 'linear-gradient(135deg, #0c1821 0%, #15202b 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #1a2332 0%, #0a1628 100%)', name: 'Glacier Nocturne', gradient: 'linear-gradient(135deg, #1a2332 0%, #0a1628 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #0b1d2e 0%, #1b263b 100%)', name: 'Tempête Lointaine', gradient: 'linear-gradient(135deg, #0b1d2e 0%, #1b263b 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #15202b 0%, #0d1b2a 50%, #1c2541 100%)', name: 'Vagues Nocturnes', gradient: 'linear-gradient(135deg, #15202b 0%, #0d1b2a 50%, #1c2541 100%)', type: 'gradient' as const }, // ✅ CORRIGÉ ICI
  
  // Gradients sombres neutres (réduits)
  { url: 'gradient:linear-gradient(135deg, #1a1410 0%, #2d1b0e 100%)', name: 'Crépuscule de Cendre', gradient: 'linear-gradient(135deg, #1a1410 0%, #2d1b0e 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #2b1e1e 0%, #1a1410 100%)', name: 'Brume Nocturne', gradient: 'linear-gradient(135deg, #2b1e1e 0%, #1a1410 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #1e1e2e 0%, #2d2440 100%)', name: 'Voile Mystique', gradient: 'linear-gradient(135deg, #1e1e2e 0%, #2d2440 100%)', type: 'gradient' as const },
  { url: 'gradient:linear-gradient(135deg, #1a2318 0%, #2d3a28 100%)', name: 'Sous-bois Profond', gradient: 'linear-gradient(135deg, #1a2318 0%, #2d3a28 100%)', type: 'gradient' as const },
];

  // Combiner les deux listes
  const allBackgrounds = [...backgroundImages, ...backgroundColors];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Choisissez un fond d'écran
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Cliquez sur une image ou une couleur pour l'appliquer ({allBackgrounds.length} disponible{allBackgrounds.length > 1 ? 's' : ''})
        </p>
      </div>

      {/* 🆕 Section Images */}
      <div>
        <h4 className="text-xs font-medium text-gray-400 mb-2">📸 Images</h4>
        <div className="grid grid-cols-2 gap-3">
          {backgroundImages.map((bg) => (
            <button
              key={bg.url}
              type="button"
              onClick={() => onBackgroundChange?.(bg.url)}
              className={`relative group rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                currentBackground === bg.url
                  ? 'border-purple-500 ring-2 ring-purple-500/50'
                  : 'border-gray-600 hover:border-purple-400'
              }`}
            >
              <div className="aspect-video relative bg-gray-900">
                <img
                  src={bg.url}
                  alt={bg.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Overlay au survol */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium">
                    Sélectionner
                  </span>
                </div>

                {/* Indicateur de sélection */}
                {currentBackground === bg.url && (
                  <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-2 bg-gray-700/50 text-center">
                <p className="text-xs text-gray-300 truncate">{bg.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 🆕 Section Couleurs & Gradients */}
      <div>
        <h4 className="text-xs font-medium text-gray-400 mb-2">🎨 Couleurs & Dégradés</h4>
        <div className="grid grid-cols-2 gap-3">
          {backgroundColors.map((bg) => (
            <button
              key={bg.url}
              type="button"
              onClick={() => onBackgroundChange?.(bg.url)}
              className={`relative group rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                currentBackground === bg.url
                  ? 'border-purple-500 ring-2 ring-purple-500/50'
                  : 'border-gray-600 hover:border-purple-400'
              }`}
            >
              <div 
                className="aspect-video relative"
                style={{ 
                  background: bg.type === 'gradient' ? bg.gradient : bg.color 
                }}
              >
                {/* Overlay au survol */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium drop-shadow-lg">
                    Sélectionner
                  </span>
                </div>

                {/* Indicateur de sélection */}
                {currentBackground === bg.url && (
                  <div className="absolute top-2 right-2 bg-purple-600 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="p-2 bg-gray-700/50 text-center">
                <p className="text-xs text-gray-300 truncate">{bg.name}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Message adapté selon le type d'appareil */}
      <div className="bg-blue-900/20 border border-blue-600/50 rounded-lg p-3 mt-4">
        <p className="text-xs text-blue-200">
          ℹ️ <strong>Note :</strong> Le fond d'écran s'applique sur {
            deviceType === 'desktop' ? 'la vue bureau' : 'toutes les vues'
          }. Le même fond est utilisé partout.
        </p>
      </div>
    </div>
  );
}