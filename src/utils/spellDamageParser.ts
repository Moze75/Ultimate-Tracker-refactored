// src/utils/spellDamageParser.ts

/**
 * Structure pour un groupe de dégâts (ex: "2d8 feu")
 */
export interface DamageComponent {
  diceCount: number;      // Ex: 2
  diceType: number;       // Ex: 8
  formula: string;        // Ex: "2d8"
  damageType?: string;    // Ex: "feu", "radiant", null
}

/**
 * Information complète sur les dégâts d'un sort
 */
export interface SpellDamageInfo {
  isDamageSpell: boolean;
  isAttackRoll: boolean;        // true si "jet d'attaque" dans description
  baseDamage: DamageComponent[];  // Ex: [{2d8 feu}, {1d6 radiant}]
  hasModifier: boolean;         // true si "+ modificateur" trouvé
  modifierAbility?: string;     // Ex: "Charisme", "Sagesse"
  
  // Pour les améliorations
  upgradeType: 'per_slot_level' | 'character_level' | 'none';
  upgradePattern: DamageComponent[] | null;  // Ex: [{1d8 feu}]
  upgradePerLevels?: number;    // Ex: 1 (chaque niveau), ou 4 (tous les 4 niveaux pour cantrips)
  characterLevelThresholds?: number[];  // Ex: [5, 11, 17] pour cantrips
}

/**
 * 1. Détecte si un sort inflige des dégâts
 */
export function isDamageSpell(description: string): boolean {
  if (!description) return false;
  
  const damageKeywords = [
    /\d+d\d+/i,                    // Formule de dés
    /dégâts?/i,
    /inflige/i,
    /subit/i,
    /perd.*points? de vie/i,
  ];
  
  return damageKeywords.some(regex => regex.test(description));
}

/**
 * 2. Détecte si le sort nécessite un jet d'attaque
 * IMPORTANT : Ne doit matcher que si le LANCEUR doit faire un jet d'attaque,
 * pas si c'est une condition de rupture du sort ou un effet secondaire.
 */
export function isAttackRoll(description: string): boolean {
  if (!description) return false;
  
  // Patterns négatifs : exclusions (vérifier en PREMIER)
  const exclusionKeywords = [
    /si vous effectuez un jet d'attaque/i,     // Condition de rupture (ex: Amis)
    /lorsque vous effectuez un jet d'attaque/i, // Condition temporelle
    /quand vous effectuez un jet d'attaque/i,   // Variante
    /après avoir effectué un jet d'attaque/i,   // Variante
  ];
  
  // Si une exclusion matche, ce n'est PAS un sort d'attaque
  if (exclusionKeywords.some(regex => regex.test(description))) {
    return false;
  }
  
  // Patterns positifs : le sort nécessite un jet d'attaque
  const attackKeywords = [
    /effectuez une attaque.*de sort/i,         // "effectuez une attaque de sort à distance"
    /faites un jet d'attaque.*de sort/i,       // "faites un jet d'attaque de sort"
    /réalisez une attaque.*de sort/i,          // "réalisez une attaque de sort"
    /attaque de sort.*distance/i,              // "attaque de sort à distance contre"
    /attaque de sort.*au corps à corps/i,      // "attaque de sort au corps à corps"
    /jet d'attaque de sort/i,                  // "nécessite un jet d'attaque de sort"
  ];
  
  // Vérifier les patterns positifs
  return attackKeywords.some(regex => regex.test(description));
}

/**
 * 3. Extrait toutes les composantes de dégâts d'un texte
 * Ex: "2d8 de feu et 1d6 de radiant" → [{2d8, feu}, {1d6, radiant}]
 * IMPORTANT : Filtre les faux positifs (ex: "1d4 du prochain jet")
 */
