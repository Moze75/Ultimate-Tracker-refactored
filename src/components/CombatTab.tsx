import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Settings, Trash2 } from 'lucide-react';
import { Player, Attack } from '../types/dnd';
import toast from 'react-hot-toast';
import { ConditionsSection } from './ConditionsSection';
import { DiceRollContext } from './ResponsiveGameLayout';
import { StandardActionsSection } from './StandardActionsSection';
import { AttackSection } from './Combat/AttackSection';
import { ConcentrationCheckModal } from './Combat/ConcentrationCheckModal';
import { attackService } from '../services/attackService';
import './combat-tab.css';
import { HPManagerConnected } from './Combat/HPManagerConnected';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

interface CombatTabProps {
  player: Player;
  inventory: any[];
  onUpdate: (player: Player) => void;
}

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
    weapon_bonus: attack?.weapon_bonus ?? null
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
      weapon_bonus: formData.weapon_bonus
    });
  };

  return createPortal(
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
    </div>,
    document.body
  );
};

export default function CombatTab({ player, inventory, onUpdate }: CombatTabProps) {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [editingAttack, setEditingAttack] = useState<Attack | null>(null);
  const [showAttackModal, setShowAttackModal] = useState(false);

  const [showConcentrationCheck, setShowConcentrationCheck] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);

  // ✨ UTILISATION DU CONTEXTE
  const context = React.useContext(DiceRollContext);
  console.log('🎲 [CombatTab] Context:', context);
  console.log('🎲 [CombatTab] rollDice existe?', typeof context?.rollDice);
  
  const { rollDice } = context;
  
  const deviceType = useResponsiveLayout();

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
    const equipmentBonuses = calculateEquipmentBonuses(inventory);
    const abilities = Array.isArray(player.abilities) ? player.abilities : [];

    if (attack.override_ability) {
      const ability = abilities.find((a) => a.name === attack.override_ability);
      const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
      const equipmentBonus = equipmentBonuses[attack.override_ability] || 0;
      const totalAbilityMod = baseAbilityMod + equipmentBonus;
      const masteryBonus = attack.expertise ? proficiencyBonus : 0;
      return totalAbilityMod + masteryBonus + weaponBonus;
    }

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
    const abilities = Array.isArray(player.abilities) ? player.abilities : [];

    if (attack.override_ability) {
      const ability = abilities.find((a) => a.name === attack.override_ability);
      const baseAbilityMod = ability?.score ? Math.floor((ability.score - 10) / 2) : 0;
      const equipmentBonus = equipmentBonuses[attack.override_ability] || 0;
      return baseAbilityMod + equipmentBonus + weaponBonus;
    }

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

  // ✨ FONCTIONS MODIFIÉES POUR UTILISER LE CONTEXTE
  const rollAttack = (attack: Attack) => {
    console.log('🎯 [CombatTab] rollAttack APPELÉ', attack.name);
    console.log('🎯 [CombatTab] rollDice disponible?', typeof rollDice);
    
    const attackBonus = getAttackBonus(attack);
    console.log('🎲 [CombatTab] Lancer attaque:', attack.name, 'bonus:', attackBonus);
    
    if (!rollDice) {
      console.error('❌ [CombatTab] rollDice est undefined !');
      return;
    }
    
    rollDice({
      type: 'attack',
      attackName: attack.name,
      diceFormula: '1d20',
      modifier: attackBonus
    });
  };

  const rollDamage = (attack: Attack) => {
    console.log('🎯 [CombatTab] rollDamage APPELÉ', attack.name);
    console.log('🎯 [CombatTab] rollDice disponible?', typeof rollDice);
    
    const damageBonus = getDamageBonus(attack);
    console.log('🎲 [CombatTab] Lancer dégâts:', attack.name, 'formule:', attack.damage_dice);
    
    if (!rollDice) {
      console.error('❌ [CombatTab] rollDice est undefined !');
      return;
    }
    
    rollDice({
      type: 'damage',
      attackName: attack.name,
      diceFormula: attack.damage_dice,
      modifier: damageBonus
    });
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

  return (
    <div className="space-y-6">
  {deviceType !== 'desktop' && (
  <HPManagerConnected
    player={player}
    onUpdate={(updatedPlayer) => {
      console.log('[CombatTab] onUpdate from HPManagerConnected', {
        before: { current_hp: player.current_hp, temporary_hp: player.temporary_hp },
        after: { current_hp: updatedPlayer.current_hp, temporary_hp: updatedPlayer.temporary_hp },
      });
      onUpdate(updatedPlayer);
    }}
    onConcentrationCheck={(dc) => {
      setConcentrationDC(dc);
      setShowConcentrationCheck(true);
    }}
  />
)}

      <AttackSection
        player={player} // ✅ Ajouté
        attacks={attacks}
        onAdd={() => {
          setEditingAttack(null);
          setShowAttackModal(true);
        }}
        onEdit={(attack) => {
          setEditingAttack(attack);
          setShowAttackModal(true);
        }}
        onDelete={deleteAttack}
        onRollAttack={rollAttack}
        onRollDamage={rollDamage}
        getAttackBonus={getAttackBonus}
        getDamageBonus={getDamageBonus}
        changeAmmoCount={changeAmmoCount}
        setAmmoCount={setAmmoCount}
      />

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
      
      {showConcentrationCheck && (
        <ConcentrationCheckModal
          player={player}
          concentrationDC={concentrationDC}
          onUpdate={onUpdate}
          onClose={() => setShowConcentrationCheck(false)}
        />
      )}
    </div>
  );
}