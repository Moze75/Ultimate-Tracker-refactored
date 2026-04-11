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
  isHealingSpell: boolean;
  isAttackRoll: boolean;        // true si le LANCEUR doit faire un jet d'attaque
  isSavingThrow: boolean;       // true si la CIBLE doit faire un jet de sauvegarde
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
  
  // Un sort inflige des dégâts s'il contient une formule de dés ET un mot-clé de dégâts
  const hasDiceFormula = /\d+d\d+/i.test(description);
  
  if (!hasDiceFormula) return false;
  
  const damageKeywords = [
    /dégâts?/i,                    // "8d6 dégâts de feu"
    /inflige/i,                    // "inflige 2d8"
    /subit/i,                      // "subit 1d10"
    /perd.*points? de vie/i,       // "perd 3d6 points de vie"
    /subissant/i,                  // "subissant 8d6 dégâts"
  ];
  
  return damageKeywords.some(regex => regex.test(description)); 
}
 
/**
 * Détecte si un sort rend des points de vie
 */
export function isHealingSpell(description: string): boolean {
  if (!description) return false;

  const hasDiceFormula = /\d+d\d+/i.test(description);
  if (!hasDiceFormula) return false;

  const healingKeywords = [
    /récupère\s+\d+d\d+\s+points?\s+de\s+vie/i,
    /récupère\s+un\s+nombre\s+de\s+points?\s+de\s+vie\s+égal\s+à\s+\d+d\d+/i,
    /regagne(?:nt)?\s+\d+d\d+\s+points?\s+de\s+vie/i,
    /regagne(?:nt)?\s+des\s+points?\s+de\s+vie\s+équivalents?\s+à\s+\d+d\d+/i,
    /retrouve\s+\d+d\d+\s+points?\s+de\s+vie/i,
    /rend\s+\d+d\d+\s+points?\s+de\s+vie/i,
    /gagne\s+\d+d\d+\s+points?\s+de\s+vie/i,
    /points?\s+de\s+vie\s+égal\s+à\s+\d+d\d+/i,
    /points?\s+de\s+vie\s+équivalents?\s+à\s+\d+d\d+/i,
    /soins?\s+augmentent\s+de/i,
    /points?\s+de\s+vie\s+plus\s+le\s+modificateur/i,
  ];

  return healingKeywords.some(regex => regex.test(description));
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
  
  // ✅ NOUVEAU : Patterns positifs élargis pour détecter toutes les formulations d'attaque
    const attackKeywords = [
    // Patterns existants (avec "de sort" explicite)
    /effectuez une attaque.*de sort/i,         // "effectuez une attaque de sort à distance"
    /faites un jet d'attaque.*de sort/i,       // "faites un jet d'attaque de sort"
    /réalisez une attaque.*de sort/i,          // "réalisez une attaque de sort"
    /attaque de sort.*distance/i,              // "attaque de sort à distance contre"
    /attaque de sort.*au corps à corps/i,      // "attaque de sort au corps à corps"
    /jet d'attaque de sort/i,                  // "nécessite un jet d'attaque de sort"
    
    // Variantes sans "de sort" explicite (règles 2024)
    /effectuez une attaque.*avec un sort/i,    // "effectuez une attaque de corps à corps avec un sort"
    /effectuez un jet d'attaque/i,             // "Effectuez un jet d'attaque à distance"
    /faites un jet d'attaque.*contre/i,        // "faites un jet d'attaque contre"
    /réalisez un jet d'attaque/i,              // "réalisez un jet d'attaque"
    
    // 🔹 Variantes simplifiées : "attaque à distance / au corps à corps contre ... "
    // On reste prudent en exigeant "contre" (cible explicite).
    /effectuez une attaque\s+(?:à distance|au corps à corps)\s+contre/i,
    /réalisez une attaque\s+(?:à distance|au corps à corps)\s+contre/i,
    /attaque\s+(?:à distance|au corps à corps)\s+contre/i,
  ];
  
  // Vérifier les patterns positifs
  const hasAttack = attackKeywords.some(regex => regex.test(description));
  
  // ✅ DEBUG optionnel (à commenter après validation)
  // if (hasAttack) {
  //   console.log('🎯 Attaque détectée:', description.substring(0, 100));
  // }
  
  return hasAttack;
}

