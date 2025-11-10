import React, { useState } from 'react';
import { X, Settings, History, Trash2 } from 'lucide-react';
import type { DiceSettings } from '../hooks/useDiceSettings';
import { DEFAULT_DICE_SETTINGS } from '../hooks/useDiceSettings';
import { useDiceHistory, formatRelativeTime, type DiceRollHistoryEntry } from '../hooks/useDiceHistory';
 
interface DiceSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: DiceSettings;
  onSave: (settings: DiceSettings) => void;
}

type TabType = 'settings' | 'history'; 

export function DiceSettingsModal({ open, onClose, settings, onSave }: DiceSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<DiceSettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const { history, clearHistory, removeEntry } = useDiceHistory();
  const [refreshKey, setRefreshKey] = useState(0); // ✅ Pour forcer le refresh


  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  React.useEffect(() => {
    if (open) {
      // Réinitialiser l'onglet actif à l'ouverture
      setActiveTab('settings');
    }
  }, [open]);


  // ✅ Rafraîchir l'historique quand on bascule sur l'onglet
  useEffect(() => {
    if (open && activeTab === 'history') {
      setRefreshKey(prev => prev + 1);
    }
  }, [open, activeTab]);

  // ✅ Polling pour mettre à jour automatiquement l'historique
  useEffect(() => {
    if (!open || activeTab !== 'history') return;

    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000); // Refresh toutes les secondes

    return () => clearInterval(interval);
  }, [open, activeTab]);

  if (!open) return null;

  const handleSave = () => {
    try {
      onSave(localSettings);
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
      setRefreshKey(prev => prev + 1);
    }
  };
  
  if (!open) return null;

  const handleSave = () => {
    try {
      onSave(localSettings);
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
    if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique des jets de dés ?')) {
      clearHistory();
    }
  }; 
 
  return ( 
   <div className="fixed inset-0 z-50 bg-black/50 overflow-y-auto">
       <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-md w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Dés 3D</h2>
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
            Paramètres
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
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === 'settings' ? (
            <SettingsTab
              localSettings={localSettings}
              handleChange={handleChange}
            />
          ) : (
            <HistoryTab
              history={history}
              onClearHistory={handleClearHistory}
              onRemoveEntry={removeEntry}
            />
          )}
        </div>

        {/* Footer - seulement pour l'onglet paramètres */}
        {activeTab === 'settings' && (
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
        )}
      </div>
    </div>
     </div>
  );
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
      {/* Tous vos contrôles existants ici */}
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
      </div>

      {/* Volume */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          🔊 Volume des dés : {localSettings.volume}%
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
              {/* Résultat total */}
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-purple-400">{entry.total}</span>
              </div>

              {/* Détails */}
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