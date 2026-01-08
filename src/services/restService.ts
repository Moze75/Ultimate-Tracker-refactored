import type { Player, ClassResources, CustomClassResource } from '../types/dnd';

export interface RestableResource {
  id: string;
  name: string;
  type: 'standard' | 'custom';
  current: number;
  max: number;
  icon?: string;
  color?: string;
  restType: 'short' | 'long' | 'both';
}

export interface RestUpdateResult {
  updateData: Partial<Player>;
  restoredLabels: string[];
}

function getModifierFromPlayer(player: Player, abilityName: string): number {
  const abilities = player?.abilities;
  if (!abilities) return 0;

  const abilityMap: Record<string, string[]> = {
    'Force': ['Force', 'force', 'strength', 'STR', 'str'],
    'Dexterite': ['Dextérité', 'Dexterite', 'dexterite', 'dexterity', 'DEX', 'dex'],
    'Constitution': ['Constitution', 'constitution', 'CON', 'con'],
    'Intelligence': ['Intelligence', 'intelligence', 'INT', 'int'],
    'Sagesse': ['Sagesse', 'sagesse', 'wisdom', 'WIS', 'wis'],
    'Charisme': ['Charisme', 'charisme', 'charisma', 'CHA', 'cha'],
  };

  const keys = abilityMap[abilityName] || [abilityName];

  if (Array.isArray(abilities)) {
    const found = abilities.find((a: any) => keys.some(k => a?.name === k));
    if (found) {
      if (typeof found.modifier === 'number') return found.modifier;
      if (typeof found.score === 'number') return Math.floor((found.score - 10) / 2);
    }
  }

  return 0;
}

export function getCustomResourceMaxValue(
  resource: CustomClassResource,
  level: number,
  player: Player
): number {
  if (typeof resource.maxValue === 'number') {
    return resource.maxValue;
  }
  if (resource.maxValue === 'level') {
    return level;
  }
  if (resource.maxValue === 'modifier' && resource.modifierAbility) {
    return Math.max(1, getModifierFromPlayer(player, resource.modifierAbility));
  }
  return 1;
}

export function getHitDieSize(className: string | null | undefined): number {
  switch (className) {
    case 'Barbare': return 12;
    case 'Guerrier':
    case 'Paladin':
    case 'Rôdeur': return 10;
    case 'Barde':
    case 'Clerc':
    case 'Druide':
    case 'Moine':
    case 'Roublard':
    case 'Occultiste':
      return 8;
    case 'Magicien':
    case 'Ensorceleur': return 6;
    default: return 8;
  }
}

export function getRestorableResources(player: Player, restType: 'short' | 'long'): RestableResource[] {
  const resources: RestableResource[] = [];
  const cr = player.class_resources || {};
  const level = player.level || 1;

  if (player.class === 'Moine') {
    const total = (cr as any).credo_points ?? (cr as any).ki_points ?? level;
    const used = (cr as any).used_credo_points ?? (cr as any).used_ki_points ?? 0;
    if (used > 0) {
      resources.push({
        id: 'credo_points',
        name: 'Points de crédo',
        type: 'standard',
        current: total - used,
        max: total,
        restType: 'short',
      });
    }
  }

  if (player.class === 'Occultiste') {
    const pactSlots = player.spell_slots?.pact_slots || 0;
    const usedPact = player.spell_slots?.used_pact_slots || 0;
    if (usedPact > 0 && pactSlots > 0) {
      resources.push({
        id: 'pact_slots',
        name: 'Emplacements de pacte',
        type: 'standard',
        current: pactSlots - usedPact,
        max: pactSlots,
        restType: 'short',
      });
    }
  }

  if (player.class === 'Magicien') {
    const used = (cr as any).used_arcane_recovery;
    if (used) {
      resources.push({
        id: 'arcane_recovery',
        name: 'Récupération arcanique',
        type: 'standard',
        current: 0,
        max: 1,
        restType: 'short',
      });
    }
  }

  if (player.class === 'Paladin') {
    const cdUsed = (cr as any).used_channel_divinity || 0;
    if (cdUsed > 0 && level >= 3) {
      resources.push({
        id: 'channel_divinity_paladin',
        name: 'Conduit divin (1)',
        type: 'standard',
        current: 0,
        max: 1,
        restType: 'short',
      });
    }
  }

  if (player.custom_class_data?.isCustom && player.custom_class_data.resources?.length > 0) {
    const customState = cr.custom_resources || {};

    for (const res of player.custom_class_data.resources) {
      const shouldShow = restType === 'short' ? res.shortRest : res.longRest;
      if (!shouldShow) continue;

      const maxVal = getCustomResourceMaxValue(res, level, player);
      const used = customState[res.id]?.used || 0;

      if (used > 0) {
        resources.push({
          id: `custom_${res.id}`,
          name: res.name,
          type: 'custom',
          current: maxVal - used,
          max: maxVal,
          icon: res.icon,
          color: res.color,
          restType: res.shortRest && res.longRest ? 'both' : res.shortRest ? 'short' : 'long',
        });
      }
    }
  }

  if (player.secondary_class === 'Moine') {
    const scr = player.secondary_class_resources || {};
    const total = (scr as any).credo_points ?? (scr as any).ki_points ?? (player.secondary_level || 1);
    const used = (scr as any).used_credo_points ?? (scr as any).used_ki_points ?? 0;
    if (used > 0) {
      resources.push({
        id: 'secondary_credo_points',
        name: 'Points de crédo (sec.)',
        type: 'standard',
        current: total - used,
        max: total,
        restType: 'short',
      });
    }
  }

  if (player.secondary_class === 'Occultiste') {
    const secSlots = player.secondary_spell_slots;
    const pactSlots = secSlots?.pact_slots || 0;
    const usedPact = secSlots?.used_pact_slots || 0;
    if (usedPact > 0 && pactSlots > 0) {
      resources.push({
        id: 'secondary_pact_slots',
        name: 'Emplacements de pacte (sec.)',
        type: 'standard',
        current: pactSlots - usedPact,
        max: pactSlots,
        restType: 'short',
      });
    }
  }

  return resources;
}

