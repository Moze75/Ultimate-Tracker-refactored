import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import type { CampaignEncounter } from '../../../types/campaign';

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

// -------------------
// Hook de synchronisation temps réel de l'encounter
// -------------------
// S'abonne aux changements de la table campaign_encounters
// pour l'encounter actif. Quand le MJ passe au tour suivant,
// les colonnes current_turn_index et round_number sont mises à jour
// en base → ce hook propage ces changements à tous les clients connectés
// (joueurs comme MJ).

interface UseCombatEncounterRealtimeSyncParams {
  encounterId: string | null | undefined;
  onEncounterUpdated: (updates: Partial<CampaignEncounter>) => void;
}

export function useCombatEncounterRealtimeSync({
  encounterId,
  onEncounterUpdated,
}: UseCombatEncounterRealtimeSyncParams) {

  // -------------------
  // Stabilisation du callback via ref
  // -------------------
  // On stocke onEncounterUpdated dans une ref pour que les useEffect
  // ne se ré-abonnent PAS à chaque re-render du parent.
  // Le channel Supabase reste stable tant que encounterId ne change pas.
  const callbackRef = useRef(onEncounterUpdated);
  useEffect(() => {
    callbackRef.current = onEncounterUpdated;
  });

  // -------------------
  // Suivi de la dernière valeur connue pour le polling de secours
  // -------------------
  // Stocke le dernier current_turn_index + round_number reçu
  // afin de ne déclencher le callback que si la valeur a réellement changé.
  const lastKnownRef = useRef<{ turn: number; round: number } | null>(null);

  // -------------------
  // Abonnement Supabase Realtime sur l'encounter actif
  // -------------------
  // Écoute les UPDATE sur campaign_encounters pour l'encounter courant.
  // Déclenché à chaque changement de tour, de round, ou de statut.
  // Dépendance : encounterId UNIQUEMENT → le channel ne se recrée
  // pas à chaque re-render, ce qui évite les pertes d'événements.
   useEffect(() => {
    if (!encounterId) return;

    // Réinitialise la référence de dernière valeur connue à chaque
    // nouvel encounter (nouveau combat lancé).
    lastKnownRef.current = null;

    // -------------------
    // Channel combiné : Broadcast (instantané) + postgres_changes (filet de secours)
    // -------------------
    // Le Broadcast est émis par le MJ dans handleNextTurn/handleEndCombat
    // via supabase.channel(...).send(). Il arrive en < 100ms.
    // Le postgres_changes reste actif pour rattraper les mises à jour
    // qui n'auraient pas déclenché de Broadcast (ex: chargement initial,
    // reconnexion, mise à jour directe en base).
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
          // valeurs, on ignore l'��vénement postgres_changes redondant.
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
  }, [encounterId]);

  // -------------------
  // Initialisation de la référence de tour au montage
  // -------------------
  // On charge la valeur actuelle de current_turn_index / round_number
  // en base DÈS le montage, pour que lastKnownRef soit initialisée
  // avant le premier tick de polling.
  // Cela évite que le polling déclenche un callback inutile
  // à la première itération (condition `last === null`) et provoque
  // un re-render parasite qui perturbe les canaux HP Realtime.
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
  // Polling de secours (toutes les 5s)
  // -------------------
  // Supabase Realtime peut rater des événements si la table n'est pas
  // correctement configurée dans la publication, ou si la connexion WS
  // est instable. Ce polling garantit que les tours se synchronisent
  // même dans ce cas, en interrogeant directement la base.
  // Il ne déclenche le callback QUE si la valeur a changé par rapport
  // à la dernière connue → pas de boucle infinie, pas de re-render parasite.
  // Intervalle porté à 5s pour réduire la charge et limiter les
  // perturbations sur les canaux HP Realtime.
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

        // -------------------
        // Guard : ne déclenche le callback que si la valeur a changé
        // -------------------
        // Si lastKnownRef est encore null (initialisation pas encore terminée),
        // on se contente d'initialiser sans déclencher le callback.
        // Cela évite le re-render parasite au premier tick.
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