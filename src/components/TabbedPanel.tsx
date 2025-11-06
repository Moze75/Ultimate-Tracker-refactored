import React, { useState, useEffect } from 'react';
import { Player } from '../types/dnd';
import { AttackSection } from './Combat/AttackSection';
import { StandardActionsSection } from './StandardActionsSection';
import { ConditionsSection } from './ConditionsSection';
import { ClassesTabWrapper } from './ClassesTabWrapper';
import { AbilitiesTab } from './AbilitiesTab';
import { GoldManager } from './Equipment/GoldManager';
import { EquipmentSlots } from './Equipment/EquipmentSlots';
import { InventoryList } from './Equipment/InventoryList';

type TabKey = 'actions' | 'class' | 'spells' | 'equipment' | 'inventory';

interface TabbedPanelProps {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: any[]) => void;
  classSections: any[] | null;
  getAttackBonus?: (attack: any) => number;
  getDamageBonus?: (attack: any) => number;
}

const TABS = [
  { key: 'actions', label: 'Actions' },
  { key: 'class', label: 'Classe' },
  { key: 'spells', label: 'Sorts' },
  { key: 'equipment', label: 'Or + Inventaire' },
  { key: 'inventory', label: 'Sac' },
] as const;

const STORAGE_KEY = 'desktopTabbedPanel:activeTab';

export function TabbedPanel({
  player,
  inventory,
  onPlayerUpdate,
  onInventoryUpdate,
  classSections,
  getAttackBonus,
  getDamageBonus,
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

  return (
    <div className="flex flex-col h-full">
      {/* Onglets horizontaux en haut */}
      <div className="flex border-b border-gray-700 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative ${
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
          <ActionsTabContent
            player={player}
            inventory={inventory}
            onPlayerUpdate={onPlayerUpdate}
            getAttackBonus={getAttackBonus}
            getDamageBonus={getDamageBonus}
          />
        )}

        {activeTab === 'class' && (
          <ClassesTabWrapper player={player} onUpdate={onPlayerUpdate} />
        )}

        {activeTab === 'spells' && (
          <AbilitiesTab player={player} onUpdate={onPlayerUpdate} />
        )}

        {activeTab === 'equipment' && (
          <EquipmentTabContent
            player={player}
            inventory={inventory}
            onPlayerUpdate={onPlayerUpdate}
            onInventoryUpdate={onInventoryUpdate}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTabContent
            player={player}
            inventory={inventory}
            onInventoryUpdate={onInventoryUpdate}
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

// Contenu de l'onglet Actions
function ActionsTabContent({
  player,
  inventory,
  onPlayerUpdate,
  getAttackBonus,
  getDamageBonus,
}: {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  getAttackBonus?: (attack: any) => number;
  getDamageBonus?: (attack: any) => number;
}) {
  return (
    <div className="space-y-6">
      <div className="text-gray-400 text-sm">
        Section Actions (AttackSection + StandardActionsSection + ConditionsSection)
      </div>

      <StandardActionsSection player={player} onUpdate={onPlayerUpdate} />
      <ConditionsSection player={player} onUpdate={onPlayerUpdate} />
    </div>
  );
}

// Contenu de l'onglet Or + Inventaire
function EquipmentTabContent({
  player,
  inventory,
  onPlayerUpdate,
  onInventoryUpdate,
}: {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: any[]) => void;
}) {
  return (
    <div className="space-y-6">
      <GoldManager player={player} onUpdate={onPlayerUpdate} />
      <EquipmentSlots
        player={player}
        inventory={inventory}
        onPlayerUpdate={onPlayerUpdate}
        onInventoryUpdate={onInventoryUpdate}
      />
    </div>
  );
}

// Contenu de l'onglet Sac
function InventoryTabContent({
  player,
  inventory,
  onInventoryUpdate,
}: {
  player: Player;
  inventory: any[];
  onInventoryUpdate: (inventory: any[]) => void;
}) {
  return (
    <div className="space-y-4">
      <InventoryList
        player={player}
        inventory={inventory}
        onInventoryUpdate={onInventoryUpdate}
      />
    </div>
  );
}
