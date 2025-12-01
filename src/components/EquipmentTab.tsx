import React, { useMemo, useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { attackService } from '../services/attackService';
import { Player, InventoryItem } from '../types/dnd';

import { EquipmentListModal } from './modals/EquipmentListModal';
import { CustomItemModal } from './modals/CustomItemModal';
import { InventoryItemEditModal } from './modals/InventoryItemEditModal';
import { WeaponsManageModal } from './modals/WeaponsManageModal';
import { InventoryEquipmentModal } from './modals/InventoryEquipmentModal';
import { WeaponProficiencyWarningModal } from './modals/WeaponProficiencyWarningModal';

import { GoldManager } from './Equipment/GoldManager';
import { EquipmentSlots } from './Equipment/EquipmentSlots';
import { InventoryList } from './Equipment/InventoryList';

import { checkWeaponProficiency, getPlayerWeaponProficiencies, WeaponProficiencyCheck } from '../utils/weaponProficiencyChecker';

// ========== HELPERS POUR LE CALCUL DE LA CA ==========

const getModifier = (score: number): number => Math.floor((score - 10) / 2);

/**
 * Calcule les bonus d'équipement à partir de l'inventaire
 */
const calculateEquipmentBonuses = (inventory: InventoryItem[]): {
  Force: number;
  Dextérité: number;
  Constitution: number;
  Intelligence: number;
  Sagesse: number;
  Charisme: number;
  armor_class: number;
} => {
  const bonuses = {
    Force: 0,
    Dextérité: 0,
    Constitution: 0,
    Intelligence: 0,
    Sagesse: 0,
    Charisme: 0,
    armor_class: 0
  };

  for (const item of inventory) {
    const meta = parseMeta(item. description);
    if (meta?. equipped && meta.bonuses) {
      if (meta.bonuses.strength) bonuses.Force += meta.bonuses.strength;
      if (meta.bonuses.dexterity) bonuses. Dextérité += meta.bonuses.dexterity;
      if (meta.bonuses. constitution) bonuses. Constitution += meta.bonuses.constitution;
      if (meta. bonuses.intelligence) bonuses.Intelligence += meta.bonuses. intelligence;
      if (meta.bonuses.wisdom) bonuses.Sagesse += meta.bonuses. wisdom;
      if (meta.bonuses.charisma) bonuses.Charisme += meta.bonuses.charisma;
      if (meta.bonuses. armor_class) bonuses.armor_class += meta.bonuses.armor_class;
    }
  }

  return bonuses;
};

/**
 * Récupère le modificateur d'une caractéristique depuis les abilities du joueur
 */
const getAbilityModFromPlayer = (player: Player, abilityName: string): number => {
  const abilities: any = (player as any).abilities;
  if (!Array.isArray(abilities)) return 0;
  
  const ability = abilities.find((a: any) => a?. name === abilityName);
  if (!ability) return 0;
  
  if (typeof ability. modifier === 'number') return ability.modifier;
  if (typeof ability.score === 'number') return getModifier(ability. score);
  return 0;
};

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 * en tenant compte des bonus d'équipement
 */
const calculateUnarmoredAC = (
  player: Player,
  equipmentBonuses: { Dextérité: number; Sagesse: number; Constitution: number }
): number => {
  const baseDexMod = getAbilityModFromPlayer(player, 'Dextérité');
  const dexMod = baseDexMod + (equipmentBonuses.Dextérité || 0);

  if (player.class === 'Moine') {
    const baseWisMod = getAbilityModFromPlayer(player, 'Sagesse');
    const wisMod = baseWisMod + (equipmentBonuses.Sagesse || 0);
    return 10 + dexMod + wisMod;
  }

  if (player.class === 'Barbare') {
    const baseConMod = getAbilityModFromPlayer(player, 'Constitution');
    const conMod = baseConMod + (equipmentBonuses.Constitution || 0);
    return 10 + dexMod + conMod;
  }

  return 10 + dexMod;
};

/**
 * Recalcule et met à jour la CA du joueur si nécessaire
 */
const recalculateAndUpdateAC = async (
  player: Player,
  updatedInventory: InventoryItem[],
  onPlayerUpdate: (player: Player) => void
) => {
  // Vérifier si une armure est équipée
  const hasArmorEquipped = ! !(player.equipment?. armor?. armor_formula);
  
  // Si une armure est équipée, la CA est gérée par l'armure, pas besoin de recalculer
  if (hasArmorEquipped) {
    console.log('[EquipmentTab] Armure équipée, CA gérée par l\'armure');
    return;
  }

  // Calculer les bonus d'équipement avec l'inventaire mis à jour
  const equipmentBonuses = calculateEquipmentBonuses(updatedInventory);
  
  // Calculer la nouvelle CA
  const newArmorClass = calculateUnarmoredAC(player, equipmentBonuses);
  
  // Vérifier si la CA a changé
  const currentAC = player.stats?. armor_class ??  10;
  
  if (newArmorClass !== currentAC) {
    console.log(`[EquipmentTab] ✅ Recalcul CA: ${currentAC} → ${newArmorClass}`);
    
    const updatedStats = {
      ... player.stats,
      armor_class: newArmorClass
    };

    try {
      const { error } = await supabase
        .from('players')
        .update({ stats: updatedStats })
        .eq('id', player.id);

      if (error) throw error;

      onPlayerUpdate({
        ...player,
        stats: updatedStats
      });
    } catch (err) {
      console.error('[EquipmentTab] Erreur mise à jour CA:', err);
    }
  }
};

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
  weapon_bonus?: number | null;
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
  forced?: boolean;
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

interface EquipmentTabProps {
  player: Player;
  inventory: InventoryItem[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: InventoryItem[]) => void;
  viewMode?: 'all' | 'gold' | 'inventory' | 'bag';
}

export function EquipmentTab({
  player, inventory, onPlayerUpdate, onInventoryUpdate, viewMode = 'all'
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

  const [editLockType, setEditLockType] = useState(false);
  const prevEditMetaRef = useRef<ItemMeta | null>(null);

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryModalType, setInventoryModalType] = useState<'armor' | 'shield'>('armor');

  const [showBagModal, setShowBagModal] = useState(false);
  const [bagText, setBagText] = useState(bag?.description || '');

  const [showProficiencyWarning, setShowProficiencyWarning] = useState(false);
  const [proficiencyCheck, setProficiencyCheck] = useState<WeaponProficiencyCheck | null>(null);
  const [pendingWeaponEquip, setPendingWeaponEquip] = useState<InventoryItem | null>(null);

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
  }, [player.equipment]);

  useEffect(() => {
    if (bag?.description) {
      setBagText(bag.description);
    }
  }, [bag]);

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

      for (const item of inventory) {
        const meta = parseMeta(item.description);
        if (meta?.type === 'weapon' && meta.equipped) {
          const nextMeta = { ...meta, equipped: false };
          const nextDesc = injectMetaIntoDescription(visibleDescription(item.description), nextMeta);
          localUpdates.push({ ...item, description: nextDesc });
          updates.push(supabase.from('inventory_items').update({ description: nextDesc }).eq('id', item.id));
        }
      }

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
  }, []);

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

      const weaponBonus = w?.weapon_bonus !== undefined && w?.weapon_bonus !== null
        ? w.weapon_bonus
        : (existing?.weapon_bonus ?? null);

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

  const performEquipToggle = async (freshItem: InventoryItem, mode: 'equip' | 'unequip') => {
    const meta = parseMeta(freshItem.description);
    if (!meta) return;

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
          const weaponData = {
            inventory_item_id: freshItem.id,
            name: freshItem.name,
            description: visibleDescription(freshItem.description),
            weapon_meta: meta.weapon || null
          };
          updatedWeapons = [...currentWeapons.filter((w: any) => w.inventory_item_id !== freshItem.id), weaponData];

          const weaponMetaToPass: WeaponMeta | null = meta.weapon ? {
            damageDice: meta.weapon.damageDice || '1d6',
            damageType: meta.weapon.damageType || 'Tranchant',
            properties: meta.weapon.properties || '',
            range: meta.weapon.range || 'Corps à corps',
            category: meta.weapon.category,
            weapon_bonus: meta.weapon.weapon_bonus ?? null
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
  if (mode === 'unequip' && meta.equipped) {
    await updateItemMetaComplete(freshItem, { ...meta, equipped: false });

    // ✅ NOUVEAU : Recalculer la CA après déséquipement
    // Créer l'inventaire mis à jour avec l'objet déséquipé
    const updatedInv = inventory.map(it =>
      it. id === freshItem.id
        ? { ...it, description: injectMetaIntoDescription(visibleDescription(it. description), { ...meta, equipped: false }) }
        : it
    );
    await recalculateAndUpdateAC(player, updatedInv, onPlayerUpdate);

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
  } else if (mode === 'equip' && ! meta.equipped) {
    await updateItemMetaComplete(freshItem, { ...meta, equipped: true });

    // ✅ NOUVEAU : Recalculer la CA après équipement
    // Créer l'inventaire mis à jour avec l'objet équipé
    const updatedInv = inventory.map(it =>
      it.id === freshItem.id
        ? { ... it, description: injectMetaIntoDescription(visibleDescription(it.description), { ...meta, equipped: true }) }
        : it
    );
    await recalculateAndUpdateAC(player, updatedInv, onPlayerUpdate);

    try {
      window.dispatchEvent(
        new CustomEvent('inventory:refresh', { detail: { playerId: player. id } })
      );
    } catch (e) {
      console.warn('[performEquipToggle] dispatch inventory:refresh failed', e);
    }

    const itemTypeName =
      meta.type === 'jewelry' ?  'Bijou' :
      meta.type === 'equipment' ? 'Équipement' :
      meta. type === 'tool' ? 'Outil' : 'Objet';
    toast.success(`${itemTypeName} équipé`);
  }
} finally {
      setPendingEquipment(prev => {
        const next = new Set(prev);
        next.delete(freshItem.id);
        return next;
      });
    }
  };

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

    const hasBonuses = meta?.bonuses && Object.keys(meta.bonuses).length > 0;
    const isEquippableItem = hasBonuses &&
      (meta?.type === 'jewelry' || meta?.type === 'equipment' ||
       meta?.type === 'tool' || meta?.type === 'other');

    const equipped =
      (isArmor && armor?.inventory_item_id === freshItem.id) ||
      (isShield && shield?.inventory_item_id === freshItem.id) ||
      (isWeapon && meta.equipped === true) ||
      (isEquippableItem && meta.equipped === true);

    performToggle(freshItem, equipped ? 'unequip' : 'equip');
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
    performToggle(item, 'unequip');
  };

  const jewelryText = jewelryItems.length ? jewelryItems.map(i => `• ${smartCapitalize(i.name)}`).join('\n') : 'Aucun bijou dans le sac.';
  const potionText = potionItems.length ? potionItems.map(i => `• ${smartCapitalize(i.name)}`).join('\n') : 'Aucune potion/poison dans le sac.';

  const checkWeaponProficiencyForInventory = (itemName: string): WeaponProficiencyCheck | null => {
    const item = inventory.find(i => i.name === itemName);
    if (!item) return null;
    const meta = parseMeta(item.description);
    if (!meta?.weapon) return null;
    try {
      return checkWeaponProficiency(itemName, playerWeaponProficiencies, meta.weapon.category, meta.weapon.properties);
    } catch {
      return null;
    }
  };

  const showEquipmentSlots = viewMode === 'all' || viewMode === 'bag';
  const showGold = viewMode === 'all' || viewMode === 'gold';
  const showInventory = viewMode === 'all' || viewMode === 'inventory';

  return (
    <div className="space-y-6">
      {showEquipmentSlots && (
        <EquipmentSlots
          armor={armor}
          shield={shield}
          weaponsSummary={weaponsSummary}
          potionText={potionText}
          jewelryText={jewelryText}
          bag={bag}
          bagText={bagText}
          inventory={inventory}
          equippedWeaponsCount={equippedWeapons.length}
          onOpenInventoryModal={(type) => {
            setInventoryModalType(type);
            setShowInventoryModal(true);
          }}
          onToggleFromSlot={toggleFromSlot}
          onOpenEditFromSlot={openEditFromSlot}
          onOpenWeaponsModal={() => setShowWeaponsModal(true)}
          onOpenBagModal={() => setShowBagModal(true)}
        />
      )}

      {showGold && <GoldManager player={player} onPlayerUpdate={onPlayerUpdate} />}

      {showInventory && (
        <InventoryList
        inventory={inventory}
        onInventoryUpdate={onInventoryUpdate}
        pendingEquipment={pendingEquipment}
        armorId={armor?.inventory_item_id}
        shieldId={shield?.inventory_item_id}
        onRequestToggle={requestToggleWithConfirm}
        onOpenEditItem={(item) => {
          setEditLockType(false);
          prevEditMetaRef.current = parseMeta(item.description) || null;
          setEditingItem(item);
        }}
        onOpenAddList={() => {
          setAllowedKinds(null);
          setShowList(true);
        }}
        onOpenAddCustom={() => setShowCustom(true)}
        checkWeaponProficiency={checkWeaponProficiencyForInventory}
      />
      )}

      {showList && (
        <EquipmentListModal
          onClose={() => { setShowList(false); setAllowedKinds(null); }}
          onAddItem={async (payload) => {
            try {
              const meta: ItemMeta = { ...(payload. meta as any), equipped: false };
              const finalDesc = injectMetaIntoDescription(payload.description || '', meta);
              const { data, error } = await supabase
                . from('inventory_items')
                .insert([{
                  player_id: player.id,
                  name: smartCapitalize(payload. name),
                  description: finalDesc
                }])
                .select()
                .single();
              if (error) throw error;
              if (data) {
                onInventoryUpdate([...inventory, data]);
                // ✅ Invalider le cache après ajout
                localStorage.removeItem(`ut:inventory:ts:${player.id}`);
              }
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
              const finalDesc = injectMetaIntoDescription(payload.description || '', { ...payload. meta, equipped: false });
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
              if (data) {
                onInventoryUpdate([...inventory, data]);
                // ✅ Invalider le cache après ajout
                localStorage.removeItem(`ut:inventory:ts:${player.id}`);
              }
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
            refreshInventory(0);
            setEditingItem(null);
            setEditLockType(false);
            prevEditMetaRef.current = null;
          }}
          onSaved={() => {
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
