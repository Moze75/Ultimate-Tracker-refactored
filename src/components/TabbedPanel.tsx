import React, { useState, useEffect } from 'react';
import { Player } from '../types/dnd';
import { ClassesTabWrapper } from './ClassesTabWrapper';
import { AbilitiesTab } from './AbilitiesTab';
import { EquipmentTab } from './EquipmentTab';
import CombatTab from './CombatTab';

type TabKey = 'actions' | 'class' | 'spells' | 'gold' | 'inventory' | 'bag' | 'notes';

interface TabbedPanelProps {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: any[]) => void;
  classSections: any[] | null;
  hiddenTabs?: TabKey[]; // ← Ajouter cette ligne
}

const TABS = [
  { key: 'actions', label: 'Actions' },
  { key: 'class', label: 'Classe' },
  { key: 'spells', label: 'Sorts' },
  { key: 'gold', label: 'Or' },
  { key: 'inventory', label: 'Équipements' }, // ← Changé ici
  { key: 'bag', label: 'Sac' },
  { key: 'notes', label: 'Notes' }, // ← Ajouter cette ligne
] as const;

const STORAGE_KEY = 'desktopTabbedPanel:activeTab';

export function TabbedPanel({
  player,
  inventory,
  onPlayerUpdate,
  onInventoryUpdate,
  classSections,
  hiddenTabs = [],
}: TabbedPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}:${player.id}`);
      return (saved as TabKey) || 'actions';
    } catch {
      return 'actions';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}:${player.id}`, activeTab);
    } catch {}
  }, [activeTab, player.id]);

  // Filtrer les onglets à afficher
  const visibleTabs = TABS.filter(tab => !hiddenTabs.includes(tab.key));

  return (
    <div className="flex flex-col h-full">
      {/* Onglets horizontaux en haut */}
      <div className="flex border-b border-gray-700 mb-4">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-4 py-2 text-base font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet actif */}
<div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'actions' && (
          <CombatTab
            player={player}
            inventory={inventory}
            onUpdate={onPlayerUpdate}
          />
        )}

        {activeTab === 'class' && (
          <ClassesTabWrapper player={player} onUpdate={onPlayerUpdate} />
        )}

        {activeTab === 'spells' && (
          <AbilitiesTab player={player} onUpdate={onPlayerUpdate} />
        )}

        {activeTab === 'gold' && (
          <EquipmentTab
            player={player}
            inventory={inventory}
            onPlayerUpdate={onPlayerUpdate}
            onInventoryUpdate={onInventoryUpdate}
            viewMode="gold"
          />
        )}

        {activeTab === 'inventory' && (
          <EquipmentTab
            player={player}
            inventory={inventory}
            onPlayerUpdate={onPlayerUpdate}
            onInventoryUpdate={onInventoryUpdate}
            viewMode="inventory"
          />
        )}

        {activeTab === 'bag' && (
          <EquipmentTab
            player={player}
            inventory={inventory}
            onPlayerUpdate={onPlayerUpdate}
            onInventoryUpdate={onInventoryUpdate}
            viewMode="bag"
          />
        )}
      </div>

      {/* Styles scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(31, 41, 55, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(75, 85, 99, 0.8);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 1);
        }
      `}</style>
    </div>
  );
}
