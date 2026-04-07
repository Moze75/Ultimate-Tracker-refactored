import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Player } from '../types/dnd';
import { triggerBloodSplash } from '../utils/bloodSplash';
import { triggerHealingAura } from '../utils/healingAura';
import { audioManager } from '../utils/audioManager';

// -------------------
// Payload de vtt_player_state (table légère, remplace players pour le Realtime)
// -------------------
interface VttPlayerStatePayload {
  player_id: string;
  room_id: string;
  current_hp: number;
  temporary_hp: number;
  active_conditions: string[];
}

interface UsePlayerRealtimeSyncOptions {
  playerId: string;
  roomId: string | null;   // ← nouveau : nécessaire pour filtrer vtt_player_state
  currentPlayer: Player;
  onPlayerUpdated: (updates: Partial<Player>) => void;
  soundsEnabled?: boolean;
  fxVolume?: number;
}

export function usePlayerRealtimeSync({
  playerId,
  roomId,
  currentPlayer,
  onPlayerUpdated,
  soundsEnabled = true,
  fxVolume = 0.5,
}: UsePlayerRealtimeSyncOptions) {
  const prevHPRef = useRef<{ current_hp: number; temporary_hp: number }>({
    current_hp: currentPlayer.current_hp,
    temporary_hp: currentPlayer.temporary_hp,
  });

  const lastLocalUpdateRef = useRef<number>(0);

  const soundsEnabledRef = useRef(soundsEnabled);
  const fxVolumeRef = useRef(fxVolume);

  useEffect(() => {
    soundsEnabledRef.current = soundsEnabled;
    fxVolumeRef.current = fxVolume;
  }, [soundsEnabled, fxVolume]);

  useEffect(() => {
    prevHPRef.current = {
      current_hp: currentPlayer.current_hp,
      temporary_hp: currentPlayer.temporary_hp,
    };
  }, [currentPlayer.current_hp, currentPlayer.temporary_hp]);

  useEffect(() => {
    if (!playerId || !roomId) {
      console.log('[Realtime] No playerId or roomId, skipping subscription');
      return;
    }

    console.log('[Realtime] Setting up subscription on vtt_player_state for player:', playerId, 'room:', roomId);

    // -------------------
    // Écoute vtt_player_state (table légère) filtrée par room_id
    // -------------------
    // Plus d'écoute sur players (REPLICA IDENTITY FULL → lourd WAL).
    // vtt_player_state ne contient que HP, conditions, initiative.
    // Le filtre room_id=eq.X couvre tous les joueurs de la room en 1 subscription.
    const channel = supabase
      .channel(`vtt-state-player-${playerId}-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'vtt_player_state',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newData = payload.new as VttPlayerStatePayload;

          // Ne traiter que les updates du joueur courant
          if (newData.player_id !== playerId) return;

          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < 2000) {
            console.log('[Realtime] Ignoring update (local update too recent)');
            return;
          }

          const prevHP = prevHPRef.current;
          const newCurrentHP = newData.current_hp ?? prevHP.current_hp;
          const newTempHP = newData.temporary_hp ?? prevHP.temporary_hp;

          const oldTotalHP = prevHP.current_hp + prevHP.temporary_hp;
          const newTotalHP = newCurrentHP + newTempHP;
          const hpDelta = newTotalHP - oldTotalHP;

          console.log('[Realtime] HP Delta:', hpDelta, 'Old:', oldTotalHP, 'New:', newTotalHP);

          if (hpDelta !== 0) {
            if (hpDelta < 0) {
              const damage = Math.abs(hpDelta);
              if (soundsEnabledRef.current) {
                audioManager.play('/Sounds/Damage-sounds/sword-slice.mp3', fxVolumeRef.current);
              }
              triggerBloodSplash(damage);

              const hpElement = document.querySelector('.hp-bar');
              if (hpElement) {
                hpElement.classList.add('damage-animation');
                setTimeout(() => hpElement.classList.remove('damage-animation'), 600);
              }
            } else {
              const healing = hpDelta;
              if (soundsEnabledRef.current) {
                audioManager.play('/Sounds/Healing/Healing.mp3', fxVolumeRef.current);
              }
              triggerHealingAura(healing);

              const hpElement = document.querySelector('.hp-bar');
              if (hpElement) {
                hpElement.classList.add('heal-animation');
                setTimeout(() => hpElement.classList.remove('heal-animation'), 600);
              }
            }
          }

          const updates: Partial<Player> = {};

          if (newData.current_hp !== undefined) updates.current_hp = newData.current_hp;
          if (newData.temporary_hp !== undefined) updates.temporary_hp = newData.temporary_hp;
          if (newData.active_conditions !== undefined) updates.conditions = newData.active_conditions;

          if (Object.keys(updates).length > 0) {
            console.log('[Realtime] Applying updates from vtt_player_state:', updates);
            onPlayerUpdated(updates);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status, err ? `Error: ${err}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to vtt_player_state for player:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error for player:', playerId);
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from vtt_player_state for player:', playerId);
      supabase.removeChannel(channel);
    };
  }, [playerId, roomId, onPlayerUpdated]);

  const markLocalUpdate = () => {
    lastLocalUpdateRef.current = Date.now();
  };

  return { markLocalUpdate };
}
