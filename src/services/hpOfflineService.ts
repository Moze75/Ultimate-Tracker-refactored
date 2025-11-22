import type { Player } from '../types/dnd';
import { enqueueHPUpdate, flushHPQueue, type HPUpdateAction } from './hpSyncQueue';
import { setPlayerSnapshot } from './playerLocalStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calcule les nouveaux HP courants et temporaires en appliquant des dégâts.
 * La logique de PV temp est identique à celle déjà présente dans CombatTab_old / HPManagerConnected.
 */
export function computeDamage(player: Player, damage: number): { current_hp: number; temporary_hp: number } {
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

  // Clamp sur max_hp pour sécurité (même si en pratique les dégâts ne dépassent jamais 0)
  newCurrentHP = Math.max(0, Math.min(player.max_hp, newCurrentHP));
  newTempHP = Math.max(0, newTempHP);

  return { current_hp: newCurrentHP, temporary_hp: newTempHP };
}

/**
 * Calcule les nouveaux HP courants après soins.
 */
export function computeHealing(player: Player, healing: number): { current_hp: number; temporary_hp: number } {
  const newCurrentHP = Math.min(player.max_hp, Math.max(0, player.current_hp + healing));
  return { current_hp: newCurrentHP, temporary_hp: player.temporary_hp };
}

/**
 * Calcule les nouveaux PV temporaires (logique actuelle : on garde le plus élevé).
 */
export function computeTempHP(player: Player, tempHP: number): { current_hp: number; temporary_hp: number } {
  const newTempHP = Math.max(player.temporary_hp, tempHP);
  return {
    current_hp: player.current_hp,
    temporary_hp: Math.max(0, newTempHP),
  };
}

/**
 * Applique de manière optimistic une mise à jour HP côté client + queue offline pour synchro serveur.
 * Retourne le nouveau joueur (pour que le composant parent puisse set le state).
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

  // 1) Mise à jour immédiate du snapshot local (optimistic)
  setPlayerSnapshot(updatedPlayer);

  // 2) Ajout dans la queue d’actions
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

  // 3) Tentative de flush silencieuse
  // Si ça échoue, l’action reste dans la queue et sera rejouée plus tard.
  try {
    if (navigator.onLine) {
      await flushHPQueue();
    }
  } catch {
    // no-op: on reste en offline, les données locales sont correctes
  }

  return updatedPlayer;
}