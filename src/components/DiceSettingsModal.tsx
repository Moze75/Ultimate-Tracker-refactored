import React, { useState, useEffect } from 'react';
import { X, Settings, History as HistoryIcon, Trash2 } from 'lucide-react';
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
  const { history, clearHistory, removeEntry, isLoading } = useDiceHistory();
  const [historySnapshot, setHistorySnapshot] = useState<DiceRollHistoryEntry[]>([]);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  React.useEffect(() => {
    if (open) {
      setActiveTab('settings');
    }
  }, [open]);

  // ✅ Mettre à jour le snapshot quand history change
  useEffect(() => {
    setHistorySnapshot(history);
  }, [history]);

  // ✅ Recharger l'historique quand on ouvre l'onglet
  useEffect(() => {
    if (open && activeTab === 'history') {
      // Relire depuis localStorage
      try {
        const stored = localStorage.getItem('dice-roll-history');
        if (stored) {
          const parsed = JSON.parse(stored) as DiceRollHistoryEntry[];
          setHistorySnapshot(parsed);
        }
      } catch (error) {
        console.error('❌ Erreur lecture localStorage:', error);
      }
    }
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
      setHistorySnapshot([]);
    }
  };

  const handleRemoveEntry = (id: string) => {
    removeEntry(id);
    // Mise à jour immédiate du snapshot
    setHistorySnapshot(prev => prev.filter(entry => entry.id !== id));
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
              <HistoryIcon className="w-4 h-4" />
              Historique
              {historySnapshot.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                  {historySnapshot.length}
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
                history={historySnapshot}
                isLoading={isLoading}
                onClearHistory={handleClearHistory}
                onRemoveEntry={handleRemoveEntry}
              />
            )}
          </div>

          {/* Footer */}
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

// SettingsTab (inchangé)
function SettingsTab({
  localSettings,
  handleChange,
}: {
  localSettings: DiceSettings;
  handleChange: (key: keyof DiceSettings, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Votre code SettingsTab actuel... */}
    </div>
  );
}

// HistoryTab (simplifié)
function HistoryTab({
  history,
  isLoading,
  onClearHistory,
  onRemoveEntry,
}: {
  history: DiceRollHistoryEntry[];
  isLoading: boolean;
  onClearHistory: () => void;
  onRemoveEntry: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-400 mb-2">Aucun jet de dés enregistré</p>
        <p className="text-sm text-gray-500">
          Lancez des dés pour voir l'historique apparaître ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <p className="text-sm text-gray-400">{history.length} / 20 jets enregistrés</p>
        <button
          onClick={onClearHistory}
          className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Tout effacer
        </button>
      </div>

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
}import React, { useState, useEffect } from 'react';
import { X, Settings, History as HistoryIcon, Trash2 } from 'lucide-react';
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
  const { history, clearHistory, removeEntry, isLoading } = useDiceHistory();
  const [historySnapshot, setHistorySnapshot] = useState<DiceRollHistoryEntry[]>([]);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  React.useEffect(() => {
    if (open) {
      setActiveTab('settings');
    }
  }, [open]);

  // ✅ Mettre à jour le snapshot quand history change
  useEffect(() => {
    setHistorySnapshot(history);
  }, [history]);

  // ✅ Recharger l'historique quand on ouvre l'onglet
  useEffect(() => {
    if (open && activeTab === 'history') {
      // Relire depuis localStorage
      try {
        const stored = localStorage.getItem('dice-roll-history');
        if (stored) {
          const parsed = JSON.parse(stored) as DiceRollHistoryEntry[];
          setHistorySnapshot(parsed);
        }
      } catch (error) {
        console.error('❌ Erreur lecture localStorage:', error);
      }
    }
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
      setHistorySnapshot([]);
    }
  };

  const handleRemoveEntry = (id: string) => {
    removeEntry(id);
    // Mise à jour immédiate du snapshot
    setHistorySnapshot(prev => prev.filter(entry => entry.id !== id));
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
              <HistoryIcon className="w-4 h-4" />
              Historique
              {historySnapshot.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                  {historySnapshot.length}
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
                history={historySnapshot}
                isLoading={isLoading}
                onClearHistory={handleClearHistory}
                onRemoveEntry={handleRemoveEntry}
              />
            )}
          </div>

          {/* Footer */}
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

// SettingsTab (inchangé)
function SettingsTab({
  localSettings,
  handleChange,
}: {
  localSettings: DiceSettings;
  handleChange: (key: keyof DiceSettings, value: any) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Votre code SettingsTab actuel... */}
    </div>
  );
}

// HistoryTab (simplifié)
function HistoryTab({
  history,
  isLoading,
  onClearHistory,
  onRemoveEntry,
}: {
  history: DiceRollHistoryEntry[];
  isLoading: boolean;
  onClearHistory: () => void;
  onRemoveEntry: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <p className="text-gray-400 mb-2">Aucun jet de dés enregistré</p>
        <p className="text-sm text-gray-500">
          Lancez des dés pour voir l'historique apparaître ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-gray-700">
        <p className="text-sm text-gray-400">{history.length} / 20 jets enregistrés</p>
        <button
          onClick={onClearHistory}
          className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Tout effacer
        </button>
      </div>

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