/**
 * 3. Détecte si le sort nécessite un jet de sauvegarde
 * Utile pour l'affichage futur du DD de sauvegarde sur la carte
 */
export function isSavingThrowSpell(description: string): boolean {
  if (!description) return false;
  
  const savingThrowKeywords = [
    /jet de sauvegarde/i,
    /effectue.*sauvegarde/i,
    /réussit.*sauvegarde/i,
  ];
  
  return savingThrowKeywords.some(regex => regex.test(description));
}

/**
 * 4. Extrait toutes les composantes de dégâts d'un texte
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
  
  // Regex améliorée : capturer formule + type de dégât éventuel APRÈS
  // Ex: "1d6 dégâts de tonnerre" → capture "1d6", puis cherche "tonnerre" après
  const damageRegex = /(\d+)d(\d+)/gi;
  
  let match;
  while ((match = damageRegex.exec(text)) !== null) {
    const [fullMatch, diceCount, diceType] = match;
    
    // Vérifier le contexte dans une fenêtre plus large (100 caractères avant/après)
    const contextStart = Math.max(0, match.index - 100);
    const contextEnd = Math.min(text.length, match.index + fullMatch.length + 100);
    const context = text.substring(contextStart, contextEnd).toLowerCase();
    
    // Exclusions strictes : patterns de non-dégâts
    const exclusionPatterns = [
      /soustraire\s+\d+d\d+/i,           // "soustraire 1d4"
      /\d+d\d+\s+du\s+prochain/i,        // "1d4 du prochain jet"
      /\d+d\d+\s+au\s+(?:prochain|suivant)/i, // "1d4 au prochain"
    ];
    
    // Vérifier si c'est un pattern exclu
    const textAroundMatch = text.substring(
      Math.max(0, match.index - 20),
      Math.min(text.length, match.index + fullMatch.length + 30)
    );
    
    const isExcluded = exclusionPatterns.some(pattern => pattern.test(textAroundMatch));
    
    if (isExcluded) {
      continue; // Ignorer ce match
    }
    
    // Vérifier que le contexte mentionne bien des dégâts
    const isDamageContext = /dégâts?|subir|subit|inflige|infligeant|perd|perdant|blessure/i.test(context);
    const isHealingContext = /points?\s+de\s+vie|récupère|regagne|retrouve|soins?|guérison/i.test(context);

    if (!isDamageContext && !isHealingContext) {
      continue; // Ignorer si pas de contexte de dégât ou de soin
    }
    
    // Extraire le type de dégât après la formule
    // Chercher dans les 50 caractères après la formule
    const afterText = text.substring(match.index, match.index + 50);
    let damageType: string | undefined = undefined;
    
    // Pattern 1 : "1d6 dégâts de tonnerre" ou "1d6 de tonnerre"
    const typePattern1 = /\d+d\d+\s+(?:dégâts?\s+)?de\s+([a-zàâçéèêëîïôûùüÿñæœ]+)/i;
    const typeMatch1 = afterText.match(typePattern1);
    
    if (typeMatch1) {
      const candidate = typeMatch1[1].toLowerCase().trim();
      if (validDamageTypes.has(candidate)) {
        damageType = candidate;
      }
    }
    
    // Pattern 2 : "1d6 tonnerre" (type juste après, sans "de")
    if (!damageType) {
      const typePattern2 = /\d+d\d+\s+([a-zàâçéèêëîïôûùüÿñæœ]+)/i;
      const typeMatch2 = afterText.match(typePattern2);
      
      if (typeMatch2) {
        const candidate = typeMatch2[1].toLowerCase().trim();
        // Vérifier que ce n'est pas un mot-clé non pertinent
        if (validDamageTypes.has(candidate) && candidate !== 'dégâts' && candidate !== 'dégât') {
          damageType = candidate;
        }
      }
    }
    
    // Pattern 3 : "subir 1d6 dégâts psychiques" (chercher après "dégâts")
    if (!damageType) {
      const typePattern3 = /dégâts?\s+([a-zàâçéèêëîïôûùüÿñæœ]+)/i;
      const typeMatch3 = afterText.match(typePattern3);
      
      if (typeMatch3) {
        const candidate = typeMatch3[1].toLowerCase().trim();
        if (validDamageTypes.has(candidate)) {
          damageType = candidate;
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
 * 5. Détecte si le sort utilise un modificateur de caractéristique
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

  // gestion des formulations génériques de caractéristique d'incantation
  const spellcastingAbilityRegex = /modificateur de votre caractéristique d['’]incantation(?:s)?/i;
  if (spellcastingAbilityRegex.test(description)) {
    return {
      hasModifier: true,
      ability: undefined,
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
 * 6. Parse les règles d'amélioration pour sorts à emplacements
 * Ex: "+1d8 par niveau d'emplacement supérieur à 1"
 * Retourne: { components: [{1d8}], perLevels: 1 }
 */
