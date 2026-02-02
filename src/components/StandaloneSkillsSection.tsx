import React from 'react';
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
  
  const abilities: Ability[] = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : DEFAULT_ABILITIES;

  const allSkills: Array<{
    abilityIndex: number;
    skillIndex: number;
    abilityShort: string;
    skillName: string;
    bonus: number;
    isProficient: boolean;
    hasExpertise: boolean;
  }> = [];

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

  const handleSkillClick = (skillName: string, bonus: number) => {
    if (onSkillClick) {
      onSkillClick(skillName, bonus);
    } 
  };

  return (
    <SkillsTable
      allSkills={allSkills}
      editing={false}
      expertiseLimit={0}
      handleProficiencyChange={() => {}}
      handleExpertiseChange={() => {}}
      rollSkillCheck={handleSkillClick}
      statsJackOfAllTrades={player.stats?.jack_of_all_trades || false}
    />
  );
}
