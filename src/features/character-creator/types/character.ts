export type DndClass = 
  | 'Barbare' | 'Barde' | 'Clerc' | 'Druide' | 'Ensorceleur' 
  | 'Guerrier' | 'Magicien' | 'Moine' | 'Paladin' | 'Rôdeur' 
  | 'Roublard' | 'Occultiste';

export interface PlayerStats {
  armor_class: number;
  initiative: number;
  speed: number;
  proficiency_bonus: number;
  inspirations: number;
}

export interface Ability {
  name: string;
  score: number;
  modifier: number;
  savingThrow: number;
  skills: {
    name: string;
    bonus: number;
    isProficient: boolean;
    hasExpertise: boolean;
  }[];
}

export interface CharacterCreationData {
  name: string;
  race: string;
  class: DndClass;
  background: string;
  abilities: Ability[];
  skills: string[];
  equipment: string[];
  hitPoints: number;
}

export interface DndRace {
  name: string;
  description: string;
  abilityScoreIncrease: { [key: string]: number };
  size: string;
  speed: number;
  languages: string[];
  proficiencies: string[];
  traits: string[];
}

// Type pour les choix d'équipement
export interface EquipmentOption {
  label: string; // "A", "B", "C"
  items: string[];
}

export interface DndClassData {
  name: DndClass;
  description: string;
  hitDie: number;
  primaryAbility: string[];
  savingThrows: string[];
  skillsToChoose: number;
  availableSkills: string[];
  weaponProficiencies: string[]; // Maîtrises d'armes
  armorProficiencies: string[];  // Formation aux armures
  toolProficiencies?: string[];  // Maîtrises d'outils (optionnel)
  equipmentOptions: EquipmentOption[]; // Choix A/B/C d'équipement
  equipment: string[]; // Équipement fixe (si applicable)
  features: string[];
}

export interface DndBackground {
  name: string;
  description: string;
  skillProficiencies: string[];
  languages: number;
  equipment: string[];
  feature: string;
}

export interface CharacterCreationStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
}

export interface CustomClassResource {
  id: string;
  name: string;
  maxValue: number | 'level' | 'modifier';
  modifierAbility?: 'Force' | 'Dextérité' | 'Constitution' | 'Intelligence' | 'Sagesse' | 'Charisme';
  color: 'red' | 'purple' | 'yellow' | 'green' | 'blue';
  icon: string;
  shortRest?: boolean;
  longRest?: boolean;
}

export interface CustomClassAbility {
  id: string;
  name: string;
  description: string;
  level: number;
}

export interface CustomClassSpellcasting {
  enabled: boolean;
  cantrips: number;
  spellsKnown: number;
  spellcastingAbility: 'Intelligence' | 'Sagesse' | 'Charisme';
  spellList: string;
}

// =====================
// HISTORIQUES PERSONNALISÉS
// =====================

export interface CustomBackgroundData {
  name: string;
  description: string;
  abilityScores: string[]; // 3 caractéristiques au choix
  feat: string; // Don d'origine
  skillProficiencies: string[]; // 2 compétences
  toolProficiencies: string[]; // 1 outil ou instrument
  equipmentOptions: {
    optionA: string[];
    optionB: string[];
  };
  isCustom?: boolean;
    featSkillPicks?: string[];  // Compétences/outils choisis via le don (ex: "Doué")
}

export interface CustomClassData {
  name: string;
  description: string;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbility: string[];
  savingThrows: string[];
  isCustom: true;
  resources: CustomClassResource[];
  abilities: CustomClassAbility[];
  spellcasting?: CustomClassSpellcasting;
}