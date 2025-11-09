import React from 'react';
import { Moon, Scroll, Brain, Plus, Minus, Star, Sun, Settings } from 'lucide-react';
import { Player, PlayerStats } from '../../types/dnd';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface DesktopActionsGridProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onOpenCampaigns: () => void;
 
}

export function DesktopActionsGrid({ player, onUpdate, onOpenCampaigns, onOpenDiceSettings }: DesktopActionsGridProps) {
  const handleShortRest = async () => {
    if (!player.hit_dice || player.hit_dice.total - player.hit_dice.used <= 0) {
      toast.error('Aucun dé de vie disponible');
      return;
    }
    try {
      const hitDieSize = (() => {
        switch (player.class) {
          case 'Barbare': return 12;
          case 'Guerrier':
          case 'Paladin':
          case 'Rôdeur': return 10;
          case 'Barde':
          case 'Clerc':
          case 'Druide':
          case 'Moine':
          case 'Roublard':
          case 'Occultiste':
            return 8;
          case 'Magicien':
          case 'Ensorceleur': return 6;
          default: return 8;
        }
      })();

      const roll = Math.floor(Math.random() * hitDieSize) + 1;
      const constitutionMod = player.abilities?.find(a => a.name === 'Constitution')?.modifier || 0;
      const healing = Math.max(1, roll + constitutionMod);

      const nextCR: any = { ...(player.class_resources || {}) };
      let recoveredLabel = '';

      if (player.class === 'Magicien') {
        nextCR.used_arcane_recovery = false;
        nextCR.arcane_recovery_slots_used = 0;
      }

      if (player.class === 'Paladin' && typeof nextCR.used_channel_divinity === 'number') {
        const before = nextCR.used_channel_divinity || 0;
        nextCR.used_channel_divinity = Math.max(0, before - 1);
        if (before > 0) recoveredLabel = ' (+1 Conduit divin récupéré)';
      }

      const nextSpellSlots = { ...(player.spell_slots || {}) };
      if (player.class === 'Occultiste' && typeof nextSpellSlots.used_pact_slots === 'number') {
        const pactSlots = nextSpellSlots.pact_slots || 0;
        if (nextSpellSlots.used_pact_slots > 0 && pactSlots > 0) {
          nextSpellSlots.used_pact_slots = 0;
          recoveredLabel += ` (+${pactSlots} emplacement${pactSlots > 1 ? 's' : ''} de pacte récupéré${pactSlots > 1 ? 's' : ''})`;
        }
      }

      const { error } = await supabase
        .from('players')
        .update({
          current_hp: Math.min(player.max_hp, player.current_hp + healing),
          hit_dice: {
            ...player.hit_dice,
            used: player.hit_dice.used + 1
          },
          class_resources: nextCR,
          spell_slots: nextSpellSlots
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        current_hp: Math.min(player.max_hp, player.current_hp + healing),
        hit_dice: {
          ...player.hit_dice,
          used: player.hit_dice.used + 1
        },
        class_resources: nextCR,
        spell_slots: nextSpellSlots
      });

      toast.success(`Repos court : +${healing} PV${recoveredLabel}`);
    } catch (error) {
      console.error('Erreur lors du repos court:', error);
      toast.error('Erreur lors du repos');
    }
  };

  const handleLongRest = async () => {
    try {
      const nextCR: any = { ...(player.class_resources || {}) };
      nextCR.used_rage = 0;
      nextCR.used_bardic_inspiration = 0;
      nextCR.used_channel_divinity = 0;
      nextCR.used_wild_shape = 0;
      nextCR.used_sorcery_points = 0;
      nextCR.used_action_surge = 0;
      nextCR.used_arcane_recovery = false;
      nextCR.arcane_recovery_slots_used = 0;
      nextCR.used_credo_points = 0;
      nextCR.used_ki_points = 0;
      nextCR.used_lay_on_hands = 0;
      nextCR.used_favored_foe = 0;
      nextCR.used_innate_sorcery = 0;
      nextCR.used_supernatural_metabolism = 0;

      const { error } = await supabase
        .from('players')
        .update({
          current_hp: player.max_hp,
          temporary_hp: 0,
          hit_dice: {
            total: player.level,
            used: Math.max(0, player.hit_dice?.used - Math.floor(player.level / 2) || 0)
          },
          class_resources: nextCR,
          spell_slots: {
            ...player.spell_slots,
            used1: 0, used2: 0, used3: 0, used4: 0,
            used5: 0, used6: 0, used7: 0, used8: 0, used9: 0,
            used_pact_slots: 0
          },
          is_concentrating: false,
          concentration_spell: null
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        current_hp: player.max_hp,
        temporary_hp: 0,
        hit_dice: {
          total: player.level,
          used: Math.max(0, player.hit_dice?.used - Math.floor(player.level / 2) || 0)
        },
        class_resources: nextCR,
        spell_slots: {
          ...player.spell_slots,
          used1: 0, used2: 0, used3: 0, used4: 0,
          used5: 0, used6: 0, used7: 0, used8: 0, used9: 0,
          used_pact_slots: 0
        },
        is_concentrating: false,
        concentration_spell: null
      });

      toast.success('Repos long effectué (toutes les ressources restaurées)');
    } catch (error) {
      console.error('Erreur lors du repos long:', error);
      toast.error('Erreur lors du repos');
    }
  };

  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mr-4 auto-rows-fr">
      <button
        onClick={handleLongRest}
        className="h-10 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3 border border-gray-700/50 min-w-[115px]"
      >
        <span className="text-xm whitespace-nowrap">Repos long</span>
        <Moon className="w-4 h-4 ml-2" />
      </button>

      <button
        onClick={handleShortRest}
        className="h-10 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3 border border-gray-700/50 min-w-[115px]"
      >
        <span className="text-xm whitespace-nowrap">Repos court</span>
        <Sun className="w-4 h-4 ml-2" />
      </button>

      {player.hit_dice && (
        <div className="h-10 px-3 py-1 text-sm bg-gray-800/30 rounded flex items-center justify-between border border-gray-700/50 min-w-[115px]">
          <span className="text-xm text-gray-400 whitespace-nowrap">Dés de vie</span>
          <span className="text-gray-300 font-medium text-sm ml-2">
            {player.hit_dice.total - player.hit_dice.used}/{player.hit_dice.total}
          </span>
        </div>
      )}

      <div className="h-10 rounded text-sm bg-gray-800/50 flex items-center justify-between px-3 border border-gray-700/50 min-w-[115px]">
        <div className="text-gray-400 text-xs flex items-center gap-1">
          <span className="whitespace-nowrap text-sm">Inspi</span>
        </div>
        <div className="flex items-center gap-0.5">  
          <button
            onClick={async () => {
              try {
                const newValue = Math.max(0, (player.stats?.inspirations || 0) - 1);
                const newStats = { ...(player.stats || {}), inspirations: newValue } as PlayerStats;
                const { error } = await supabase.from('players').update({ stats: newStats }).eq('id', player.id);
                if (error) throw error;
                onUpdate({ ...player, stats: newStats });
                toast.success('Inspiration retirée');
              } catch (error) {
                console.error('Erreur maj inspiration:', error);
                toast.error('Erreur lors de la mise à jour');
              }
            }}
            className={`w-6 h-6 flex items-center justify-center rounded ${
              (player.stats?.inspirations || 0) > 0
                ? 'text-yellow-500 hover:bg-yellow-500/20'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            disabled={(player.stats?.inspirations || 0) <= 0}
          >
            <Minus size={14} />
          </button>
          <span className={`font-medium w-5 text-center text-sm ${(player.stats?.inspirations || 0) > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
            {player.stats?.inspirations || 0}
          </span>
          <button
            onClick={async () => {
              try {
                const newValue = Math.min(3, (player.stats?.inspirations || 0) + 1);
                const newStats = { ...(player.stats || {}), inspirations: newValue } as PlayerStats;
                const { error } = await supabase.from('players').update({ stats: newStats }).eq('id', player.id);
                if (error) throw error;
                onUpdate({ ...player, stats: newStats });
                toast.success('Inspiration ajoutée');
              } catch (error) {
                console.error('Erreur maj inspiration:', error);
                toast.error('Erreur lors de la mise à jour');
              }
            }}
            className={`w-6 h-6 flex items-center justify-center rounded ${
              (player.stats?.inspirations || 0) < 3
                ? 'text-yellow-500 hover:bg-yellow-500/20'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            disabled={(player.stats?.inspirations || 0) >= 3}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <button
        onClick={async () => {
          try {
            const { error } = await supabase
              .from('players')
              .update({
                is_concentrating: !player.is_concentrating,
                concentration_spell: !player.is_concentrating ? 'Sort actif' : null
              })
              .eq('id', player.id);
            if (error) throw error;

            onUpdate({
              ...player,
              is_concentrating: !player.is_concentrating,
              concentration_spell: !player.is_concentrating ? 'Sort actif' : null
            });

            toast.success(player.is_concentrating ? 'Concentration interrompue' : 'Concentration activée');
          } catch (error) {
            console.error('Erreur concentration:', error);
            toast.error('Erreur lors de la modification de la concentration');
          }
        }}
        className={`h-10 rounded text-sm flex items-center justify-between px-3 transition-all duration-200 min-w-[115px] ${
          player.is_concentrating
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-lg shadow-purple-500/20 animate-pulse'
            : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 border border-gray-700/50'
        }`}
      >
        <span className="text-xm whitespace-nowrap">Concentration</span>
        <Brain className={`w-4 h-4 ml-2 ${player.is_concentrating ? 'text-purple-400' : 'text-gray-400'}`} />
      </button>

      <button
        onClick={onOpenCampaigns}
        className="h-10 rounded text-sm bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/40 text-purple-300 hover:from-purple-600/30 hover:to-blue-600/30 flex items-center justify-between px-3 min-w-[115px]"
      >
        <span className="text-xm whitespace-nowrap">Campagnes</span>
        <Scroll className="w-4 h-4 ml-2" />
      </button>


    </div>
  );
}