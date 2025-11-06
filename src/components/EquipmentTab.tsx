import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Backpack, Plus, Trash2, Shield as ShieldIcon, Sword, FlaskRound as Flask, Star,
  Coins, Search, X, Settings, Filter as FilterIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { attackService } from '../services/attackService'; 
import { Player, InventoryItem } from '../types/dnd';

import { EquipmentListModal } from './modals/EquipmentListModal';
import { CustomItemModal } from './modals/CustomItemModal';
import { InventoryItemEditModal } from './modals/InventoryItemEditModal';
import { WeaponsManageModal } from './modals/WeaponsManageModal';
import { InventoryEquipmentModal } from './modals/InventoryEquipmentModal';

import { checkWeaponProficiency, getPlayerWeaponProficiencies, WeaponProficiencyCheck } from '../utils/weaponProficiencyChecker';
import { WeaponProficiencyWarningModal } from './modals/WeaponProficiencyWarningModal';

/* ====================== Types & helpers ====================== */

interface Equipment {
  name: string;
  description: string;
  isTextArea?: boolean;

  inventory_item_id?: string | null;

  armor_formula?: {
    base: number;
    addDex: boolean;
    dexCap?: number | null;
    label?: string;
  } | null;

  shield_bonus?: number | null;

  weapon_meta?: {
    damageDice: string;
    damageType: 'Tranchant' | 'Perforant' | 'Contondant';
    properties: string;
    range: string;
  } | null;
}

type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';
type WeaponCategory = 'Armes courantes' | 'Armes de guerre' | 'Armes de guerre dotées de la propriété Légère' | 'Armes de guerre présentant la propriété Finesse ou Légère';

interface WeaponMeta {
  damageDice: string;
  damageType: 'Tranchant' | 'Perforant' | 'Contondant';
  properties: string;
  range: string;
  category?: WeaponCategory;
  weapon_bonus?: number | null; // ✅ AJOUT
}
interface ArmorMeta {
  base: number;
  addDex: boolean;
  dexCap?: number | null;
  label: string;
}
interface ShieldMeta {
  bonus: number;
}
interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: WeaponMeta;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
  forced?: boolean; // --- ADDED (optionnel pour marquer un équipement forcé)
  imageUrl?: string; // ✅ NOUVEAU : URL de l'image de l'item
  
  // ✅ NOUVEAU : Bonus pour équipements, bijoux, outils, autres
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

const META_PREFIX = '#meta:';
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();
const visibleDescription = (desc: string | null | undefined) => {
  if (!desc) return '';
  return desc.split('\n').filter((l) => !l.trim().startsWith(META_PREFIX)).join('\n').trim();
};
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
function injectMetaIntoDescription(desc: string | null | undefined, meta: ItemMeta): string {
  const base = (desc || '').trim();
  const noOldMeta = base
    .split('\n')
    .filter(l => !l.trim().startsWith(META_PREFIX))
    .join('\n')
    .trim();
  const metaLine = `${META_PREFIX}${JSON.stringify(meta)}`;
  return (noOldMeta ? `${noOldMeta}\n` : '') + metaLine;
}