export function extractDamageComponents(text: string): DamageComponent[] {
  if (!text) return [];
  
  const components: DamageComponent[] = [];
  
  // Liste des types de dégâts valides en français
  const validDamageTypes = new Set([
    'acide', 'contondant', 'feu', 'froid', 'force', 'foudre',
    'nécrotique', 'perçant', 'poison', 'psychique', 'radiant',
    'tonnerre', 'tranchant',
  ]);
  
  // Regex pour capturer: "2d8 dégâts de feu" ou "2d8 de feu" ou "2d8 feu" ou juste "2d8"
  // Capture aussi le contexte avant pour vérifier si c'est bien un dégât
  const damageRegex = /(\d+)d(\d+)\s*(?:dégâts?\s+)?(?:de\s+)?([a-zàâçéèêëîïôûùüÿñæœ]+)?/gi;
  
  let match;
  while ((match = damageRegex.exec(text)) !== null) {
    const [fullMatch, diceCount, diceType, possibleDamageType] = match;
    
    // Vérifier le contexte : doit contenir "dégât" ou "subir" à proximité
    const contextStart = Math.max(0, match.index - 50);
    const contextEnd = Math.min(text.length, match.index + fullMatch.length + 20);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    // Exclusions : ne pas extraire si c'est un malus/bonus de jet
    const isNotDamage = /soustraire|ajouter|bonus|malus|jet de|prochain|suivant/.test(context);
    
    if (isNotDamage) {
      continue; // Ignorer ce match
    }
    
    // Vérifier que le contexte mentionne bien des dégâts
    const isDamageContext = /dégâts?|subir|subit|inflige|perd/.test(context);
    
    if (!isDamageContext) {
      continue; // Ignorer si pas de contexte de dégât
    }
    
    // Valider le type de dégât
    let damageType: string | undefined = undefined;
    
    if (possibleDamageType) {
      const normalized = possibleDamageType.toLowerCase().trim();
      
      if (validDamageTypes.has(normalized)) {
        damageType = normalized;
      } else if (normalized === 'dégâts' || normalized === 'dégât') {
        // Chercher le type après "dégâts de X"
        const afterMatch = text.substring(match.index + fullMatch.length, match.index + fullMatch.length + 30);
        const typeMatch = afterMatch.match(/(?:de\s+)?([a-zàâçéèêëîïôûùüÿñæœ]+)/i);
        
        if (typeMatch && validDamageTypes.has(typeMatch[1].toLowerCase())) {
          damageType = typeMatch[1].toLowerCase();
        }
      }
    }
    
    components.push({
      diceCount: parseInt(diceCount, 10),
      diceType: parseInt(diceType, 10),
      formula: `${diceCount}d${diceType}`,
      damageType,
    });
  } 
  
  return components;
}
 
/**
 * 4. Détecte si le sort utilise un modificateur de caractéristique
 * Ex: "2d8 + votre modificateur de Charisme"
 * Retourne: { hasModifier: true, ability: "Charisme" }
 */
export function detectModifier(description: string): { hasModifier: boolean; ability?: string } {
  if (!description) return { hasModifier: false };
  
  const modifierRegex = /modificateur de (Force|Dextérité|Constitution|Intelligence|Sagesse|Charisme)/i;
  const match = description.match(modifierRegex);
  
  if (match) {
    return {
      hasModifier: true,
      ability: match[1],
    };
  }
  
  // Alternative: "bonus de Charisme", "+ CHA", etc.
  const shortModRegex = /\+\s*(FOR|DEX|CON|INT|SAG|CHA)\b/i;
  const shortMatch = description.match(shortModRegex);
  
  if (shortMatch) {
    const abilityMap: Record<string, string> = {
      'FOR': 'Force',
      'DEX': 'Dextérité',
      'CON': 'Constitution',
      'INT': 'Intelligence',
      'SAG': 'Sagesse',
      'CHA': 'Charisme',
    };
    return {
      hasModifier: true,
      ability: abilityMap[shortMatch[1].toUpperCase()],
    };
  }
  
  return { hasModifier: false };
}

/**
 * 5. Parse les règles d'amélioration pour sorts à emplacements
 * Ex: "+1d8 par niveau d'emplacement supérieur à 1"
 * Retourne: { components: [{1d8}], perLevels: 1 }
 */
export function parseSlotUpgrade(higherLevels: string): {
  components: DamageComponent[];
  perLevels: number;
} | null {
  if (!higherLevels) return null;
  
  // Pattern: "+1d8 par niveau" ou "1d8 supplémentaire par emplacement"
  const upgradeRegex = /(?:\+)?(\d+d\d+).*?(?:par|pour chaque).*?(?:niveau|emplacement)/i;
  const match = higherLevels.match(upgradeRegex);
  
  if (match) {
    const components = extractDamageComponents(match[1]);
    return {
      components,
      perLevels: 1,  // Par défaut, +1 niveau = +1 fois les dégâts
    };
  }
  
  return null;
}

/** 
 * 6. Parse les règles d'amélioration pour tours de magie (basées sur niveau de personnage)
 * Ex: "Les dégâts augmentent de 1d10 lorsque vous atteignez le niveau 5"
 * Retourne: { components: [{1d10}], thresholds: [5, 11, 17] }
 */
