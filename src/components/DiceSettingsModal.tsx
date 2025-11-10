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

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  React.useEffect(() => {
    if (open) {
      // Réinitialiser l'onglet actif à l'ouverture
      setActiveTab('settings');
    }
  }, [open]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
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
          {/* ... toutes vos options ... */}
        </select>
      </div>

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