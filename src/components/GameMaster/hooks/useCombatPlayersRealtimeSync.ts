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

export interface InitiativeChangedBroadcast {
  participantId: string;
  initiative_roll: number;
}

interface UseCombatPlayersRealtimeSyncParams {
  members: CampaignMember[];
  participants: EncounterParticipant[];
  onParticipantHPUpdate: (participantId: string, updates: { current_hp: number; temporary_hp: number }) => void;
  onParticipantInitiativeUpdate?: (participantId: string, initiative_roll: number) => void;
}

export function useCombatPlayersRealtimeSync({
  members,
  participants,
  onParticipantHPUpdate,
  onParticipantInitiativeUpdate,
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
  // Ref vers le channel souscrit — utilisée pour émettre les Broadcasts
  // -------------------
  // On stocke ici le channel Supabase actif pour que applyHp (dans CombatTab)
  // puisse envoyer le Broadcast hp-changed sur le channel DÉJÀ abonné,
  // et non sur un nouveau channel éphémère qui ne reçoit rien.
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  // -------------------
  // Marquage d'une mise à jour locale (anti-écho)
  // -------------------
  // Accepte un playerId (UUID table players) OU un participantId (UUID encounter_participants).
  // Les deux sont stockés dans le même Set pour filtrer aussi bien
  // l'écho postgres_changes (clé = playerId) que l'écho Broadcast (clé = participantId).
  const markLocalUpdate = (id: string) => {
    recentLocalUpdatesRef.current.add(id);
    setTimeout(() => {
      recentLocalUpdatesRef.current.delete(id);
    }, 2000);
  };

  // -------------------
  // Émission d'un Broadcast HP sur le channel souscrit
  // -------------------
  // À appeler depuis applyHp dans CombatTab à la place de
  // supabase.channel(name).send(...) qui crée un channel éphémère.
  // Le channel est déjà souscrit → le message est bien distribué
  // à tous les clients (joueurs inclus) en < 100ms.
  const sendHpBroadcast = (payload: HpChangedBroadcast) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'hp-changed',
      payload,
    });
  };

    const sendInitiativeBroadcast = (payload: InitiativeChangedBroadcast) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'initiative-changed',
      payload,
    });
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

    // -------------------
    // Channel combiné : Broadcast (instantané) + postgres_changes (filet)
    // -------------------
    // Le Broadcast 'hp-changed' est émis par sendHpBroadcast (appelé dans applyHp).
    // Il arrive en < 100ms, sans passer par Postgres WAL.
    // Le postgres_changes sur 'players' reste en filet de secours
    // pour les mises à jour de HP hors-combat (fiche joueur, etc.).
    const channel = supabase
      .channel(`combat-players-hp-sync-${playerIds.join('-')}`)
      // -------------------
      // Écoute Broadcast : PV changé (quasi-instantané)
      // -------------------
      .on('broadcast', { event: 'hp-changed' }, (payload) => {
        const data = payload.payload as HpChangedBroadcast;
        // On ignore si c'est une mise à jour locale récente (émise par ce même client)
        if (recentLocalUpdatesRef.current.has(data.participantId)) return;
        callbackRef.current(data.participantId, {
          current_hp: data.current_hp,
          temporary_hp: data.temporary_hp,
        });
      })
      // -------------------
      // Écoute postgres_changes : HP joueur via table players (filet de secours)
      // -------------------
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
          if (recentLocalUpdatesRef.current.has(newData.id)) return;

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
      .subscribe((status) => {
        console.log(`[RealtimeSync] channel combat-players-hp-sync status:`, status);
      });

    // -------------------
    // Stockage du channel dans la ref pour l'émission des Broadcasts
    // -------------------
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [playerIdsKey]);

  return { markLocalUpdate, sendHpBroadcast };
}