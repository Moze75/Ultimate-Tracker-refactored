import { useEffect } from 'react';
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

interface UseCombatEncounterRealtimeSyncParams {
  encounterId: string | null | undefined;
  onEncounterUpdated: (updates: Partial<CampaignEncounter>) => void;
}

export function useCombatEncounterRealtimeSync({
  encounterId,
  onEncounterUpdated,
}: UseCombatEncounterRealtimeSyncParams) {

  // -------------------
  // Abonnement Supabase Realtime
  // -------------------
  // Écoute les UPDATE sur campaign_encounters pour l'encounter courant.
  // Déclenché à chaque changement de tour, de round, ou de statut.
  useEffect(() => {
    if (!encounterId) return;

    const channel = supabase
      .channel(`combat-encounter-sync-${encounterId}`)
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
          // Propagation de la mise à jour
          // -------------------
          // On ne transmet que les champs pertinents pour le tracker :
          // current_turn_index, round_number, status.
          const relevantUpdates: Partial<CampaignEncounter> = {};

          if (updated.current_turn_index !== undefined) {
            relevantUpdates.current_turn_index = updated.current_turn_index;
          }
          if (updated.round_number !== undefined) {
            relevantUpdates.round_number = updated.round_number;
          }
          if (updated.status !== undefined) {
            relevantUpdates.status = updated.status;
          }

          if (Object.keys(relevantUpdates).length > 0) {
            onEncounterUpdated(relevantUpdates);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [encounterId, onEncounterUpdated]);
}