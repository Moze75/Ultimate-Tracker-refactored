// Types D&D centralisés

// IMPORTANT — Compatibilité classes
// - Ajout de "Occultiste" (Warlock) conformément aux règles 2024.
//   Idéalement, migrez vos données vers "Occultiste" puis retirez "Sorcier".
export type DndClass =
  | ''
  | 'Barbare'
  | 'Barde'
  | 'Clerc'
  | 'Druide'
  | 'Ensorceleur'
  | 'Guerrier'
  | 'Magicien'
  | 'Moine'
  | 'Paladin'
  | 'Rôdeur'
  | 'Roublard'
  | 'Occultiste'

export type PlayerBackground =
  | ''
  | 'Acolyte'
  | 'Artisan de guilde'
  | 'Artiste'
  | 'Charlatan'
  | 'Criminel'
  | 'Ermite'
  | 'Héros du peuple'
  | 'Marin'
  | 'Noble'
  | 'Sage'
  | 'Sauvageon'
  | 'Soldat'
  | 'Autre';

export interface SpellSlots {
  level1?: number;
  level2?: number;
  level3?: number;
  level4?: number;
  level5?: number;
  level6?: number;
  level7?: number;
  level8?: number;
  level9?: number;
  used1?: number;
  used2?: number;
  used3?: number;
  used4?: number;
  used5?: number;
  used6?: number;
  used7?: number;
  used8?: number;
  used9?: number;
  pact_slots?: number;
  pact_level?: number;
  used_pact_slots?: number;
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

export interface CustomClassData {
  name: string;
  description: string;
  hitDie: 6 | 8 | 10 | 12;
  primaryAbility: string[];
  savingThrows: string[];
  isCustom: true;
  resources: CustomClassResource[];
  abilities: CustomClassAbility[];
}

export interface CustomResourceState {
  [resourceId: string]: {
    current: number;
    used: number;
  };
}

export interface ClassResources {
  // Barbare
  rage?: number;
  used_rage?: number;

  // Barde
  bardic_inspiration?: number;
  used_bardic_inspiration?: number;

  // Clerc & Paladin (conduits divins)
  channel_divinity?: number;
  used_channel_divinity?: number;

  // Druide
  wild_shape?: number;
  used_wild_shape?: number;

  // Ensorceleur
  sorcery_points?: number;
  used_sorcery_points?: number;

  // Ensorceleur — Sorcellerie innée (2 charges)
  innate_sorcery?: number;
  used_innate_sorcery?: number;

  // Guerrier
  action_surge?: number;
  used_action_surge?: number;

  // Magicien
  arcane_recovery?: boolean;
  used_arcane_recovery?: boolean;
  arcane_recovery_slots_used?: number;

  // Moine (double clé pour compat : credo/ki)
  credo_points?: number;
  used_credo_points?: number;

  // Métabolisme surnaturel (Moine N2+)
  supernatural_metabolism?: number;
  used_supernatural_metabolism?: number;

  // Paladin
  lay_on_hands?: number;
  used_lay_on_hands?: number;

  // Rôdeur
  favored_foe?: number;
  used_favored_foe?: number;

  // Roublard
  sneak_attack?: string;

  // Occultiste (Warlock)
  pact_magic?: boolean;

  // Classes personnalisées
  custom_resources?: CustomResourceState;
}

export interface PlayerStats {
  armor_class: number;
  initiative: number;
  speed: number;
  proficiency_bonus: number;
  inspirations: number;
  jack_of_all_trades?: boolean;
  ac_bonus?: number;
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

// Attaque — unifiée (inclut munitions facultatives)
export interface Attack {
  id: string;
  player_id: string;
  name: string;
  damage_dice: string;
  damage_type: string;
  range: string;
  properties?: string;
  expertise: boolean;
  created_at: string;
  manual_attack_bonus?: number | null;
  manual_damage_bonus?: number | null;
  attack_type?: 'physical' | 'spell';
  spell_level?: number | null;

  // Munitions (optionnelles)
  ammo_type?: string | null;
  ammo_count?: number | null;

  // Caractéristique utilisée (Force/Dextérité, null = automatique)
  override_ability?: 'Force' | 'Dextérité' | 'Constitution' | 'Intelligence' | 'Sagesse' | 'Charisme' | null;
}

  // ✅ NOUVEAU : Bonus de l'arme (s'ajoute aux calculs d'attaque et de dégâts)
  weapon_bonus?: number | null;

export interface Player {
  id: string;
  user_id?: string | null;

  equipment?: {
    armor?: { name: string; description: string } | null;
    weapon?: { name: string; description: string } | null;
    shield?: { name: string; description: string } | null;
    potion?: { name: string; description: string } | null;
    jewelry?: { name: string; description: string } | null;
  };

  name: string;
  adventurer_name?: string | null;
  avatar_url?: string | null;

  race?: string | null;
  subclass?: string | null;
  background?: PlayerBackground | null;
  alignment?: string | null;
  languages?: string[];
  age?: string | null;
  gender?: string | null;
  character_history?: string | null;

  avatar_position?: { x: number; y: number } | null;
  avatar_zoom?: number | null;

  class?: DndClass | null;
  level: number;

  // AJOUT: Support du multiclassage
  secondary_class?: DndClass | null;
  secondary_level?: number | null;
  secondary_subclass?: string | null;
  secondary_class_resources?: ClassResources | null;
  secondary_spell_slots?: SpellSlots | null;
  
  max_hp: number;
  current_hp: number;
  temporary_hp: number;

  spell_slots?: SpellSlots | null;
  class_resources?: ClassResources | null;

  gold: number;
  silver: number;
  copper: number;
  electrum: number;
  platinum: number;

  created_at: string;

  stats: PlayerStats;
  abilities?: Ability[];

  is_gm?: boolean;

  hit_dice?: {
    total: number;
    used: number;
  };

  // AJOUT: Nouveau format pour le multiclassage
  hit_dice_by_type?: Record<string, {
    total: number;
    used: number;
  }> | null;
  
  is_concentrating?: boolean;
  concentration_spell?: string;

  active_conditions?: string[];

  // Affinité élémentaire (Ensorceleur — Sorcellerie draconique niv.6+)
  draconic_element?: 'feu' | 'froid' | 'foudre' | 'acide' | 'poison' | null;

  custom_class_data?: CustomClassData | null;
}

export interface Condition {
  id: string;
  name: string;
  description: string;
  effects: string[];
}

export interface InventoryItem {
  id: string;
  player_id: string;
  name: string;
  description?: string | null;
  created_at: string;
}