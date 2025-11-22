import React, { useState } from 'react';
import { Player } from '../../types/dnd';
import { HPManager } from '../HPManager';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { triggerBloodSplash } from '../../utils/bloodSplash';
import { audioManager } from '../../utils/audioManager';

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
}

export function HPManagerConnected({ player, onUpdate, onConcentrationCheck }: HPManagerConnectedProps) {
  const [damageValue, setDamageValue] = useState('');
  const [healValue, setHealValue] = useState('');
  const [tempHpValue, setTempHpValue] = useState('');

  const totalHP = player.current_hp + player.temporary_hp;

  // ✅ Fonction pour jouer le son de dégâts
  const playSwordSliceSound = () => {
    audioManager.play('/Sounds/Damage-sounds/sword-slice.mp3', 0.5);
  };

  // ✅ Fonction pour jouer le son de guérison
  const playHealingSound = () => {
    audioManager.play('/Sounds/Healing/Healing.mp3', 0.5);
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

  /**
   * 🔁 updateHP : NE gère plus l'UI ni la queue, uniquement la synchro Supabase.
   * L'update locale est faite dans applyDamage/applyHealing/applyTempHP via applyHPUpdateOfflineFirst.
   */
  const updateHP = async (newCurrentHP: number, newTempHP?: number) => {
    const clampedHP = Math.max(0, Math.min(player.max_hp, newCurrentHP));
    const clampedTempHP = Math.max(0, newTempHP ?? player.temporary_hp);

    try {
      const updateData: any = { current_hp: clampedHP };
      if (newTempHP !== undefined) updateData.temporary_hp = clampedTempHP;

      const { error } = await supabase.from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;
    } catch (error) {
      console.warn('[HPManagerConnected] Erreur synchro Supabase (HP):', error);
      // On ne rollback pas l'UI : les valeurs locales + la queue offline sont déjà correctes.
    }
  };

  const applyDamage = async () => {
    const damage = parseInt(damageValue) || 0;
    if (damage <= 0) return;

    // ✅ Jouer le son AVANT les effets visuels
    playSwordSliceSound();
    triggerBloodSplash(damage);

    let newCurrentHP = player.current_hp;
    let newTempHP = player.temporary_hp;

    if (newTempHP > 0) {
      if (damage >= newTempHP) {
        const remainingDamage = damage - newTempHP;
        newTempHP = 0;
        newCurrentHP = Math.max(0, newCurrentHP - remainingDamage);
      } else {
        newTempHP = newTempHP - damage;
      }
    } else {
      newCurrentHP = Math.max(0, newCurrentHP - damage);
    }

    await updateHP(newCurrentHP, newTempHP);
    setDamageValue('');

    const hpElement = document.querySelector('.hp-bar');
    if (hpElement) {
      hpElement.classList.add('damage-animation');
      setTimeout(() => hpElement.classList.remove('damage-animation'), 600);
    }

    toast.success(`${damage} dégâts appliqués`);

    if (player.is_concentrating) {
      const dc = Math.max(10, Math.floor(damage / 2));
      onConcentrationCheck(dc);
    }
  };

  const applyHealing = async () => {
    const healing = parseInt(healValue) || 0;
    if (healing <= 0) return;

    // ✅ Jouer le son de guérison
    playHealingSound();

    const newCurrentHP = Math.min(player.max_hp, player.current_hp + healing);
    await updateHP(newCurrentHP);
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

    const newTempHP = Math.max(player.temporary_hp, tempHP);
    await updateHP(player.current_hp, newTempHP);
    setTempHpValue('');

    toast.success(`${newTempHP} PV temporaires appliqués`);
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