/* ====================== Confirmation ====================== */
function ConfirmEquipModal({
  open, mode, itemName, onConfirm, onCancel, showWarning
}: {
  open: boolean;
  mode: 'equip' | 'unequip';
  itemName: string;
  onConfirm: () => void;
  onCancel: () => void;
  showWarning?: boolean; // --- ADDED
}) {
  if (!open) return null;
  const title = mode === 'equip' ? 'Équiper cet objet ?' : 'Déséquiper cet objet ?';
  const label = mode === 'equip'
    ? `Équiper${showWarning ? ' ⚠' : ''}`
    : 'Déséquiper';
  return (
    <div
      className="fixed inset-0 z-[10000]"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900/95 border border-gray-700 rounded-lg p-4 w-[min(28rem,95vw)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          <button className="p-2 text-gray-400 hover:bg-gray-800 rounded" onClick={onCancel} aria-label="Fermer">
            <X />
          </button>
        </div>
        <p className="text-gray-300 mb-3 break-words">{smartCapitalize(itemName)}</p>
        {showWarning && mode === 'equip' && (
          <div className="mb-4 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
            Cette arme n’est pas maîtrisée : le bonus de maîtrise ne sera pas appliqué.
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary px-4 py-2 rounded-lg">Annuler</button>
          <button onClick={onConfirm} className="btn-primary px-4 py-2 rounded-lg">{label}</button>
        </div>
      </div>
    </div>
  );
}

/* ====================== Info bubble / Slot ====================== */
const getTitle = (type: 'armor' | 'weapon' | 'shield' | 'potion' | 'jewelry' | 'bag') =>
  type === 'armor' ? 'Armure'
  : type === 'shield' ? 'Bouclier'
  : type === 'weapon' ? 'Armes'
  : type === 'potion' ? 'Potions'
  : type === 'jewelry' ? 'Bijoux'
  : 'Sac à dos';

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

const InfoBubble = ({
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
}: InfoBubbleProps) => (
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
    
    {/* ✅ NOUVEAU : Affichage de l'image si présente */}
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
  </div>
);

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

// ✅ CORRECTION : EquipmentSlot (ligne ~397-429)
const EquipmentSlot = ({
  icon, position, equipment, type, onRequestOpenList, onToggleEquipFromSlot, onOpenEditFromSlot, isEquipped, onOpenWeaponsManageFromSlot, onOpenBagModal, bagText, inventory
}: EquipmentSlotProps) => {
  const [showInfo, setShowInfo] = useState(false);
  
  return (
    <>
      <button
        onClick={() => {
          // ✅ AJOUT : Si c'est une arme, ouvrir directement la modal de gestion
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
};

/* ====================== Composant principal ====================== */
interface EquipmentTabProps {
  player: Player;
  inventory: InventoryItem[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: InventoryItem[]) => void;
}
type Currency = 'gold' | 'silver' | 'copper';

const CurrencyInput = ({ currency, value, onAdd, onSpend }: {
  currency: Currency;
  value: number;
  onAdd: (n: number) => void;
  onSpend: (n: number) => void;
}) => {
  const [amount, setAmount] = useState<string>('');
  const getColor = (c: Currency) => c === 'gold' ? 'text-yellow-500' : c === 'silver' ? 'text-gray-300' : c === 'copper' ? 'text-orange-400' : '';
  const getName = (c: Currency) => c === 'gold' ? 'Or' : c === 'silver' ? 'Argent' : c === 'copper' ? 'Cuivre' : c;
  const act = (add: boolean) => { const n = parseInt(amount) || 0; if (n > 0) { (add ? onAdd : onSpend)(n); setAmount(''); } };
  return (
    <div className="flex items-center gap-2 h-11 relative">
      <div className={`w-16 text-center font-medium ${getColor(currency)}`}>{getName(currency)}</div>
      <div className="w-16 h-full text-center bg-gray-800/50 rounded-md flex items-center justify-center font-bold">{value}</div>
      <div className="flex-1 flex items-center justify-end gap-1">
        <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="input-dark w-20 h-11 px-2 rounded-md text-center text-base" placeholder="0" />
        <button onClick={() => act(true)} className="h-11 w-[72px] text-base text-green-500 hover:bg-green-900/30 rounded-md border border-green-500/20 hover:border-green-500/40">Ajouter</button>
        <button onClick={() => act(false)} className="h-11 w-[72px] text-base text-red-500 hover:bg-red-900/30 rounded-md border border-red-500/20 hover:border-red-500/40">Dépenser</button>
      </div>
    </div>
  );
};

export function EquipmentTab({
  player, inventory, onPlayerUpdate, onInventoryUpdate
}: EquipmentTabProps) {
  const [armor, setArmor] = useState<Equipment | null>(player.equipment?.armor || null);
  const [shield, setShield] = useState<Equipment | null>(player.equipment?.shield || null);
  const [bag, setBag] = useState<Equipment | null>(player.equipment?.bag || null);
  const stableEquipmentRef = useRef<{ armor: Equipment | null; shield: Equipment | null; bag: Equipment | null; } | null>(null);

  const refreshSeqRef = useRef(0);
  const [pendingEquipment, setPendingEquipment] = useState<Set<string>>(new Set());

  const [showList, setShowList] = useState(false);
  const [allowedKinds, setAllowedKinds] = useState<('armors' | 'shields' | 'weapons' | 'adventuring_gear' | 'tools')[] | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showWeaponsModal, setShowWeaponsModal] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState<{
    mode: 'equip' | 'unequip';
    itemId: string;
    itemName: string;
    showWarning?: boolean; // --- ADDED
  } | null>(null);

  const [editLockType, setEditLockType] = useState(false);
  const prevEditMetaRef = useRef<ItemMeta | null>(null);

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryModalType, setInventoryModalType] = useState<'armor' | 'shield'>('armor');

  const [showBagModal, setShowBagModal] = useState(false);
  const [bagText, setBagText] = useState(bag?.description || '');

  // Avertissement maîtrise (maintenu si tu veux réutiliser ailleurs)
  const [showProficiencyWarning, setShowProficiencyWarning] = useState(false);
  const [proficiencyCheck, setProficiencyCheck] = useState<WeaponProficiencyCheck | null>(null);
  const [pendingWeaponEquip, setPendingWeaponEquip] = useState<InventoryItem | null>(null);

  // --- ADDED: mémorise les maîtrises du joueur
  const playerWeaponProficiencies = useMemo(
    () => getPlayerWeaponProficiencies(player),
    [player]
  );

  useEffect(() => {
    stableEquipmentRef.current = { armor, shield, bag };
  }, [armor, shield, bag]);

  useEffect(() => {
    if (!armor && player.equipment?.armor) setArmor(player.equipment.armor);
    if (!shield && player.equipment?.shield) setShield(player.equipment.shield);
    if (!bag && player.equipment?.bag) setBag(player.equipment.bag);
  }, [player.equipment]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bag?.description) {
      setBagText(bag.description);
    }
  }, [bag]);

  // Sync initial armes
  useEffect(() => {
    const syncWeaponsFromPlayer = async () => {
      const savedWeapons = (player.equipment as any)?.weapons || [];
      if (savedWeapons.length === 0) return;

      const savedWeaponIds = new Set(savedWeapons.map((w: any) => w.inventory_item_id));
      const currentEquippedIds = new Set(
        inventory
          .filter(item => {
            const meta = parseMeta(item.description);
            return meta?.type === 'weapon' && meta.equipped;
          })
          .map(item => item.id)
      );

      const needsSync =
        savedWeaponIds.size !== currentEquippedIds.size ||
        [...savedWeaponIds].some(id => !currentEquippedIds.has(id));

      if (!needsSync) return;

      const updates: Promise<any>[] = [];
      const localUpdates: InventoryItem[] = [];

      // déséquiper
      for (const item of inventory) {
        const meta = parseMeta(item.description);
        if (meta?.type === 'weapon' && meta.equipped) {
          const nextMeta = { ...meta, equipped: false };
            const nextDesc = injectMetaIntoDescription(visibleDescription(item.description), nextMeta);
          localUpdates.push({ ...item, description: nextDesc });
          updates.push(supabase.from('inventory_items').update({ description: nextDesc }).eq('id', item.id));
        }
      }

      // rééquiper
      for (const savedWeapon of savedWeapons) {
        const item = inventory.find(i => i.id === savedWeapon.inventory_item_id);
        if (item) {
          const meta = parseMeta(item.description);
          if (meta?.type === 'weapon') {
            const nextMeta = { ...meta, equipped: true };
            const nextDesc = injectMetaIntoDescription(visibleDescription(item.description), nextMeta);

            const existingIndex = localUpdates.findIndex(u => u.id === item.id);
            if (existingIndex >= 0) {
              localUpdates[existingIndex] = { ...item, description: nextDesc };
            } else {
              localUpdates.push({ ...item, description: nextDesc });
            }

            updates.push(supabase.from('inventory_items').update({ description: nextDesc }).eq('id', item.id));
            await createOrUpdateWeaponAttack(item.name, meta.weapon, item.name);
          }
        }
      }

      if (localUpdates.length > 0) {
        const updatedInventory = inventory.map(item => {
          const updated = localUpdates.find(u => u.id === item.id);
          return updated || item;
        });
        onInventoryUpdate(updatedInventory);
      }

      if (updates.length > 0) {
        await Promise.allSettled(updates);
      }
    };

    const timeoutId = setTimeout(() => {
      if (inventory.length > 0 && (player.equipment as any)?.weapons?.length > 0) {
        syncWeaponsFromPlayer();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  
  const jewelryItems = useMemo(() => inventory.filter(i => parseMeta(i.description)?.type === 'jewelry'), [inventory]);
  const potionItems = useMemo(() => inventory.filter(i => parseMeta(i.description)?.type === 'potion'), [inventory]);

  const equippedWeapons = useMemo(() => {
    return inventory
      .map(it => ({ it, meta: parseMeta(it.description) }))
      .filter(({ meta }) => meta?.type === 'weapon' && meta?.equipped)
      .map(({ it, meta }) => ({ it, w: meta?.weapon }));
  }, [inventory]);

  const weaponsSummary: Equipment = useMemo(() => {
    const lines = equippedWeapons.map(({ it, w }) => {
      const parts: string[] = [smartCapitalize(it.name)];
      if (w?.damageDice || w?.damageType) {
        const dice = w.damageDice || '';
        const dtype = w.damageType || '';
        const fmt = [dice, dtype].filter(Boolean).join(' ');
        if (fmt) parts.push(`(${fmt})`);
      }
      return `• ${parts.join(' ')}`;
    });
    return {
      name: 'Armes équipées',
      description: lines.length ? lines.join('\n') : 'Aucune arme équipée.',
      isTextArea: true
    };
  }, [equippedWeapons]);

  const buildEquipmentSnapshot = (override?: Partial<{ armor: Equipment | null; shield: Equipment | null; bag: Equipment | null }>) => {
    const base = stableEquipmentRef.current || { armor, shield, bag };
    return {
      armor: override?.armor !== undefined ? override.armor : base.armor,
      shield: override?.shield !== undefined ? override.shield : base.shield,
      bag: override?.bag !== undefined ? override.bag : base.bag,
      potion: (player.equipment as any)?.potion ?? null,
      jewelry: (player.equipment as any)?.jewelry ?? null,
      weapon: (player.equipment as any)?.weapon ?? null
    } as any;
  };

  const saveEquipment = async (slot: 'armor' | 'shield' | 'bag', eq: Equipment | null) => {
    const snapshot = buildEquipmentSnapshot({ [slot]: eq });
    try {
      const { error } = await supabase.from('players').update({ equipment: snapshot }).eq('id', player.id);
      if (error) throw error;
      onPlayerUpdate({ ...player, equipment: snapshot });
      if (slot === 'armor') setArmor(eq);
      else if (slot === 'shield') setShield(eq);
      else if (slot === 'bag') setBag(eq);
    } catch (e) {
      console.error('Erreur saveEquipment:', e);
      throw e;
    }
  };

  const refreshInventory = async (delayMs = 0) => {
    const doFetch = async () => {
      const seq = ++refreshSeqRef.current;
      const { data, error } = await supabase.from('inventory_items').select('*').eq('player_id', player.id);
      if (seq !== refreshSeqRef.current) return;
      if (!error && data) {
        onInventoryUpdate(data);
      }
    };
    if (delayMs > 0) setTimeout(doFetch, delayMs);
    else await doFetch();
  };

useEffect(() => {
  const handler = (e: any) => {
    const pid = e?.detail?.playerId;
    if (!pid || pid === player.id) {
      refreshInventory(0);
    }
  };
  window.addEventListener('inventory:refresh', handler);
  return () => window.removeEventListener('inventory:refresh', handler);
}, [player.id]);

  const notifyAttacksChanged = () => {
    try { window.dispatchEvent(new CustomEvent('attacks:changed', { detail: { playerId: player.id } })); } catch {}
  };

  const createOrUpdateWeaponAttack = async (name: string, w?: WeaponMeta | null, weaponName?: string) => {
  try {
    const attacks = await attackService.getPlayerAttacks(player.id);
    const existing = attacks.find(a => norm(a.name) === norm(name));

    const explicitCategory = w?.category;
    const weaponProperties = w?.properties;
    const proficiencyResult = checkWeaponProficiency(weaponName || name, playerWeaponProficiencies, explicitCategory, weaponProperties);

      // ✅ DEBUG LOGS
    console.log('🔧 [EquipmentTab] createOrUpdateWeaponAttack:', {
      name,
      weaponMeta: w,
      'w?.weapon_bonus': w?.weapon_bonus,
      'existing?.weapon_bonus': existing?.weapon_bonus
    });

    // ✅ CORRECTION : Extraire weapon_bonus depuis w ou conserver celui existant
    const weaponBonus = w?.weapon_bonus !== undefined && w?.weapon_bonus !== null 
      ? w.weapon_bonus 
      : (existing?.weapon_bonus ?? null);

    console.log('🔧 [EquipmentTab] weaponBonus final:', weaponBonus);

    const payload = {
      player_id: player.id,
      name,
      damage_dice: w?.damageDice || '1d6',
      damage_type: w?.damageType || 'Tranchant',
      range: w?.range || 'Corps à corps',
      properties: w?.properties || '',
      manual_attack_bonus: null,
      manual_damage_bonus: null,
      expertise: proficiencyResult.shouldApplyProficiencyBonus,
      attack_type: 'physical' as const,
      spell_level: null as any,
      ammo_count: (existing as any)?.ammo_count ?? 0,
      weapon_bonus: weaponBonus
    };

    console.log('🔧 [EquipmentTab] payload envoyé:', payload);

    if (existing) {
      await attackService.updateAttack({ ...payload, id: existing.id });
    } else {
      await attackService.addAttack(payload);
    }
    notifyAttacksChanged();
  } catch (err) {
    console.error('Création/mise à jour attaque échouée', err);
  }
};

  const removeWeaponAttacksByName = async (name: string) => {
    try {
      const attacks = await attackService.getPlayerAttacks(player.id);
      const toDelete = attacks.filter(a => norm(a.name) === norm(name));
      if (toDelete.length === 0) return;
      await Promise.allSettled(toDelete.map(a => attackService.removeAttack(a.id)));
      notifyAttacksChanged();
    } catch (e) { console.error('Suppression attaques (déséquipement) échouée', e); }
  };

  const updateItemMetaComplete = async (item: InventoryItem, nextMeta: ItemMeta) => {
    const nextDesc = injectMetaIntoDescription(visibleDescription(item.description), nextMeta);
    const updatedInventory = inventory.map(it =>
      it.id === item.id
        ? { ...it, description: nextDesc }
        : it
    );
    onInventoryUpdate(updatedInventory);
    const { error } = await supabase.from('inventory_items').update({ description: nextDesc }).eq('id', item.id);
    if (error) throw error;
  };

  const unequipOthersOfType = async (type: 'armor' | 'shield', keepItemId?: string) => {
    const updates: Promise<any>[] = [];
    const localUpdates: InventoryItem[] = [];

    for (const it of inventory) {
      const meta = parseMeta(it.description);
      if (!meta) continue;
      if ((type === 'armor' && meta.type === 'armor') || (type === 'shield' && meta.type === 'shield')) {
        if (it.id !== keepItemId && meta.equipped) {
          const next = { ...meta, equipped: false };
          const nextDesc = injectMetaIntoDescription(visibleDescription(it.description), next);
          localUpdates.push({ ...it, description: nextDesc });
          updates.push(supabase.from('inventory_items').update({ description: nextDesc }).eq('id', it.id));
        }
      }
    }

    if (localUpdates.length > 0) {
      const updatedInventory = inventory.map(it => {
        const updated = localUpdates.find(u => u.id === it.id);
        return updated || it;
      });
      onInventoryUpdate(updatedInventory);
    }

    if (updates.length) await Promise.allSettled(updates);
  };

 
  // ----------- Équipement effectif -----------
 const performEquipToggle = async (freshItem: InventoryItem, mode: 'equip' | 'unequip') => {
  const meta = parseMeta(freshItem.description);
  if (!meta) return;
  
  // ✅ NOUVEAU : Calculer isEquippableItem ici (accessible dans toute la fonction)
  const hasBonuses = meta?.bonuses && Object.keys(meta.bonuses).length > 0;
  const isEquippableItem = hasBonuses && 
    (meta?.type === 'jewelry' || meta?.type === 'equipment' || 
     meta?.type === 'tool' || meta?.type === 'other');
  
  try {
    setPendingEquipment(prev => new Set([...prev, freshItem.id]));

      if (meta.type === 'armor') {
        if (mode === 'unequip' && armor?.inventory_item_id === freshItem.id) {
          await updateItemMetaComplete(freshItem, { ...meta, equipped: false });
          await saveEquipment('armor', null);
          toast.success('Armure déséquipée');
        } else if (mode === 'equip') {
          await unequipOthersOfType('armor', freshItem.id);
          const eq: Equipment = {
            name: freshItem.name,
            description: visibleDescription(freshItem.description),
            inventory_item_id: freshItem.id,
            armor_formula: meta.armor ? { base: meta.armor.base, addDex: meta.armor.addDex, dexCap: meta.armor.dexCap ?? null, label: meta.armor.label } : null,
            shield_bonus: null,
            weapon_meta: null,
          };
          await updateItemMetaComplete(freshItem, { ...meta, equipped: true });
          await saveEquipment('armor', eq);
          toast.success('Armure équipée');
        }
      } else if (meta.type === 'shield') {
        if (mode === 'unequip' && shield?.inventory_item_id === freshItem.id) {
          await updateItemMetaComplete(freshItem, { ...meta, equipped: false });
          await saveEquipment('shield', null);
          toast.success('Bouclier déséquipé');
        } else if (mode === 'equip') {
          await unequipOthersOfType('shield', freshItem.id);
          const eq: Equipment = {
            name: freshItem.name,
            description: visibleDescription(freshItem.description),
            inventory_item_id: freshItem.id,
            shield_bonus: meta.shield?.bonus ?? null,
            armor_formula: null,
            weapon_meta: null,
          };
          await updateItemMetaComplete(freshItem, { ...meta, equipped: true });
          await saveEquipment('shield', eq);
          toast.success('Bouclier équipé');
        }
      } else if (meta.type === 'weapon') {
  const targetEquipped = mode === 'equip';
  if (meta.equipped === targetEquipped) return;

  const explicitCategory = meta.weapon?.category;
  const weaponProperties = meta.weapon?.properties;
  const proficiencyResult = checkWeaponProficiency(freshItem.name, playerWeaponProficiencies, explicitCategory, weaponProperties);
  const nextMeta = { ...meta, equipped: targetEquipped, forced: !proficiencyResult.isProficient && targetEquipped };
  await updateItemMetaComplete(freshItem, nextMeta);

  const currentWeapons = (player.equipment as any)?.weapons || [];
  let updatedWeapons;

  if (targetEquipped) {
    // ✅ CORRECTION : Extraire weapon_bonus depuis meta.weapon
    console.log('🔍 [EquipmentTab] Avant createOrUpdateWeaponAttack:', {
      itemName: freshItem.name,
      'meta.weapon': meta?.weapon,
      'meta.weapon?.weapon_bonus': meta?.weapon?.weapon_bonus
    });

    const weaponData = {
      inventory_item_id: freshItem.id,
      name: freshItem.name,
      description: visibleDescription(freshItem.description),
      weapon_meta: meta.weapon || null
    };
          updatedWeapons = [...currentWeapons.filter((w: any) => w.inventory_item_id !== freshItem.id), weaponData];

     // ✅ CORRECTION : Passer meta.weapon complet (incluant weapon_bonus)
const weaponMetaToPass: WeaponMeta | null = meta.weapon ? {
  damageDice: meta.weapon.damageDice || '1d6',
  damageType: meta.weapon.damageType || 'Tranchant',
  properties: meta.weapon.properties || '',
  range: meta.weapon.range || 'Corps à corps',
  category: meta.weapon.category,
  weapon_bonus: meta.weapon.weapon_bonus ?? null  // ✅ EXTRACTION DU BONUS
} : null;

await createOrUpdateWeaponAttack(freshItem.name, weaponMetaToPass, freshItem.name);

          if (proficiencyResult.shouldApplyProficiencyBonus) {
            toast.success('Arme équipée avec bonus de maîtrise');
          } else {
            toast.success('Arme équipée (sans bonus de maîtrise)', {
              duration: 4000,
              icon: '⚠️'
            });
          }
        } else {
          updatedWeapons = currentWeapons.filter((w: any) => w.inventory_item_id !== freshItem.id);
          await removeWeaponAttacksByName(freshItem.name);
          toast.success('Arme déséquipée');
        }

        const updatedEquipment = {
          ...player.equipment,
          weapons: updatedWeapons
        };

        try {
          const { error } = await supabase
            .from('players')
            .update({ equipment: updatedEquipment })
            .eq('id', player.id);
          if (error) throw error;
          onPlayerUpdate({
            ...player,
            equipment: updatedEquipment
          });
        } catch (weaponSaveError) {
          console.error('Erreur sauvegarde armes équipées:', weaponSaveError);
        }
  } else if (isEquippableItem) {
        // ✅ NOUVEAU : Gestion équipement/bijoux/outils/autres avec bonus
        if (mode === 'unequip' && meta.equipped) {
          await updateItemMetaComplete(freshItem, { ...meta, equipped: false });
          
          // ✅ NOUVEAU : Notifier le changement d'inventaire pour mettre à jour les stats
          try {
            window.dispatchEvent(
              new CustomEvent('inventory:refresh', { detail: { playerId: player.id } })
            );
          } catch (e) {
            console.warn('[performEquipToggle] dispatch inventory:refresh failed', e);
          }
          
          const itemTypeName = 
            meta.type === 'jewelry' ? 'Bijou' : 
            meta.type === 'equipment' ? 'Équipement' : 
            meta.type === 'tool' ? 'Outil' : 'Objet';
          toast.success(`${itemTypeName} déséquipé`);
        } else if (mode === 'equip' && !meta.equipped) {
          await updateItemMetaComplete(freshItem, { ...meta, equipped: true });
          
          // ✅ NOUVEAU : Notifier le changement d'inventaire pour mettre à jour les stats
          try {
            window.dispatchEvent(
              new CustomEvent('inventory:refresh', { detail: { playerId: player.id } })
            );
          } catch (e) {
            console.warn('[performEquipToggle] dispatch inventory:refresh failed', e);
          }
          
          const itemTypeName = 
            meta.type === 'jewelry' ? 'Bijou' : 
            meta.type === 'equipment' ? 'Équipement' : 
            meta.type === 'tool' ? 'Outil' : 'Objet';
          toast.success(`${itemTypeName} équipé`);
        }
      }
    } catch (e) {
      console.error('Erreur performEquipToggle:', e);
      await refreshInventory(0);
      toast.error('Erreur lors de la bascule équipement');
    } finally {
      setPendingEquipment(prev => {
        const next = new Set(prev);
        next.delete(freshItem.id);
        return next;
      });
    }
  };

  // ----------- performToggle (AVERTISSEMENT NON BLOQUANT) -----------
  // --- CHANGED: on ne déclenche plus le WeaponProficiencyWarningModal ici pour éviter double overlay
  const performToggle = async (item: InventoryItem, mode: 'equip' | 'unequip') => {
    if (pendingEquipment.has(item.id)) return;

    const freshItem = inventory.find(i => i.id === item.id);
    if (!freshItem) {
      toast.error("Objet introuvable");
      return;
    }
    const meta = parseMeta(freshItem.description);
    if (!meta) {
      toast.error("Métadonnées manquantes");
      return;
    }

    await performEquipToggle(freshItem, mode);
  };

  const handleProficiencyWarningConfirm = () => {
    setShowProficiencyWarning(false);
    setPendingWeaponEquip(null);
    setProficiencyCheck(null);
  };
  const handleProficiencyWarningCancel = () => {
    setShowProficiencyWarning(false);
    setPendingWeaponEquip(null);
    setProficiencyCheck(null);
  };

   const requestToggleWithConfirm = (item: InventoryItem) => {
    if (pendingEquipment.has(item.id)) return;
    const freshItem = inventory.find(i => i.id === item.id);
    if (!freshItem) {
      toast.error("Objet introuvable");
      return;
    }
    const meta = parseMeta(freshItem.description);
    if (!meta) return toast.error("Objet sans métadonnées. Ouvrez Paramètres et précisez sa nature.");

    const isArmor = meta.type === 'armor';
    const isShield = meta.type === 'shield';
    const isWeapon = meta.type === 'weapon';

    // ✅ NOUVEAU : Détecter les objets équipables avec bonus
    const hasBonuses = meta?.bonuses && Object.keys(meta.bonuses).length > 0;
    const isEquippableItem = hasBonuses && 
      (meta?.type === 'jewelry' || meta?.type === 'equipment' || 
       meta?.type === 'tool' || meta?.type === 'other');

    // ✅ DEBUG : Log pour comprendre l'état
    console.log('🔧 [requestToggleWithConfirm]', {
      itemName: freshItem.name,
      type: meta.type,
      hasBonuses,
      isEquippableItem,
      currentEquipped: meta.equipped
    });

    const equipped =
      (isArmor && armor?.inventory_item_id === freshItem.id) ||
      (isShield && shield?.inventory_item_id === freshItem.id) ||
      (isWeapon && meta.equipped === true) ||
      (isEquippableItem && meta.equipped === true); // ✅ AJOUT : Vérifier l'état équipé pour les items avec bonus

    // ✅ DEBUG : Afficher le mode qui sera utilisé
    console.log('🔧 [requestToggleWithConfirm] État calculé:', {
      equipped,
      mode: equipped ? 'unequip' : 'equip'
    });

    // --- ADDED: calc maîtrise pour affichage dans le modal
    let showWarning = false;
    if (isWeapon && !equipped) {
      try {
        const explicitCategory = meta.weapon?.category;
        const weaponProperties = meta.weapon?.properties;
        const result = checkWeaponProficiency(freshItem.name, playerWeaponProficiencies, explicitCategory, weaponProperties);
        showWarning = !result.isProficient;
      } catch {}
    }

    setConfirmPayload({
      mode: equipped ? 'unequip' : 'equip',
      itemId: freshItem.id,
      itemName: freshItem.name,
      showWarning
    });
    setConfirmOpen(true);
  };

  const openEditFromSlot = (slot: 'armor' | 'shield') => {
    const eq = slot === 'armor' ? armor : shield;
    if (!eq?.inventory_item_id) return;
    const item = inventory.find(i => i.id === eq.inventory_item_id);
    if (item) {
      setEditLockType(true);
      prevEditMetaRef.current = parseMeta(item.description) || null;
      setEditingItem(item);
    }
  };
  const toggleFromSlot = (slot: 'armor' | 'shield') => {
    const eq = slot === 'armor' ? armor : shield;
    if (!eq) return;
    const item = eq.inventory_item_id ? inventory.find(i => i.id === eq.inventory_item_id) : undefined;
    if (!item) return;
    setConfirmPayload({ mode: 'unequip', itemId: item.id, itemName: item.name });
    setConfirmOpen(true);
  };

  // Sac / filtres
  const [bagFilter, setBagFilter] = useState('');
  const [bagKinds, setBagKinds] = useState<Record<MetaType, boolean>>({
    armor: true, shield: true, weapon: true, equipment: true, potion: true, jewelry: true, tool: true, other: true
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
// ✅ CORRECTION : Tri par date de création (nouveaux objets en haut)
const filteredInventory = useMemo(() => {
  const q = bagFilter.trim().toLowerCase();
  return inventory
    .filter(i => {
      const meta = parseMeta(i.description);
      const kind: MetaType = (meta?.type || 'equipment') as MetaType;
      if (!bagKinds[kind]) return false;
      if (!q) return true;
      const name = stripPriceParentheses(i.name).toLowerCase();
      const desc = visibleDescription(i.description).toLowerCase();
      return name.includes(q) || desc.includes(q);
    })
    .sort((a, b) => {
      // ✅ Tri par date de création (plus récent en premier)
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // Décroissant = nouveaux en haut
    });
}, [inventory, bagFilter, bagKinds]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const jewelryText = jewelryItems.length ? jewelryItems.map(i => `• ${smartCapitalize(i.name)}`).join('\n') : 'Aucun bijou dans le sac.';
  const potionText = potionItems.length ? potionItems.map(i => `• ${smartCapitalize(i.name)}`).join('\n') : 'Aucune potion/poison dans le sac.';

  return (
    <div className="space-y-6">
      {/* Silhouette + slots */}
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
              onRequestOpenList={() => { setInventoryModalType('armor'); setShowInventoryModal(true); }}
              onToggleEquipFromSlot={() => toggleFromSlot('armor')}
              onOpenEditFromSlot={() => openEditFromSlot('armor')}
              isEquipped={!!armor}
              inventory={inventory}
            />

            <EquipmentSlot
              icon={<ShieldIcon size={24} className="text-blue-500" />}
              position="top-[50%] left-[15%]"
              equipment={shield || null}
              type="shield"
              onRequestOpenList={() => { setInventoryModalType('shield'); setShowInventoryModal(true); }}
              onToggleEquipFromSlot={() => toggleFromSlot('shield')}
              onOpenEditFromSlot={() => openEditFromSlot('shield')}
              isEquipped={!!shield}
              inventory={inventory}
            />

            <EquipmentSlot
              icon={<Sword size={24} className="text-red-500" />}
              position="top-[50%] right-[15%]"
              equipment={weaponsSummary}
              type="weapon"
              onRequestOpenList={() => { setAllowedKinds(['weapons']); setShowList(true); }}
              onToggleEquipFromSlot={() => {}}
              onOpenEditFromSlot={() => {}}
              onOpenWeaponsManageFromSlot={() => setShowWeaponsModal(true)}
              isEquipped={equippedWeapons.length > 0}
              inventory={inventory}
            />

            <EquipmentSlot
              icon={<Flask size={24} className="text-green-500" />}
              position="top-[5%] right-[5%]"
              equipment={{ name: 'Potions et poisons', description: potionText, isTextArea: true }}
              type="potion"
              onRequestOpenList={() => { setAllowedKinds(null); setShowList(true); }}
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
              onRequestOpenList={() => { setAllowedKinds(null); setShowList(true); }}
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
              onRequestOpenList={() => { setAllowedKinds(null); setShowList(true); }}
              onToggleEquipFromSlot={() => {}}
              onOpenEditFromSlot={() => {}}
              onOpenBagModal={() => setShowBagModal(true)}
              isEquipped={false}
              bagText={bagText}
              inventory={inventory}
            />
          </div>
        </div>
      </div>

      {/* Argent */}
      <div className="stat-card">
        <div className="stat-header flex items-center gap-3">
          <Coins className="text-green-500" size={24} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Mon argent</h2>
        </div>
        <div className="p-4 space-y-2">
          {(['gold','silver','copper'] as Currency[]).map(curr => (
            <CurrencyInput
              key={curr}
              currency={curr}
              value={player[curr] as number}
              onAdd={async (n) => {
                const newAmount = Math.max(0, (player[curr] as number) + n);
                try {
                  const { error } = await supabase.from('players').update({ [curr]: newAmount }).eq('id', player.id);
                  if (error) throw error;
                  onPlayerUpdate({ ...player, [curr]: newAmount } as any);
                  toast.success(`Ajout de ${n} ${curr}`);
                } catch (e) { toast.error('Erreur lors de la mise à jour'); }
              }}
              onSpend={async (n) => {
                const newAmount = Math.max(0, (player[curr] as number) - n);
                try {
                  const { error } = await supabase.from('players').update({ [curr]: newAmount }).eq('id', player.id);
                  if (error) throw error;
                  onPlayerUpdate({ ...player, [curr]: newAmount } as any);
                  toast.success(`Retrait de ${n} ${curr}`);
                } catch (e) { toast.error('Erreur lors de la mise à jour'); }
              }}
            />
          ))}
        </div>
      </div>

      {/* Sac */}
      <div className="stat-card">
        <div className="stat-header flex items-center gap-3">
          <Backpack className="text-purple-500" size={24} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Sac</h2>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={() => { setAllowedKinds(null); setShowList(true); }} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={20} /> Liste d'équipement</button>
            <button onClick={() => setShowCustom(true)} className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2"><Plus size={18} /> Objet personnalisé</button>

            <div className="ml-auto flex items-center gap-2 min-w-[240px] flex-1">
              <button
                onClick={() => setFiltersOpen(true)}
                className="px-3 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2"
              >
                <FilterIcon size={16} /> Filtres
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input value={bagFilter} onChange={(e) => setBagFilter(e.target.value)} placeholder="Filtrer le sac…" className="input-dark px-3 py-2 rounded-md w-full" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
          {filteredInventory.map(item => {
  const meta = parseMeta(item.description);
  const qty = meta?.quantity ?? 1;
  const isArmor = meta?.type === 'armor';
  const isShield = meta?.type === 'shield';
  const isWeapon = meta?.type === 'weapon';
  
  // ✅ NOUVEAU : Détecter si l'objet a des bonus (devient équipable)
  const hasBonuses = meta?.bonuses && Object.keys(meta.bonuses).length > 0;
  const isEquippableItem = hasBonuses && 
    (meta?.type === 'jewelry' || meta?.type === 'equipment' || 
     meta?.type === 'tool' || meta?.type === 'other');
  
  const isEquipped =
    (isArmor && armor?.inventory_item_id === item.id) ||
    (isShield && shield?.inventory_item_id === item.id) ||
    (isWeapon && meta?.equipped === true) ||
    (isEquippableItem && meta?.equipped === true);

              // --- ADDED: calcul maîtrise arme
              let weaponProficiency: WeaponProficiencyCheck | null = null;
              if (isWeapon) {
                try {
                  const explicitCategory = meta?.weapon?.category;
                  const weaponProperties = meta?.weapon?.properties;
                  weaponProficiency = checkWeaponProficiency(item.name, playerWeaponProficiencies, explicitCategory, weaponProperties);
                } catch {}
              }
              const notProficient = isWeapon && weaponProficiency && !weaponProficiency.isProficient;

              // --- ADDED: label dynamique avec ⚠
              const buttonLabel = pendingEquipment.has(item.id)
                ? 'En cours...'
                : isEquipped
                  ? (notProficient ? 'Équipé ⚠' : 'Équipé')
                  : (notProficient ? 'Équiper ⚠' : 'Non équipé');

              const buttonTitle = pendingEquipment.has(item.id)
                ? 'Traitement en cours...'
                : isEquipped
                  ? (notProficient ? 'Arme équipée sans maîtrise (cliquer pour déséquiper)' : 'Cliquer pour déséquiper')
                  : (notProficient ? 'Arme non maîtrisée (bonus de maîtrise absent) – cliquer pour équiper' : 'Cliquer pour équiper');

              return (
                <div key={item.id} className="bg-gray-800/40 border border-gray-700/40 rounded-md">
<div className="flex items-start justify-between p-2">
  <div className="flex-1 mr-2">
<div className="flex items-center gap-2 flex-wrap">
  <button onClick={() => toggleExpand(item.id)} className="text-left text-gray-100 font-medium hover:underline break-words inline">
    {smartCapitalize(item.name)}
  </button>
  {qty > 1 && <span className="text-xs px-2 py-0.5 rounded bg-gray-700/60 text-gray-300 whitespace-nowrap">x{qty}</span>}
  {isArmor && <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 whitespace-nowrap">Armure</span>}
  {isShield && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 whitespace-nowrap">Bouclier</span>}
  {isWeapon && <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 whitespace-nowrap">Arme</span>}
  {meta?.type === 'equipment' && <span className="text-xs px-2 py-0.5 rounded bg-gray-800/60 text-gray-300 whitespace-nowrap">Équipement</span>}
  {meta?.type === 'tool' && <span className="text-xs px-2 py-0.5 rounded bg-teal-900/30 text-teal-300 whitespace-nowrap">Outil</span>}
  {meta?.type === 'jewelry' && <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/30 text-yellow-300 whitespace-nowrap">Bijou</span>}
  {meta?.type === 'potion' && <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-300 whitespace-nowrap">Potion/Poison</span>}
  {meta?.type === 'other' && <span className="text-xs px-2 py-0.5 rounded bg-slate-900/30 text-slate-300 whitespace-nowrap">Autre</span>}
</div>
{expanded[item.id] && (
  <div className="mt-2 space-y-2">
    {/* ✅ Image en grand quand dépliée */}
    {meta?.imageUrl && (
      <div className="mb-3">
        <img
          src={meta.imageUrl}
          alt={item.name}
          className="w-full max-w-sm rounded-lg border border-gray-600/50 shadow-lg"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    )}
    
  {/* Propriétés techniques pour armure/bouclier/arme */}
{(isArmor || isShield || isWeapon) && (
  <div className="text-xs text-gray-400 space-y-0.5">
    {isArmor && meta?.armor && <div>CA: {meta.armor.label}</div>}
    {isShield && meta?.shield && <div>Bonus de bouclier: +{meta.shield.bonus}</div>}
    {isWeapon && meta?.weapon && (
      <>
        <div>Dégâts: {meta.weapon.damageDice} {meta.weapon.damageType}</div>
        {meta.weapon.properties && <div>Propriété: {meta.weapon.properties}</div>}
        {meta.weapon.range && <div>Portée: {meta.weapon.range}</div>}
        {notProficient && (
          <div className="text-[10px] text-amber-300 mt-1">
            Non maîtrisée : bonus de maîtrise non appliqué.
          </div>
        )}
      </>
    )}
  </div>
)}

{/* ✅ NOUVEAU : Affichage des bonus pour jewelry/equipment/tool/other */}
{hasBonuses && meta?.bonuses && (
  <div className="text-xs text-gray-400 space-y-0.5 mt-2 pt-2 border-t border-gray-700/30">
    <div className="font-medium text-gray-300 mb-1">Bonus :</div>
    {meta.bonuses.strength && <div>Force: {meta.bonuses.strength >= 0 ? '+' : ''}{meta.bonuses.strength}</div>}
    {meta.bonuses.dexterity && <div>Dextérité: {meta.bonuses.dexterity >= 0 ? '+' : ''}{meta.bonuses.dexterity}</div>}
    {meta.bonuses.constitution && <div>Constitution: {meta.bonuses.constitution >= 0 ? '+' : ''}{meta.bonuses.constitution}</div>}
    {meta.bonuses.intelligence && <div>Intelligence: {meta.bonuses.intelligence >= 0 ? '+' : ''}{meta.bonuses.intelligence}</div>}
    {meta.bonuses.wisdom && <div>Sagesse: {meta.bonuses.wisdom >= 0 ? '+' : ''}{meta.bonuses.wisdom}</div>}
    {meta.bonuses.charisma && <div>Charisme: {meta.bonuses.charisma >= 0 ? '+' : ''}{meta.bonuses.charisma}</div>}
    {meta.bonuses.armor_class && <div>Classe d'Armure: {meta.bonuses.armor_class >= 0 ? '+' : ''}{meta.bonuses.armor_class}</div>}
  </div>
)}
    
{/* Description visible (tous types) */}
{(() => {
  const desc = visibleDescription(item.description);
  return desc ? (
    <div className="text-sm text-gray-300 whitespace-pre-wrap mt-2">
      {desc}
    </div>
  ) : null;
})()}
  </div>
)}
                    </div>

                 <div className="flex items-center gap-2">
  {(isArmor || isShield || isWeapon || isEquippableItem) && (
    <button
      onClick={() => requestToggleWithConfirm(item)}
      disabled={pendingEquipment.has(item.id)}
      className={`px-2 py-1 rounded text-xs border ${
        pendingEquipment.has(item.id)
          ? 'border-gray-500 text-gray-500 bg-gray-800/50 cursor-not-allowed'
          : isEquipped
            ? (notProficient
              ? 'border-amber-500/40 text-amber-300 bg-amber-900/20'
              : 'border-green-500/40 text-green-300 bg-green-900/20')
            : (notProficient
              ? 'border-amber-500/40 text-amber-300 hover:bg-amber-900/20'
              : 'border-gray-600 text-gray-300 hover:bg-gray-700/40')
      }`}
      title={buttonTitle}
    >
      {buttonLabel}
    </button>
  )}
                      <button
                        onClick={() => {
                          setEditLockType(false);
                          prevEditMetaRef.current = parseMeta(item.description) || null;
                          setEditingItem(item);
                        }}
                        className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 rounded-full"
                        title="Paramètres"
                      >
                        <Settings size={16} />
                      </button>
                      <button onClick={() => {
                        if (!window.confirm('Supprimer cet objet ?')) return;
                        (async () => {
                          try {
                            const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
                            if (error) throw error;
                            onInventoryUpdate(inventory.filter(i => i.id !== item.id));
                            toast.success('Objet supprimé');
                          } catch (e) {
                            console.error(e);
                            toast.error('Erreur suppression');
                          }
                        })();
                      }} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-900/30 rounded-full" title="Supprimer l'objet">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

{/* Modals ajout / custom / édition */}
{showList && (
  <EquipmentListModal
    onClose={() => { setShowList(false); setAllowedKinds(null); }}
    onAddItem={async (payload) => {
      try {
        const meta: ItemMeta = { ...(payload.meta as any), equipped: false };
        const finalDesc = injectMetaIntoDescription(payload.description || '', meta);
        const { data, error } = await supabase
          .from('inventory_items')
          .insert([{
            player_id: player.id,
            name: smartCapitalize(payload.name),
            description: finalDesc
          }])
          .select()
          .single();
        if (error) throw error;
        if (data) onInventoryUpdate([...inventory, data]);
        // ✅ Supprimé : toast.success('Équipement ajouté');
      } catch (e) {
        console.error(e);
        toast.error('Erreur ajout équipement');
      } finally {
        setShowList(false);
        setAllowedKinds(null);
      }
    }}
    allowedKinds={allowedKinds}
  />
      )}
      {showCustom && (
        <CustomItemModal
          onClose={() => setShowCustom(false)}
          onAdd={async (payload) => {
            try {
              const finalDesc = injectMetaIntoDescription(payload.description || '', { ...payload.meta, equipped: false });
              const { data, error } = await supabase
                .from('inventory_items')
                .insert([{
                  player_id: player.id,
                  name: smartCapitalize(payload.name),
                  description: finalDesc
                }])
                .select()
                .single();
              if (error) throw error;
              if (data) onInventoryUpdate([...inventory, data]);
              toast.success('Objet personnalisé ajouté');
            } catch (e) {
              console.error(e);
              toast.error('Erreur ajout objet');
            } finally {
              setShowCustom(false);
            }
          }}
        />
      )}
{editingItem && (
  <InventoryItemEditModal
    item={editingItem}
    lockType={editLockType}
    onInventoryUpdate={onInventoryUpdate}
    inventory={inventory}
    onClose={() => {
      // Recharge depuis la BDD pour refléter immédiatement les changements
      refreshInventory(0);
      setEditingItem(null);
      setEditLockType(false);
      prevEditMetaRef.current = null;
    }}
    onSaved={() => {
      // Recharge depuis la BDD pour garantir la persistance visible
      refreshInventory(0);
      setEditingItem(null);
      setEditLockType(false);
      prevEditMetaRef.current = null;
    }}
  />
)}

      {showWeaponsModal && (
        <WeaponsManageModal
          inventory={inventory}
          onClose={() => setShowWeaponsModal(false)}
          onEquip={(it) => performToggle(it, 'equip')}
          onUnequip={(it) => performToggle(it, 'unequip')}
          player={player}
        />
      )}

      <ConfirmEquipModal
        open={confirmOpen}
        mode={confirmPayload?.mode || 'equip'}
        itemName={confirmPayload?.itemName || ''}
        showWarning={confirmPayload?.showWarning}
        onCancel={() => { setConfirmOpen(false); setConfirmPayload(null); }}
        onConfirm={async () => {
          if (!confirmPayload) return;
          setConfirmOpen(false);
          const latest = inventory.find(i => i.id === confirmPayload.itemId);
          if (!latest) { toast.error("Objet introuvable"); setConfirmPayload(null); return; }
          await performToggle(latest, confirmPayload.mode);
          setConfirmPayload(null);
        }}
      />

      {showInventoryModal && (
        <InventoryEquipmentModal
          onClose={() => setShowInventoryModal(false)}
          onEquipItem={async (item) => {
            setShowInventoryModal(false);
            await performToggle(item, 'equip');
          }}
          inventory={inventory}
          equipmentType={inventoryModalType}
        />
      )}

      {showBagModal && (
        <div className="fixed inset-0 z-[11000]" onClick={(e) => { if (e.target === e.currentTarget) setShowBagModal(false); }}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] bg-gray-900/95 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Backpack size={20} className="text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-100">Contenu du sac à dos</h3>
              </div>
              <button onClick={() => setShowBagModal(false)} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4">
              <textarea
                placeholder="Listez ici le contenu de votre sac à dos..."
                value={bagText}
                onChange={(e) => setBagText(e.target.value)}
                className="input-dark w-full px-3 py-2 rounded-md"
                rows={8}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBagModal(false)}
                className="btn-secondary px-4 py-2 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  try {
                    const bagEquipment = {
                      name: 'Sac à dos',
                      description: bagText,
                      isTextArea: true
                    };
                    const { error } = await supabase
                      .from('players')
                      .update({
                        equipment: {
                          ...player.equipment,
                          bag: bagEquipment
                        }
                      })
                      .eq('id', player.id);
                    if (error) throw error;
                    setBag(bagEquipment);
                    onPlayerUpdate({
                      ...player,
                      equipment: {
                        ...player.equipment,
                        bag: bagEquipment
                      }
                    });
                    toast.success('Contenu du sac sauvegardé');
                    setShowBagModal(false);
                  } catch (error) {
                    console.error('Erreur lors de la sauvegarde du sac:', error);
                    toast.error('Erreur lors de la sauvegarde');
                  }
                }}
                className="btn-primary px-4 py-2 rounded-lg"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {filtersOpen && (
        <div className="fixed inset-0 z-[11000]" onClick={(e) => { if (e.target === e.currentTarget) setFiltersOpen(false); }}>
          <div className="fixed inset-0 bg-black/60" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(22rem,92vw)] bg-gray-900/95 border border-gray-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-gray-100 font-semibold">Filtres du sac</h4>
              <button onClick={() => setFiltersOpen(false)} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg" aria-label="Fermer">
                <X />
              </button>
            </div>
            <div className="space-y-1">
              {(['armor','shield','weapon','equipment','potion','jewelry','tool','other'] as MetaType[]).map(k => (
                <label key={k} className="flex items-center justify-between text-sm text-gray-200 px-2 py-1 rounded hover:bg-gray-800/60 cursor-pointer">
                  <span>
                    {k === 'armor' ? 'Armure'
                      : k === 'shield' ? 'Bouclier'
                      : k === 'weapon' ? 'Arme'
                      : k === 'potion' ? 'Potion/Poison'
                      : k === 'jewelry' ? 'Bijoux'
                      : k === 'tool' ? 'Outils'
                      : k === 'other' ? 'Autre' : 'Équipement'}
                  </span>
                  <input
                    type="checkbox"
                    className="accent-red-500"
                    checked={bagKinds[k]}
                    onChange={() => setBagKinds(prev => ({ ...prev, [k]: !prev[k] }))}
                  />
                </label>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button onClick={() => setFiltersOpen(false)} className="btn-primary px-3 py-2 rounded-lg">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Garde le modal d’avertissement si tu veux l’activer ailleurs */}
      <WeaponProficiencyWarningModal
        isOpen={showProficiencyWarning}
        weaponName={pendingWeaponEquip?.name || ''}
        proficiencyCheck={proficiencyCheck!}
        onConfirm={handleProficiencyWarningConfirm}
        onCancel={handleProficiencyWarningCancel}
      />
    </div>
  );
}