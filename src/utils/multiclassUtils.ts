import type { DndClass, Player } from '../types/dnd';

export function getPrimaryAbilityForClass(dndClass: DndClass): string[] {
  switch (dndClass) {
    case 'Barbare':
      return ['Force'];
    case 'Barde':
      return ['Charisme'];
    case 'Clerc':
      return ['Sagesse'];
    case 'Druide':
      return ['Sagesse'];
    case 'Ensorceleur':
      return ['Charisme'];
    case 'Guerrier':
      return ['Force', 'Dextérité'];
    case 'Magicien':
      return ['Intelligence'];
    case 'Moine':
      return ['Dextérité', 'Sagesse'];
    case 'Paladin':
      return ['Force', 'Charisme'];
    case 'Rôdeur':
      return ['Dextérité', 'Sagesse'];
    case 'Roublard':
      return ['Dextérité'];
    case 'Occultiste':
      return ['Charisme'];
    default:
      return [];
  }
}

const getModifier = (score: number): number => Math.floor((score - 10) / 2);

function getAbilityScoreFromPlayer(player: Player, abilityName: string): number {
  const abilities: any = (player as any)?.abilities;

  if (Array.isArray(abilities)) {
    const found = abilities.find((a: any) =>
      a?.name?.toLowerCase() === abilityName.toLowerCase()
    );
    if (found) {
      if (typeof found.score === 'number') return found.score;
    }
  } else if (abilities && typeof abilities === 'object') {
    const direct = abilities[abilityName] ?? abilities[abilityName.toLowerCase()];
    if (typeof direct === 'number') return direct;
    if (direct && typeof direct === 'object' && typeof direct.score === 'number') {
      return direct.score;
    }
  }

  return 10;
}

export function validateMulticlassPrerequisites(
  player: Player,
  newClass: DndClass
): { valid: boolean; message: string } {
  if (!player.class) {
    return {
      valid: false,
      message: 'Le personnage doit avoir une classe principale avant de multiclasser.'
    };
  }

  const primaryClassAbilities = getPrimaryAbilityForClass(player.class);
  const newClassAbilities = getPrimaryAbilityForClass(newClass);

  const missingAbilities: string[] = [];

  for (const ability of primaryClassAbilities) {
    const score = getAbilityScoreFromPlayer(player, ability);
    if (score < 13) {
      missingAbilities.push(`${ability} ${score}/13 (classe actuelle)`);
    }
  }

  for (const ability of newClassAbilities) {
    const score = getAbilityScoreFromPlayer(player, ability);
    if (score < 13) {
      missingAbilities.push(`${ability} ${score}/13 (nouvelle classe)`);
    }
  }

  if (missingAbilities.length > 0) {
    return {
      valid: false,
      message: `⚠️ Prérequis non remplis: ${missingAbilities.join(', ')}. Vous pouvez continuer mais c'est contre les règles D&D 5e.`
    };
  }

  return {
    valid: true,
    message: 'Tous les prérequis sont remplis.'
  };
}

export function getTotalLevel(player: Player): number {
  const primaryLevel = player.level || 0;
  const secondaryLevel = player.secondary_level || 0;
  return primaryLevel + secondaryLevel;
}

export function getHitDieForClass(dndClass: DndClass): number {
  switch (dndClass) {
    case 'Barbare':
      return 12;
    case 'Guerrier':
    case 'Paladin':
    case 'Rôdeur':
      return 10;
    case 'Barde':
    case 'Clerc':
    case 'Druide':
    case 'Moine':
    case 'Roublard':
    case 'Occultiste':
      return 8;
    case 'Magicien':
    case 'Ensorceleur':
      return 6;
    default:
      return 8;
  }
}

export function formatHitDiceDisplay(
  hitDiceByType: Record<string, { total: number; used: number }>
): string {
  if (!hitDiceByType || Object.keys(hitDiceByType).length === 0) {
    return '0';
  }

  const parts: string[] = [];
  const sortedTypes = Object.keys(hitDiceByType).sort((a, b) => {
    const aNum = parseInt(a.replace('d', ''));
    const bNum = parseInt(b.replace('d', ''));
    return bNum - aNum;
  });

  for (const diceType of sortedTypes) {
    const { total, used } = hitDiceByType[diceType];
    const remaining = Math.max(0, total - used);
    parts.push(`${remaining}${diceType}`);
  }

  return parts.join(' + ');
}