export function buildShortRestUpdate(
  player: Player,
  hitDiceToUse: number,
  selectedResourceIds: string[]
): RestUpdateResult {
  const restoredLabels: string[] = [];
  const nextCR: any = { ...(player.class_resources || {}) };
  const nextSpellSlots: any = { ...(player.spell_slots || {}) };
  const nextSecondaryCR: any = { ...(player.secondary_class_resources || {}) };
  const nextSecondarySpellSlots: any = { ...(player.secondary_spell_slots || {}) };

  let totalHealing = 0;

  if (hitDiceToUse > 0 && player.hit_dice) {
    const available = player.hit_dice.total - player.hit_dice.used;
    const diceToUse = Math.min(hitDiceToUse, available);
    const hitDieSize = getHitDieSize(player.class);
    const constitutionMod = player.abilities?.find(a => a.name === 'Constitution')?.modifier || 0;

    for (let i = 0; i < diceToUse; i++) {
      const roll = Math.floor(Math.random() * hitDieSize) + 1;
      totalHealing += Math.max(1, roll + constitutionMod);
    }

    restoredLabels.push(`+${totalHealing} PV (${diceToUse} dé${diceToUse > 1 ? 's' : ''} de vie)`);
  }

  if (selectedResourceIds.includes('credo_points') && player.class === 'Moine') {
    nextCR.used_credo_points = 0;
    nextCR.used_ki_points = 0;
    const total = nextCR.credo_points || nextCR.ki_points || player.level;
    restoredLabels.push(`+${total} points de crédo`);
  }

  if (selectedResourceIds.includes('pact_slots') && player.class === 'Occultiste') {
    const pactSlots = nextSpellSlots.pact_slots || 0;
    nextSpellSlots.used_pact_slots = 0;
    if (pactSlots > 0) {
      restoredLabels.push(`+${pactSlots} emplacement${pactSlots > 1 ? 's' : ''} de pacte`);
    }
  }

  if (selectedResourceIds.includes('arcane_recovery') && player.class === 'Magicien') {
    nextCR.used_arcane_recovery = false;
    nextCR.arcane_recovery_slots_used = 0;
    restoredLabels.push('Récupération arcanique disponible');
  }

  if (selectedResourceIds.includes('channel_divinity_paladin') && player.class === 'Paladin') {
    const before = nextCR.used_channel_divinity || 0;
    nextCR.used_channel_divinity = Math.max(0, before - 1);
    if (before > 0) {
      restoredLabels.push('+1 Conduit divin');
    }
  }

  if (selectedResourceIds.includes('secondary_credo_points') && player.secondary_class === 'Moine') {
    nextSecondaryCR.used_credo_points = 0;
    nextSecondaryCR.used_ki_points = 0;
    const total = nextSecondaryCR.credo_points || nextSecondaryCR.ki_points || (player.secondary_level || 1);
    restoredLabels.push(`+${total} points de crédo (sec.)`);
  }

  if (selectedResourceIds.includes('secondary_pact_slots') && player.secondary_class === 'Occultiste') {
    const pactSlots = nextSecondarySpellSlots.pact_slots || 0;
    nextSecondarySpellSlots.used_pact_slots = 0;
    if (pactSlots > 0) {
      restoredLabels.push(`+${pactSlots} emplacement${pactSlots > 1 ? 's' : ''} de pacte (sec.)`);
    }
  }

  if (player.custom_class_data?.isCustom && player.custom_class_data.resources?.length > 0) {
    const customState = { ...(nextCR.custom_resources || {}) };

    for (const res of player.custom_class_data.resources) {
      if (!res.shortRest) continue;
      if (!selectedResourceIds.includes(`custom_${res.id}`)) continue;

      const maxVal = getCustomResourceMaxValue(res, player.level || 1, player);
      const oldUsed = customState[res.id]?.used || 0;

      if (oldUsed > 0) {
        customState[res.id] = { current: maxVal, used: 0 };
        restoredLabels.push(`+${oldUsed} ${res.name}`);
      }
    }

    nextCR.custom_resources = customState;
  }

  const hitDiceUsed = hitDiceToUse > 0 && player.hit_dice
    ? Math.min(hitDiceToUse, player.hit_dice.total - player.hit_dice.used)
    : 0;

  const updateData: Partial<Player> = {
    class_resources: nextCR,
    spell_slots: nextSpellSlots,
  };

  if (totalHealing > 0) {
    updateData.current_hp = Math.min(player.max_hp, player.current_hp + totalHealing);
  }

  if (hitDiceUsed > 0 && player.hit_dice) {
    updateData.hit_dice = {
      ...player.hit_dice,
      used: player.hit_dice.used + hitDiceUsed,
    };
  }

  if (player.secondary_class) {
    updateData.secondary_class_resources = nextSecondaryCR;
    updateData.secondary_spell_slots = nextSecondarySpellSlots;
  }

  return { updateData, restoredLabels };
}

