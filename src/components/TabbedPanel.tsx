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
  const [attacks, setAttacks] = React.useState<any[]>([]);

  React.useEffect(() => {
    const equippedWeapons = inventory.filter(item => {
      try {
        const description = item.description || '';
        const metaLine = description.split('\n').reverse().find((l: string) => l.trim().startsWith('#meta:'));
        if (!metaLine) return false;
        const meta = JSON.parse(metaLine.trim().slice(6));
        return meta.equipped && meta.category === 'weapon';
      } catch {
        return false;
      }
    });

    const weaponAttacks = equippedWeapons.map(weapon => {
      try {
        const description = weapon.description || '';
        const metaLine = description.split('\n').reverse().find((l: string) => l.trim().startsWith('#meta:'));
        const meta = JSON.parse(metaLine.trim().slice(6));

        return {
          id: weapon.id,
          name: weapon.name,
          damage_dice: meta.damage?.dice || '1d4',
          damage_type: meta.damage?.type || 'contondant',
          range: meta.range || 'corps à corps',
          attack_type: 'physical',
          ammo_type: meta.ammo_type || null,
          ammo_count: meta.ammo_count || 0,
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    setAttacks(weaponAttacks);
  }, [inventory]);

  const defaultGetAttackBonus = (attack: any) => {
    const abilities = player.abilities || [];
    const profBonus = Math.floor((player.level - 1) / 4) + 2;

    const strMod = abilities.find(a => a.name === 'Force')?.modifier || 0;
    const dexMod = abilities.find(a => a.name === 'Dextérité')?.modifier || 0;

    const isMelee = attack.range?.toLowerCase().includes('corps à corps');
    const baseMod = isMelee ? strMod : dexMod;

    return baseMod + profBonus;
  };

  const defaultGetDamageBonus = (attack: any) => {
    const abilities = player.abilities || [];
    const strMod = abilities.find(a => a.name === 'Force')?.modifier || 0;
    const dexMod = abilities.find(a => a.name === 'Dextérité')?.modifier || 0;

    const isMelee = attack.range?.toLowerCase().includes('corps à corps');
    return isMelee ? strMod : dexMod;
  };

  const handleAddAttack = () => {
    console.log('Add attack');
  };

  const handleEditAttack = (attack: any) => {
    console.log('Edit attack', attack);
  };

  const handleDeleteAttack = (attackId: string) => {
    console.log('Delete attack', attackId);
  };

  const handleRollAttack = (attack: any) => {
    const bonus = (getAttackBonus || defaultGetAttackBonus)(attack);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + bonus;
    console.log(`Attaque ${attack.name}: ${roll} + ${bonus} = ${total}`);
  };

  const handleRollDamage = (attack: any) => {
    const bonus = (getDamageBonus || defaultGetDamageBonus)(attack);
    const diceMatch = attack.damage_dice.match(/(\d+)d(\d+)/);
    if (diceMatch) {
      const numDice = parseInt(diceMatch[1]);
      const diceSize = parseInt(diceMatch[2]);
      let total = bonus;
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * diceSize) + 1;
      }
      console.log(`Dégâts ${attack.name}: ${attack.damage_dice} + ${bonus} = ${total}`);
    }
  };

  const handleChangeAmmoCount = (attack: any, delta: number) => {
    console.log('Change ammo', attack, delta);
  };

  const handleSetAmmoCount = (attack: any, count: number) => {
    console.log('Set ammo', attack, count);
  };

  return (
    <div className="space-y-6">
      <AttackSection
        attacks={attacks}
        onAdd={handleAddAttack}
        onEdit={handleEditAttack}
        onDelete={handleDeleteAttack}
        onRollAttack={handleRollAttack}
        onRollDamage={handleRollDamage}
        getAttackBonus={getAttackBonus || defaultGetAttackBonus}
        getDamageBonus={getDamageBonus || defaultGetDamageBonus}
        changeAmmoCount={handleChangeAmmoCount}
        setAmmoCount={handleSetAmmoCount}
      />

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
  const [pendingEquipment] = React.useState<Set<string>>(new Set());

  return (
    <div className="space-y-4">
      <InventoryList
        inventory={inventory}
        onInventoryUpdate={onInventoryUpdate}
        pendingEquipment={pendingEquipment}
        armorId={null}
        shieldId={null}
        onRequestToggle={() => {}}
        onOpenEditItem={() => {}}
        onOpenAddList={() => {}}
        onOpenAddCustom={() => {}}
        checkWeaponProficiency={undefined}
      />
    </div>
  );
}
