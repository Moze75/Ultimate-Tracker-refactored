import React, { useState } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { Ability } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { FEAT_BONUSES, normalizeFeatName, AbilityName } from '../data/featBonuses';

// Ajouter après les imports (vers ligne 10)

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 */
/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 * en tenant compte des bonus d'équipement
 */
const calculateUnarmoredACFromAbilities = (
  playerClass: string | null | undefined,
  abilities: Ability[],
  equipmentBonuses: { Force: number; Dextérité: number; Constitution: number; Intelligence: number; Sagesse: number; Charisme: number; armor_class: number }
): number => {
  const getModifier = (score: number) => Math.floor((score - 10) / 2);
  
  const dexAbility = abilities.find(a => a. name === 'Dextérité');
  const baseDexMod = dexAbility ? getModifier(dexAbility.score) : 0;
  const dexMod = baseDexMod + (equipmentBonuses. Dextérité || 0);

  if (playerClass === 'Moine') {
    const wisAbility = abilities.find(a => a.name === 'Sagesse');
    const baseWisMod = wisAbility ? getModifier(wisAbility.score) : 0;
    const wisMod = baseWisMod + (equipmentBonuses.Sagesse || 0);
    return 10 + dexMod + wisMod;
  }

  if (playerClass === 'Barbare') {
    const conAbility = abilities.find(a => a.name === 'Constitution'); 
    const baseConMod = conAbility ? getModifier(conAbility.score) : 0;
    const conMod = baseConMod + (equipmentBonuses.Constitution || 0);
    return 10 + dexMod + conMod;
  }

  return 10 + dexMod;
};


interface HorizontalAbilityScoresProps {
  abilities: Ability[];
  inventory?: any[];
  onAbilityClick?: (ability: Ability) => void;
  onSavingThrowClick?: (ability: Ability) => void;
  player?: any;
  onUpdate?: (player: any) => void;
}