export function buildLongRestUpdate(player: Player): RestUpdateResult {
  const restoredLabels: string[] = [];
  const nextCR: any = { ...(player.class_resources || {}) };
  const nextSecondaryCR: any = { ...(player.secondary_class_resources || {}) };

  const standardResourceKeys = [
    'used_rage',
    'used_bardic_inspiration',
    'used_channel_divinity',
    'used_wild_shape',
    'used_sorcery_points',
    'used_action_surge',
    'used_credo_points',
    'used_ki_points',
    'used_lay_on_hands',
    'used_favored_foe',
    'used_innate_sorcery',
    'used_supernatural_metabolism',
  ];

  for (const key of standardResourceKeys) {
    nextCR[key] = 0;
    nextSecondaryCR[key] = 0;
  }

  nextCR.used_arcane_recovery = false;
  nextCR.arcane_recovery_slots_used = 0;
  nextSecondaryCR.used_arcane_recovery = false;
  nextSecondaryCR.arcane_recovery_slots_used = 0;

  if (player.custom_class_data?.isCustom && player.custom_class_data.resources?.length > 0) {
    const customState = { ...(nextCR.custom_resources || {}) };

    for (const res of player.custom_class_data.resources) {
      if (!res.longRest) continue;

      const maxVal = getCustomResourceMaxValue(res, player.level || 1, player);
      customState[res.id] = { current: maxVal, used: 0 };
    }

    nextCR.custom_resources = customState;
  }

  const hitDiceRecovered = Math.max(1, Math.floor(player.level / 2));

  const updateData: Partial<Player> = {
    current_hp: player.max_hp,
    temporary_hp: 0,
    hit_dice: {
      total: player.level,
      used: Math.max(0, (player.hit_dice?.used || 0) - hitDiceRecovered),
    },
    class_resources: nextCR,
    spell_slots: {
      ...player.spell_slots,
      used1: 0, used2: 0, used3: 0, used4: 0,
      used5: 0, used6: 0, used7: 0, used8: 0, used9: 0,
      used_pact_slots: 0,
    },
    is_concentrating: false,
    concentration_spell: undefined,
  };

  if (player.secondary_class) {
    updateData.secondary_class_resources = nextSecondaryCR;
    updateData.secondary_spell_slots = {
      ...player.secondary_spell_slots,
      used1: 0, used2: 0, used3: 0, used4: 0,
      used5: 0, used6: 0, used7: 0, used8: 0, used9: 0,
      used_pact_slots: 0,
    };
  }

  restoredLabels.push('PV restaurés au maximum');
  restoredLabels.push(`+${hitDiceRecovered} dé${hitDiceRecovered > 1 ? 's' : ''} de vie`);
  restoredLabels.push('Emplacements de sorts restaurés');
  restoredLabels.push('Toutes les ressources de classe restaurées');

  return { updateData, restoredLabels };
}
