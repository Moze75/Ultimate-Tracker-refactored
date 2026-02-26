// Mapping des dons généraux vers leurs bonus de caractéristiques possibles
// Format: nom du don (normalisé) -> liste des caractéristiques pouvant recevoir +1

export type AbilityName = 'Force' | 'Dextérité' | 'Constitution' | 'Intelligence' | 'Sagesse' | 'Charisme';
 
export interface FeatBonus {
  choices: AbilityName[];  // Caractéristiques au choix
  amount: number;          // Montant du bonus (généralement 1)
}

export const FEAT_BONUSES: Record<string, FeatBonus> = {
  'adepte élémentaire': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'affinité féerique': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'affinité ombreuse': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'athlète': { choices: ['Force', 'Dextérité'], amount: 1 },
  'broyeur': { choices: ['Force', 'Constitution'], amount: 1 },
  'chef cuisinier': { choices: ['Constitution', 'Sagesse'], amount: 1 },
  'cogneur lourd': { choices: ['Force'], amount: 1 },
  'combattant à deux armes': { choices: ['Force', 'Dextérité'], amount: 1 },
  'combattant monté': { choices: ['Force', 'Dextérité', 'Sagesse'], amount: 1 },
  'comédien': { choices: ['Charisme'], amount: 1 },
  'discret': { choices: ['Dextérité'], amount: 1 },
  'duelliste défensif': { choices: ['Dextérité'], amount: 1 },
  'empoisonneur': { choices: ['Dextérité', 'Intelligence'], amount: 1 },
  'esprit affûté': { choices: ['Intelligence'], amount: 1 },
  'expert': { choices: ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'expert de la charge': { choices: ['Force', 'Dextérité'], amount: 1 },
  'figure de proue': { choices: ['Sagesse', 'Charisme'], amount: 1 },
  'formation aux armes de guerre': { choices: ['Force', 'Dextérité'], amount: 1 },
  'gaillard': { choices: ['Constitution'], amount: 1 },
  'incantateur d\'élite': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'mage de guerre': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'magie rituelle': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'maître d\'armes': { choices: ['Force', 'Dextérité'], amount: 1 },
  'maître du hast': { choices: ['Force', 'Dextérité'], amount: 1 },
  'maître-arbalétrier': { choices: ['Dextérité'], amount: 1 },
  'maître des armures intermédiaires': { choices: ['Force', 'Dextérité'], amount: 1 },
  'maître des armures lourdes': { choices: ['Force', 'Constitution'], amount: 1 },
  'maître des boucliers': { choices: ['Force'], amount: 1 },
  'mobile': { choices: ['Dextérité', 'Constitution'], amount: 1 },
  'observateur': { choices: ['Intelligence', 'Sagesse'], amount: 1 },
  'perforateur': { choices: ['Force', 'Dextérité'], amount: 1 },
  'protection légère': { choices: ['Force', 'Dextérité'], amount: 1 },
  'protection intermédiaire': { choices: ['Force', 'Dextérité'], amount: 1 },
  'protection lourde': { choices: ['Force', 'Constitution'], amount: 1 },
  'résilient': { choices: ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'sentinelle': { choices: ['Force', 'Dextérité'], amount: 1 },
  'télékinésiste': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'télépathe': { choices: ['Intelligence', 'Sagesse', 'Charisme'], amount: 1 },
  'tireur d\'élite': { choices: ['Dextérité'], amount: 1 },
  'trancheur': { choices: ['Force', 'Dextérité'], amount: 1 },
  'tueur de mages': { choices: ['Force', 'Dextérité'], amount: 1 },
};

// Mapping des dons d'origine vers les maîtrises de compétences qu'ils offrent
// "Doué" : 3 compétences ou outils au choix (toutes compétences disponibles)
export interface FeatSkillBonus {
  skillChoices: string[];  // Compétences éligibles
  toolChoices: string[];   // Outils éligibles
  totalPicks: number;      // Nombre total à choisir (compétences + outils combinés)
}

export const FEAT_SKILL_BONUSES: Record<string, FeatSkillBonus> = {
  'doué': {
    skillChoices: [
      'Acrobaties', 'Arcanes', 'Athlétisme', 'Discrétion', 'Dressage',
      'Escamotage', 'Histoire', 'Intimidation', 'Investigation', 'Intuition',
      'Médecine', 'Nature', 'Perception', 'Persuasion', 'Religion',
      'Représentation', 'Survie', 'Tromperie',
    ],
    toolChoices: [
      'Matériel de calligraphie', 'Outils d\'artisan (au choix)',
      'Instrument de musique (au choix)', 'Matériel de contrefaçon',
      'Outils de voleur', 'Matériel d\'herboriste', 'Outils de charpentier',
      'Boîte de jeux (au choix)', 'Outils de cartographe',
      'Instruments de navigateur',
    ],
    totalPicks: 3, // 3 compétences ou outils au choix, mélangés
  },
};

// Normalisation du nom du don pour la recherche
export function normalizeFeatName(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u2019\u2018\u2032]/g, "'")
    .replace(/[\u2010-\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}