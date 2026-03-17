import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { CampaignMember, EncounterParticipant } from '../../../types/campaign';

interface PlayerHPUpdate {
  id: string;
  current_hp: number;
  temporary_hp: number;
}

// -------------------
// Type du message Broadcast pour les PV d'un participant
// -------------------
// Émis par le MJ via applyHp → reçu instantanément par tous les clients.
export interface HpChangedBroadcast {
  participantId: string;
  current_hp: number;
  temporary_hp: number;
}

interface UseCombatPlayersRealtimeSyncParams {
  members: CampaignMember[];
  participants: EncounterParticipant[];
  onParticipantHPUpdate: (participantId: string, updates: { current_hp: number; temporary_hp: number }) => void;
}

export function useCombatPlayersRealtimeSync({
  members,
  participants,
  onParticipantHPUpdate,
}: UseCombatPlayersRealtimeSyncParams) {
  const recentLocalUpdatesRef = useRef<Set<string>>(new Set());

  // -------------------
  // Stabilisation des données via refs
  // -------------------
  // members et participants changent de référence à chaque re-render du parent.
  // On les stocke dans des refs pour que le useEffect ne se ré-abonne pas
  // inutilement → le channel Supabase reste stable.
  const membersRef = useRef(members);
  const participantsRef = useRef(participants);
  const callbackRef = useRef(onParticipantHPUpdate);
  useEffect(() => {
    membersRef.current = members;
    participantsRef.current = participants;
    callbackRef.current = onParticipantHPUpdate;
  });

  // -------------------
  // Calcul stable des playerIds pour la souscription
  // -------------------
  // On ne recrée le channel que si la liste des IDs joueurs change réellement
  // (ajout/suppression d'un membre), pas à chaque re-render.
  const playerIdsKey = members
    .map((m) => m.player_id)
    .filter(Boolean)
    .sort()
    .join(',');

  const markLocalUpdate = (playerId: string) => {
    recentLocalUpdatesRef.current.add(playerId);
    setTimeout(() => {
      recentLocalUpdatesRef.current.delete(playerId);
    }, 2000);
  };

  // -------------------
  // Abonnement Supabase Realtime sur les HP joueurs
  // -------------------
  // Dépendance : playerIdsKey uniquement → le channel se recrée seulement
  // si la composition de l'équipe change, pas à chaque re-render.
  // Les données fraîches (members, participants, callback) sont lues
  // depuis les refs au moment de l'événement.
  useEffect(() => {
    const playerIds = membersRef.current
      .filter((m) => m.player_id)
      .map((m) => m.player_id as string);

    if (playerIds.length === 0) return;

    const channel = supabase
      .channel(`combat-players-hp-sync-${playerIds.join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=in.(${playerIds.join(',')})`,
        },
        (payload) => {
          const newData = payload.new as PlayerHPUpdate;

          if (recentLocalUpdatesRef.current.has(newData.id)) {
            return;
          }

          // Lecture depuis les refs → données toujours fraîches
          const member = membersRef.current.find((m) => m.player_id === newData.id);
          if (!member) return;

          const participant = participantsRef.current.find(
            (p) => p.participant_type === 'player' && p.player_member_id === member.id
          );
          if (!participant) return;

          callbackRef.current(participant.id, {
            current_hp: newData.current_hp,
            temporary_hp: newData.temporary_hp,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerIdsKey]); // ← liste des joueurs uniquement, pas les objets

  return { markLocalUpdate };
}