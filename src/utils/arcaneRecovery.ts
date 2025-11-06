import { Player } from '../types/dnd';

/**
 * Calcule le total de niveaux de sorts récupérables via Restauration Arcanique
 * Règle D&D 2024 : moitié du niveau de magicien (arrondi supérieur), minimum 1
 */
export function getArcaneRecoveryTotal(level: number): number {
  return Math.max(1, Math.ceil(level / 2));
}

/**
 * Récupère les informations actuelles sur la Restauration Arcanique
 */
export function getArcaneRecoveryInfo(player: Player): {
  total: number;
  used: number;
  remaining: number;
  isAvailable: boolean;
  canRecover: boolean;
} {
  const level = player.level || 1;
  const total = getArcaneRecoveryTotal(level);
  
  const used = (player.class_resources as any)?.arcane_recovery_slots_used || 0;
  const remaining = Math.max(0, total - used);
  
  // Le bouton "Restauration magique" a-t-il été activé ?
  const isAvailable = !(player.class_resources?.used_arcane_recovery || false);
  
  const canRecover = isAvailable && remaining > 0;

  return { total, used, remaining, isAvailable, canRecover };
}

/**
 * Vérifie si un emplacement de sort peut être récupéré
 */
export function canRecoverSlot(
  player: Player,
  slotLevel: number,
  currentUsedSlots: number
): { canRecover: boolean; reason?: string } {
  const info = getArcaneRecoveryInfo(player);

  if (!info.isAvailable) {
    return {
      canRecover: false,
      reason: 'Cliquez sur "Restauration magique" dans l\'onglet Classes pour activer cette capacité'
    };
  }

  if (info.remaining <= 0) {
    return { canRecover: false, reason: 'Tous les niveaux de Restauration Arcanique ont été utilisés' };
  }

  if (currentUsedSlots <= 0) {
    return { canRecover: false, reason: 'Aucun emplacement utilisé à récupérer' };
  }

  if (slotLevel > info.remaining) {
    return { canRecover: false, reason: `Niveaux restants insuffisants (${info.remaining}/${info.total})` };
  }

  return { canRecover: true };
}

/**
 * Met à jour les compteurs après avoir récupéré un emplacement
 */
export function updateArcaneRecoveryUsage(player: Player, slotLevel: number): {
  spell_slots: any;
  class_resources: any;
} {
  const info = getArcaneRecoveryInfo(player);
  const newUsed = info.used + slotLevel;

  const usedKey = `used${slotLevel}` as keyof typeof player.spell_slots;
  const currentUsedSlots = (player.spell_slots?.[usedKey] || 0) as number;

  const newSpellSlots = {
    ...player.spell_slots,
    [usedKey]: Math.max(0, currentUsedSlots - 1)
  };

  const newClassResources = {
    ...player.class_resources,
    arcane_recovery_slots_used: newUsed
  };

  return { spell_slots: newSpellSlots, class_resources: newClassResources };
}