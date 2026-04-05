import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CampaignEncounter } from '../../../types/campaign';

// -------------------
// Hook de synchronisation temps réel de l'encounter
// -------------------
// S'abonne aux changements de la table campaign_encounters
// pour l'encounter actif. Quand le MJ passe au tour suivant,
// les colonnes current_turn_index et round_number sont mises à jour
// en base → ce hook propage ces changements à tous les clients connectés
// (joueurs comme MJ).
//
// Architecture :
//   1. Broadcast 'turn-changed' → quasi-instantané (< 100ms), émis par le MJ
//   2. postgres_changes → filet de secours WAL (1-3s)
//   3. Polling toutes les 5s → dernier recours si WS instable

// -------------------
// Type du message Broadcast pour le changement de tour
// -------------------
// Émis par le MJ via handleNextTurn → reçu instantanément par tous
// les clients du même channel Broadcast (< 100ms).
export interface TurnChangedBroadcast {
  current_turn_index: number;
  round_number: number;
  status?: string;
}

export interface ParticipantsReorderedBroadcast {
  orderedIds: string[]; // IDs dans le nouvel ordre
}

export interface FriendlyChangedBroadcast {
  participantId: string;
  friendly: boolean;
}

interface UseCombatEncounterRealtimeSyncParams {
  encounterId: string | null | undefined;
  onEncounterUpdated: (updates: Partial<CampaignEncounter>) => void;
  onParticipantsReordered?: (orderedIds: string[]) => void;
  onFriendlyChanged?: (participantId: string, friendly: boolean) => void;
}

