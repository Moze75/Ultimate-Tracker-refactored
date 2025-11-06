// Tables de probabilités de loot par niveau et difficulté
export const LOOT_TABLES = {
  '1-4': {
    facile: {
      '1': { copper: 50, silver: 28, gold: 10, equipment: 5, gems: 7 },
      '2-4': { copper: 55, silver: 26, gold: 8, equipment: 4, gems: 7 },
      '5-10': { copper: 60, silver: 23, gold: 7, equipment: 3, gems: 7 },
      '11+': { copper: 63, silver: 21, gold: 6, equipment: 3, gems: 7 }
    },
    modérée: {
      '1': { copper: 40, silver: 27, gold: 17, equipment: 8, gems: 8 },
      '2-4': { copper: 45, silver: 25, gold: 15, equipment: 7, gems: 8 },
      '5-10': { copper: 49, silver: 23, gold: 14, equipment: 6, gems: 8 },
      '11+': { copper: 53, silver: 21, gold: 12, equipment: 6, gems: 8 }
    },
    difficile: {
      '1': { copper: 30, silver: 27, gold: 23, equipment: 12, gems: 8 },
      '2-4': { copper: 35, silver: 25, gold: 22, equipment: 10, gems: 8 },
      '5-10': { copper: 39, silver: 23, gold: 20, equipment: 10, gems: 8 },
      '11+': { copper: 43, silver: 21, gold: 18, equipment: 10, gems: 8 }
    }
  },
  '5-10': {
    facile: {
      '1': { copper: 25, silver: 32, gold: 20, equipment: 15, gems: 8 },
      '2-4': { copper: 29, silver: 30, gold: 18, equipment: 15, gems: 8 },
      '5-10': { copper: 33, silver: 27, gold: 15, equipment: 17, gems: 8 },
      '11+': { copper: 35, silver: 25, gold: 13, equipment: 19, gems: 8 }
    },
    modérée: {
      '1': { copper: 17, silver: 27, gold: 28, equipment: 20, gems: 8 },
      '2-4': { copper: 21, silver: 25, gold: 26, equipment: 20, gems: 8 },
      '5-10': { copper: 25, silver: 22, gold: 24, equipment: 21, gems: 8 },
      '11+': { copper: 29, silver: 19, gold: 22, equipment: 22, gems: 8 }
    },
    difficile: {
      '1': { copper: 7, silver: 17, gold: 38, equipment: 30, gems: 8 },
      '2-4': { copper: 11, silver: 15, gold: 36, equipment: 30, gems: 8 },
      '5-10': { copper: 15, silver: 12, gold: 34, equipment: 31, gems: 8 },
      '11+': { copper: 19, silver: 9, gold: 32, equipment: 32, gems: 8 }
    }
  },
  '11-16': {
    facile: {
      '1': { copper: 10, silver: 25, gold: 25, equipment: 30, gems: 10 },
      '2-4': { copper: 13, silver: 23, gold: 24, equipment: 30, gems: 10 },
      '5-10': { copper: 17, silver: 21, gold: 20, equipment: 32, gems: 10 },
      '11+': { copper: 20, silver: 19, gold: 18, equipment: 33, gems: 10 }
    },
    modérée: {
      '1': { copper: 7, silver: 15, gold: 30, equipment: 38, gems: 10 },
      '2-4': { copper: 9, silver: 13, gold: 28, equipment: 40, gems: 10 },
      '5-10': { copper: 11, silver: 11, gold: 26, equipment: 42, gems: 10 },
      '11+': { copper: 13, silver: 9, gold: 24, equipment: 44, gems: 10 }
    },
    difficile: {
      '1': { copper: 3, silver: 7, gold: 35, equipment: 45, gems: 10 },
      '2-4': { copper: 5, silver: 5, gold: 33, equipment: 47, gems: 10 },
      '5-10': { copper: 7, silver: 3, gold: 30, equipment: 50, gems: 10 },
      '11+': { copper: 9, silver: 1, gold: 28, equipment: 52, gems: 10 }
    }
  },
  '17-20': {
    facile: {
      '1': { copper: 1, silver: 9, gold: 30, equipment: 50, gems: 10 },
      '2-4': { copper: 3, silver: 8, gold: 28, equipment: 51, gems: 10 },
      '5-10': { copper: 5, silver: 7, gold: 26, equipment: 52, gems: 10 },
      '11+': { copper: 7, silver: 5, gold: 24, equipment: 54, gems: 10 }
    },
    modérée: {
      '1': { copper: 0, silver: 5, gold: 30, equipment: 55, gems: 10 },
      '2-4': { copper: 1, silver: 4, gold: 28, equipment: 57, gems: 10 },
      '5-10': { copper: 3, silver: 3, gold: 26, equipment: 58, gems: 10 },
      '11+': { copper: 4, silver: 2, gold: 24, equipment: 60, gems: 10 }
    },
    difficile: {
      '1': { copper: 0, silver: 1, gold: 28, equipment: 63, gems: 8 },
      '2-4': { copper: 0, silver: 0, gold: 26, equipment: 65, gems: 9 },
      '5-10': { copper: 0, silver: 0, gold: 25, equipment: 66, gems: 9 },
      '11+': { copper: 0, silver: 0, gold: 24, equipment: 67, gems: 9 }
    }
  }
} as const;

export type LevelRange = '1-4' | '5-10' | '11-16' | '17-20';
export type Difficulty = 'facile' | 'modérée' | 'difficile';
export type EnemyCount = '1' | '2-4' | '5-10' | '11+';

// Montants spécifiques par type de monnaie et niveau
export const CURRENCY_AMOUNTS = {
  '1-4': {
    copper: { min: 1,  max: 50 },
    silver: { min: 1,  max: 20 },
    gold:   { min: 1,  max: 10 }
  },
  '5-10': {
    copper: { min: 1,  max: 50 },
    silver: { min: 5,  max: 50 },
    gold:   { min: 5,  max: 50 }
  },
  '11-16': {
    copper: { min: 1,  max: 50 },
    silver: { min: 10, max: 100 },
    gold:   { min: 10, max: 200 }
  },
  '17-20': {
    copper: { min: 1,  max: 50 },
    silver: { min: 10, max: 200 },
    gold:   { min: 50, max: 500 }
  }
};

// ✅ Révisé : Nombre de gemmes/objets précieux par niveau
export const GEM_AMOUNTS = {
  '1-4':   { min: 0, max: 2 },   // jusqu’à 2 gemmes pour niveaux 1‑4
  '5-10':  { min: 0, max: 3 },   // jusqu’à 3 gemmes pour niveaux 5‑10
  '11-16': { min: 1, max: 3 },   // 1 à 3 gemmes pour niveaux 11‑16
  '17-20': { min: 1, max: 4 }    // 1 à 4 gemmes pour niveaux 17‑20
};