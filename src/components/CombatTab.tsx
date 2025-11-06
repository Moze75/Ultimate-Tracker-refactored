import React, { useState } from 'react';
import { Heart, Plus, Sword, Swords, Shield, Settings, Trash2, Brain } from 'lucide-react';
import { Player, Attack } from '../types/dnd'; 
import toast from 'react-hot-toast';
import { ConditionsSection } from './ConditionsSection';
import { DiceRoller } from '../components/DiceRoller';
import { StandardActionsSection } from './StandardActionsSection';
import { attackService } from '../services/attackService';
import { supabase } from '../lib/supabase';
import './combat-tab.css';
import { inferWeaponAbilityMod } from '../utils/inferWeaponAbility';

interface CombatTabProps {
  player: Player;
  inventory: any[];
  onUpdate: (player: Player) => void;
}

// ✅ NOUVEAU : Fonction pour calculer les bonus d'équipement depuis l'inventaire
const calculateEquipmentBonuses = (inventory: any[]): Record<string, number> => {
  const bonuses: Record<string, number> = {
    Force: 0,
    Dextérité: 0,
    Constitution: 0,
    Intelligence: 0,
    Sagesse: 0,
    Charisme: 0,
    armor_class: 0
  };

  if (!inventory || !Array.isArray(inventory)) return bonuses;

  for (const item of inventory) {
    try {
      const description = item.description || '';
      const metaLine = description
        .split('\n')
        .reverse()
        .find((l: string) => l.trim().startsWith('#meta:'));
      
      if (!metaLine) continue;
      
      const meta = JSON.parse(metaLine.trim().slice(6));
      
      if (meta.equipped && meta.bonuses) {
        if (meta.bonuses.strength) bonuses.Force += meta.bonuses.strength;
        if (meta.bonuses.dexterity) bonuses.Dextérité += meta.bonuses.dexterity;
        if (meta.bonuses.constitution) bonuses.Constitution += meta.bonuses.constitution;
        if (meta.bonuses.intelligence) bonuses.Intelligence += meta.bonuses.intelligence;
        if (meta.bonuses.wisdom) bonuses.Sagesse += meta.bonuses.wisdom;
        if (meta.bonuses.charisma) bonuses.Charisme += meta.bonuses.charisma;
        if (meta.bonuses.armor_class) bonuses.armor_class += meta.bonuses.armor_class;
      }
    } catch (e) {
      continue;
    }
  }

  return bonuses;
};

interface AttackEditModalProps {
  attack: Attack | null;
  onClose: () => void;
  onSave: (attack: Partial<Attack>) => void;
  onDelete?: () => void;
}

// Icône locale "Bow" (style Lucide)
const BowIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 20c6-4 6-12 0-16" />
    <path d="M4 4l8 8L4 20" />
    <path d="M22 2l-8 8" />
    <path d="M22 2l-4 2" />
    <path d="M22 2l-2 4" />
  </svg>
);

// Types de dégâts physiques uniquement
const PHYSICAL_DAMAGE_TYPES = ['Tranchant', 'Perforant', 'Contondant'] as const;
type PhysicalDamage = typeof PHYSICAL_DAMAGE_TYPES[number];

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
  '90 m'
];

// ✅ AJOUT : Liste des caractéristiques
const ABILITIES = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'] as const;
type Ability = typeof ABILITIES[number];

