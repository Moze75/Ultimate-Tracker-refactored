import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CampaignInventoryItem } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { ImageUrlInput } from '../../ImageUrlInput';
import { META_PREFIX, parseMeta, stripMetaFromDescription } from '../utils/metaParser';
import { DAMAGE_TYPES, WEAPON_CATEGORIES, RANGES, PROPERTY_TAGS } from '../utils/itemConstants';
import toast from 'react-hot-toast';

interface EditCampaignItemModalProps {
  item: CampaignInventoryItem;
  onClose: () => void;
  onSaved: () => void;
}

export function EditCampaignItemModal({ item, onClose, onSaved }: EditCampaignItemModalProps) {
  const [name, setName] = useState(item.name || '');
  const [visibleDescription, setVisibleDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(item.quantity || 1);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<string | null>(null);
  const [armorBase, setArmorBase] = useState<number | null>(null);
  const [armorAddDex, setArmorAddDex] = useState<boolean>(true);
  const [armorDexCap, setArmorDexCap] = useState<number | null>(null);
  const [weaponDamageDice, setWeaponDamageDice] = useState<string>('');
  const [weaponDamageType, setWeaponDamageType] = useState<string>('');
  const [weaponProperties, setWeaponProperties] = useState<string>('');
  const [weaponRange, setWeaponRange] = useState<string>('');
  const [weaponCategory, setWeaponCategory] = useState<string>('');
  const [weaponBonus, setWeaponBonus] = useState<number | null>(null);
  const [weaponPropTags, setWeaponPropTags] = useState<string[]>([]);
  const [shieldBonus, setShieldBonus] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string>('');

  const [bonusStr, setBonusStr] = React.useState<number | ''>('');
  const [bonusDex, setBonusDex] = React.useState<number | ''>('');
  const [bonusCon, setBonusCon] = React.useState<number | ''>('');
  const [bonusInt, setBonusInt] = React.useState<number | ''>('');
  const [bonusWis, setBonusWis] = React.useState<number | ''>('');
  const [bonusCha, setBonusCha] = React.useState<number | ''>('');
  const [bonusAC, setBonusAC] = React.useState<number | ''>('');

  useEffect(() => {
    const vis = stripMetaFromDescription(item.description);
    setVisibleDescription(vis);
    const meta = parseMeta(item.description);

    if (meta) {
      setType(meta.type || null);
      setQuantity(meta.quantity ?? item.quantity ?? 1);

      if (meta.type === 'armor' && meta.armor) {
        setArmorBase(meta.armor.base ?? null);
        setArmorAddDex(meta.armor.addDex ?? true);
        setArmorDexCap(meta.armor.dexCap ?? null);
      }

      if (meta.type === 'weapon' && meta.weapon) {
        setWeaponDamageDice(meta.weapon.damageDice || '1d6');
        setWeaponDamageType(
          (meta.weapon.damageType && (DAMAGE_TYPES as readonly string[]).includes(meta.weapon.damageType as any))
            ? meta.weapon.damageType
            : 'Tranchant'
        );
        const propRaw = meta.weapon.properties || '';
        const initTags = PROPERTY_TAGS.filter(t => propRaw.toLowerCase().includes(t.toLowerCase()));
        setWeaponPropTags(initTags as string[]);
        setWeaponProperties(propRaw);
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
      }

      if (meta.type === 'shield' && meta.shield) {
        setShieldBonus(meta.shield.bonus ?? null);
      }

      if (meta.bonuses) {
        setBonusStr(meta.bonuses.strength ?? '');
        setBonusDex(meta.bonuses.dexterity ?? '');
        setBonusCon(meta.bonuses.constitution ?? '');
        setBonusInt(meta.bonuses.intelligence ?? '');
        setBonusWis(meta.bonuses.wisdom ?? '');
        setBonusCha(meta.bonuses.charisma ?? '');
        setBonusAC(meta.bonuses.armor_class ?? '');
      }

      setImageUrl(meta.imageUrl || '');
    } else {
      setType(null);
      setQuantity(item.quantity || 1);
    }
  }, [item]);

  useEffect(() => {
    if (type === 'weapon') {
      setWeaponDamageDice(prev => prev || '1d6');
      setWeaponDamageType(prev => (prev && (DAMAGE_TYPES as readonly string[]).includes(prev as any) ? prev : 'Tranchant'));
      setWeaponRange(prev => (prev && (RANGES as readonly string[]).includes(prev as any) ? prev : 'Corps à corps'));
      setWeaponCategory(prev => (prev && (WEAPON_CATEGORIES as readonly string[]).includes(prev as any) ? prev : 'Armes courantes'));
    }
  }, [type]);

  const buildMeta = () => {
    if (!type) return null;
    const baseMeta: any = {
      type,
      quantity: quantity || 1,
      equipped: false,
      imageUrl: imageUrl.trim() || undefined,
    };

    if (type === 'armor') {
      baseMeta.armor = {
        base: armorBase ?? 0,
        addDex: armorAddDex,
        dexCap: armorDexCap ?? null,
        label: (() => {
          const base = armorBase ?? 0;
          let label = `${base}`;
          if (armorAddDex) label += ' + modificateur de Dex';
          if (armorDexCap != null) label += ` (max ${armorDexCap})`;
          return label;
        })()
      };
    } else if (type === 'weapon') {
      const properties = (weaponPropTags.length ? weaponPropTags.join(', ') : weaponProperties || '').trim();
      baseMeta.weapon = {
        damageDice: weaponDamageDice || '1d6',
        damageType: weaponDamageType || 'Tranchant',
        properties,
        range: weaponRange || 'Corps à corps',
        category: weaponCategory || 'Armes courantes',
        weapon_bonus: weaponBonus
      };
    } else if (type === 'shield') {
      baseMeta.shield = { bonus: shieldBonus ?? 0 };
    }

    const hasBonuses =
      bonusStr !== '' || bonusDex !== '' || bonusCon !== '' ||
      bonusInt !== '' || bonusWis !== '' || bonusCha !== '' || bonusAC !== '';

    if (hasBonuses) {
      baseMeta.bonuses = {};
      if (bonusStr !== '') baseMeta.bonuses.strength = Number(bonusStr);
      if (bonusDex !== '') baseMeta.bonuses.dexterity = Number(bonusDex);
      if (bonusCon !== '') baseMeta.bonuses.constitution = Number(bonusCon);
      if (bonusInt !== '') baseMeta.bonuses.intelligence = Number(bonusInt);
      if (bonusWis !== '') baseMeta.bonuses.wisdom = Number(bonusWis);
      if (bonusCha !== '') baseMeta.bonuses.charisma = Number(bonusCha);
      if (bonusAC !== '') baseMeta.bonuses.armor_class = Number(bonusAC);
    }

    return baseMeta;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    setSaving(true);
    try {
      const metaObj = buildMeta();
      const metaLine = metaObj ? `${META_PREFIX}${JSON.stringify(metaObj)}` : null;
      const cleanVisible = (visibleDescription || '').trim();
      const finalDescription = metaLine
        ? (cleanVisible ? `${cleanVisible}\n${metaLine}` : metaLine)
        : cleanVisible;

      await campaignService.updateCampaignItem(item.id, {
        name: name.trim(),
        description: finalDescription,
        quantity: quantity,
      });

      toast.success('Objet mis à jour');
      onSaved();
    } catch (err) {
      console.error('Erreur save item:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Modifier l'objet</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              placeholder="Nom de l'objet"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Quantité</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Type (méta)</label>
              <select
                value={type || ''}
                onChange={(e) => setType(e.target.value || null)}
                className="input-dark w-full px-4 py-2 rounded-lg"
              >
                <option value="">Aucun (objet générique)</option>
                <option value="armor">Armure</option>
                <option value="shield">Bouclier</option>
                <option value="weapon">Arme</option>
                <option value="jewelry">Bijou</option>
                <option value="equipment">Équipement</option>
                <option value="tool">Outil</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>

          {type === 'armor' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Base</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorBase ?? ''} onChange={(e) => setArmorBase(e.target.value ? parseInt(e.target.value) : null)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Add Dex</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={armorAddDex ? 'true' : 'false'} onChange={(e) => setArmorAddDex(e.target.value === 'true')}>
                    <option value="true">Oui</option>
                    <option value="false">Non</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Dex cap (optionnel)</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={armorDexCap ?? ''} onChange={(e) => setArmorDexCap(e.target.value ? parseInt(e.target.value) : null)} />
                </div>
              </div>
            </div>
          )}

          {type === 'weapon' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400">Dégâts (ex: 1d6)</label>
                  <input className="input-dark w-full px-2 py-1 rounded" value={weaponDamageDice} onChange={(e) => setWeaponDamageDice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Type de dégâts</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponDamageType || 'Tranchant'} onChange={(e) => setWeaponDamageType(e.target.value)}>
                    {Array.from(DAMAGE_TYPES).map((dt) => (<option key={dt} value={dt}>{dt}</option>))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400">Propriétés (cases à cocher)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from(PROPERTY_TAGS).map(tag => {
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
                  <p className="text-[10px] text-gray-500 mt-1">Finesse/Légère/Lancer/Polyvalente influencent STR/DEX en mêlée.</p>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Portée</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponRange || 'Corps à corps'} onChange={(e) => setWeaponRange(e.target.value)}>
                    {Array.from(RANGES).map((r) => (<option key={r} value={r}>{r}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Catégorie</label>
                  <select className="input-dark w-full px-2 py-1 rounded" value={weaponCategory || 'Armes courantes'} onChange={(e) => setWeaponCategory(e.target.value)}>
                    {Array.from(WEAPON_CATEGORIES).map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400">Bonus de l'arme</label>
                  <input type="number" className="input-dark w-full px-2 py-1 rounded" value={weaponBonus ?? ''} onChange={(e) => setWeaponBonus(e.target.value ? parseInt(e.target.value) : null)} />
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-gray-400">Propriétés (libre, optionnel)</label>
                  <input className="input-dark w-full px-2 py-1 rounded" value={weaponProperties} onChange={(e) => setWeaponProperties(e.target.value)} placeholder="Compléments éventuels" />
                </div>
              </div>
            </div>
          )}

          {type === 'shield' && (
            <div className="space-y-2 bg-gray-800/30 p-3 rounded">
              <div>
                <label className="text-xs text-gray-400">Bonus</label>
                <input type="number" className="input-dark w-full px-2 py-1 rounded" value={shieldBonus ?? ''} onChange={(e) => setShieldBonus(e.target.value ? parseInt(e.target.value) : null)} />
              </div>
            </div>
          )}

          {(type === 'jewelry' || type === 'equipment' || type === 'tool' || type === 'other') && (
            <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-300">Bonus (optionnel)</h4>
              <p className="text-xs text-gray-500">
                Si cet objet confère des bonus, il deviendra équipable/déséquipable.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Force</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusStr} onChange={(e) => setBonusStr(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dextérité</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusDex} onChange={(e) => setBonusDex(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Constitution</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusCon} onChange={(e) => setBonusCon(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Intelligence</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusInt} onChange={(e) => setBonusInt(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sagesse</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusWis} onChange={(e) => setBonusWis(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Charisme</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusCha} onChange={(e) => setBonusCha(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Classe d'Armure</label>
                  <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={bonusAC} onChange={(e) => setBonusAC(e.target.value ? parseInt(e.target.value) : '')} placeholder="+0" />
                </div>
              </div>
            </div>
          )}

          <div>
            <ImageUrlInput value={imageUrl} onChange={setImageUrl} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description (visible)</label>
            <textarea
              value={visibleDescription}
              onChange={(e) => setVisibleDescription(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              rows={4}
              placeholder="Description que verront les joueurs"
            />
            <p className="text-xs text-gray-500 mt-1">Les propriétés techniques sont sérialisées dans les méta.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 rounded-lg">Annuler</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50">
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  );
}
