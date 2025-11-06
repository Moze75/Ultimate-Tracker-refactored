import React from 'react';
import { Backpack, Shield as ShieldIcon, Sword, Flask, Star } from 'lucide-react';
import { EquipmentSlot } from './EquipmentSlot';
import { InventoryItem } from '../../types/dnd';

interface Equipment {
  name: string;
  description: string;
  isTextArea?: boolean;
  inventory_item_id?: string | null;
  armor_formula?: {
    base: number;
    addDex: boolean;
    dexCap?: number | null;
    label: string;
  };
  shield_bonus?: number;
  weapon_meta?: {
    damageDice: string;
    damageType: string;
    properties?: string;
    range?: string;
  };
}

interface EquipmentSlotsProps {
  armor: Equipment | null;
  shield: Equipment | null;
  weaponsSummary: Equipment;
  potionText: string;
  jewelryText: string;
  bag: Equipment | null;
  bagText: string;
  inventory: InventoryItem[];
  equippedWeaponsCount: number;
  onOpenInventoryModal: (type: 'armor' | 'shield') => void;
  onToggleFromSlot: (slot: 'armor' | 'shield') => void;
  onOpenEditFromSlot: (slot: 'armor' | 'shield') => void;
  onOpenWeaponsModal: () => void;
  onOpenBagModal: () => void;
}

export function EquipmentSlots({
  armor,
  shield,
  weaponsSummary,
  potionText,
  jewelryText,
  bag,
  bagText,
  inventory,
  equippedWeaponsCount,
  onOpenInventoryModal,
  onToggleFromSlot,
  onOpenEditFromSlot,
  onOpenWeaponsModal,
  onOpenBagModal
}: EquipmentSlotsProps) {
  return (
    <div className="stat-card">
      <div className="stat-header flex items-center gap-3">
        <Backpack className="text-purple-500" size={24} />
        <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Inventaire</h2>
      </div>
      <div className="p-4">
        <div className="relative w-full mx-auto aspect-[2/3] bg-gray-800/50 rounded-lg overflow-hidden">
          <img
            src="https://yumzqyyogwzrmlcpvnky.supabase.co/storage/v1/object/public/static//Silouete.png"
            alt="Character silhouette"
            className="absolute inset-0 w-full h-full object-contain opacity-30"
            style={{ mixBlendMode: 'luminosity' }}
          />

          <EquipmentSlot
            icon={<ShieldIcon size={24} className="text-purple-500" />}
            position="top-[27%] left-1/2 -translate-x-1/2"
            equipment={armor || null}
            type="armor"
            onRequestOpenList={() => onOpenInventoryModal('armor')}
            onToggleEquipFromSlot={() => onToggleFromSlot('armor')}
            onOpenEditFromSlot={() => onOpenEditFromSlot('armor')}
            isEquipped={!!armor}
            inventory={inventory}
          />

          <EquipmentSlot
            icon={<ShieldIcon size={24} className="text-blue-500" />}
            position="top-[50%] left-[15%]"
            equipment={shield || null}
            type="shield"
            onRequestOpenList={() => onOpenInventoryModal('shield')}
            onToggleEquipFromSlot={() => onToggleFromSlot('shield')}
            onOpenEditFromSlot={() => onOpenEditFromSlot('shield')}
            isEquipped={!!shield}
            inventory={inventory}
          />

          <EquipmentSlot
            icon={<Sword size={24} className="text-red-500" />}
            position="top-[50%] right-[15%]"
            equipment={weaponsSummary}
            type="weapon"
            onRequestOpenList={() => {}}
            onToggleEquipFromSlot={() => {}}
            onOpenEditFromSlot={() => {}}
            onOpenWeaponsManageFromSlot={onOpenWeaponsModal}
            isEquipped={equippedWeaponsCount > 0}
            inventory={inventory}
          />

          <EquipmentSlot
            icon={<Flask size={24} className="text-green-500" />}
            position="top-[5%] right-[5%]"
            equipment={{ name: 'Potions et poisons', description: potionText, isTextArea: true }}
            type="potion"
            onRequestOpenList={() => {}}
            onToggleEquipFromSlot={() => {}}
            onOpenEditFromSlot={() => {}}
            isEquipped={false}
            inventory={inventory}
          />

          <EquipmentSlot
            icon={<Star size={24} className="text-yellow-500" />}
            position="top-[15%] right-[5%]"
            equipment={{ name: 'Bijoux', description: jewelryText, isTextArea: true }}
            type="jewelry"
            onRequestOpenList={() => {}}
            onToggleEquipFromSlot={() => {}}
            onOpenEditFromSlot={() => {}}
            isEquipped={false}
            inventory={inventory}
          />

          <EquipmentSlot
            icon={<img src="https://yumzqyyogwzrmlcpvnky.supabase.co/storage/v1/object/public/static//8-2-backpack-png-pic.png" alt="Backpack" className="w-24 h-24 object-contain" />}
            position="bottom-[5%] right-[2%]"
            equipment={bag || { name: 'Sac à dos', description: '', isTextArea: true }}
            type="bag"
            onRequestOpenList={() => {}}
            onToggleEquipFromSlot={() => {}}
            onOpenEditFromSlot={() => {}}
            onOpenBagModal={onOpenBagModal}
            isEquipped={false}
            bagText={bagText}
            inventory={inventory}
          />
        </div>
      </div>
    </div>
  );
}