export function parseSlotUpgrade(higherLevels: string): {
  components: DamageComponent[];
  perLevels: number;
} | null {
  if (!higherLevels) return null;
  
  // gestion des textes d'amélioration des dégâts ou soins
  const cleanText = higherLevels.replace(/\*\*/g, '').replace(/\n/g, ' ');

  let match =
    cleanText.match(/(?:\+)?(\d+d\d+)(?:.*?(?:supplémentaire|en plus))?.*?(?:par|pour\s+chaque|pour\s+tous).*?(?:niveau|emplacement)/i) ||
    cleanText.match(/augment(?:ent|e)?\s+(?:de\s+)?(\d+d\d+).*?(?:par|pour\s+chaque|pour\s+tous).*?(?:niveau|emplacement)/i);

  if (match) {
    const diceFormula = match[1];

    const fakeContext = `récupère ${diceFormula} points de vie`;
    const components = extractDamageComponents(fakeContext);

    if (components.length === 0) {
      const [countStr, typeStr] = diceFormula.split('d');
      return {
        components: [{
          diceCount: parseInt(countStr, 10),
          diceType: parseInt(typeStr, 10),
          formula: diceFormula,
          damageType: undefined,
        }],
        perLevels: 1,
      };
    }

    return {
      components,
      perLevels: 1,
    };
  }
  
  return null;
}



/** 
 * 7. Parse les règles d'amélioration pour tours de magie (basées sur niveau de personnage)
 * Ex: "Les dégâts augmentent de 1d10 lorsque vous atteignez le niveau 5"
 * Retourne: { components: [{1d10}], thresholds: [5, 11, 17] }
 */