export function parseCantripUpgrade(higherLevels: string): {
  components: DamageComponent[];
  thresholds: number[];
} | null {
  if (!higherLevels) return null;
  
  // 1️⃣ Détection des seuils de niveau
  // Pattern amélioré : chercher "niveau X" ou "niveaux X" mais PAS "X (YdZ)"
  const levelPattern = /niveaux?\s+(\d+)(?!\s*\()/gi;
  const thresholds: number[] = [];
  
  let match;
  while ((match = levelPattern.exec(higherLevels)) !== null) {
    thresholds.push(parseInt(match[1], 10));
  }
  
  // Si aucun seuil trouvé, chercher les patterns alternatifs
  if (thresholds.length === 0) {
    // Pattern : "aux niveaux 5, 11, et 17"
    const altPattern = /niveaux?\s+([\d,\s]+(?:et\s+\d+)?)/i;
    const altMatch = higherLevels.match(altPattern); 
    
    if (altMatch) { 
      const numbers = altMatch[1].match(/\d+/g);
      if (numbers) { 
        numbers.forEach(n => thresholds.push(parseInt(n, 10)));
      }
    }
  }
  
  if (thresholds.length === 0) return null;
  
  // 2️⃣ Extraire UNIQUEMENT l'incrément de dégâts
  // Pattern : "augmentent de XdY" ou "augmente de XdY" ou "gagne XdY"
  const incrementPattern = /(?:augmentent?|gagne(?:nt)?)\s+(?:de\s+)?(\d+d\d+)/i;
  const incrementMatch = higherLevels.match(incrementPattern);
  
  if (!incrementMatch) {
    // Fallback : prendre la PREMIÈRE formule de dés (ignorer celles entre parenthèses)
    const allFormulas = higherLevels.match(/(?<!\()\d+d\d+(?!\))/g);
    if (allFormulas && allFormulas.length > 0) {
      const components = extractDamageComponents(allFormulas[0]);
      if (components.length > 0) {
        return {
          components,
          thresholds,
        };
      }
    } 
    return null;
  }
  
  // Extraire les composantes de l'incrément
  const components = extractDamageComponents(incrementMatch[1]);
  
  if (components.length === 0) return null;
  
  return {
    components,
    thresholds,
  };
}

/**
 * 7. Fonction principale : analyse complète d'un sort
 */
export function analyzeSpellDamage(
  description: string,
  higherLevels?: string,
  spellLevel: number = 0
): SpellDamageInfo {
  const baseDamage = extractDamageComponents(description);
  const modifier = detectModifier(description);
  const isCantrip = spellLevel === 0;
  
  let upgradeType: SpellDamageInfo['upgradeType'] = 'none';
  let upgradePattern: DamageComponent[] | null = null;
  let upgradePerLevels: number | undefined;
  let characterLevelThresholds: number[] | undefined;
  
  if (higherLevels) {
    if (isCantrip) {
      const cantripUpgrade = parseCantripUpgrade(higherLevels);
      if (cantripUpgrade) {
        upgradeType = 'character_level';
        upgradePattern = cantripUpgrade.components;
        characterLevelThresholds = cantripUpgrade.thresholds;
      }
    } else {
      const slotUpgrade = parseSlotUpgrade(higherLevels);
      if (slotUpgrade) {
        upgradeType = 'per_slot_level';
        upgradePattern = slotUpgrade.components;
        upgradePerLevels = slotUpgrade.perLevels;
      }
    }
  }
  
  return {
    isDamageSpell: baseDamage.length > 0,
    isAttackRoll: isAttackRoll(description),
    baseDamage,
    hasModifier: modifier.hasModifier,
    modifierAbility: modifier.ability,
    upgradeType,
    upgradePattern,
    upgradePerLevels,
    characterLevelThresholds,
  };
}

/**
 * 8. Calcule les dégâts totaux pour un niveau donné (sorts à emplacements)
 */
export function calculateSlotDamage(
  info: SpellDamageInfo,
  baseSpellLevel: number,
  castLevel: number,
  abilityModifier?: number
): string {
  if (!info.isDamageSpell) return '';
  
  let totalComponents = [...info.baseDamage];
  
  // Ajouter les dégâts d'amélioration
  if (info.upgradeType === 'per_slot_level' && info.upgradePattern && castLevel > baseSpellLevel) {
    const levelDiff = castLevel - baseSpellLevel;
    const multiplier = Math.floor(levelDiff / (info.upgradePerLevels || 1));
    
    // Multiplier chaque composante d'amélioration
    info.upgradePattern.forEach(upgrade => {
      const existing = totalComponents.find(c => c.diceType === upgrade.diceType && c.damageType === upgrade.damageType);
      
      if (existing) {
        // Ajouter aux dégâts existants du même type
        existing.diceCount += upgrade.diceCount * multiplier;
        existing.formula = `${existing.diceCount}d${existing.diceType}`;
      } else {
        // Ajouter comme nouvelle composante
        totalComponents.push({
          diceCount: upgrade.diceCount * multiplier,
          diceType: upgrade.diceType,
          formula: `${upgrade.diceCount * multiplier}d${upgrade.diceType}`,
          damageType: upgrade.damageType,
        });
      }
    });
  }
  
// ✅ Consolider les dés identiques avant de construire la formule
const consolidated = consolidateDamageComponents(totalComponents);

// Construire la formule finale
const parts: string[] = [];

consolidated.forEach(comp => {
  if (comp.damageType) {
    parts.push(`${comp.formula} ${comp.damageType}`);
  } else {
    parts.push(comp.formula);
  }
});

let result = parts.join(' + ');
  
  // Ajouter le modificateur si applicable
  if (info.hasModifier && abilityModifier !== undefined) {
    const sign = abilityModifier >= 0 ? '+' : '';
    result += ` ${sign}${abilityModifier}`;
  }
  
  return result;
}


/**
 * Consolide les composantes de dégâts identiques
 * Ex: [1d6 feu, 1d6 feu] → [2d6 feu]
 */
function consolidateDamageComponents(components: DamageComponent[]): DamageComponent[] {
  const consolidated = new Map<string, DamageComponent>();
  
  components.forEach(comp => {
    // Clé unique : type de dé + type de dégât
    const key = `${comp.diceType}-${comp.damageType || 'none'}`;
    
    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;
      existing.diceCount += comp.diceCount;
      existing.formula = `${existing.diceCount}d${existing.diceType}`;
    } else {
      consolidated.set(key, { ...comp });
    }
  });
  
  return Array.from(consolidated.values());
}

