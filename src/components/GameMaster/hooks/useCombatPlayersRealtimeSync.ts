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
  // On ne recrée le channel que si