export function parseCantripUpgrade(higherLevels: string): {
  components: DamageComponent[];
  thresholds: number[];
} | null {
  if (!higherLevels) return null;
  
  // 1️⃣ Détection des seuils de niveau
  // Pattern principal : "niveaux 5 (2d6), 11 (3d6) et 17 (4d6)"
  // On cherche TOUS les nombres après "niveau" ou "niveaux", même s'ils sont suivis de parenthèses
  const levelPattern = /niveaux?\s+(\d+)/gi;
  const thresholds: number[] = [];
  
  let match;
  while ((match = levelPattern.exec(higherLevels)) !== null) {
    const level = parseInt(match[1], 10);
    // On ne garde que les seuils typiques de cantrips (5, 11, 17)
    if ([5, 11, 17].includes(level)) {
      thresholds.push(level);
    }
  }
  
  // ✅ DEBUG : Afficher les seuils détectés (dev uniquement)
  if ((import.meta as any)?.env?.DEV) {
    console.log('[parseCantripUpgrade] Seuils détectés:', thresholds, '| Texte:', higherLevels);
  }
  
  // Si aucun seuil trouvé avec le pattern principal, chercher les patterns alternatifs
  if (thresholds.length === 0) {
    // Pattern alternatif : "aux niveaux 5, 11, et 17" (sans parenthèses)
    const altPattern = /niveaux?\s+([\d,\s]+(?:et\s+\d+)?)/i;
    const altMatch = higherLevels.match(altPattern); 
    
    if (altMatch) { 
      const numbers = altMatch[1].match(/\d+/g);
      if (numbers) { 
        numbers.forEach(n => {
          const level = parseInt(n, 10);
          if ([5, 11, 17].includes(level)) {
            thresholds.push(level);
          }
        });
      }
    }
  }
  
  // Si toujours aucun seuil, utiliser les valeurs par défaut
  if (thresholds.length === 0) {
        if ((import.meta as any)?.env?.DEV) {
      console.log('[parseCantripUpgrade] Aucun seuil trouvé, utilisation des valeurs par défaut');
    }
    thresholds.push(5, 11, 17);
  }
  
  // Dédoublonner et trier
  const uniqueThresholds = [...new Set(thresholds)].sort((a, b) => a - b);
  
  // 2️⃣ Extraire UNIQUEMENT l'incrément de dégâts
  // Pattern : "augmentent de XdY" ou "augmente de XdY"
  const incrementPattern = /(?:augmentent?|gagne(?:nt)?)\s+(?:de\s+)?(\d+d\d+)/i;
  const incrementMatch = higherLevels.match(incrementPattern);
 
    // ✅ DEBUG : Afficher l'incrément détecté
  console.log('[parseCantripUpgrade] Incrément détecté:', incrementMatch ? incrementMatch[1] : 'aucun');
  
   if (!incrementMatch) {
    // Fallback : extraire toutes les formules et prendre la première (hors parenthèses)
    const textWithoutParens = higherLevels.replace(/\([^)]+\)/g, ''); // Retirer "(2d6)", "(3d6)", etc.
    const components = extractDamageComponents(textWithoutParens);
    
    if (components.length > 0) {
      // Prendre seulement la première formule
      if ((import.meta as any)?.env?.DEV) {
        console.log('[parseCantripUpgrade] Fallback - composante trouvée:', components[0]);
      }
      return {
        components: [components[0]],
        thresholds: uniqueThresholds,
      };
    }
    if ((import.meta as any)?.env?.DEV) {
      console.log('[parseCantripUpgrade] Aucun incrément trouvé');
    }
    return null;
  }
  
   // Extraire les composantes de l'incrément
  // ⚠️ extractDamageComponents nécessite un contexte de "dégâts", on l'ajoute artificiellement
  const components = extractDamageComponents(`augmentent de ${incrementMatch[1]} dégâts`);
  
  if (components.length === 0) {
    if ((import.meta as any)?.env?.DEV) {
      console.log('[parseCantripUpgrade] Aucune composante extraite');
    }
    return null;
  }
  
  if ((import.meta as any)?.env?.DEV) {
    console.log('[parseCantripUpgrade] Résultat final:', {
      components: [components[0]],
      thresholds: uniqueThresholds
    });
  }
  
  return {
    components: [components[0]], // Prendre seulement la première formule
    thresholds: uniqueThresholds,
  };
}

