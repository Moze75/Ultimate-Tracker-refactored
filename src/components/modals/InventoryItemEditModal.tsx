import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { ImageUrlInput } from '../ImageUrlInput';
import type { InventoryItem } from '../../types/dnd';

type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';
type WeaponCategory =
  | 'Armes courantes'
  | 'Armes de guerre'
  | 'Armes de guerre dotées de la propriété Légère'
  | 'Armes de guerre présentant la propriété Finesse ou Légère';

interface WeaponMeta {
  damageDice: string;
  damageType: 'Tranchant' | 'Perforant' | 'Contondant';
  properties: string; // chaîne lisible ex: "Finesse, Légère"
  range: string;      // libellé FR ex: "Corps à corps", "6 m", ...
  category?: WeaponCategory;
  weapon_bonus?: number | null;
}
interface ArmorMeta { base: number; addDex: boolean; dexCap?: number | null; label: string; }
interface ShieldMeta { bonus: number; }
interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: WeaponMeta;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
  imageUrl?: string;
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

function stripMetaFromDescription(description: string | null | undefined) {
  if (!description) return '';
  return description
    .split('\n')
    .filter(l => !l.trim().startsWith(META_PREFIX))
    .join('\n')
    .trim();
}

function injectMetaIntoDescription(visible: string, meta: ItemMeta) {
  const metaLine = `${META_PREFIX}${JSON.stringify(meta)}`;
  return visible ? `${visible}\n${metaLine}` : metaLine;
}

// Propriétés standardisées, robustes pour l’inférence STR/DEX et la détection distance
const PROPERTY_TAGS = ['Finesse', 'Légère', 'Lancer', 'Polyvalente', 'Deux mains', 'Lourde', 'Allonge', 'Munitions', 'Chargement'] as const;
const DAMAGE_TYPES = ['Tranchant', 'Perforant', 'Contondant'] as const;
const WEAPON_CATEGORIES = [
  'Armes courantes',
  'Armes de guerre',
  'Armes de guerre dotées de la propriété Légère',
  'Armes de guerre présentant la propriété Finesse ou Légère',
] as const;
const RANGES = [
  'Corps à corps',
  'Contact',
  '1,5 m',
  '3 m',
  '6 m',
  '9 m',
  '12 m',
  '18 m',
  '24 m',
  '30 m',
  '36 m',
  '45 m',
  '60 m',
  '90 m',
] as const;