export function HorizontalAbilityScores({
  abilities,
  inventory = [],
  onAbilityClick,
  onSavingThrowClick,
  player,
  onUpdate
}: HorizontalAbilityScoresProps) {
  const [editing, setEditing] = useState(false);
  const [localAbilities, setLocalAbilities] = useState<Ability[]>(abilities);

  React.useEffect(() => {
    setLocalAbilities(abilities);
  }, [abilities]);

  const calculateEquipmentBonuses = () => {
    const bonuses = {
      Force: 0,
      Dextérité: 0,
      Constitution: 0,
      Intelligence: 0,
      Sagesse: 0,
      Charisme: 0,
      armor_class: 0
    };

    if (inventory && Array.isArray(inventory)) {
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
    }
    return bonuses;
  };

  const calculateFeatBonuses = () => {
    const bonuses: Record<AbilityName, number> = {
      Force: 0,
      Dextérité: 0,
      Constitution: 0,
      Intelligence: 0,
      Sagesse: 0,
      Charisme: 0
    };

    if (!player?.stats) return bonuses;

    const feats = player.stats.feats || {};
    const featAbilityChoices: Record<string, AbilityName> = player.stats.feat_ability_choices || {};
    
    const allFeats: string[] = [
      ...(Array.isArray(feats.generals) ? feats.generals : []),
      ...(Array.isArray(feats.origins) ? feats.origins : []),
      ...(Array.isArray(feats.styles) ? feats.styles : [])
    ];

    for (const featName of allFeats) {
      const normalizedName = normalizeFeatName(featName);
      const featBonus = FEAT_BONUSES[normalizedName];
      
      if (featBonus) {
        const chosenAbility = featAbilityChoices[normalizedName];
        if (chosenAbility && featBonus.choices.includes(chosenAbility)) {
          bonuses[chosenAbility] += featBonus.amount;
        }
      }
    }

    return bonuses;
  };
  
  const getModifier = (score: number) => Math.floor((score - 10) / 2);
  const getProficiencyBonus = (level: number): number => {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
  };

    const equipmentBonuses = calculateEquipmentBonuses();
  const featBonuses = calculateFeatBonuses();

  const handleScoreChange = (index: number, newScore: number) => {
    const updatedAbilities = [...localAbilities];
    updatedAbilities[index] = {
      ...updatedAbilities[index],
      score: Math.max(1, Math.min(30, newScore))
    };
    
    const profBonus = player ? getProficiencyBonus(player.level) : 2;
    updatedAbilities[index].modifier = getModifier(updatedAbilities[index].score);
    
    const isSavingThrowProficient = updatedAbilities[index].savingThrow !== abilities[index].modifier;
    updatedAbilities[index].savingThrow = updatedAbilities[index].modifier + (isSavingThrowProficient ? profBonus : 0);
    
    updatedAbilities[index].skills = updatedAbilities[index].skills.map(skill => ({
      ...skill,
      bonus: updatedAbilities[index].modifier + (skill.isProficient ? 
        (skill.hasExpertise ? profBonus * 2 : profBonus) : 0)
    }));

    setLocalAbilities(updatedAbilities);
  };

  const handleSavingThrowToggle = (index: number) => {
    const updatedAbilities = [...localAbilities];
    const ability = updatedAbilities[index];
    const profBonus = player ? getProficiencyBonus(player.level) : 2;
    const isCurrentlyProficient = ability.savingThrow !== ability.modifier;
    
    updatedAbilities[index] = {
      ...ability,
      savingThrow: ability.modifier + (isCurrentlyProficient ? 0 : profBonus)
    };
    
    setLocalAbilities(updatedAbilities);
  };

const handleSave = async () => {
  if (! player || !onUpdate) {
    toast.error('Impossible de sauvegarder');
    return;
  }

  try {
    const dexScore = localAbilities.find(a => a.name === 'Dextérité')?. score ?? 10;
    const equipmentBonuses = calculateEquipmentBonuses(); // ✅ Récupérer les bonus
    const dexMod = getModifier(dexScore) + (equipmentBonuses.Dextérité || 0); // ✅ Inclure le bonus

    // Vérifier si une armure est équipée
    const hasArmorEquipped = ! !(player.equipment?. armor?.armor_formula);

    // Recalculer la CA si Moine/Barbare sans armure
    let newArmorClass = player.stats?.armor_class ?? (10 + dexMod);
    
    if (!hasArmorEquipped && (player.class === 'Moine' || player.class === 'Barbare')) {
      // ✅ Passer les bonus d'équipement au calcul
      newArmorClass = calculateUnarmoredACFromAbilities(player.class, localAbilities, equipmentBonuses);
      console.log(`[HorizontalAbilityScores] ✅ Recalcul CA ${player.class}: ${newArmorClass} (avec bonus équipement)`);
    } else if (! hasArmorEquipped) {
      newArmorClass = 10 + dexMod;
    }

    const mergedStats = {
      ...player.stats,
      proficiency_bonus: getProficiencyBonus(player.level),
      initiative: dexMod,
      armor_class: newArmorClass,
    };

    const { error } = await supabase
      .from('players')
      .update({ 
        abilities: localAbilities,
        stats: mergedStats
      })
      .eq('id', player.id);

    if (error) throw error;

    onUpdate({
      ...player,
      abilities: localAbilities,
      stats: mergedStats
    });

    setEditing(false);
    toast.success('Caractéristiques mises à jour');
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    toast.error('Erreur lors de la mise à jour');
  }
};

  const handleCancel = () => {
    setLocalAbilities(abilities);
    setEditing(false);
  };

  const displayAbilities = editing ? localAbilities : abilities;

  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Caractéristiques</h3>
        {player && onUpdate && (
          <div className="flex items-center gap-2">
            {editing && (
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                title="Annuler"
              >
                <X size={20} />
              </button>
            )}
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors flex items-center justify-center"
              title={editing ? 'Sauvegarder' : 'Modifier'}
            >
              {editing ? <Save size={20} /> : <Settings size={20} />}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-6 gap-3 flex-1">
        {displayAbilities.map((ability, index) => {
          const equipmentBonus = equipmentBonuses[ability.name as keyof typeof equipmentBonuses] || 0;
          const featBonus = featBonuses[ability.name as keyof typeof featBonuses] || 0;
          const totalBonus = equipmentBonus + featBonus;
          const baseModifier = getModifier(ability.score);
          const displayModifier = baseModifier + totalBonus;

return (
  <div key={ability.name} className="flex flex-col items-center">
    <div
      className={`relative w-24 h-32 flex flex-col items-center justify-start transition-opacity ${
        editing ? 'opacity-60' : 'cursor-pointer hover:opacity-80'
      }`}
      style={{
        backgroundImage: 'url(/background/contenant_stats.png)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        filter: 'sepia(0.6) saturate(1.5) hue-rotate(-10deg) brightness(0.95)'
      }}
                onClick={() => !editing && onAbilityClick && onAbilityClick(ability)}
                title={editing ? '' : `Cliquer pour lancer 1d20+${ability.modifier}`}
              >
                <div className="absolute top-5 left-0 right-0 flex flex-col items-center pointer-events-none">
                  <h4 className="text-xs font-semibold text-gray-100 capitalize tracking-wide">
                    {ability.name}
                  </h4>
                </div>

                {totalBonus !== 0 && (
                  <div className="absolute -top-0 left-1/2 transform -translate-x-1/2 pointer-events-none">
                    <div className="text-[9px] text-green-400 leading-none whitespace-nowrap bg-gray-900/80 px-1.5 py-0.5 rounded">
                      ({baseModifier >= 0 ? '+' : ''}{baseModifier} {totalBonus > 0 ? '+' : ''}{totalBonus})
                    </div>
                  </div>
                )}

                <div className="absolute top-[46%] left-[48%] transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                  <div className="text-2xl font-normal text-gray-100">
                    {displayModifier >= 0 ? '+' : ''}{displayModifier}
                  </div>
                </div>

                <div className="absolute bottom-4 left-[50%] transform -translate-x-1/2">
                  {editing ? (
                    <input
                      type="number"
                      value={ability.score}
                      onChange={(e) => handleScoreChange(index, parseInt(e.target.value) || 10)}
                      className="w-10 h-8 text-center text-sm font-normal bg-gray-700 text-gray-100 border border-gray-600 rounded pointer-events-auto"
                      min={1}
                      max={30}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="w-8 h-8 flex items-center justify-center text-sm font-normal text-gray-100 pointer-events-none">
                      {ability.score}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 w-full max-w-[110px]">
                <div
                  className={`flex items-center justify-between px-2 py-1 bg-gray-800/50 rounded-md border border-gray-700/50 transition-colors ${
                    editing ? 'cursor-pointer hover:bg-gray-700/70' : 'cursor-pointer hover:bg-gray-700/50'
                  }`}
                  onClick={() => {
                    if (editing) {
                      handleSavingThrowToggle(index);
                    } else if (onSavingThrowClick) {
                      onSavingThrowClick(ability);
                    }
                  }}
                  title={editing ? 'Cliquer pour activer/désactiver la maîtrise' : `Jet de sauvegarde 1d20+${ability.savingThrow}`}
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-3 h-3 rounded border transition-colors ${
                        ability.savingThrow !== ability.modifier
                          ? 'bg-red-500 border-red-600'
                          : 'border-gray-600'
                      } ${editing ? 'cursor-pointer hover:border-red-400' : ''}`}
                    />
                    <span className="text-xs text-gray-400">Sauv.</span>
                  </div>
                  <span className="text-sm font-medium text-gray-200">
                    {ability.savingThrow >= 0 ? '+' : ''}{ability.savingThrow}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <button
            onClick={handleSave}
            className="w-full btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2 font-medium"
          >
            <Save size={18} />
            Sauvegarder les modifications
          </button>
        </div>
      )}
    </div>
  );
}