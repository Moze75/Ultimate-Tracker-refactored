import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Backpack, Plus, Settings, Trash2, Search, Filter as FilterIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { InventoryItem } from '../../types/dnd';

type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';

interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: {
    damageDice: string;
    damageType: string;
    properties?: string;
    range?: string;
  };
  armor?: {
    base: number;
    addDex: boolean;
    dexCap?: number | null;
    label: string;
  };
  shield?: {
    bonus: number;
  };
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

interface WeaponProficiencyCheck {
  isProficient: boolean;
  shouldApplyProficiencyBonus: boolean;
}

const META_PREFIX = '#meta:';
const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((? :\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, ''). trim();
const visibleDescription = (desc: string | null | undefined) => {
  if (! desc) return '';
  return desc.split('\n').filter((l) => ! l.trim().startsWith(META_PREFIX)).join('\n'). trim();
};
function smartCapitalize(name: string): string {
  const base = stripPriceParentheses(name). trim();
  if (! base) return '';
  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
function parseMeta(description: string | null | undefined): ItemMeta | null {
  if (!description) return null;
  const lines = (description || '').split('\n'). map(l => l.trim());
  const metaLine = [... lines].reverse().find(l => l.startsWith(META_PREFIX));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine. slice(META_PREFIX.length));
  } catch {
    return null;
  }
}

interface InventoryListProps {
  inventory: InventoryItem[];
  onInventoryUpdate: (inventory: InventoryItem[]) => void;
  pendingEquipment: Set<string>;
  armorId?: string | null;
  shieldId?: string | null;
  onRequestToggle: (item: InventoryItem) => void;
  onOpenEditItem: (item: InventoryItem) => void;
  onOpenAddList: () => void;
  onOpenAddCustom: () => void;
  checkWeaponProficiency?: (itemName: string) => WeaponProficiencyCheck | null;
}

