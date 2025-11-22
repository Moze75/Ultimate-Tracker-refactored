import { supabase } from '../lib/supabase';
import type { Player } from '../types/dnd';
import { setPlayerSnapshot } from './playerLocalStore';

const QUEUE_KEY = 'ut:hpQueue';

export type HPUpdateAction = {
  id: string;          // UUID local
  type: 'HP_UPDATE';
  playerId: string;
  payload: {
    current_hp: number;
    temporary_hp: number;
  };
  createdAt: number;   // timestamp local
};

function loadQueue(): HPUpdateAction[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HPUpdateAction[];
  } catch (e) {
    console.error('[hpSyncQueue] Erreur loadQueue:', e);
    return [];
  }
}

function saveQueue(queue: HPUpdateAction[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[hpSyncQueue] Erreur saveQueue:', e);
  }
}

/**
 * Ajoute une action HP dans la queue locale.
 */
export function enqueueHPUpdate(action: HPUpdateAction): void {
  const queue = loadQueue();
  queue.push(action);
  saveQueue(queue);
}

/**
 * Tente de rejouer toutes les actions HP dans l’ordre.
 * S’arrête au premier échec (réseau ou autre) et garde le reste de la queue pour plus tard.
 */
export async function flushHPQueue(): Promise<void> {
  let queue = loadQueue();
  if (queue.length === 0) return;

  const newQueue: HPUpdateAction[] = [];

  for (const action of queue) {
    if (action.type !== 'HP_UPDATE') {
      // future-proofing pour d’autres types d’actions
      newQueue.push(action);
      continue;
    }

    try {
      const { playerId, payload } = action;

      const { error, data } = await supabase
        .from('players')
        .update({
          current_hp: payload.current_hp,
          temporary_hp: payload.temporary_hp,
        })
        .eq('id', playerId)
        .select('*')
        .single();

      if (error) {
        console.warn('[hpSyncQueue] Erreur Supabase, arrêt du flush:', error);
        // On remet l’action et toutes les suivantes dans la queue
        newQueue.push(action, ...queue.slice(queue.indexOf(action) + 1));
        break;
      }

      // Optionnel : mettre à jour le snapshot local avec l’état serveur
      if (data) {
        setPlayerSnapshot(data as Player);
      }
    } catch (e) {
      console.warn('[hpSyncQueue] Exception pendant flush, arrêt:', e); 
      newQueue.push(action, ...queue.slice(queue.indexOf(action) + 1));
      break;
    }
  }

  saveQueue(newQueue);
}

/**
 * Utilitaire simple pour savoir s’il reste des actions non flushées (utile pour un badge UI).
 */
export function getPendingHPActionCount(): number {
  return loadQueue().length;
}