const AttackEditModal = ({ attack, onClose, onSave, onDelete }: AttackEditModalProps) => {
  const [formData, setFormData] = useState<{
    name: string;
    damage_dice: string;
    damage_type: PhysicalDamage;
    range: string;
    properties: string;
    manual_attack_bonus: number | null;
    manual_damage_bonus: number | null;
    expertise: boolean;
    ammo_type: string;
    override_ability: Ability | null; 
    weapon_bonus: number | null;
  }>({
    name: attack?.name || '',
    damage_dice: attack?.damage_dice || '1d8',
    damage_type: (PHYSICAL_DAMAGE_TYPES as readonly string[]).includes(attack?.damage_type || '')
      ? (attack?.damage_type as PhysicalDamage)
      : 'Tranchant',
    range: attack?.range || 'Corps à corps',
    properties: attack?.properties || '',
    manual_attack_bonus: attack?.manual_attack_bonus ?? null,
    manual_damage_bonus: attack?.manual_damage_bonus ?? null,
    expertise: attack?.expertise || false,
    ammo_type: (attack as any)?.ammo_type || '',
  override_ability: attack?.override_ability || null,
  weapon_bonus: attack?.weapon_bonus ?? null // ✅ AJOUT
});

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Le nom de l'attaque est obligatoire");
      return;
    }
    onSave({
      name: formData.name,
      damage_dice: formData.damage_dice,
      damage_type: formData.damage_type,
      range: formData.range,
      properties: formData.properties,
      manual_attack_bonus: formData.manual_attack_bonus,
      manual_damage_bonus: formData.manual_damage_bonus,
      expertise: formData.expertise,
      ammo_type: formData.ammo_type.trim() || null,
      override_ability: formData.override_ability,
      weapon_bonus: formData.weapon_bonus // ✅ AJOUT
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-100 mb-6">
          {attack ? "Modifier l'attaque" : 'Nouvelle attaque'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nom de l&apos;attaque</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
              placeholder="Ex: Épée longue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Dés de dégâts</label>
            <input
              type="text"
              value={formData.damage_dice}
              onChange={(e) => setFormData({ ...formData, damage_dice: e.target.value })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
              placeholder="Ex: 1d8, 2d6"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type de dégâts</label>
            <select
              value={formData.damage_type}
              onChange={(e) => setFormData({ ...formData, damage_type: e.target.value as PhysicalDamage })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
            >
              {PHYSICAL_DAMAGE_TYPES.map((dt) => (
                <option key={dt} value={dt}>
                  {dt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Portée</label>
            <select
              value={formData.range}
              onChange={(e) => setFormData({ ...formData, range: e.target.value })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
            >
              {RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          {/* Type de munition */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type de munition (optionnel)</label>
            <input
              type="text"
              value={formData.ammo_type}
              onChange={(e) => setFormData({ ...formData, ammo_type: e.target.value })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
              placeholder="Ex: Flèches, Balles, Carreaux"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Propriétés (optionnel)</label>
            <input
              type="text"
              value={formData.properties}
              onChange={(e) => setFormData({ ...formData, properties: e.target.value })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
              placeholder="Ex: Finesse, Polyvalente"
            />
          </div>

          {/* ✅ AJOUT : Sélecteur de caractéristique */}
          <div className="border-t border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Caractéristique pour les calculs
              <span className="text-xs text-gray-500 ml-2">(optionnel - remplace le calcul auto)</span>
            </label>
            <select
              value={formData.override_ability || ''}
              onChange={(e) => setFormData({ ...formData, override_ability: e.target.value as Ability || null })}
              className="input-dark w-full px-3 py-2 rounded-md border border-gray-600 focus:border-red-500"
            >
              <option value="">Calcul automatique (selon classe/portée)</option>
              {ABILITIES.map((ability) => (
                <option key={ability} value={ability}>
                  {ability}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Ex: Choisir "Charisme" pour un Occultiste utilisant Coup au but
            </p>
          </div>

 


             {/* ✅ Bonus de l'arme (lecture seule) */}
          <div className="border-t border-gray-700 pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bonus de l'arme
              <span className="text-xs text-gray-500 ml-2">(défini dans l'onglet Équipement)</span>
            </label>
            <div className="bg-gray-700/50 px-4 py-3 rounded-md border border-gray-600">
              <span className="text-gray-100 font-medium">
                {formData.weapon_bonus !== null && formData.weapon_bonus !== undefined 
                  ? `+${formData.weapon_bonus}` 
                  : 'Aucun bonus'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💡 Pour modifier le bonus de cette arme, allez dans <span className="text-purple-400 font-medium">Onglet Sac → Paramètres de l'arme</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, expertise: !formData.expertise })}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                formData.expertise ? 'bg-red-500 border-red-500 text-white' : 'bg-gray-700 border-gray-600 hover:border-gray-500'
              }`}
            >
              {formData.expertise && (
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
            <label
              className="text-sm font-medium text-gray-300 cursor-pointer"
              onClick={() => setFormData({ ...formData, expertise: !formData.expertise })}
            >
              Maîtrise (ajoute le bonus de maîtrise)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={handleSave} className="btn-primary flex-1 px-4 py-2 rounded-lg">
              Sauvegarder
            </button>
            {attack && onDelete && (
              <button
                onClick={onDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button onClick={onClose} className="btn-secondary px-4 py-2 rounded-lg">
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function CombatTab({ player, inventory, onUpdate }: CombatTabProps) {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [editingAttack, setEditingAttack] = useState<Attack | null>(null);
  const [showAttackModal, setShowAttackModal] = useState(false);

  const [showMaxHpModal, setShowMaxHpModal] = useState(false);
  const [newMaxHp, setNewMaxHp] = useState(player.max_hp.toString());
  const [damageValue, setDamageValue] = useState('');
  const [healValue, setHealValue] = useState('');
  const [tempHpValue, setTempHpValue] = useState('');

  const [showConcentrationCheck, setShowConcentrationCheck] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);
  
  const [diceRollerOpen, setDiceRollerOpen] = useState(false);
  const [rollData, setRollData] = useState<{
    type: 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null>(null);

  React.useEffect(() => {
    fetchAttacks();
  }, [player.id]);

  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        if (e?.detail?.playerId && e.detail.playerId !== player.id) return;
      } catch {}
      fetchAttacks();
    };
    window.addEventListener('attacks:changed', handler);
    const visHandler = () => {
      if (document.visibilityState === 'visible') fetchAttacks();
    };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('attacks:changed', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [player.id]);

  const fetchAttacks = async () => {
    try {
      const attacksData = await attackService.getPlayerAttacks(player.id);
      setAttacks(attacksData);
    } catch (error) {
      console.error('Erreur lors de la récupération des attaques:', error);
      toast.error('Erreur lors de la récupération des attaques');
    }
  };

  const saveAttack = async (attackData: Partial<Attack>) => {
    try {
      if (editingAttack) {
        const updatedAttack = await attackService.updateAttack({
          ...attackData,
          id: editingAttack.id,
          attack_type: 'physical',
          spell_level: null
        });

        if (updatedAttack) {
          setAttacks(attacks.map((attack) => (attack.id === editingAttack.id ? updatedAttack : attack)));
          toast.success('Attaque modifiée');
        }
      } else {
        const newAttack = await attackService.addAttack({
          player_id: player.id,
          ...attackData,
          attack_type: 'physical',
          spell_level: null,
          ammo_count: 0
        });

        if (newAttack) {
          setAttacks([...attacks, newAttack]);
          toast.success('Attaque ajoutée');
        }
      }

      setEditingAttack(null);
      setShowAttackModal(false);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'attaque:", error);
      toast.error("Erreur lors de la sauvegarde de l'attaque");
    }
  };

  const deleteAttack = async (attackId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette attaque ?')) return;

    try {
      const success = await attackService.removeAttack(attackId);

      if (success) {
        setAttacks(attacks.filter((attack) => attack.id !== attackId));
        setEditingAttack(null);
        setShowAttackModal(false);
        toast.success('Attaque supprimée');
      } else {
        throw new Error('Échec de la suppression');
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de l'attaque:", error);
      toast.error("Erreur lors de la suppression de l'attaque");
    }
  };

const getAttackBonus = (attack: Attack): number => {
  const weaponBonus = attack.weapon_bonus ?? 0;
  const proficiencyBonus = player.stats?.proficiency_bonus || 2;
  
  // ✅ Calculer les bonus d'équipement
  const equipmentBonuses = calculateEquipmentBonuses(inventory);

  // ✅ AJOUT : Protection pour éviter l'erreur .find()
  const abilities = Array.isArray(player.abilities) ? player.abilities : [];

  // 1) override_ability prime
  if (attack.override_ability) {
    const ability = abilities.find((a) => a.name === attack.override_ability);
    const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
    const equipmentBonus = equipmentBonuses[attack.override_ability] || 0;
    const totalAbilityMod = baseAbilityMod + equipmentBonus;
    const masteryBonus = attack.expertise ? proficiencyBonus : 0;
    return totalAbilityMod + masteryBonus + weaponBonus;
  }

  // 2) inférence depuis properties/portée
  const inferredAbilityName = (() => {
    const props = (attack.properties || '').toLowerCase();
    const range = (attack.range || '').toLowerCase();
    const nameLower = (attack.name || '').toLowerCase();
    
    const isThrown = 
      props.includes('lancer') || 
      props.includes('jet') || 
      nameLower.includes('lance') || 
      nameLower.includes('javeline') || 
      nameLower.includes('hachette');
    
    if (isThrown) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10;
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité';
    }
    
    const hasFinesse = props.includes('finesse');
    const hasLight = props.includes('légère') || props.includes('legere');
    const hasVersatile = props.includes('polyvalente') || props.includes('versatile');
    const hasHeavy = props.includes('lourde') || props.includes('lourd') || props.includes('heavy');
    
    if (hasFinesse || hasLight || hasVersatile) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10;
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité';
    }

    if (hasVersatile && !hasHeavy) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10;
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité';
    }
    
    const isPureRanged = 
      props.includes('munitions') || 
      props.includes('chargement') || 
      nameLower.includes('arc') || 
      nameLower.includes('arbalète');
    
    if (isPureRanged) {
      return 'Dextérité';
    }
    
    if (range !== 'corps à corps' && range !== 'contact' && range.includes('m')) {
      return 'Dextérité';
    }
    
    return 'Force';
  })();
  
  const ability = abilities.find(a => a.name === inferredAbilityName);
  const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
  const equipmentBonus = equipmentBonuses[inferredAbilityName] || 0;
  const totalAbilityMod = baseAbilityMod + equipmentBonus;
  const masteryBonus = attack.expertise ? proficiencyBonus : 0;
  return totalAbilityMod + masteryBonus + weaponBonus;
};

const getDamageBonus = (attack: Attack): number => {
  const weaponBonus = attack.weapon_bonus ?? 0;
  
  const equipmentBonuses = calculateEquipmentBonuses(inventory);

  // ✅ AJOUT : Protection pour éviter l'erreur .find()
  const abilities = Array.isArray(player.abilities) ? player.abilities : [];

  // 1) override_ability prime
  if (attack.override_ability) {
    const ability = abilities.find((a) => a.name === attack.override_ability);
    const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
    const equipmentBonus = equipmentBonuses[attack.override_ability] || 0;
    return baseAbilityMod + equipmentBonus + weaponBonus;
  }

  // 2) inférence depuis properties/portée
  const inferredAbilityName = (() => {
    const props = (attack.properties || '').toLowerCase();
    const range = (attack.range || '').toLowerCase();
    const nameLower = (attack.name || '').toLowerCase();
    
    const hasFinesse = props.includes('finesse');
    const hasLight = props.includes('légère') || props.includes('legere');
    const hasVersatile = props.includes('polyvalente') || props.includes('versatile');
    const hasHeavy = props.includes('lourde') || props.includes('lourd') || props.includes('heavy');
    
    const isThrown = 
      props.includes('lancer') || 
      props.includes('jet') || 
      nameLower.includes('lance') || 
      nameLower.includes('javeline') || 
      nameLower.includes('hachette');
    
    if (isThrown) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10; 
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité'; 
    }
    
    if (hasFinesse || hasLight) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10;
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité';
    }
    
    if (hasVersatile && !hasHeavy) {
      const strAbility = abilities.find(a => a.name === 'Force');
      const dexAbility = abilities.find(a => a.name === 'Dextérité');
      const strScore = strAbility?.score || 10;
      const dexScore = dexAbility?.score || 10;
      return strScore >= dexScore ? 'Force' : 'Dextérité';
    }
    
    const isPureRanged = 
      props.includes('munitions') || 
      props.includes('chargement') || 
      nameLower.includes('arc') || 
      nameLower.includes('arbalète');
    
    if (isPureRanged) {
      return 'Dextérité';
    }
    
    if (range !== 'corps à corps' && range !== 'contact' && range.includes('m')) {
      return 'Dextérité';
    }
    
    return 'Force';
  })();
  
  const ability = abilities.find(a => a.name === inferredAbilityName);
  const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
  const equipmentBonus = equipmentBonuses[inferredAbilityName] || 0;
  return baseAbilityMod + equipmentBonus + weaponBonus;
};

const rollAttack = (attack: Attack) => {
  const attackBonus = getAttackBonus(attack);
  setRollData({
    type: 'attack',
    attackName: attack.name,
    diceFormula: '1d20',
    modifier: attackBonus
  });
  setDiceRollerOpen(true);
};
  
  const rollDamage = (attack: Attack) => {
    const damageBonus = getDamageBonus(attack);
    setRollData({
      type: 'damage',
      attackName: attack.name,
      diceFormula: attack.damage_dice,
      modifier: damageBonus
    });
    setDiceRollerOpen(true);
  };

  const setAmmoCount = async (attack: Attack, next: number) => {
    const clamped = Math.max(0, Math.floor(next || 0));
    try {
      const updated = await attackService.updateAttack({ id: attack.id, ammo_count: clamped });
      if (!updated) throw new Error('update failed');
      setAttacks((prev) => prev.map((a) => (a.id === attack.id ? { ...a, ammo_count: clamped } : a)));
    } catch (e) {
      console.error('Erreur maj munitions:', e);
      toast.error('Erreur lors de la mise à jour des munitions');
    }
  };

  const changeAmmoCount = (attack: Attack, delta: number) => {
    const current = attack.ammo_count ?? 0;
    setAmmoCount(attack, current + delta);
  };

  const renderAttackCard = (attack: Attack) => {
    const dmgBonus = getDamageBonus(attack);
    const dmgLabel = `${attack.damage_dice}${dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`) : ''}`;
    const ammoType = (attack as any).ammo_type || '';
    const ammoCount = (attack as any).ammo_count ?? 0;

    // ✅ AJOUT : Afficher la caractéristique override si définie
    const overrideLabel = attack.override_ability ? ` (${attack.override_ability})` : '';

    return (
      <div key={attack.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h4 className="font-medium text-gray-100 text-base">{attack.name}</h4>
            <p className="text-sm text-gray-400">
              {attack.damage_type} • {attack.range}
              {overrideLabel && <span className="text-purple-400">{overrideLabel}</span>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setEditingAttack(attack);
                setShowAttackModal(true);
              }}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
              title="Modifier l'attaque"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={() => deleteAttack(attack.id)}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-900/30 rounded transition-colors"
              title="Supprimer l'attaque"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 text-sm items-stretch">
          <div className="flex-1 flex flex-col">
            <button
              onClick={() => rollAttack(attack)}
              className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded-md transition-colors flex items-center justify-center"
            >
              Attaque : 1d20+{getAttackBonus(attack)}
            </button>

            {ammoType ? (
              <div
                className="mt-2 px-3 py-2 rounded-md flex items-center justify-center gap-2 bg-transparent"
                aria-hidden
              >
                <BowIcon className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-medium text-gray-100">{ammoType}</span>
              </div>
            ) : (
              <div className="mt-2" />
            )}
          </div>

          <div className="flex-1 flex flex-col">
            <button
              onClick={() => rollDamage(attack)}
              className="bg-orange-600/60 hover:bg-orange-500/60 text-white px-3 py-2 rounded-md transition-colors flex items-center justify-center"
            >
              Dégâts : {dmgLabel}
            </button>
            {ammoType ? (
              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => changeAmmoCount(attack, -1)}
                  disabled={(ammoCount ?? 0) <= 0}
                  className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200"
                  title="Retirer une munition"
                >
                  −
                </button>
                <input
                  type="number"
                  value={ammoCount}
                  min={0}
                  onChange={(e) => setAmmoCount(attack, Number(e.target.value))}
                  className="w-16 text-center input-dark px-2 py-1 rounded-md border border-gray-600 focus:border-red-500"
                />
                <button
                  onClick={() => changeAmmoCount(attack, +1)}
                  className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                  title="Ajouter une munition"
                >
                  +
                </button>
              </div>
            ) : (
              <div className="mt-2" />
            )}
          </div>
        </div>
      </div>
    );
  };

  // ... (reste du code HP, soins, etc. inchangé)

  const totalHP = player.current_hp + player.temporary_hp;
  const isCriticalHealth = totalHP <= Math.floor(player.max_hp * 0.20);

  const getWoundLevel = () => {
    const percentage = (totalHP / player.max_hp) * 100;
    if (totalHP <= 0) return 'Mort';
    if (percentage >= 1 && percentage <= 30) return 'Blessures critiques';
    if (percentage > 30 && percentage <= 60) return 'Blessures importantes';
    if (percentage > 60 && percentage <= 75) return 'Blessures';
    if (percentage > 75 && percentage <= 90) return 'Blessures légères';
    if (percentage > 90 && percentage <= 99) return 'Égratignures';
    return 'En pleine forme';
  };

  const getWoundColor = () => {
    const percentage = (totalHP / player.max_hp) * 100;
    if (totalHP <= 0) return 'text-black';
    if (percentage >= 1 && percentage <= 30) return 'text-red-600';
    if (percentage > 30 && percentage <= 60) return 'text-red-500';
    if (percentage > 60 && percentage <= 75) return 'text-orange-500';
    if (percentage > 75 && percentage <= 90) return 'text-yellow-500';
    if (percentage > 90 && percentage <= 99) return 'text-yellow-400';
    return 'text-green-500';
  };

  const getHPBarColor = () => {
    const percentage = (player.current_hp / player.max_hp) * 100;
    if (totalHP <= 0) return 'from-black to-gray-800';
    if (percentage >= 1 && percentage <= 30) return 'from-red-600 to-red-700';
    if (percentage > 30 && percentage <= 60) return 'from-red-500 to-red-600';
    if (percentage > 60 && percentage <= 75) return 'from-orange-500 to-red-500';
    if (percentage > 75 && percentage <= 90) return 'from-yellow-500 to-orange-500';
    if (percentage > 90 && percentage <= 99) return 'from-yellow-400 to-yellow-500';
    return 'from-green-500 to-green-600';
  };

  const applyDamage = async () => {
  const damage = parseInt(damageValue) || 0;
  if (damage <= 0) return;

  let newCurrentHP = player.current_hp;
  let newTempHP = player.temporary_hp;

  if (newTempHP > 0) {
    if (damage >= newTempHP) {
      const remainingDamage = damage - newTempHP;
      newTempHP = 0;
      newCurrentHP = Math.max(0, newCurrentHP - remainingDamage);
    } else {
      newTempHP = newTempHP - damage;
    }
  } else {
    newCurrentHP = Math.max(0, newCurrentHP - damage);
  }

  await updateHP(newCurrentHP, newTempHP);
  setDamageValue('');

  const hpElement = document.querySelector('.hp-bar');
  if (hpElement) {
    hpElement.classList.add('damage-animation');
    setTimeout(() => hpElement.classList.remove('damage-animation'), 600);
  }

  toast.success(`${damage} dégâts appliqués`);

  // ✅ NOUVEAU : Vérifier la concentration
  if (player.is_concentrating) {
    const dc = Math.max(10, Math.floor(damage / 2));
    setConcentrationDC(dc);
    setShowConcentrationCheck(true);
  }
};

  const applyHealing = async () => {
    const healing = parseInt(healValue) || 0;
    if (healing <= 0) return;

    const newCurrentHP = Math.min(player.max_hp, player.current_hp + healing);
    await updateHP(newCurrentHP);
    setHealValue('');

    const hpElement = document.querySelector('.hp-bar');
    if (hpElement) {
      hpElement.classList.add('heal-animation');
      setTimeout(() => hpElement.classList.remove('heal-animation'), 600);
    }

    toast.success(`${healing} PV récupérés`);
  };

  const applyTempHP = async () => {
    const tempHP = parseInt(tempHpValue) || 0;
    if (tempHP <= 0) return;

    const newTempHP = Math.max(player.temporary_hp, tempHP);
    await updateHP(player.current_hp, newTempHP);
    setTempHpValue('');

    toast.success(`${newTempHP} PV temporaires appliqués`);
  };

  const updateHP = async (newCurrentHP: number, newTempHP?: number) => {
    const clampedHP = Math.max(0, Math.min(player.max_hp, newCurrentHP));
    const clampedTempHP = Math.max(0, newTempHP ?? player.temporary_hp);

    try {
      const updateData: any = { current_hp: clampedHP };
      if (newTempHP !== undefined) updateData.temporary_hp = clampedTempHP;

      const { error } = await supabase.from('players').update(updateData).eq('id', player.id);
      if (error) throw error;

      onUpdate({ ...player, current_hp: clampedHP, temporary_hp: clampedTempHP });
    } catch (error) {
      console.error('Erreur lors de la mise à jour des PV:', error);
      toast.error('Erreur lors de la mise à jour des PV');
    }
  };

  const physicalAttacks = attacks.filter((a) => (a.attack_type || 'physical') === 'physical');

  return (
    <div className="space-y-6">
      {/* Points de vie */}
      <div className="stat-card">
        <div className="stat-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-5 h-5 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Points de vie</h3>
              <p className={`text-sm font-medium ${getWoundColor()}`}>{getWoundLevel()}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none select-none">
                <span className="text-white font-bold text-sm drop-shadow-lg">
                  {totalHP} / {player.max_hp}
                </span>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-8 overflow-hidden relative">
                <div
                  className={`hp-bar hp-bar-main h-full transition-all duration-500 bg-gradient-to-r ${getHPBarColor()} ${
                    isCriticalHealth ? 'heartbeat-animation' : ''
                  }`}
                  style={{ width: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%` }}
                />
                {player.temporary_hp > 0 && (
                  <div
                    className="hp-bar-temp absolute top-0 h-full bg-gradient-to-r from-blue-500 to-blue-400"
                    style={{
                      left: `${Math.min(100, (player.current_hp / player.max_hp) * 100)}%`,
                      width: `${Math.min(
                        100 - (player.current_hp / player.max_hp) * 100,
                        (player.temporary_hp / player.max_hp) * 100
                      )}%`
                    }}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center">
                  <input
                    type="number"
                    value={damageValue}
                    onChange={(e) => setDamageValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && applyDamage()}
                    className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    onClick={applyDamage}
                    disabled={!damageValue || parseInt(damageValue) <= 0}
                    className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-red-500 rounded-r-md text-sm font-medium transition-colors"
                  >
                    OK
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-red-500 mt-1">
                  <Sword size={16} />
                  <span>Dégâts</span>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center">
                  <input
                    type="number"
                    value={healValue}
                    onChange={(e) => setHealValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && applyHealing()}
                    className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    onClick={applyHealing}
                    disabled={!healValue || parseInt(healValue) <= 0}
                    className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-green-400 rounded-r-md text-sm font-medium transition-colors"
                  >
                    OK
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-green-400 mt-1">
                  <Heart size={16} />
                  <span>Soins</span>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-2">
                <div className="flex items-center">
                  <input
                    type="number"
                    value={tempHpValue}
                    onChange={(e) => setTempHpValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && applyTempHP()}
                    className="input-dark w-16 px-2 py-2 rounded-l-md text-center text-sm"
                    placeholder="0"
                    min="0"
                  />
                  <button
                    onClick={applyTempHP}
                    disabled={!tempHpValue || parseInt(tempHpValue) <= 0}
                    className="px-3 py-2 bg-transparent hover:bg-gray-600/30 disabled:bg-transparent disabled:cursor-not-allowed text-blue-400 rounded-r-md text-sm font-medium transition-colors"
                  >
                    OK
                  </button>
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-blue-400 mt-1">
                  <Shield size={16} />
                  <span>PV Temp</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attaques */}
      <div className="stat-card">
        <div className="stat-header flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-100">Attaques</h3>
          </div>
          <button
            onClick={() => {
              setEditingAttack(null);
              setShowAttackModal(true);
            }}
            className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
            title="Ajouter une attaque"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {physicalAttacks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Sword className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune attaque configurée</p>
              <p className="text-sm">Equippez une arme dans l'onglet Sac</p>
              <p className="text-sm">ou bien cliquez sur + pour ajouter une attaque</p>
            </div>
          ) : (
            <div className="space-y-2">{physicalAttacks.map(renderAttackCard)}</div>
          )}
        </div>
      </div>

      {showAttackModal && (
        <AttackEditModal
          attack={editingAttack}
          onClose={() => {
            setShowAttackModal(false);
            setEditingAttack(null);
          }}
          onSave={saveAttack}
          onDelete={editingAttack ? () => deleteAttack(editingAttack.id) : undefined}
        />
      )}

      <StandardActionsSection player={player} onUpdate={onUpdate} />
      <ConditionsSection player={player} onUpdate={onUpdate} />

      <DiceRoller isOpen={diceRollerOpen} onClose={() => setDiceRollerOpen(false)} rollData={rollData} />
 {/* ✅ AJOUTEZ LE MODAL ICI, JUSTE APRÈS DiceRoller */}
      {showConcentrationCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-purple-500/40 shadow-xl shadow-purple-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Test de Concentration</h3>
                <p className="text-sm text-purple-400">Vous avez subi des dégâts !</p>
              </div>
            </div>

            <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
              <p className="text-gray-300 mb-3">
                Vous devez réussir un jet de sauvegarde de Constitution pour maintenir votre concentration sur{' '}
                <span className="text-purple-400 font-semibold">{player.concentration_spell || 'votre sort'}</span>.
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">DD du test :</span>
                  <span className="text-2xl font-bold text-red-400">
                    {concentrationDC}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Votre modificateur de CON :</span>
<span className="text-xl font-semibold text-green-400">
  {(() => {
    // ✅ AJOUT : Protection
    const abilities = Array.isArray(player.abilities) ? player.abilities : [];
    const conAbility = abilities.find(a => a.name === 'Constitution');
    const conMod = conAbility?.modifier || 0;
    return conMod >= 0 ? `+${conMod}` : conMod;
  })()}
</span>
                </div>
              </div>
            </div>

            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-purple-400">Rappel :</span> Lancez 1d20 et ajoutez votre modificateur de Constitution. 
                Si le résultat est égal ou supérieur à {concentrationDC}, vous maintenez votre concentration.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    const { error } = await supabase
                      .from('players')
                      .update({
                        is_concentrating: false,
                        concentration_spell: null
                      })
                      .eq('id', player.id);

                    if (error) throw error;

                    onUpdate({
                      ...player,
                      is_concentrating: false,
                      concentration_spell: null
                    });

                    setShowConcentrationCheck(false);
                    toast.error('Concentration perdue');
                  } catch (error) {
                    console.error('Erreur lors de l\'interruption de la concentration:', error);
                    toast.error('Erreur lors de la mise à jour');
                  }
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                J'ai raté le test
              </button>
              
              <button
                onClick={() => {
                  setShowConcentrationCheck(false);
                  toast.success('Concentration maintenue !');
                }}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
              >
                J'ai réussi le test
              </button>
            </div>

            <button
              onClick={() => setShowConcentrationCheck(false)}
              className="w-full mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
            >
              Fermer (je gère plus tard)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}