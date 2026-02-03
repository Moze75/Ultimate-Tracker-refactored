import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ImageUrlInput } from '../ImageUrlInput';
import toast from 'react-hot-toast';

type MetaType = 'armor' | 'shield' | 'weapon' | 'potion' | 'equipment' | 'jewelry' | 'tool' | 'other';
type WeaponCategory =
  | 'Armes courantes'
  | 'Armes de guerre'
  | 'Armes de guerre dotées de la propriété Légère'
  | 'Armes de guerre présentant la propriété Finesse ou Légère';

interface WeaponMeta {
  damageDice: string;
  damageType: 'Tranchant' | 'Perforant' | 'Contondant';
  properties: string;            // string lisible, ex: "Finesse, Légère"
  range: string;                 // libellé FR, ex: "Corps à corps", "6 m", etc.
  category?: WeaponCategory;
  weapon_bonus?: number | null;
}
interface ArmorMeta { base: number; addDex: boolean; dexCap?: number | null; label: string; }
interface ShieldMeta { bonus: number; }
export interface ItemMeta {
  type: MetaType;
  quantity?: number;
  equipped?: boolean;
  weapon?: WeaponMeta;
  armor?: ArmorMeta;
  shield?: ShieldMeta;
  imageUrl?: string;
}

const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();
const smartCapitalize = (name: string) => {
  const base = stripPriceParentheses(name).trim();
  if (!base) return '';
  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// Propriétés disponibles (cochent les règles STR/DEX en mêlée)
const PROPERTY_TAGS = ['Finesse', 'Légère', 'Lancer', 'Polyvalente', 'Deux mains', 'Lourde', 'Allonge', 'Munitions', 'Chargement'] as const;

export function CustomItemModal({
  onClose, onAdd,
}: {
  onClose: () => void;
  onAdd: (payload: { name: string; description: string; meta: ItemMeta }) => void;
}) {
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<MetaType>('equipment');
  const [description, setDescription] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);

  const [armBase, setArmBase] = React.useState<number>(12);
  const [armAddDex, setArmAddDex] = React.useState<boolean>(true);
  const [armDexCap, setArmDexCap] = React.useState<number | ''>(2);
  const [shieldBonus, setShieldBonus] = React.useState<number>(2);

  const [wDice, setWDice] = React.useState('1d6');
  const [wType, setWType] = React.useState<'Tranchant' | 'Perforant' | 'Contondant'>('Tranchant');
  const [wProps, setWProps] = React.useState(''); // fallback libre si aucune case cochée
  const [wRange, setWRange] = React.useState('Corps à corps');
  const [wCategory, setWCategory] = React.useState<WeaponCategory>('Armes courantes');
  const [wBonus, setWBonus] = React.useState<number | null>(null);
  const [imageUrl, setImageUrl] = React.useState('');
  const [propTags, setPropTags] = React.useState<string[]>([]);

  // ✅ NOUVEAU : États pour les bonus
const [bonusStr, setBonusStr] = React.useState<number | ''>('');
const [bonusDex, setBonusDex] = React.useState<number | ''>('');
const [bonusCon, setBonusCon] = React.useState<number | ''>('');
const [bonusInt, setBonusInt] = React.useState<number | ''>('');
const [bonusWis, setBonusWis] = React.useState<number | ''>('');
const [bonusCha, setBonusCha] = React.useState<number | ''>('');
const [bonusAC, setBonusAC] = React.useState<number | ''>('');

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

 const add = () => {
  const cleanNameRaw = name.trim();
  if (!cleanNameRaw) return toast.error('Nom requis');
  if (quantity <= 0) return toast.error('Quantité invalide');

  const cleanName = smartCapitalize(cleanNameRaw);

  const meta: ItemMeta = {
    type,
    quantity,
    equipped: false,
    imageUrl: imageUrl.trim() || undefined
  };

  if (type === 'armor') {
    const cap = armDexCap === '' ? null : Number(armDexCap);
    meta.armor = {
      base: armBase,
      addDex: armAddDex,
      dexCap: cap,
      label: `${armBase}${armAddDex ? ` + modificateur de Dex${cap != null ? ` (max ${cap})` : ''}` : ''}`
    };
  } else if (type === 'shield') {
    meta.shield = { bonus: shieldBonus };
  } else if (type === 'weapon') {
    // Construire la chaîne properties depuis la checklist ou le fallback libre
    const properties = (propTags.length ? propTags.join(', ') : wProps || '').trim();
    meta.weapon = {
      damageDice: wDice,
      damageType: wType,
      properties,
      range: wRange,
      category: wCategory,
      weapon_bonus: wBonus
    };
  }

  // ✅ NOUVEAU : Ajouter les bonus si présents (jewelry, equipment, tool, other)
  const hasBonuses = 
    bonusStr !== '' || bonusDex !== '' || bonusCon !== '' || 
    bonusInt !== '' || bonusWis !== '' || bonusCha !== '' || bonusAC !== '';

  if (hasBonuses) {
    meta.bonuses = {};
    if (bonusStr !== '') meta.bonuses.strength = Number(bonusStr);
    if (bonusDex !== '') meta.bonuses.dexterity = Number(bonusDex);
    if (bonusCon !== '') meta.bonuses.constitution = Number(bonusCon);
    if (bonusInt !== '') meta.bonuses.intelligence = Number(bonusInt);
    if (bonusWis !== '') meta.bonuses.wisdom = Number(bonusWis);
    if (bonusCha !== '') meta.bonuses.charisma = Number(bonusCha);
    if (bonusAC !== '') meta.bonuses.armor_class = Number(bonusAC);
  }

  onAdd({ name: cleanName, description: description.trim(), meta });
  onClose();
};
 
  return (
    <div className="fixed inset-0 z-[9999]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">Objet personnalisé</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nom</label>
            <input className="input-dark w-full px-3 py-2 rounded-md" value={name} onChange={e => setName(e.target.value)} placeholder="Nom de l'objet" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <select className="input-dark w-full px-3 py-2 rounded-md" value={type} onChange={e => setType(e.target.value as MetaType)}>
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
        </div>
 
        {type === 'weapon' && (
          <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300">Propriétés d'arme</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Dés de dégâts</label>
                <input className="input-dark w-full px-3 py-2 rounded-md" value={wDice} onChange={e => setWDice(e.target.value)} placeholder="ex: 1d6, 1d8..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type de dégâts</label>
                <select className="input-dark w-full px-3 py-2 rounded-md" value={wType} onChange={e => setWType(e.target.value as any)}>
                  <option>Tranchant</option>
                  <option>Perforant</option>
                  <option>Contondant</option>
                </select>
              </div>

             <div className="md:col-span-2">
  <label className="block text-xs text-gray-400 mb-1">Propriétés (cases à cocher)</label>
  <div className="grid grid-cols-2 gap-2">
    {PROPERTY_TAGS.map(tag => {
      const checked = propTags.includes(tag);
      return (
        <label key={tag} className="inline-flex items-center gap-2 text-xs text-gray-200">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setPropTags(prev => e.target.checked ? [...prev, tag] : prev.filter(t => t !== tag));
            }}
          />
          <span>{tag}</span>
        </label>
      );
    })}
  </div>
  <p className="text-[10px] text-gray-500 mt-1">
    Finesse/Légère/Lancer/Polyvalente influencent STR/DEX en mêlée; Munitions/Chargement aident à détecter une arme à distance.
  </p>
</div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Portée</label>
                <input className="input-dark w-full px-3 py-2 rounded-md" value={wRange} onChange={e => setWRange(e.target.value)} placeholder="ex: Corps à corps, 6 m..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Catégorie</label>
                <select className="input-dark w-full px-3 py-2 rounded-md" value={wCategory} onChange={e => setWCategory(e.target.value as WeaponCategory)}>
                  <option>Armes courantes</option>
                  <option>Armes de guerre</option>
                  <option>Armes de guerre dotées de la propriété Légère</option>
                  <option>Armes de guerre présentant la propriété Finesse ou Légère</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Bonus de l'arme (optionnel)</label>
                <input
                  type="number"
                  className="input-dark w-full px-3 py-2 rounded-md"
                  value={wBonus ?? ''}
                  onChange={e => setWBonus(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Ex: 1, 2, 3"
                />
              </div>
            </div>

          <div>
  <label className="block text-xs text-gray-400 mb-1">Propriétés (libre, optionnel)</label>
  <input
    className="input-dark w-full px-3 py-2 rounded-md"
    value={wProps}
    onChange={e => setWProps(e.target.value)}
    placeholder="Compléments éventuels (si aucune case cochée)"
  />
</div>
          </div>
        )}

        {type === 'armor' && (
          <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300">Propriétés d'armure</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className="block text-xs text-gray-400 mb-1">Base CA</label><input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={armBase} onChange={e => setArmBase(parseInt(e.target.value) || 0)} /></div>
              <div className="flex items-center gap-2"><input id="addDex" type="checkbox" checked={armAddDex} onChange={e => setArmAddDex(e.target.checked)} /><label htmlFor="addDex" className="text-sm text-gray-300">Ajouter DEX</label></div>
              <div><label className="block text-xs text-gray-400 mb-1">Cap DEX (vide = illimité)</label><input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={armDexCap} onChange={e => setArmDexCap(e.target.value ? parseInt(e.target.value) : ('' as any))} /></div>
            </div>
          </div>
        )}

        {type === 'shield' && (
          <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-300">Propriétés de bouclier</h4>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Bonus de bouclier</label>
              <input type="number" className="input-dark w-full px-3 py-2 rounded-md" value={shieldBonus} onChange={e => setShieldBonus(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        )}

        {/* ✅ NOUVEAU : Section bonus pour jewelry, equipment, tool, other */}
{(type === 'jewelry' || type === 'equipment' || type === 'tool' || type === 'other') && (
  <div className="mt-4 space-y-3 border-t border-gray-700 pt-4">
    <h4 className="text-sm font-medium text-gray-300">Bonus (optionnel)</h4>
    <p className="text-xs text-gray-500">
      Si cet objet confère des bonus, l'objet deviendra équipable/déséquipable.
    </p>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Force</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusStr} 
          onChange={e => setBonusStr(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Dextérité</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusDex} 
          onChange={e => setBonusDex(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Constitution</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusCon} 
          onChange={e => setBonusCon(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Intelligence</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusInt} 
          onChange={e => setBonusInt(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Sagesse</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusWis} 
          onChange={e => setBonusWis(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Charisme</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusCha} 
          onChange={e => setBonusCha(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Classe d'Armure</label>
        <input 
          type="number" 
          className="input-dark w-full px-3 py-2 rounded-md" 
          value={bonusAC} 
          onChange={e => setBonusAC(e.target.value ? parseInt(e.target.value) : '')} 
          placeholder="+0"
        />
      </div>
    </div>
  </div>
)}

        <div className="mt-4 border-t border-gray-700 pt-4">
          <ImageUrlInput value={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Quantité</label>
          <input type="number" min={1} className="input-dark w-full px-3 py-2 rounded-md" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
          <textarea className="input-dark w-full px-3 py-2 rounded-md" rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description de l'objet" />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-lg">Annuler</button>
          <button onClick={add} className="btn-primary px-4 py-2 rounded-lg">Ajouter</button>
        </div>
      </div>
    </div>
  );
}