/**
 * 8. Consolide les composantes de dégâts identiques
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
 * 9. Fonction principale : analyse complète d'un sort
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
  
  // ✅ NOUVEAU : Enrichir upgradePattern avec le type de dégât de baseDamage
  if (upgradePattern && baseDamage.length > 0) {
    upgradePattern = upgradePattern.map(upgrade => {
      // Si l'upgrade n'a pas de damageType, hériter du premier baseDamage qui matche le diceType
      if (!upgrade.damageType) {
        const matchingBase = baseDamage.find(base => base.diceType === upgrade.diceType);
        if (matchingBase && matchingBase.damageType) {
          return {
            ...upgrade,
            damageType: matchingBase.damageType,
          };
        }
      }
      return upgrade;
    });
  }
  
  return {
    isDamageSpell: isDamageSpell(description),
    isHealingSpell: isHealingSpell(description),
    isAttackRoll: isAttackRoll(description),
    isSavingThrow: isSavingThrowSpell(description),
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
 * 10. Calcule les dégâts totaux pour un niveau donné (sorts à emplacements)
 */
export function calculateSlotDamage(
  info: SpellDamageInfo,
  baseSpellLevel: number,
  castLevel: number,
  abilityModifier?: number
): string {
  // ✅ DEBUG : Afficher les entrées (dev uniquement)
  if ((import.meta as any)?.env?.DEV) {
    console.log(`[calculateSlotDamage] Appelé avec castLevel=${castLevel}, baseSpellLevel=${baseSpellLevel}`);
    console.log(`[calculateSlotDamage] baseDamage:`, JSON.stringify(info.baseDamage));
    console.log(`[calculateSlotDamage] upgradePattern:`, JSON.stringify(info.upgradePattern));
  }
  
  if (!info.isDamageSpell && !info.isHealingSpell) return '';
  
  // ✅ CORRECTION : Deep copy STRICTE pour éviter toute mutation
  let totalComponents: DamageComponent[] = info.baseDamage.map(comp => ({
    diceCount: comp.diceCount,
    diceType: comp.diceType,
    formula: comp.formula,
    damageType: comp.damageType,
  }));
  
  // Ajouter les dégâts d'amélioration
  if (info.upgradeType === 'per_slot_level' && info.upgradePattern && castLevel > baseSpellLevel) {
    const levelDiff = castLevel - baseSpellLevel;
    const multiplier = Math.floor(levelDiff / (info.upgradePerLevels || 1));
    
    // ✅ NOUVEAU : Clone aussi upgradePattern pour éviter les mutations
    const upgradeClones = info.upgradePattern.map(upgrade => ({
      diceCount: upgrade.diceCount,
      diceType: upgrade.diceType,
      formula: upgrade.formula,
      damageType: upgrade.damageType,
    }));
    
    // Multiplier chaque composante d'amélioration
    upgradeClones.forEach(upgrade => {
      // ✅ DEBUG : Afficher la recherche (dev uniquement)
      if ((import.meta as any)?.env?.DEV) {
        console.log(`[calculateSlotDamage] Recherche d'un composant existant pour upgrade:`, upgrade);
        console.log(`[calculateSlotDamage] totalComponents avant fusion:`, JSON.stringify(totalComponents));
      }
      
      const existingIndex = totalComponents.findIndex(
        c => c.diceType === upgrade.diceType && c.damageType === upgrade.damageType
      );
      
      // ✅ DEBUG : Résultat de la recherche
      if ((import.meta as any)?.env?.DEV) {
        console.log(`[calculateSlotDamage] existingIndex trouvé: ${existingIndex}`);
      }
      
      if (existingIndex !== -1) {
        // ✅ Créer un NOUVEAU composant au lieu de muter l'existant
        totalComponents[existingIndex] = {
          diceCount: totalComponents[existingIndex].diceCount + (upgrade.diceCount * multiplier),
          diceType: totalComponents[existingIndex].diceType,
          formula: `${totalComponents[existingIndex].diceCount + (upgrade.diceCount * multiplier)}d${totalComponents[existingIndex].diceType}`,
          damageType: totalComponents[existingIndex].damageType,
        };
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
    // ✅ Ne pas afficher le type de dégât dans le badge (visible dans la description)
    parts.push(comp.formula);
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
 * 11. Calcule les dégâts totaux pour un tour de magie selon le niveau du personnage
 */
export function calculateCantripDamage(
  info: SpellDamageInfo,
  characterLevel: number,
  abilityModifier?: number
): string {
  if (!info.isDamageSpell && !info.isHealingSpell) return '';
  
  // ✅ CORRECTION : Deep copy STRICTE pour éviter toute mutation
  let totalComponents: DamageComponent[] = info.baseDamage.map(comp => ({
    diceCount: comp.diceCount,
    diceType: comp.diceType,
    formula: comp.formula,
    damageType: comp.damageType,
  }));
  
  // Déterminer combien de fois appliquer l'amélioration
  if (info.upgradeType === 'character_level' && info.upgradePattern && info.characterLevelThresholds) {
    let multiplier = 0;
    
    // Compter combien de seuils ont été atteints
    info.characterLevelThresholds.forEach(threshold => {
      if (characterLevel >= threshold) {
        multiplier++;
      }
    });

    // ✅ DEBUG : Afficher le calcul du multiplier (dev uniquement)
    if ((import.meta as any)?.env?.DEV) {
      console.log('[calculateCantripDamage] Multiplier:', multiplier, '| Niveau perso:', characterLevel, '| Seuils:', info.characterLevelThresholds);
    }
      if (multiplier > 0) {
      // ✅ Clone upgradePattern pour éviter les mutations
      const upgradeClones = info.upgradePattern.map(upgrade => ({
        diceCount: upgrade.diceCount,
        diceType: upgrade.diceType,
        formula: upgrade.formula,
        damageType: upgrade.damageType,
      }));
      
      // Ajouter les dégâts supplémentaires
      upgradeClones.forEach(upgrade => {
        const existingIndex = totalComponents.findIndex(c => 
          c.diceType === upgrade.diceType && 
          (c.damageType || 'none') === (upgrade.damageType || 'none')
        );
        
        if (existingIndex !== -1) {
          // ✅ Créer un NOUVEAU composant au lieu de muter
          totalComponents[existingIndex] = {
            diceCount: totalComponents[existingIndex].diceCount + (upgrade.diceCount * multiplier),
            diceType: totalComponents[existingIndex].diceType,
            formula: `${totalComponents[existingIndex].diceCount + (upgrade.diceCount * multiplier)}d${totalComponents[existingIndex].diceType}`,
            damageType: totalComponents[existingIndex].damageType,
          };
        } else {
          // ✅ Ajouter comme nouveau composant
             const newComponent = {
            diceCount: upgrade.diceCount * multiplier,
            diceType: upgrade.diceType,
            formula: `${upgrade.diceCount * multiplier}d${upgrade.diceType}`,
            damageType: upgrade.damageType,
          };
          totalComponents.push(newComponent);
          if ((import.meta as any)?.env?.DEV) {
            console.log('[calculateCantripDamage] Nouveau composant ajouté:', newComponent);
          }
        }
      });
      // ✅ DEBUG : Afficher les composantes après amélioration (dev uniquement)
      if ((import.meta as any)?.env?.DEV) {
        console.log('[calculateCantripDamage] Composantes après amélioration:', totalComponents);
      }
    }
  }

  // ✅ Harmoniser le type de dégâts entre baseDamage et les upgrades
  if (info.baseDamage.length > 0) {
    const mainType = info.baseDamage[0].damageType || null;

    if (mainType) {
      totalComponents = totalComponents.map(comp => {
        // Si un composant n'a pas de type, on lui applique le type principal (ex: "tonnerre")
        if (!comp.damageType || comp.damageType === 'none') {
          return {
            ...comp,
            damageType: mainType,
          };
        }
        return comp;
      });
    }
  }
  
  // ✅ Consolider les dés identiques avant de construire la formule
  const consolidated = consolidateDamageComponents(totalComponents);

  // Construire la formule finale
  const parts: string[] = [];

  consolidated.forEach(comp => {
    // ✅ Ne pas afficher le type de dégât dans le badge (visible dans la description)
    parts.push(comp.formula);
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
 * 12. Obtient les niveaux de lancement disponibles pour un sort
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