export function InventoryList({
  inventory,
  onInventoryUpdate,
  pendingEquipment,
  armorId,
  shieldId,
  onRequestToggle,
  onOpenEditItem,
  onOpenAddList,
  onOpenAddCustom,
  checkWeaponProficiency
}: InventoryListProps) {
  const [bagFilter, setBagFilter] = useState('');
  const [bagKinds, setBagKinds] = useState<Record<MetaType, boolean>>({
    armor: true, shield: true, weapon: true, equipment: true, potion: true, jewelry: true, tool: true, other: true
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Debug
  console.log('🔍 [InventoryList] filtersOpen:', filtersOpen);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const filteredInventory = useMemo(() => {
    const q = bagFilter.trim().toLowerCase();
    return inventory
      .filter(i => {
        const meta = parseMeta(i.description);
        const kind: MetaType = (meta?.type || 'equipment') as MetaType;
        if (! bagKinds[kind]) return false;
        if (! q) return true;
        const name = stripPriceParentheses(i.name).toLowerCase();
        const desc = visibleDescription(i.description). toLowerCase();
        return name.includes(q) || desc. includes(q);
      })
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b. created_at || 0).getTime();
        return dateB - dateA;
      });
  }, [inventory, bagFilter, bagKinds]);

  const toggleExpand = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const handleDelete = async (item: InventoryItem) => {
    if (! window.confirm('Supprimer cet objet ?')) return;
    try {
      const { error } = await supabase. from('inventory_items').delete(). eq('id', item.id);
      if (error) throw error;
      
      const playerId = (item as any).player_id;
      if (playerId) {
        localStorage.removeItem(`ut:inventory:ts:${playerId}`);
      }
      
      onInventoryUpdate(inventory. filter(i => i.id !== item.id));
      toast. success('Objet supprimé');
    } catch (e) {
      console.error(e);
      toast.error('Erreur suppression');
    }
  };

  return (
    <>
      <div className="stat-card">
        <div className="stat-header flex items-center gap-3">
          <Backpack className="text-purple-500" size={24} />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-100">Sac</h2>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <button onClick={onOpenAddList} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2">
              <Plus size={20} /> Liste d'équipement
            </button>
            <button onClick={onOpenAddCustom} className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2">
              <Plus size={18} /> Objet personnalisé
            </button>

            <div className="ml-auto flex items-center gap-2 min-w-[240px] flex-1">
              <button
                onClick={() => setFiltersOpen(true)}
                className="px-3 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2"
              >
                <FilterIcon size={16} /> Filtres
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400" />
                <input 
                  value={bagFilter} 
                  onChange={(e) => setBagFilter(e.target.value)} 
                  placeholder="Filtrer le sac…" 
                  className="input-dark px-3 py-2 rounded-md w-full" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredInventory.map(item => {
              const meta = parseMeta(item.description);
              const qty = meta?.quantity ??  1;
              const isArmor = meta?.type === 'armor';
              const isShield = meta?.type === 'shield';
              const isWeapon = meta?.type === 'weapon';

              const hasBonuses = meta?.bonuses && Object.keys(meta.bonuses).length > 0;
              const isEquippableItem = hasBonuses &&
                (meta?.type === 'jewelry' || meta?.type === 'equipment' ||
                 meta?.type === 'tool' || meta?.type === 'other');

              const isEquipped =
                (isArmor && armorId === item.id) ||
                (isShield && shieldId === item.id) ||
                (isWeapon && meta?.equipped === true) ||
                (isEquippableItem && meta?.equipped === true);

              let weaponProficiency: WeaponProficiencyCheck | null = null;
              if (isWeapon && checkWeaponProficiency) {
                weaponProficiency = checkWeaponProficiency(item.name);
              }
              const notProficient = isWeapon && weaponProficiency && ! weaponProficiency.isProficient;

              const buttonLabel = pendingEquipment.has(item.id)
                ? 'En cours.. .'
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
                        {meta?. type === 'jewelry' && <span className="text-xs px-2 py-0.5 rounded bg-yellow-900/30 text-yellow-300 whitespace-nowrap">Bijou</span>}
                        {meta?.type === 'potion' && <span className="text-xs px-2 py-0.5 rounded bg-green-900/30 text-green-300 whitespace-nowrap">Potion/Poison</span>}
                        {meta?. type === 'other' && <span className="text-xs px-2 py-0.5 rounded bg-slate-900/30 text-slate-300 whitespace-nowrap">Autre</span>}
                      </div>
                      {expanded[item.id] && (
                        <div className="mt-2 space-y-2">
                          {meta?.imageUrl && (
                            <div className="mb-3">
                              <img
                                src={meta.imageUrl}
                                alt={item.name}
                                className="w-full max-w-sm rounded-lg border border-gray-600/50 shadow-lg"
                                onError={(e) => {
                                  (e. target as HTMLImageElement).style. display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {(isArmor || isShield || isWeapon) && (
                            <div className="text-xs text-gray-400 space-y-0.5">
                              {isArmor && meta?.armor && <div>CA: {meta.armor.label}</div>}
                              {isShield && meta?.shield && <div>Bonus de bouclier: +{meta.shield.bonus}</div>}
                              {isWeapon && meta?.weapon && (
                                <>
                                  <div>Dégâts: {meta.weapon.damageDice} {meta.weapon.damageType}</div>
                                  {meta. weapon.properties && <div>Propriété: {meta.weapon.properties}</div>}
                                  {meta.weapon.range && <div>Portée: {meta. weapon.range}</div>}
                                  {notProficient && (
                                    <div className="text-[10px] text-amber-300 mt-1">
                                      Non maîtrisée : bonus de maîtrise non appliqué. 
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {hasBonuses && meta?.bonuses && (
                            <div className="text-xs text-gray-400 space-y-0.5 mt-2 pt-2 border-t border-gray-700/30">
                              <div className="font-medium text-gray-300 mb-1">Bonus :</div>
                              {meta.bonuses.strength && <div>Force: {meta.bonuses. strength >= 0 ? '+' : ''}{meta.bonuses.strength}</div>}
                              {meta.bonuses.dexterity && <div>Dextérité: {meta.bonuses. dexterity >= 0 ? '+' : ''}{meta. bonuses.dexterity}</div>}
                              {meta.bonuses.constitution && <div>Constitution: {meta.bonuses.constitution >= 0 ? '+' : ''}{meta.bonuses.constitution}</div>}
                              {meta.bonuses.intelligence && <div>Intelligence: {meta.bonuses.intelligence >= 0 ? '+' : ''}{meta.bonuses.intelligence}</div>}
                              {meta.bonuses.wisdom && <div>Sagesse: {meta.bonuses.wisdom >= 0 ? '+' : ''}{meta.bonuses.wisdom}</div>}
                              {meta.bonuses.charisma && <div>Charisme: {meta.bonuses. charisma >= 0 ?  '+' : ''}{meta.bonuses.charisma}</div>}
                              {meta.bonuses.armor_class && <div>Classe d'Armure: {meta.bonuses.armor_class >= 0 ? '+' : ''}{meta.bonuses.armor_class}</div>}
                            </div>
                          )}

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
                          onClick={() => onRequestToggle(item)}
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
                        onClick={() => onOpenEditItem(item)}
                        className="p-1. 5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 rounded-full"
                        title="Paramètres"
                      >
                        <Settings size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-900/30 rounded-full"
                        title="Supprimer l'objet"
                      >
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

      {/* Modal des filtres - Portal pour sortir du DOM parent */}
      {filtersOpen && createPortal(
        <div 
          className="fixed inset-0 z-[999999] flex items-center justify-center"
          onClick={(e) => { 
            if (e.target === e.currentTarget) setFiltersOpen(false); 
          }}
        >
          <div className="fixed inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />
          <div className="relative w-[min(22rem,92vw)] bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-2xl z-[1000000]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-gray-100 font-semibold text-lg">Filtres du sac</h4>
              <button 
                onClick={() => setFiltersOpen(false)} 
                className="p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 rounded-lg transition-colors" 
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1">
              {(['armor','shield','weapon','equipment','potion','jewelry','tool','other'] as MetaType[]).map(k => (
                <label 
                  key={k} 
                  className="flex items-center justify-between text-sm text-gray-200 px-3 py-2 rounded hover:bg-gray-800/60 cursor-pointer transition-colors"
                >
                  <span>
                    {k === 'armor' ?  'Armure'
                      : k === 'shield' ? 'Bouclier'
                      : k === 'weapon' ? 'Arme'
                      : k === 'potion' ? 'Potion/Poison'
                      : k === 'jewelry' ? 'Bijoux'
                      : k === 'tool' ? 'Outils'
                      : k === 'other' ? 'Autre' : 'Équipement'}
                  </span>
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-purple-500 cursor-pointer"
                    checked={bagKinds[k]}
                    onChange={() => setBagKinds(prev => ({ ...prev, [k]: !prev[k] }))}
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button 
                onClick={() => setFiltersOpen(false)} 
                className="btn-primary px-4 py-2 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}