export function getProficiencyBonusForPlayer(player: Player): number {
  const totalLevel = getTotalLevel(player);
  if (totalLevel >= 17) return 6;
  if (totalLevel >= 13) return 5;
  if (totalLevel >= 9) return 4;
  if (totalLevel >= 5) return 3;
  return 2;
}

export function getCasterLevelForClass(dndClass: DndClass | null | undefined): 'full' | 'half' | 'third' | 'none' {
  if (!dndClass) return 'none';

  const fullCasters: DndClass[] = ['Barde', 'Clerc', 'Druide', 'Ensorceleur', 'Magicien'];
  const halfCasters: DndClass[] = ['Paladin', 'Rôdeur'];

  if (fullCasters.includes(dndClass)) return 'full';
  if (halfCasters.includes(dndClass)) return 'half';
  if (dndClass === 'Occultiste') return 'none';

  return 'none';
}

export function calculateMulticlassSpellSlots(player: Player): Record<string, number> {
  const primaryClass = player.class;
  const primaryLevel = player.level || 0;
  const secondaryClass = player.secondary_class;
  const secondaryLevel = player.secondary_level || 0;

  const primaryCasterType = getCasterLevelForClass(primaryClass);
  const secondaryCasterType = getCasterLevelForClass(secondaryClass);

  if (primaryCasterType === 'none' && secondaryCasterType === 'none') {
    return {};
  }

  let effectiveLevel = 0;

  if (primaryCasterType === 'full') {
    effectiveLevel += primaryLevel;
  } else if (primaryCasterType === 'half') {
    effectiveLevel += Math.ceil(primaryLevel / 2);
  } else if (primaryCasterType === 'third') {
    effectiveLevel += Math.floor(primaryLevel / 3);
  }

  if (secondaryCasterType === 'full') {
    effectiveLevel += secondaryLevel;
  } else if (secondaryCasterType === 'half') {
    effectiveLevel += Math.ceil(secondaryLevel / 2);
  } else if (secondaryCasterType === 'third') {
    effectiveLevel += Math.floor(secondaryLevel / 3);
  }

  effectiveLevel = Math.max(1, effectiveLevel);

  const spellSlotTable: Record<number, number[]> = {
    1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
    3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
    4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
    7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
    8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
    9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
    10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
    11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
    13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
    15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
    17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
    18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
    19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
    20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
  };

  const clampedLevel = Math.min(20, Math.max(1, effectiveLevel));
  const slots = spellSlotTable[clampedLevel] || [0, 0, 0, 0, 0, 0, 0, 0, 0];

  const result: Record<string, number> = {};
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] > 0) {
      result[`level${i + 1}`] = slots[i];
    }
  }

  return result;
}

