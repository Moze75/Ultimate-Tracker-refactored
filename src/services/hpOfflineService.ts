import type { Player } from '../types/dnd';
import { enqueueHPUpdate, flushHPQueue, type HPUpdateAction } from './hpSyncQueue';
import { setPlayerSnapshot } from './playerLocalStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Applique un changement de HP en local + l’enfile dans la queue pour synchro.
 * Ne touche PAS à Supabase directement (c’est la queue qui s’en charge).
 */
export async function applyHPUpdateOfflineFirst(
  player: Player,
  nextHP: { current_hp: number; temporary_hp: number }
): Promise<Player> {
  const { current_hp, temporary_hp } = nextHP;

  const updatedPlayer: Player = {
    ...player,
    current_hp,
    temporary_hp,
  };

  // 1) Snapshot local immédiat
  setPlayerSnapshot(updatedPlayer);

  // 2) Ajout dans la queue
  const action: HPUpdateAction = {
    id: uuidv4(),
    type: 'HP_UPDATE',
    playerId: player.id,
    payload: {
      current_hp,
      temporary_hp,
    },
    createdAt: Date.now(),
  };
  enqueueHPUpdate(action);

  // 3) Tentative de flush silencieuse si online
  try {
    if (navigator.onLine) {
      await flushHPQueue();
    }
  } catch {
    // reste en offline, c’est OK
  }

  return updatedPlayer;
}

/**
 * Helpers de calcul (on reprend ta logique existante).
 */
export function computeDamage(
  player: Player,
  damage: number
): { current_hp: number; temporary_hp: number } {
  let newCurrentHP = player.current_hp;
  let newTempHP = player.temporary_hp;

  if (newTempHP > 0) {
    if (damage >= newTempHP) {
      const remainingDamage = damage - newTempHP;
      newTempHP = 0;
      newCurrentHP = Math.max(0, newCurrentHP - remainingDamage);
    } else {
      newTempHP = newTempHP - damage;
    }
  } else {
    newCurrentHP = Math.max(0, newCurrentHP - damage);
  }

  newCurrentHP = Math.max(0, Math.min(player.max_hp, newCurrentHP));
  newTempHP = Math.max(0, newTempHP);

  return { current_hp: newCurrentHP, temporary_hp: newTempHP };
}

export function computeHealing(
  player: Player,
  healing: number
): { current_hp: number; temporary_hp: number } {
  const newCurrentHP = Math.min(player.max_hp, Math.max(0, player.current_hp + healing));
  return { current_hp: newCurrentHP, temporary_hp: player.temporary_hp };
}

export function computeTempHP(
  player: Player,
  tempHP: number
): { current_hp: number; temporary_hp: number } {
  const newTempHP = Math.max(player.temporary_hp, tempHP);
  return {
    current_hp: player.current_hp,
    temporary_hp: Math.max(0, newTempHP),
  };
}