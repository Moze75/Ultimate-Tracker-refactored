import React from 'react';
import { createPortal } from 'react-dom';
import { Settings } from 'lucide-react';
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

interface ItemMeta {
  type?: string;
  quantity?: number;
  equipped?: boolean;
  imageUrl?: string;
  bonuses?: {
    strength?: number;
    dexterity?: number;
    constitution?: number;
    intelligence?: number;
    wisdom?: number;
    charisma?: number;
    armor_class?: number;
  };
}

interface InfoBubbleProps {
  equipment: Equipment | null;
  type: 'armor' | 'weapon' | 'shield' | 'potion' | 'jewelry' | 'bag';
  onClose: () => void;
  onToggleEquip?: () => void;
  isEquipped?: boolean;
  onRequestOpenList?: () => void;
  onOpenEditFromSlot?: () => void;
  onOpenWeaponsManage?: () => void;
  onOpenBagModal?: () => void;
  bagText?: string;
  inventory?: InventoryItem[];
}

const META_PREFIX = '#meta:';

const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();

function smartCapitalize(name: string): string {
  const base = stripPriceParentheses(name).trim();
  if (!base) return '';
  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function parseMeta(description: string | null | undefined): ItemMeta | null {
  if (!description) return null;
  const lines = (description || '').split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine.slice(META_PREFIX.length));
  } catch {
    return null;
  }
}

const getTitle = (type: 'armor' | 'weapon' | 'shield' | 'potion' | 'jewelry' | 'bag') => {
  if (type === 'armor') return 'Armure';
  if (type === 'shield') return 'Bouclier';
  if (type === 'weapon') return 'Armes';
  if (type === 'potion') return 'Potions';
  if (type === 'jewelry') return 'Bijoux';
  return 'Sac à dos';
};