/**
 * 9. Calcule les dégâts totaux pour un tour de magie selon le niveau du personnage
 */
export function calculateCantripDamage(
  info: SpellDamageInfo,
  characterLevel: number,
  abilityModifier?: number
): string {
  if (!info.isDamageSpell) return '';
  
  let totalComponents = [...info.baseDamage];
  
  // Déterminer combien de fois appliquer l'amélioration
  if (info.upgradeType === 'character_level' && info.upgradePattern && info.characterLevelThresholds) {
    let multiplier = 0;
    
    // Compter combien de seuils ont été atteints
    info.characterLevelThresholds.forEach(threshold => {
      if (characterLevel >= threshold) {
        multiplier++;
      }
    });
    
    if (multiplier > 0) {
      // Ajouter les dégâts supplémentaires
      info.upgradePattern.forEach(upgrade => {
        const existing = totalComponents.find(c => c.diceType === upgrade.diceType && c.damageType === upgrade.damageType);
        
        if (existing) {
          existing.diceCount += upgrade.diceCount * multiplier;
          existing.formula = `${existing.diceCount}d${existing.diceType}`;
        } else {
          totalComponents.push({
            diceCount: upgrade.diceCount * multiplier,
            diceType: upgrade.diceType,
            formula: `${upgrade.diceCount * multiplier}d${upgrade.diceType}`,
            damageType: upgrade.damageType,
          });
        }
      });
    }
  }
  
 // ✅ Consolider les dés identiques avant de construire la formule
const consolidated = consolidateDamageComponents(totalComponents);

// Construire la formule finale
const parts: string[] = [];

consolidated.forEach(comp => {
  if (comp.damageType) {
    parts.push(`${comp.formula} ${comp.damageType}`);
  } else {
    parts.push(comp.formula);
  }
});

let result = parts.join(' + ');
  
  // Ajouter le modificateur si applicable
  if (info.hasModifier && abilityModifier !== undefined) {
    const sign = abilityModifier >= 0 ? '+' : '';
    result += ` ${sign}${abilityModifier}`;
  }
  
  return result;
}

/**
 * 10. Obtient les niveaux de lancement disponibles pour un sort
 */
export function getAvailableCastLevels(
  spellLevel: number,
  maxPlayerSpellLevel: number,
  hasUpgrade: boolean
): number[] {
  if (spellLevel === 0 || !hasUpgrade) {
    return [spellLevel];
  }
  
  const levels: number[] = [];
  for (let i = spellLevel; i <= Math.min(maxPlayerSpellLevel, 9); i++) {
    levels.push(i);
  }
  
  return levels;
}