export function InventoryItemEditModal({
  item,
  lockType,
  onInventoryUpdate,
  inventory,
  onClose,
  onSaved
}: {
  item: InventoryItem;
  lockType?: boolean;
  onInventoryUpdate: (inventory: InventoryItem[]) => void;
  inventory: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Champs généraux
  const [name, setName] = useState(item.name || '');
  const [visibleDescription, setVisibleDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(item.quantity || 1);

  // Type
  const [type, setType] = useState<MetaType>('equipment');

  // Armure
  const [armorBase, setArmorBase] = useState<number | ''>('');
  const [armorAddDex, setArmorAddDex] = useState<boolean>(true);
  const [armorDexCap, setArmorDexCap] = useState<number | ''>('');

  // Bouclier
  const [shieldBonus, setShieldBonus] = useState<number | ''>('');

  // Arme
  const [weaponDamageDice, setWeaponDamageDice] = useState<string>('1d6');
  const [weaponDamageType, setWeaponDamageType] = useState<'Tranchant' | 'Perforant' | 'Contondant'>('Tranchant');
  const [weaponRange, setWeaponRange] = useState<string>('Corps à corps');
  const [weaponCategory, setWeaponCategory] = useState<WeaponCategory>('Armes courantes');
  const [weaponBonus, setWeaponBonus] = useState<number | null>(null);
  const [weaponPropTags, setWeaponPropTags] = useState<string[]>([]);
  const [weaponPropsFree, setWeaponPropsFree] = useState<string>(''); // fallback si aucun tag coché

  // ✅ NOUVEAU : Bonus pour jewelry, equipment, tool, other
  const [bonusStr, setBonusStr] = useState<number | ''>('');
  const [bonusDex, setBonusDex] = useState<number | ''>('');
  const [bonusCon, setBonusCon] = useState<number | ''>('');
  const [bonusInt, setBonusInt] = useState<number | ''>('');
  const [bonusWis, setBonusWis] = useState<number | ''>('');
  const [bonusCha, setBonusCha] = useState<number | ''>('');
  const [bonusAC, setBonusAC] = useState<number | ''>('');
  
  // Image
  const [imageUrl, setImageUrl] = useState<string>('');

  // Init depuis l’item
  useEffect(() => {
    const vis = stripMetaFromDescription(item.description);
    setVisibleDescription(vis);
    const meta = parseMeta(item.description);

    if (meta) {
      // Type / qty
      setType((meta.type || 'equipment') as MetaType);
      setQuantity(meta.quantity ?? item.quantity ?? 1);

      // Image
      setImageUrl(meta.imageUrl || '');

      // Armure
      if (meta.type === 'armor' && meta.armor) {
        setArmorBase(meta.armor.base);
        setArmorAddDex(meta.armor.addDex ?? true);
        setArmorDexCap(meta.armor.dexCap ?? '');
      }

      // Bouclier
      if (meta.type === 'shield' && meta.shield) {
        setShieldBonus(meta.shield.bonus ?? '');
      }

      // Arme
      if (meta.type === 'weapon' && meta.weapon) {
        setWeaponDamageDice(meta.weapon.damageDice || '1d6');
        setWeaponDamageType(
          (meta.weapon.damageType && (DAMAGE_TYPES as readonly string[]).includes(meta.weapon.damageType as any))
            ? meta.weapon.damageType
            : 'Tranchant'
        );
        setWeaponRange(
          (meta.weapon.range && (RANGES as readonly string[]).includes(meta.weapon.range as any))
            ? meta.weapon.range
            : 'Corps à corps'
        );
        setWeaponCategory(
          (meta.weapon.category && (WEAPON_CATEGORIES as readonly string[]).includes(meta.weapon.category as any))
            ? meta.weapon.category
            : 'Armes courantes'
        );
        setWeaponBonus(meta.weapon.weapon_bonus ?? null);

        const propRaw = meta.weapon.properties || '';
        setWeaponPropsFree(propRaw);
        const initTags = PROPERTY_TAGS.filter(t => propRaw.toLowerCase().includes(t.toLowerCase()));
        setWeaponPropTags(initTags);
      }

    // ✅ NOUVEAU : Initialisation des bonus
      if (meta.bonuses) {
        setBonusStr(meta.bonuses.strength ?? '');
        setBonusDex(meta.bonuses.dexterity ?? '');
        setBonusCon(meta.bonuses.constitution ?? '');
        setBonusInt(meta.bonuses.intelligence ?? '');
        setBonusWis(meta.bonuses.wisdom ?? '');
        setBonusCha(meta.bonuses.charisma ?? '');
        setBonusAC(meta.bonuses.armor_class ?? '');
      }
    } else {
      // objet sans méta
      setType('equipment');
      setQuantity(item.quantity || 1);
    }
  }, [item]);

  // Si l’utilisateur change le type vers “weapon”, injecter des valeurs par défaut
  useEffect(() => {
    if (type === 'weapon') {
      setWeaponDamageDice(prev => prev || '1d6');
      setWeaponDamageType(prev => prev || 'Tranchant');
      setWeaponRange(prev => (prev && (RANGES as readonly string[]).includes(prev as any) ? prev : 'Corps à corps'));
      setWeaponCategory(prev => (prev && (WEAPON_CATEGORIES as readonly string[]).includes(prev as any) ? prev : 'Armes courantes'));
    }
  }, [type]);

  // Construire la méta à sauver
  const buildMeta = (): ItemMeta => {
    const base: ItemMeta = {
      type,
      quantity,
      equipped: parseMeta(item.description)?.equipped ?? false, // ne pas perdre l’état équip
      imageUrl: imageUrl.trim() || undefined
    };

    if (type === 'armor') {
      const baseCA = typeof armorBase === 'number' ? armorBase : parseInt(String(armorBase)) || 0;
      const cap = armorDexCap === '' ? null : (typeof armorDexCap === 'number' ? armorDexCap : parseInt(String(armorDexCap)));
      base.armor = {
        base: baseCA,
        addDex: armorAddDex,
        dexCap: cap,
        label: `${baseCA}${armorAddDex ? ` + modificateur de Dex${cap != null ? ` (max ${cap})` : ''}` : ''}`
      };
    } else if (type === 'shield') {
      const bonus = typeof shieldBonus === 'number' ? shieldBonus : parseInt(String(shieldBonus)) || 0;
      base.shield = { bonus };
     } else if (type === 'weapon') {
      const properties = (weaponPropTags.length ? weaponPropTags.join(', ') : weaponPropsFree || '').trim();
      base.weapon = {
        damageDice: weaponDamageDice || '1d6',
        damageType: weaponDamageType || 'Tranchant',
        properties,
        range: weaponRange || 'Corps à corps',
        category: weaponCategory || 'Armes courantes',
        weapon_bonus: weaponBonus
      };
    }

    // ✅ NOUVEAU : Ajouter les bonus si présents
    const hasBonuses = 
      bonusStr !== '' || bonusDex !== '' || bonusCon !== '' || 
      bonusInt !== '' || bonusWis !== '' || bonusCha !== '' || bonusAC !== '';

    if (hasBonuses) {
      base.bonuses = {};
      if (bonusStr !== '') base.bonuses.strength = Number(bonusStr);
      if (bonusDex !== '') base.bonuses.dexterity = Number(bonusDex);
      if (bonusCon !== '') base.bonuses.constitution = Number(bonusCon);
      if (bonusInt !== '') base.bonuses.intelligence = Number(bonusInt);
      if (bonusWis !== '') base.bonuses.wisdom = Number(bonusWis);
      if (bonusCha !== '') base.bonuses.charisma = Number(bonusCha);
      if (bonusAC !== '') base.bonuses.armor_class = Number(bonusAC);
    }

    return base;
  };

const handleSave = async () => {
  if (!name.trim()) return toast.error('Nom requis');
  if (quantity <= 0) return toast.error('Quantité invalide');

  try {
    const meta = buildMeta();
    const finalDesc = injectMetaIntoDescription((visibleDescription || '').trim(), meta);

    // DEBUG utile temporaire
    console.log('[EditModal] handleSave → payload', {
      id: item.id,
      player_id: (item as any).player_id,
      name: name.trim(),
      finalDescMeta: meta
    });

    const { data: updatedRow, error } = await supabase
      .from('inventory_items')
      .update({ name: name.trim(), description: finalDesc })
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) {
      console.error('[EditModal] UPDATE error', error);
      throw error;
    }

    // Mettre à jour localement
    const updated = inventory.map(it =>
      it.id === item.id ? { ...it, name: name.trim(), description: finalDesc } : it
    );
    onInventoryUpdate(updated);

    // Notifier globalement pour recharger côté EquipmentTab (et autres)
    try {
      window.dispatchEvent(
        new CustomEvent('inventory:refresh', { detail: { playerId: (item as any).player_id } })
      );
    } catch (e) {
      console.warn('[EditModal] dispatch inventory:refresh failed', e);
    }

    console.log('[EditModal] UPDATE ok, row:', updatedRow);
    toast.success('Objet mis à jour');
    onSaved();
  } catch (e) {
    console.error('[EditModal] Sauvegarde échouée', e);
    toast.error('Erreur lors de la sauvegarde');
  }
};

   return createPortal(
    <div className="fixed inset-0 z-[11000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(34rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-100">Paramètres de l'objet</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Nom + Quantité */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400">Nom</label>
              <input className="input-dark w-full px-3 py-2 rounded-md" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400">Quantité</label>
              <input type="number" min={1} className="input-dark w-full px-3 py-2 rounded-md" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs text-gray-400">Type</label>
            <select
              className="input-dark w-full px-3 py-2 rounded-md"
              value={type}
              onChange={(e) => { if (!lockType) setType(e.target.value as MetaType); }}
              disabled={!!lockType}
              title={lockType ? 'Type verrouillé' : undefined}
            >
              <option value="equipment">Équipement</option>
              <option value="potion">Potion / Poison</option>
              <option value="weapon">Arme</option>
              <option value="armor">Armure</option>
              <option value="shield">Bouclier</option>
              <option value="jewelry">Bijoux</option>
              <option value="tool">Outils</option>
              <option value="other">Autre</option>
            </select>
          </div>

          {/* Armure */}
          {type === 'armor' && (
            <div className="bg-gray-800/30 p-3 rounded space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Base</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorBase} onChange={(e) => setArmorBase(e.target.value === '' ? '' : parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Ajouter DEX</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={armorAddDex ? 'true' : 'false'} onChange={(e) => setArmorAddDex(e.target.value === 'true')}>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Cap DEX (vide = illimité)</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorDexCap} onChange={(e) => setArmorDexCap(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} />
                </div>
              </div>
            </div>
          )}

          {/* Bouclier */}
          {type === 'shield' && (
            <div className="bg-gray-800/30 p-3 rounded space-y-2">
              <div>
                <label className="text-xs text-gray-400">Bonus de bouclier</label>
                <input type="number" className="input-dark w-full px-2 py-1 rounded" value={shieldBonus} onChange={(e) => setShieldBonus(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} />
              </div>
            </div>
          )}

          {/* Arme */}
          {type === 'weapon' && (
            <div className="bg-gray-800/30 p-3 rounded space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Dés de dégâts</label>
                  <input className="input-dark w-full px-2 py-1 rounded" value={weaponDamageDice} onChange={(e) => setWeaponDamageDice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Type de dégâts</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponDamageType} onChange={(e) => setWeaponDamageType(e.target.value as any)}>
                    {DAMAGE_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Portée</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponRange} onChange={(e) => setWeaponRange(e.target.value)}>
                    {RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Catégorie</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponCategory} onChange={(e) => setWeaponCategory(e.target.value as any)}>
                    {WEAPON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Bonus de l'arme</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={weaponBonus ?? ''} onChange={(e) => setWeaponBonus(e.target.value === '' ? null : (parseInt(e.target.value) || 0))} />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400">Propriétés (cases à cocher)</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {PROPERTY_TAGS.map(tag => {
                    const checked = weaponPropTags.includes(tag);
                    return (
                      <label key={tag} className="inline-flex items-center gap-2 text-xs text-gray-200">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setWeaponPropTags(prev => e.target.checked ? [...prev, tag] : prev.filter(t => t !== tag));
                          }}
                        />
                        <span>{tag}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Finesse/Légère/Lancer/Polyvalente influencent STR/DEX en mêlée. Munitions/Chargement aident à classer l’arme à distance.
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-400">Propriétés (libre, optionnel)</label>
                <input
                  className="input-dark w-full px-2 py-1 rounded"
                  value={weaponPropsFree}
                  onChange={(e) => setWeaponPropsFree(e.target.value)}
                  placeholder="Complément, si aucune case cochée"
                />
              </div>
            </div>
          )}

 {/* ✅ NOUVEAU : Section bonus pour jewelry, equipment, tool, other */}
          {(type === 'jewelry' || type === 'equipment' || type === 'tool' || type === 'other') && (
            <div className="bg-gray-800/30 p-3 rounded space-y-3">
              <h4 className="text-sm font-medium text-gray-300">Bonus (optionnel)</h4>
              <p className="text-xs text-gray-500">
                Si cet objet confère des bonus, il deviendra équipable/déséquipable.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Force</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusStr} 
                    onChange={e => setBonusStr(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Dextérité</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusDex} 
                    onChange={e => setBonusDex(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Constitution</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusCon} 
                    onChange={e => setBonusCon(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Intelligence</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusInt} 
                    onChange={e => setBonusInt(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Sagesse</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusWis} 
                    onChange={e => setBonusWis(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Charisme</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusCha} 
                    onChange={e => setBonusCha(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Classe d'Armure</label>
                  <input 
                    type="number" 
                    className="input-dark w-full px-2 py-1 rounded" 
                    value={bonusAC} 
                    onChange={e => setBonusAC(e.target.value ? parseInt(e.target.value) : '')} 
                    placeholder="+0"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Image */}
          <div>
            <ImageUrlInput value={imageUrl} onChange={setImageUrl} />
          </div>

          {/* Description visible */}
          <div>
            <label className="text-xs text-gray-400">Description (visible)</label>
            <textarea className="input-dark w-full px-3 py-2 rounded-md" rows={4} value={visibleDescription} onChange={(e) => setVisibleDescription(e.target.value)} />
            <p className="text-[10px] text-gray-500 mt-1">Les propriétés techniques sont stockées en méta cachée.</p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-lg">Annuler</button>
          <button onClick={handleSave} className="btn-primary px-4 py-2 rounded-lg">Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}

export default InventoryItemEditModal;