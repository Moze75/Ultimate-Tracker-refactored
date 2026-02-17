import React, { useState } from 'react';
import { Player } from '../../types/dnd';
import { HPManager } from '../HPManager';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { triggerBloodSplash } from '../../utils/bloodSplash';
import { triggerHealingAura } from '../../utils/healingAura';
import { audioManager } from '../../utils/audioManager';
import { useDiceSettings } from '../../hooks/useDiceSettings';


// 🔁 service offline-first HP
import {
  applyHPUpdateOfflineFirst,
  computeDamage,
  computeHealing,
  computeTempHP,
} from '../../services/hpOfflineService';

interface HPManagerConnectedProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onConcentrationCheck: (dc: number) => void;
  markLocalUpdate?: () => void;
}

export function HPManagerConnected({ player, onUpdate, onConcentrationCheck, markLocalUpdate }: HPManagerConnectedProps) {
  const [damageValue, setDamageValue] = useState('');
  const [healValue, setHealValue] = useState('');
  const [tempHpValue, setTempHpValue] = useState('');

  const { settings } = useDiceSettings();
  // Normalisation du volume 0-100 vers 0-1
  const fxVolume = (settings.fxVolume ?? 50) / 100;

  const totalHP = player.current_hp + player.temporary_hp;



  // ✅ Fonction pour jouer le son de dégâts
  const playSwordSliceSound = () => {
    if (settings.soundsEnabled) {
      audioManager.play('/Sounds/Damage-sounds/sword-slice.mp3', fxVolume);
    }
  };

  // ✅ Fonction pour jouer le son de guérison
  const playHealingSound = () => {
    if (settings.soundsEnabled) {
      audioManager.play('/Sounds/Healing/Healing.mp3', fxVolume);
    }
  };

  const getWoundLevel = () => {
    const percentage = (totalHP / player.max_hp) * 100;
    if (totalHP <= 0) return 'Mort';
    if (percentage >= 1 && percentage <= 30) return 'Blessures critiques';
    if (percentage > 30 && percentage <= 60) return 'Blessures importantes';
    if (percentage > 60 && percentage <= 75) return 'Blessures';
    if (percentage > 75 && percentage <= 90) return 'Blessures légères';
    if (percentage > 90 && percentage <= 99) return 'Égratignures';
    return 'En pleine forme';
  };

  const getWoundColor = () => {
    const percentage = (totalHP / player.max_hp) * 100;
    if (totalHP <= 0) return 'text-black';
    if (percentage >= 1 && percentage <= 30) return 'text-red-600';
    if (percentage > 30 && percentage <= 60) return 'text-red-500';
    if (percentage > 60 && percentage <= 75) return 'text-orange-500';
    if (percentage > 75 && percentage <= 90) return 'text-yellow-500';
    if (percentage > 90 && percentage <= 99) return 'text-yellow-400';
    return 'text-green-500';
  };

  const getHPBarColor = () => {
    const percentage = (player.current_hp / player.max_hp) * 100;
    if (totalHP <= 0) return 'from-black to-gray-800';
    if (percentage >= 1 && percentage <= 30) return 'from-red-600 to-red-700';
    if (percentage > 30 && percentage <= 60) return 'from-red-500 to-red-600';
    if (percentage > 60 && percentage <= 75) return 'from-orange-500 to-red-500';
    if (percentage > 75 && percentage <= 90) return 'from-yellow-500 to-orange-500';
    if (percentage > 90 && percentage <= 99) return 'from-yellow-400 to-yellow-500';
    return 'from-green-500 to-green-600';
  };

  // ✅ Ref pour le debounce des updates HP
  const updateHPTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingHPUpdateRef = React.useRef<{ current_hp: number; temporary_hp: number } | null>(null);

  /**
   * ✅ OPTIMISÉ : updateHP avec debounce de 1. 5s
   * Regroupe plusieurs clics rapides en un seul appel Supabase
   */
  const updateHP = async (newCurrentHP: number, newTempHP?: number) => {
    // 🔇 Offline : la queue + applyHPUpdateOfflineFirst suffisent
    if (!navigator. onLine) {
      return;
    }

    const clampedHP = Math.max(0, Math.min(player.max_hp, newCurrentHP));
    const clampedTempHP = Math.max(0, newTempHP ??  player.temporary_hp);

    // Stocker les valeurs pendantes
    pendingHPUpdateRef.current = { 
      current_hp: clampedHP, 
      temporary_hp: clampedTempHP 
    };

    // Annuler le timeout précédent s'il existe
    if (updateHPTimeoutRef.current) {
      clearTimeout(updateHPTimeoutRef.current);
    }

    // Programmer l'update Supabase après 1.5 secondes d'inactivité
    updateHPTimeoutRef.current = setTimeout(async () => {
      const pending = pendingHPUpdateRef.current;
      if (! pending) return;

      try {
        console.log('[HPManagerConnected] 💾 Synchro HP vers Supabase:', pending);
        
        const { error } = await supabase. from('players')
          .update({ 
            current_hp: pending.current_hp, 
            temporary_hp: pending.temporary_hp 
          })
          .eq('id', player.id);

        if (error) throw error;
        
        console.log('[HPManagerConnected] ✅ HP synchronisés');
      } catch (error) {
        console.warn('[HPManagerConnected] Erreur synchro Supabase (HP):', error);
      } finally {
        pendingHPUpdateRef.current = null;
      }
    }, 1500); // 1.5 secondes de debounce
  };

  // Cleanup du timeout au démontage
  React.useEffect(() => {
    return () => {
      if (updateHPTimeoutRef.current) {
        clearTimeout(updateHPTimeoutRef.current);
      }
    };
  }, []); 

    const applyDamage = async () => {
    const damage = parseInt(damageValue) || 0;
    console.log('[HPManagerConnected] applyDamage called, damageValue=', damageValue, 'parsed=', damage);
    if (damage <= 0) {
      console.log('[HPManagerConnected] applyDamage aborted: damage <= 0');
      return;
    }

    // ✅ RESTAURATION : Vérification de la concentration
    if (player.is_concentrating) {
      // Règle D&D 5e : DD = max(10, dégâts / 2)
      const dc = Math.max(10, Math.floor(damage / 2));
      console.log('🧠 Test de concentration déclenché, DD:', dc);
      onConcentrationCheck(dc);
    }

    // ✅ Marquer l'update local AVANT toute écriture Supabase pour éviter le double son Realtime
    markLocalUpdate?.();

    // ✅ Jouer le son AVANT les effets visuels
    playSwordSliceSound();
    triggerBloodSplash(damage);

    console.log('[HPManagerConnected] BEFORE computeDamage', {
      current_hp: player.current_hp,
      temporary_hp: player.temporary_hp,
    });

    const { current_hp, temporary_hp } = computeDamage(player, damage);

    console.log('[HPManagerConnected] AFTER computeDamage', { current_hp, temporary_hp });

    try {
      const optimisticPlayer = await applyHPUpdateOfflineFirst(player, {
        current_hp,
        temporary_hp,
      });

      console.log('[HPManagerConnected] onUpdate (damage)', {
        before: { current_hp: player.current_hp, temporary_hp: player.temporary_hp },
        after: { current_hp, temporary_hp },
      });

      onUpdate(optimisticPlayer);
      console.log('[HPManagerConnected] onUpdate finished');

    setDamageValue('');

    const hpElement = document.querySelector('.hp-bar');
    if (hpElement) {
      hpElement.classList.add('damage-animation');
      setTimeout(() => hpElement.classList.remove('damage-animation'), 600);
    }

    toast.success(`${damage} dégâts appliqués`);
  };

  const applyHealing = async () => {
    const healing = parseInt(healValue) || 0;
    if (healing <= 0) return;

    // ✅ Marquer l'update local AVANT toute écriture Supabase pour éviter le double son Realtime
    markLocalUpdate?.();

    // ✅ Jouer le son de guérison et déclencher l'aura
    playHealingSound();
    triggerHealingAura(healing);

    // 1) Calcul local des nouveaux HP
    const { current_hp, temporary_hp } = computeHealing(player, healing);

    try {
      // 2) Mise à jour offline-first + player optimistic
      const optimisticPlayer = await applyHPUpdateOfflineFirst(player, {
        current_hp,
        temporary_hp,
      });

      // 3) Mise à jour immédiate de l'UI
      onUpdate(optimisticPlayer);
    } catch (e) {
      console.error('[HPManagerConnected] Erreur applyHealing offline:', e);
    }

    setHealValue('');

    const hpElement = document.querySelector('.hp-bar');
    if (hpElement) {
      hpElement.classList.add('heal-animation');
      setTimeout(() => hpElement.classList.remove('heal-animation'), 600);
    }

    toast.success(`${healing} PV récupérés`);
  };

  const applyTempHP = async () => {
    const tempHP = parseInt(tempHpValue) || 0;
    if (tempHP <= 0) return;

    // ✅ Marquer l'update local AVANT toute écriture Supabase pour éviter le double son Realtime
    markLocalUpdate?.();

    // 1) Calcul local des PV temporaires
    const { current_hp, temporary_hp } = computeTempHP(player, tempHP);

    try {
      // 2) Mise à jour offline-first + player optimistic
      const optimisticPlayer = await applyHPUpdateOfflineFirst(player, {
        current_hp,
        temporary_hp,
      });

      // 3) Mise à jour immédiate de l'UI
      onUpdate(optimisticPlayer);

      // 4) Synchro Supabase en arrière-plan
      updateHP(current_hp, temporary_hp);

      // 4) Synchro Supabase en arrière-plan
      updateHP(current_hp, temporary_hp);
    } catch (e) {
      console.error('[HPManagerConnected] Erreur applyTempHP offline:', e);
    }

    setTempHpValue('');

    toast.success(`${temporary_hp} PV temporaires appliqués`);
  };

  return (
    <HPManager
      player={player}
      damageValue={damageValue}
      setDamageValue={setDamageValue}
      healValue={healValue}
      setHealValue={setHealValue}
      tempHpValue={tempHpValue}
      setTempHpValue={setTempHpValue}
      applyDamage={applyDamage}
      applyHealing={applyHealing}
      applyTempHP={applyTempHP}
      totalHP={totalHP}
      getWoundLevel={getWoundLevel}
      getWoundColor={getWoundColor}
      getHPBarColor={getHPBarColor}
    />
  );
}