export function useCombatEncounterRealtimeSync({
  encounterId,
  onEncounterUpdated,
  onParticipantsReordered,
}: UseCombatEncounterRealtimeSyncParams) {

  // -------------------
  // Stabilisation du callback via ref
  // -------------------
  // On stocke onEncounterUpdated dans une ref pour que les useEffect
  // ne se ré-abonnent PAS à chaque re-render du parent.
  // Le channel Supabase reste stable tant que encounterId ne change pas.
  const callbackRef = useRef(onEncounterUpdated);
  const onParticipantsReorderedRef = useRef(onParticipantsReordered);
  useEffect(() => {
    callbackRef.current = onEncounterUpdated;
    onParticipantsReorderedRef.current = onParticipantsReordered;
  });

  // -------------------
  // Suivi de la dernière valeur connue pour le polling de secours
  // -------------------
  // Stocke le dernier current_turn_index + round_number reçu
  // afin de ne déclencher le callback que si la valeur a réellement changé.
  const lastKnownRef = useRef<{ turn: number; round: number } | null>(null);

  // -------------------
  // Pré-chargement de la valeur initiale au montage
  // -------------------
  // On charge la valeur actuelle en base DÈS le montage, pour que
  // lastKnownRef soit initialisée avant le premier tick de polling.
  // Cela évite un callback inutile à la première it��ration (last === null).
  useEffect(() => {
    if (!encounterId) return;
    supabase
      .from('campaign_encounters')
      .select('current_turn_index, round_number')
      .eq('id', encounterId)
      .single()
      .then(({ data }) => {
        if (data && lastKnownRef.current === null) {
          lastKnownRef.current = {
            turn: data.current_turn_index,
            round: data.round_number,
          };
        }
      });
  }, [encounterId]);

  // -------------------
  // Channel combiné : Broadcast (instantané) + postgres_changes (filet de secours)
  // -------------------
  // Le Broadcast est émis par le MJ dans handleNextTurn via
  // supabase.channel(`combat-encounter-sync-${id}`).send(...).
  // Il arrive en < 100ms. Le postgres_changes rattrape les cas
  // où le Broadcast n'aurait pas été émis (reconnexion, update direct, etc.).
  useEffect(() => {
    if (!encounterId) return;

    lastKnownRef.current = null;

    const channel = supabase
      .channel(`combat-encounter-sync-${encounterId}`)
      // -------------------
      // Écoute Broadcast : changement de tour (quasi-instantané)
      // -------------------
      .on('broadcast', { event: 'turn-changed' }, (payload) => {
        const data = payload.payload as TurnChangedBroadcast;
        console.log('[RealtimeSync] Broadcast turn-changed reçu:', data);
        lastKnownRef.current = { turn: data.current_turn_index, round: data.round_number };
        callbackRef.current({
          current_turn_index: data.current_turn_index,
          round_number: data.round_number,
          ...(data.status ? { status: data.status } : {}),
        });
      })
      .on('broadcast', { event: 'combat-ended' }, (payload) => {
        const data = payload.payload as { encounterId?: string; status?: string };
        console.log('[RealtimeSync] Broadcast combat-ended reçu:', data);
        callbackRef.current({
          status: data.status ?? 'completed',
        });
      })

      .on('broadcast', { event: 'participants-reordered' }, (payload) => {
        const data = payload.payload as ParticipantsReorderedBroadcast;
        console.log('[RealtimeSync] Broadcast participants-reordered reçu:', data);
        onParticipantsReorderedRef.current?.(data.orderedIds);
      })
      
      // -------------------
      // Écoute postgres_changes : filet de secours WAL (1-3s)
      // -------------------
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_encounters',
          filter: `id=eq.${encounterId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<CampaignEncounter>;

          // -------------------
          // Dédoublonnage Broadcast / postgres_changes
          // -------------------
          // Si le Broadcast a déjà mis à jour lastKnownRef avec les mêmes
          // valeurs, on ignore cet événement postgres_changes redondant.
          if (
            lastKnownRef.current &&
            updated.current_turn_index === lastKnownRef.current.turn &&
            updated.round_number === lastKnownRef.current.round
          ) {
            return;
          }

          const relevantUpdates: Partial<CampaignEncounter> = {};
          if (updated.current_turn_index !== undefined) relevantUpdates.current_turn_index = updated.current_turn_index;
          if (updated.round_number !== undefined) relevantUpdates.round_number = updated.round_number;
          if (updated.status !== undefined) relevantUpdates.status = updated.status;

          if (Object.keys(relevantUpdates).length > 0) {
            if (updated.current_turn_index !== undefined && updated.round_number !== undefined) {
              lastKnownRef.current = { turn: updated.current_turn_index, round: updated.round_number };
            }
            callbackRef.current(relevantUpdates);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[RealtimeSync] channel combat-encounter-sync-${encounterId} status:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [encounterId]); // ← encounterId SEULEMENT, pas le callback

  // -------------------
  // Polling de secours (toutes les 5s)
  // -------------------
  // Dernier recours si Realtime WS est instable ou table non publiée.
  // N'émet le callback QUE si la valeur a changé → pas de re-render parasite.
  // Intervalle à 5s (au lieu de 3s) pour ne pas perturber les canaux HP.
  useEffect(() => {
    if (!encounterId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('campaign_encounters')
          .select('current_turn_index, round_number, status')
          .eq('id', encounterId)
          .single();

        if (error || !data) return;

        const last = lastKnownRef.current;

        // Si lastKnownRef non encore initialisé : initialiser sans callback
        if (last === null) {
          lastKnownRef.current = { turn: data.current_turn_index, round: data.round_number };
          return;
        }

        const turnChanged =
          data.current_turn_index !== last.turn ||
          data.round_number !== last.round;

        if (turnChanged) {
          console.log('[RealtimeSync] Polling détecte un changement de tour:', data);
          lastKnownRef.current = { turn: data.current_turn_index, round: data.round_number };
          callbackRef.current({
            current_turn_index: data.current_turn_index,
            round_number: data.round_number,
            status: data.status,
          });
        }
      } catch (err) {
        // Polling silencieux : on ignore les erreurs réseau transitoires
        console.warn('[RealtimeSync] Polling erreur:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [encounterId]);
}