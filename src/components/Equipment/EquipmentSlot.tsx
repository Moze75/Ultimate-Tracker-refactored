import React, { useState } from 'react';
import { InfoBubble } from './InfoBubble';
import { InventoryItem } from '../../types/dnd';

interface Equipment {
  name: string;
  description: string;
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

interface EquipmentSlotProps {
  icon: React.ReactNode;
  position: string;
  equipment: Equipment | null;
  type: 'armor' | 'weapon' | 'shield' | 'potion' | 'jewelry' | 'bag';
  onRequestOpenList: () => void;
  onToggleEquipFromSlot: () => void;
  onOpenEditFromSlot: () => void;
  isEquipped: boolean;
  onOpenWeaponsManageFromSlot?: () => void;
  onOpenBagModal?: () => void;
  bagText?: string;
  inventory?: InventoryItem[];
}

export function EquipmentSlot({
  icon,
  position,
  equipment,
  type,
  onRequestOpenList,
  onToggleEquipFromSlot,
  onOpenEditFromSlot,
  isEquipped,
  onOpenWeaponsManageFromSlot,
  onOpenBagModal,
  bagText,
  inventory
}: EquipmentSlotProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          if (type === 'weapon') {
            onOpenWeaponsManageFromSlot?.();
          } else {
            setShowInfo(v => !v);
          }
        }}
        className={`absolute ${position} ${type === 'bag' ? 'w-24 h-24' : 'w-12 h-12'} rounded-lg hover:bg-gray-700/20 border border-gray-600/50 flex items-center justify-center`}
        style={{ zIndex: showInfo ? 50 : 10 }}
      >
        <div className="w-full h-full flex items-center justify-center">
          {type === 'bag' ? icon : React.cloneElement(icon as React.ReactElement, { size: 24 })}
        </div>
      </button>
      {showInfo && (
        <InfoBubble
          equipment={equipment}
          type={type}
          onClose={() => setShowInfo(false)}
          onToggleEquip={onToggleEquipFromSlot}
          isEquipped={isEquipped}
          onRequestOpenList={onRequestOpenList}
          onOpenEditFromSlot={onOpenEditFromSlot}
          onOpenWeaponsManage={onOpenWeaponsManageFromSlot}
          onOpenBagModal={onOpenBagModal}
          bagText={bagText}
          inventory={inventory}
        />
      )}
    </>
  );
}
