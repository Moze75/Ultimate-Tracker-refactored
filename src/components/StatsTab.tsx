import React, { useState, useEffect } from 'react';
import { Dices, Settings, Save, Star } from 'lucide-react';
import { Player, Ability } from '../types/dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { DiceRollContext } from './ResponsiveGameLayout'; // ✨ AJOUT
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { AbilityScoreGrid } from './AbilityScoreGrid';
import { SkillsTable } from './SkillsTable';
import { FEAT_BONUSES, normalizeFeatName, AbilityName } from '../data/featBonuses';

// Ajouter après les imports existants (vers ligne 10)
// ========== HELPERS POUR LE CALCUL DE LA CA ==========

const getConModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) 
    ? abilities. find((a: any) => a?. name === 'Constitution') 
    : undefined;
  if (fromArray?. modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

const getWisModFromPlayer = (player: Player): number => {
  const abilities: any = (player as any).abilities;
  const fromArray = Array.isArray(abilities) 
    ? abilities.find((a: any) => a?.name === 'Sagesse') 
    : undefined;
  if (fromArray?.modifier != null) return fromArray.modifier;
  if (fromArray?.score != null) return Math.floor((fromArray.score - 10) / 2);
  return 0;
};

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 * à partir des abilities LOCALES (pas celles du player stocké)
 */
// Remplacer la fonction calculateUnarmoredACFromAbilities par celle-ci :

/**
 * Calcule la CA "défense sans armure" selon la classe du joueur
 * en tenant compte des bonus d'équipement
 */
const calculateUnarmoredACFromAbilities = (
  playerClass: string | null | undefined,
  abilities: Ability[],
  equipmentBonuses: { Force: number; Dextérité: number; Constitution: number; Intelligence: number; Sagesse: number; Charisme: number; armor_class: number }
): number => {
  const dexAbility = abilities.find(a => a.name === 'Dextérité');
  const baseDexMod = dexAbility ?  getModifier(dexAbility.score) : 0;
  const dexMod = baseDexMod + (equipmentBonuses.Dextérité || 0);

  if (playerClass === 'Moine') {
    const wisAbility = abilities.find(a => a. name === 'Sagesse');
    const baseWisMod = wisAbility ? getModifier(wisAbility. score) : 0;
    const wisMod = baseWisMod + (equipmentBonuses.Sagesse || 0);
    return 10 + dexMod + wisMod;
  }

  if (playerClass === 'Barbare') {
    const conAbility = abilities. find(a => a.name === 'Constitution');
    const baseConMod = conAbility ? getModifier(conAbility.score) : 0;
    const conMod = baseConMod + (equipmentBonuses.Constitution || 0);
    return 10 + dexMod + conMod;
  }

  return 10 + dexMod;
};

interface StatsTabProps {
  player: Player;
  inventory: any[];
  onUpdate: (player: Player) => void;
}

const DEFAULT_ABILITIES: Ability[] = [
  {
    name: 'Force',
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: [
      { name: 'Athlétisme', bonus: 0, isProficient: false, hasExpertise: false }
    ]
  },
  {
    name: 'Dextérité',
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: [
      { name: 'Acrobaties', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Discrétion', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Escamotage', bonus: 0, isProficient: false, hasExpertise: false }
    ]
  },
  {
    name: 'Constitution',
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: []
  },
  {
    name: 'Intelligence', 
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: [
      { name: 'Arcanes', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Histoire', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Investigation', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Nature', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Religion', bonus: 0, isProficient: false, hasExpertise: false }
    ]
  },
  {
    name: 'Sagesse',
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: [
      { name: 'Dressage', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Médecine', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Perception', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Perspicacité', bonus: 0, isProficient: false, hasExpertise: false }, 
      { name: 'Survie', bonus: 0, isProficient: false, hasExpertise: false }
    ]
  },
  {
    name: 'Charisme',
    score: 10,
    modifier: 0,
    savingThrow: 0,
    skills: [
      { name: 'Intimidation', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Persuasion', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Représentation', bonus: 0, isProficient: false, hasExpertise: false },
      { name: 'Tromperie', bonus: 0, isProficient: false, hasExpertise: false }
    ]
  }
];

const getModifier = (score: number): number => Math.floor((score - 10) / 2);

const getProficiencyBonusForLevel = (level: number): number => {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
};

const getExpertiseLimit = (playerClass: string | null | undefined, level: number): number => {
  if (!playerClass) return 0;
  
  switch (playerClass) {
    case 'Roublard':
      if (level >= 6) return 4;
      if (level >= 1) return 2;
      return 0;
    case 'Barde':
      if (level >= 10) return 4;
      if (level >= 2) return 2;
      return 0;
    case 'Rôdeur':
      if (level >= 6) return 1;
      return 0;
    default:
      return 0;
  }
};

const hasJackOfAllTrades = (playerClass: string | null | undefined, level: number): boolean => {
  return playerClass === 'Barde' && level >= 2;
};

const getJackOfAllTradesBonus = (proficiencyBonus: number): number => {
  return Math.floor(proficiencyBonus / 2);
};

const getAbilityShortName = (abilityName: string): string => {
  switch (abilityName) {
    case 'Force':
      return 'For.';
    case 'Dextérité':
      return 'Dex.';
    case 'Constitution': 
      return 'Cons.';
    case 'Intelligence':
      return 'Int.';
    case 'Sagesse':
      return 'Sag.';
    case 'Charisme':
      return 'Cha.';
    default:
      return abilityName.substring(0, 4) + '.';
  }
};

export function StatsTab({ player, inventory, onUpdate }: StatsTabProps) {
  const [editing, setEditing] = useState(false);

  // ✨ AJOUT : Utiliser le contexte de lancer de dés
  const { rollDice } = React.useContext(DiceRollContext);

  const effectiveProficiency = getProficiencyBonusForLevel(player.level);

  // Importer en haut du fichier:
  // import { FEAT_BONUSES, normalizeFeatName, AbilityName } from '../data/featBonuses';

  const calculateFeatBonuses = React.useCallback(() => {
    const bonuses: Record<AbilityName, number> = {
      Force: 0,
      Dextérité: 0,
      Constitution: 0,
      Intelligence: 0,
      Sagesse: 0,
      Charisme: 0
    };

    const feats = (player.stats as any)?.feats || {};
    const featAbilityChoices: Record<string, AbilityName> = (player.stats as any)?.feat_ability_choices || {};
    
    const allFeats: string[] = [
      ...(Array.isArray(feats.generals) ? feats.generals : []),
      ...(Array.isArray(feats.origins) ? feats.origins : []),
      ...(Array.isArray(feats.styles) ? feats.styles : [])
    ];

    for (const featName of allFeats) {
      const normalizedName = normalizeFeatName(featName);
      const featBonus = FEAT_BONUSES[normalizedName];
      
      if (featBonus) {
        // Vérifie si un choix a été fait pour ce don
        const chosenAbility = featAbilityChoices[normalizedName];
        if (chosenAbility && featBonus.choices.includes(chosenAbility)) {
          bonuses[chosenAbility] += featBonus.amount;
        }
      }
    }

    return bonuses;
  }, [player.stats]);

  const calculateEquipmentBonuses = React.useCallback(() => {
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
  }, [inventory]);

  const [stats, setStats] = useState(() => ({
    proficiency_bonus: effectiveProficiency,
    jack_of_all_trades: player. stats?.jack_of_all_trades || false
  }));

  const [abilities, setAbilities] = useState<Ability[]>(() => {
    if (Array.isArray(player.abilities) && player.abilities.length > 0) {
      return player.abilities.map(ability => ({
        ...ability,
        skills: ability.skills.map(skill => ({
          ...skill,
          hasExpertise: skill.hasExpertise || false
        }))
      }));
    }
    return DEFAULT_ABILITIES;
  });

  const expertiseLimit = getExpertiseLimit(player.class, player.level);
  const currentExpertiseCount = abilities.reduce((count, ability) => 
    count + ability.skills.filter(skill => skill.hasExpertise).length, 0
  );

  const updateAbilityModifiers = (
    newAbilities: Ability[],
    currentStats = stats,
    proficiencyBonus = effectiveProficiency
  ) => {
    const equipmentBonuses = calculateEquipmentBonuses();
    const featBonuses = calculateFeatBonuses();
    
    // Combiner les bonus équipement + dons
    const combinedBonuses = {
      Force: equipmentBonuses.Force + featBonuses.Force,
      Dextérité: equipmentBonuses.Dextérité + featBonuses.Dextérité,
      Constitution: equipmentBonuses.Constitution + featBonuses.Constitution,
      Intelligence: equipmentBonuses.Intelligence + featBonuses.Intelligence,
      Sagesse: equipmentBonuses.Sagesse + featBonuses.Sagesse,
      Charisme: equipmentBonuses.Charisme + featBonuses.Charisme,
      armor_class: equipmentBonuses.armor_class
    };

    return newAbilities.map(ability => {
      const baseModifier = getModifier(ability.score);
      const combinedBonus = combinedBonuses[ability.name as keyof typeof combinedBonuses] || 0;
      const modifier = baseModifier + (typeof combinedBonus === 'number' ? combinedBonus : 0);
      
      const jackOfAllTradesBonus = currentStats.jack_of_all_trades ? getJackOfAllTradesBonus(proficiencyBonus) : 0;

      const isSavingThrowProficient = ability.savingThrow !== ability.modifier;

      return {
        ...ability,
        modifier,
        savingThrow: modifier + (isSavingThrowProficient ? proficiencyBonus : 0),
        skills: ability.skills.map(skill => ({
          ...skill,
          bonus: modifier + (skill.isProficient ? 
            (skill.hasExpertise ? proficiencyBonus * 2 : proficiencyBonus) :
            (currentStats.jack_of_all_trades ? jackOfAllTradesBonus : 0)
          )
        }))
      };
    });
  };

  const handleScoreChange = (index: number, score: number) => {
    const newAbilities = [...abilities];
    newAbilities[index].score = Math.max(1, Math.min(20, score));
    setAbilities(updateAbilityModifiers(newAbilities, stats, effectiveProficiency));
  };

  const handleSavingThrowChange = (index: number) => {
    const newAbilities = [...abilities];
    const ability = newAbilities[index];
    const isCurrentlyProficient = ability.savingThrow !== ability.modifier;
    ability.savingThrow = ability.modifier + (isCurrentlyProficient ? 0 : effectiveProficiency);
    setAbilities(newAbilities);
  };

  const handleProficiencyChange = (abilityIndex: number, skillIndex: number) => {
    const newAbilities = [...abilities];
    const skill = newAbilities[abilityIndex].skills[skillIndex];
    
    if (skill.isProficient && skill.hasExpertise) {
      skill.hasExpertise = false;
    }
    
    skill.isProficient = !skill.isProficient;
    setAbilities(updateAbilityModifiers(newAbilities, stats, effectiveProficiency));
  };

  const handleExpertiseChange = (abilityIndex: number, skillIndex: number) => {
    const newAbilities = [...abilities];
    const skill = newAbilities[abilityIndex].skills[skillIndex];
    
    if (!skill.hasExpertise && currentExpertiseCount >= expertiseLimit) {
      toast.error(`Limite d'expertise atteinte (${expertiseLimit})`);
      return;
    }
    
    skill.hasExpertise = !skill.hasExpertise;
    setAbilities(updateAbilityModifiers(newAbilities, stats, effectiveProficiency));
  };

  React.useEffect(() => {
    const updatedAbilities = updateAbilityModifiers(abilities, stats, effectiveProficiency);
    setAbilities(updatedAbilities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, player.id]);

  // ✨ MODIFICATION : Utiliser rollDice du contexte
  const rollAbilityCheck = (ability: Ability) => {
    if (editing) return;
    
    rollDice({
      type: 'ability',
      attackName: `Test de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.modifier
    });
  };

  // ✨ MODIFICATION : Utiliser rollDice du contexte
  const rollSavingThrow = (ability: Ability) => {
    if (editing) return;
    
    rollDice({
      type: 'saving-throw',
      attackName: `Jet de sauvegarde de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.savingThrow
    });
  };

  // ✨ MODIFICATION : Utiliser rollDice du contexte
  const rollSkillCheck = (skillName: string, bonus: number) => {
    if (editing) return;
    
    rollDice({
      type: 'skill',
      attackName: `Test de ${skillName}`,
      diceFormula: '1d20',
      modifier: bonus
    });
  };

const handleSave = async () => {
  try {
    const dexScore = abilities. find(a => a.name === 'Dextérité')?.score ??  10;
    const equipmentBonuses = calculateEquipmentBonuses(); // ✅ Récupérer les bonus d'équipement
    const dexMod = getModifier(dexScore) + (equipmentBonuses.Dextérité || 0); // ✅ Inclure le bonus d'équipement

    const updatedStatsLocal = {
      ... stats,
      jack_of_all_trades: hasJackOfAllTrades(player.class, player.level)
        ? (stats.jack_of_all_trades ??  false)
        : false
    };

     // Vérifier si une armure est équipée
    const hasArmorEquipped = !!(player.equipment?.armor?.armor_formula);

    const isManualAC = (player.stats as any)?.is_ac_manual === true;

    // Recalcul CA auto (référence) si pas d'armure
    let autoAC = player.stats?.auto_armor_class ?? (10 + dexMod);
    if (!hasArmorEquipped && (player.class === 'Moine' || player.class === 'Barbare')) {
      autoAC = calculateUnarmoredACFromAbilities(player.class, abilities, equipmentBonuses);
      console.log(`[StatsTab] ✅ Recalcul CA auto ${player.class}: ${autoAC} (avec bonus équipement)`);
    } else if (!hasArmorEquipped) {
      autoAC = 10 + dexMod;
    }

    const currentAC = player.stats?.armor_class ?? autoAC;
    const newArmorClass = isManualAC ? currentAC : autoAC;

    const mergedStats = {
      ... player.stats,
      ... updatedStatsLocal,
      proficiency_bonus: effectiveProficiency,
      initiative: dexMod,
          armor_class: newArmorClass,
      auto_armor_class: autoAC,
      is_ac_manual: isManualAC,
    };

    const { error } = await supabase
      . from('players')
      .update({ 
        abilities,
        stats: mergedStats
      })
      .eq('id', player.id);

    if (error) throw error;

    onUpdate({
      ...player,
      abilities,
      stats: mergedStats
    });

    setEditing(false);
    toast.success('Caractéristiques mises à jour');
  } catch (error) {
    console. error('Erreur lors de la mise à jour des caractéristiques:', error);
    toast.error('Erreur lors de la mise à jour');
  }
};

  const allSkills: Array<{abilityIndex: number; skillIndex: number; abilityShort: string; skillName: string; bonus: number; isProficient: boolean; hasExpertise: boolean}> = [];
  
  abilities.forEach((ability, abilityIndex) => {
    ability.skills.forEach((skill, skillIndex) => {
      allSkills.push({
        abilityIndex,
        skillIndex,
        abilityShort: getAbilityShortName(ability.name),
        skillName: skill.name,
        bonus: skill.bonus,
        isProficient: skill.isProficient,
        hasExpertise: skill.hasExpertise
      });
    });
  });

  return (
    <div className="space-y-6">
      <div className="stats-card">
        <div className="stat-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-100">
              Caractéristiques
            </h3>
          </div>
          <div className="flex items-center gap-4">
            {editing && getExpertiseLimit(player.class, player.level) > 0 && (
              <div className="text-sm text-gray-400">
                Expertise: {currentExpertiseCount}/{getExpertiseLimit(player.class, player.level)}
              </div>
            )}
            <button
              onClick={() => editing ? handleSave() : setEditing(true)}
              className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg transition-colors flex items-center justify-center"
              title={editing ? 'Sauvegarder' : 'Modifier'}
            >
              {editing ? <Save size={20} /> : <Settings size={20} />}
            </button>
          </div>
        </div>
        <div className="p-4">
          <AbilityScoreGrid
            abilities={abilities}
            editing={editing}
            calculateEquipmentBonuses={calculateEquipmentBonuses}
            calculateFeatBonuses={calculateFeatBonuses}
            handleScoreChange={handleScoreChange}
            rollAbilityCheck={rollAbilityCheck}
            rollSavingThrow={rollSavingThrow}
            handleSavingThrowChange={handleSavingThrowChange}
          />

          <SkillsTable
            allSkills={allSkills}
            editing={editing}
            expertiseLimit={getExpertiseLimit(player.class, player.level)}
            handleProficiencyChange={handleProficiencyChange}
            handleExpertiseChange={handleExpertiseChange}
            rollSkillCheck={rollSkillCheck}
            statsJackOfAllTrades={stats.jack_of_all_trades || false}
          />

          {editing && hasJackOfAllTrades(player.class, player.level) && (
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => {
                    const newStats = { ...stats, jack_of_all_trades: !stats.jack_of_all_trades };
                    setStats(newStats);
                    setAbilities(updateAbilityModifiers(abilities, newStats, effectiveProficiency));
                  }}
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                    stats.jack_of_all_trades
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-600 hover:border-blue-500'
                  }`}
                >
                  {stats.jack_of_all_trades && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <div>
                  <h4 className="text-lg font-medium text-blue-300 mb-2">
                    Touche-à-tout
                  </h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Ajoute +{getJackOfAllTradesBonus(effectiveProficiency)} aux tests de caractéristique sans maîtrise
                  </p>
                  <p className="text-xs text-gray-500">
                    Cette capacité s'applique automatiquement aux compétences non maîtrisées quand elle est activée.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!editing && stats.jack_of_all_trades && (
            <div className="mt-6 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-blue-400" />
                <span className="text-blue-300 font-medium">Touche-à-tout actif</span>
                <span className="text-sm text-gray-400">
                  (+{getJackOfAllTradesBonus(effectiveProficiency)} aux tests sans maîtrise)
                </span>
              </div>
            </div> 
          )}

          {editing && (
            <div className="mt-6 pt-4 border-t border-gray-700/50">
              <button
                onClick={handleSave}
                className="w-full btn-primary px-6 py-3 rounded-lg flex items-center justify-center gap-2 font-medium text-base"
              >
                <Save size={20} />
                Sauvegarder les modifications
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ✨ SUPPRESSION : Plus besoin de DiceRoller/DiceRollerLazy ici */}
    </div>
  );
}