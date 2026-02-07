import { useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { CampaignMember, EncounterParticipant } from '../../../types/campaign';

interface PlayerHPUpdate {
  id: string;
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

  const markLocalUpdate = (playerId: string) => {
    recentLocalUpdatesRef.current.add(playerId);
    setTimeout(() => {
      recentLocalUpdatesRef.current.delete(playerId);
    }, 2000);
  };

  useEffect(() => {
    const playerIds = members
      .filter((m) => m.player_id)
      .map((m) => m.player_id as string);

    if (playerIds.length === 0) return;

    const channel = supabase
      .channel('combat-players-hp-sync')
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

          const member = members.find((m) => m.player_id === newData.id);
          if (!member) return;

          const participant = participants.find(
            (p) => p.participant_type === 'player' && p.player_member_id === member.id
          );
          if (!participant) return;

          onParticipantHPUpdate(participant.id, {
            current_hp: newData.current_hp,
            temporary_hp: newData.temporary_hp,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [members, participants, onParticipantHPUpdate]);

  return { markLocalUpdate };
}
