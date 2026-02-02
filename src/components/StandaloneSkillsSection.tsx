import React, { useState } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { Player, Ability } from '../types/dnd';
import { SkillsTable } from './SkillsTable';

interface StandaloneSkillsSectionProps {
  player: Player;
  onSkillClick?: (skillName: string, bonus: number) => void;
  onUpdate?: (player: Player) => void;
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

export function StandaloneSkillsSection({ player, onSkillClick, onUpdate }: StandaloneSkillsSectionProps) {
  const [editing, setEditing] = useState(false);
  const [localAbilities, setLocalAbilities] = useState<Ability[]>([]);
  const [savedAbilities, setSavedAbilities] = useState<Ability[]>([]);
  
  const abilities: Ability[] = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : DEFAULT_ABILITIES;

  React.useEffect(() => {
    if (abilities.length > 0) {
      setLocalAbilities(abilities);
      setSavedAbilities(abilities);
    }
  }, [abilities]);

  const getProficiencyBonus = (level: number): number => {
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
  };

  const getExpertiseLimit = (className: string, level: number): number => {
    if (!className) return 0;
    if (className.toLowerCase() === 'barde') return level >= 10 ? 4 : 2;
    if (className.toLowerCase() === 'roublard') return level >= 6 ? 2 : 0;
    return 0;
  };

  const expertiseLimit = getExpertiseLimit(player.class, player.level);

  const handleSkillClick = (skillName: string, bonus: number) => {
    if (onSkillClick) {
      onSkillClick(skillName, bonus);
    }
  };

  const handleProficiencyChange = (abilityIndex: number, skillIndex: number) => {
    const newAbilities = [...localAbilities];
    const skill = newAbilities[abilityIndex].skills[skillIndex];
    
    if (skill.isProficient && skill.hasExpertise) {
      skill.hasExpertise = false;
    }
    
    skill.isProficient = !skill.isProficient;
    
    const profBonus = getProficiencyBonus(player.level);
    newAbilities[abilityIndex].skills[skillIndex].bonus = 
      newAbilities[abilityIndex].modifier + 
      (skill.isProficient ? (skill.hasExpertise ? profBonus * 2 : profBonus) : 0);
    
    setLocalAbilities(newAbilities);
  };

  const handleExpertiseChange = (abilityIndex: number, skillIndex: number) => {
    const newAbilities = [...localAbilities];
    const skill = newAbilities[abilityIndex].skills[skillIndex];
    
    if (!skill.isProficient) return;
    
    skill.hasExpertise = !skill.hasExpertise;
    
    const profBonus = getProficiencyBonus(player.level);
    newAbilities[abilityIndex].skills[skillIndex].bonus = 
      newAbilities[abilityIndex].modifier + 
      (skill.hasExpertise ? profBonus * 2 : profBonus);
    
    setLocalAbilities(newAbilities);
  };

  const handleSaveChanges = () => {
    if (onUpdate && localAbilities.length > 0) {
      onUpdate({ ...player, abilities: localAbilities });
      setSavedAbilities(localAbilities);
    }
    setEditing(false);
  };

  const handleCancelChanges = () => {
    setLocalAbilities(savedAbilities);
    setEditing(false);
  };

  const displayAbilities = localAbilities.length > 0 ? localAbilities : abilities;
  const allSkills: Array<{
    abilityIndex: number;
    skillIndex: number;
    abilityShort: string;
    skillName: string;
    bonus: number;
    isProficient: boolean;
    hasExpertise: boolean;
  }> = [];

  displayAbilities.forEach((ability, abilityIndex) => {
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
    <div className="relative h-full flex flex-col overflow-hidden">
      {/* Boutons Settings / Save / Cancel en haut à droite */}
      <div className="absolute top-0 right-0 z-10 flex gap-2">
        {editing ? (
          <>
            <button
              onClick={handleSaveChanges}
              className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Sauvegarder les modifications"
            > 
              <Save size={18} />
            </button>
            <button
              onClick={handleCancelChanges}
              className="p-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              title="Annuler les modifications"
            >
              <X size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            title="Modifier les compétences"
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      {/* Conteneur scrollable pour SkillsTable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <SkillsTable
          allSkills={allSkills} 
          editing={editing}
          expertiseLimit={expertiseLimit}
          handleProficiencyChange={handleProficiencyChange}
          handleExpertiseChange={handleExpertiseChange}
          rollSkillCheck={handleSkillClick}
          statsJackOfAllTrades={player.stats?.jack_of_all_trades || false}
        />
      </div>
    </div>
  );
}