import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Player } from '../types/dnd';
import { triggerBloodSplash } from '../utils/bloodSplash';
import { triggerHealingAura } from '../utils/healingAura';
import { audioManager } from '../utils/audioManager';

interface RealtimePayload {
  new: Partial<Player>;
  old: Partial<Player>;
}

interface UsePlayerRealtimeSyncOptions {
  playerId: string;
  currentPlayer: Player;
  onPlayerUpdated: (updates: Partial<Player>) => void;
  soundsEnabled?: boolean;
  fxVolume?: number;
}

export function usePlayerRealtimeSync({
  playerId,
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
    if (!playerId) {
      console.log('[Realtime] No playerId, skipping subscription');
      return;
    }

    console.log('[Realtime] Setting up subscription for player:', playerId);

    const channel = supabase
      .channel(`player-hp-sync-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `id=eq.${playerId}`,
        },
        (payload) => {
          console.log('[Realtime] Received UPDATE event:', payload);
          const { new: newData } = payload as unknown as RealtimePayload;

          const timeSinceLocalUpdate = Date.now() - lastLocalUpdateRef.current;
          if (timeSinceLocalUpdate < 2000) {
            console.log('[Realtime] Ignoring update (local update too recent)');
            return;
          }

          const prevHP = prevHPRef.current;
          const newCurrentHP = newData.current_hp ?? prevHP.current_hp;
          const newTempHP = newData.temporary_hp ?? prevHP.temporary_hp;
          const newConditions = (newData as any).active_conditions;

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

          if (newData.current_hp !== undefined) {
            updates.current_hp = newData.current_hp;
          }
          if (newData.temporary_hp !== undefined) {
            updates.temporary_hp = newData.temporary_hp;
          }
          if (newConditions !== undefined) {
            updates.conditions = newConditions;
          }

          if (Object.keys(updates).length > 0) {
            console.log('[Realtime] Applying updates:', updates);
            onPlayerUpdated(updates);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Subscription status:', status, err ? `Error: ${err}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to player HP changes for:', playerId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error for player:', playerId);
        }
      });

    return () => {
      console.log('[Realtime] Unsubscribing from player HP changes for:', playerId);
      supabase.removeChannel(channel);
    };
  }, [playerId, onPlayerUpdated]);

  const markLocalUpdate = () => {
    lastLocalUpdateRef.current = Date.now();
  };

  return { markLocalUpdate };
}