export function InfoBubble({
  equipment,
  type,
  onClose,
  onToggleEquip,
  isEquipped,
  onRequestOpenList,
  onOpenEditFromSlot,
  onOpenWeaponsManage,
  onOpenBagModal,
  bagText,
  inventory = []
}: InfoBubbleProps) {
  return createPortal(
    <div className="fixed inset-0 z-[9999]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-gray-900/95 text-sm text-gray-300 rounded-lg shadow-lg w-[min(32rem,95vw)] border border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-gray-100 text-lg">{getTitle(type)}</h4>
          <div className="flex items-center gap-1">
            {(type === 'armor' || type === 'shield') && equipment && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleEquip?.(); }}
                className={`px-2 py-1 rounded text-xs border ${isEquipped ? 'border-green-500/40 text-green-300 bg-green-900/20' : 'border-gray-600 text-gray-300 hover:bg-gray-700/40'}`}
              >
                {isEquipped ? 'Équipé' : 'Non équipé'}
              </button>
            )}
            {type === 'weapon' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenWeaponsManage?.();
                }}
                className="px-3 py-1 rounded text-xs border border-gray-600 text-gray-200 hover:bg-gray-700/50"
              >
                Gérer / Équiper
              </button>
            )}
            {(type === 'armor' || type === 'shield') && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenEditFromSlot?.(); }}
                className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg"
                title="Paramètres"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        </div>

        {equipment && type !== 'bag' ? (
          <div className="space-y-2">
            {equipment.name && <h5 className="font-medium text-gray-100 break-words">{smartCapitalize(equipment.name)}</h5>}

            {(() => {
              const item = equipment.inventory_item_id
                ? inventory?.find(i => i.id === equipment.inventory_item_id)
                : null;
              const meta = item ? parseMeta(item.description) : null;
              const imageUrl = meta?.imageUrl;

              if (imageUrl) {
                return (
                  <div className="my-3">
                    <img
                      src={imageUrl}
                      alt={equipment.name}
                      className="w-full max-w-xs rounded-lg border border-gray-600/50"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                );
              }
              return null;
            })()}
            {equipment.description && <p className="text-sm text-gray-400 whitespace-pre-wrap">{equipment.description}</p>}

            {type === 'armor' && equipment.armor_formula && (
              <div className="mt-1 text-sm text-gray-300 flex items-center justify-between">
                <span className="text-gray-400">Formule</span>
                <span className="font-medium text-gray-100">{equipment.armor_formula.label || ''}</span>
              </div>
            )}

            {type === 'shield' && typeof equipment.shield_bonus === 'number' && (
              <div className="mt-1 text-sm text-gray-300 flex items-center justify-between">
                <span className="text-gray-400">Bonus de bouclier</span>
                <span className="font-medium text-gray-100">+{equipment.shield_bonus}</span>
              </div>
            )}

            {type === 'weapon' && equipment.weapon_meta && (
              <div className="mt-1 text-sm text-gray-300 space-y-1">
                <div className="flex items-center justify-between"><span className="text-gray-400">Dés</span><span className="font-medium text-gray-100">{equipment.weapon_meta.damageDice}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-400">Type</span><span className="font-medium text-gray-100">{equipment.weapon_meta.damageType}</span></div>
                {equipment.weapon_meta.properties && <div className="flex items-center justify-between"><span className="text-gray-400">Propriété</span><span className="font-medium text-gray-100">{equipment.weapon_meta.properties}</span></div>}
                {equipment.weapon_meta.range && <div className="flex items-center justify-between"><span className="text-gray-400">Portée</span><span className="font-medium text-gray-100">{equipment.weapon_meta.range}</span></div>}
              </div>
            )}
          </div>
        ) : type === 'bag' ? (
          <div className="space-y-2">
            {equipment?.name && <h5 className="font-medium text-gray-100 break-words">{smartCapitalize(equipment.name)}</h5>}
            {bagText && (
              <div className="text-sm text-gray-400 whitespace-pre-wrap border-b border-gray-700/50 pb-2">
                {bagText}
              </div>
            )}
            {(() => {
              const equipmentItems = inventory.filter(item => {
                const meta = parseMeta(item.description);
                return meta?.type === 'equipment';
              });
              const otherItems = inventory.filter(item => {
                const meta = parseMeta(item.description);
                return meta?.type === 'other';
              });

              if (equipmentItems.length > 0 || otherItems.length > 0) {
                return (
                  <div className="space-y-3">
                    {equipmentItems.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1 font-medium">Équipements :</div>
                        <div className="space-y-1">
                          {equipmentItems.map(item => {
                            const meta = parseMeta(item.description);
                            const qty = meta?.quantity ?? 1;
                            return (
                              <div key={item.id} className="text-sm text-gray-300 pl-2">
                                • {smartCapitalize(item.name)}{qty > 1 && ` x${qty}`}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {otherItems.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1 font-medium">Autres :</div>
                        <div className="space-y-1">
                          {otherItems.map(item => {
                            const meta = parseMeta(item.description);
                            const qty = meta?.quantity ?? 1;
                            return (
                              <div key={item.id} className="text-sm text-gray-300 pl-2">
                                • {smartCapitalize(item.name)}{qty > 1 && ` x${qty}`}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              return equipmentItems.length === 0 && otherItems.length === 0 && !bagText ? (
                <div className="text-sm text-gray-400">Sac vide</div>
              ) : null;
            })()}
            <div className="mt-3">
              <button onClick={() => onOpenBagModal?.()} className="btn-primary px-3 py-2 rounded-lg">
                Modifier le contenu
              </button>
            </div>
          </div>
        ) : (
          (type === 'armor' || type === 'shield' || type === 'weapon') && (
            <div className="text-sm text-gray-400">
              {type === 'weapon' ? (
                <div className="mt-3">
                  <button onClick={() => onOpenWeaponsManage?.()} className="btn-primary px-3 py-2 rounded-lg">Gérer mes armes</button>
                </div>
              ) : (
                <>
                  Aucun {type === 'armor' ? 'armure' : 'bouclier'} équipé.
                  <div className="mt-3">
                    <button onClick={() => onRequestOpenList?.()} className="btn-primary px-3 py-2 rounded-lg">Équiper depuis le sac</button>
                  </div>
                </>
              )}
            </div>
          )
        )}
      </div>
    </div>,
    document.body
  );
}