export function combineSpellSlots(player: Player): any {
  // 1) Si pas de multiclasse, retourner les spell_slots normaux
  if (!player.secondary_class) {
    return player.spell_slots || {};
  }

  const primaryCasterType = getCasterLevelForClass(player.class);
  const secondaryCasterType = getCasterLevelForClass(player.secondary_class);

  // 2) Si AUCUNE des deux classes n'est un lanceur de sorts
  if (primaryCasterType === 'none' && secondaryCasterType === 'none') {
    return {};
  }

  // 3) Cas spécial : Une ou les deux classes sont Occultiste
  if (player.class === 'Occultiste' || player.secondary_class === 'Occultiste') {
    const primaryIsWarlock = player.class === 'Occultiste';
    const warlockSlots = primaryIsWarlock ? player.spell_slots : player.secondary_spell_slots;
    const otherClass = primaryIsWarlock ? player.secondary_class : player.class;
    const otherLevel = primaryIsWarlock ? player.secondary_level : player.level;
    const otherCasterType = getCasterLevelForClass(otherClass);

    const combined: any = {};

    // Emplacements de pacte de l'Occultiste
    if (warlockSlots) {
      combined.pact_slots = warlockSlots.pact_slots || 0;
      combined.pact_level = warlockSlots.pact_level || 1;
      combined.used_pact_slots = warlockSlots.used_pact_slots || 0;
    }

    // Emplacements normaux de l'autre classe (si lanceur)
    if (otherCasterType !== 'none' && otherLevel) {
      let effectiveLevel = 0;

      if (otherCasterType === 'full') {
        effectiveLevel = otherLevel;
      } else if (otherCasterType === 'half') {
        effectiveLevel = Math.ceil(otherLevel / 2);
      } else if (otherCasterType === 'third') {
        effectiveLevel = Math.floor(otherLevel / 3);
      }

      effectiveLevel = Math.max(1, effectiveLevel);

      const spellSlotTable: Record<number, number[]> = {
        1: [2, 0, 0, 0, 0, 0, 0, 0, 0],
        2: [3, 0, 0, 0, 0, 0, 0, 0, 0],
        3: [4, 2, 0, 0, 0, 0, 0, 0, 0],
        4: [4, 3, 0, 0, 0, 0, 0, 0, 0],
        5: [4, 3, 2, 0, 0, 0, 0, 0, 0],
        6: [4, 3, 3, 0, 0, 0, 0, 0, 0],
        7: [4, 3, 3, 1, 0, 0, 0, 0, 0],
        8: [4, 3, 3, 2, 0, 0, 0, 0, 0],
        9: [4, 3, 3, 3, 1, 0, 0, 0, 0],
        10: [4, 3, 3, 3, 2, 0, 0, 0, 0],
        11: [4, 3, 3, 3, 2, 1, 0, 0, 0],
        12: [4, 3, 3, 3, 2, 1, 0, 0, 0],
        13: [4, 3, 3, 3, 2, 1, 1, 0, 0],
        14: [4, 3, 3, 3, 2, 1, 1, 0, 0],
        15: [4, 3, 3, 3, 2, 1, 1, 1, 0],
        16: [4, 3, 3, 3, 2, 1, 1, 1, 0],
        17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
        18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
        19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
        20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
      };

      const clampedLevel = Math.min(20, Math.max(1, effectiveLevel));
      const slots = spellSlotTable[clampedLevel] || [0, 0, 0, 0, 0, 0, 0, 0, 0];

      for (let i = 0; i < slots.length; i++) {
        if (slots[i] > 0) {
          combined[`level${i + 1}`] = slots[i];
        }
      }

      // Emplacements utilisés
      const otherSlots = primaryIsWarlock ? player.secondary_spell_slots : player.spell_slots;
      for (let i = 1; i <= 9; i++) {
        const usedKey = `used${i}`;
        combined[usedKey] = (otherSlots as any)?.[usedKey] || 0;
      }
    }

    return combined;
  }

  // 4) ✅ CAS AJOUTÉ : Classe principale non-lanceur + Classe secondaire lanceur
  if (primaryCasterType === 'none' && secondaryCasterType !== 'none') {
    // Utiliser directement les spell_slots de la classe secondaire
    const secondarySlots = player.secondary_spell_slots || {};
    return secondarySlots;
  } 

  // 5) ✅ CAS AJOUTÉ : Classe principale lanceur + Classe secondaire non-lanceur
  if (primaryCasterType !== 'none' && secondaryCasterType === 'none') {
    // Utiliser directement les spell_slots de la classe principale
    return player.spell_slots || {};
  }

  // 6) Multiclasse de deux lanceurs (hors Occultiste)
  const multiclassSlots = calculateMulticlassSpellSlots(player);
  const currentUsed: Record<string, number> = {};

  for (let i = 1; i <= 9; i++) {
    const usedKey = `used${i}`;
    const primaryUsed = (player.spell_slots as any)?.[usedKey] || 0;
    const secondaryUsed = (player.secondary_spell_slots as any)?.[usedKey] || 0;
    currentUsed[usedKey] = primaryUsed + secondaryUsed;
  }

  return {
    ...multiclassSlots,
    ...currentUsed,
  };
}