import React, { useState } from 'react';
import { Moon, Scroll, Brain, Plus, Minus, Star, Sun } from 'lucide-react';
import { Player, PlayerStats } from '../../types/dnd';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { RestSelectionModal } from '../modals/RestSelectionModal';
import { buildShortRestUpdate, buildLongRestUpdate } from '../../services/restService';

interface DesktopActionsGridProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onOpenCampaigns: () => void;
}

export function DesktopActionsGrid({ player, onUpdate, onOpenCampaigns }: DesktopActionsGridProps) {
  const [showRestModal, setShowRestModal] = useState(false);

  const handleShortRestConfirm = async (hitDiceCount: number, selectedResourceIds: string[]) => {
    try {
      const { updateData, restoredLabels } = buildShortRestUpdate(player, hitDiceCount, selectedResourceIds);

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        ...updateData,
      });

      if (restoredLabels.length > 0) {
        toast.success(`Repos court : ${restoredLabels.join(', ')}`);
      } else {
        toast.success('Repos court effectue');
      }
    } catch (error) {
      console.error('Erreur lors du repos court:', error);
      toast.error('Erreur lors du repos');
    }
  };

  const handleLongRest = async () => {
    try {
      const { updateData } = buildLongRestUpdate(player);

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        ...updateData
      });

      toast.success('Repos long effectue (toutes les ressources restaurees)');
    } catch (error) {
      console.error('Erreur lors du repos long:', error);
      toast.error('Erreur lors du repos');
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 mr-4 auto-rows-fr">
        <button
          onClick={handleLongRest}
          className="h-10 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3 border border-gray-700/50 min-w-[115px]"
        >
          <span className="text-xm whitespace-nowrap">Repos long</span>
          <Moon className="w-4 h-4 ml-2" />
        </button>

        <button
          onClick={() => setShowRestModal(true)}
          className="h-10 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3 border border-gray-700/50 min-w-[115px]"
        >
          <span className="text-xm whitespace-nowrap">Repos court</span>
          <Sun className="w-4 h-4 ml-2" />
        </button>

        {player.hit_dice && (
          <div className="h-10 px-3 py-1 text-sm bg-gray-800/30 rounded flex items-center justify-between border border-gray-700/50 min-w-[115px]">
            <span className="text-xm text-gray-400 whitespace-nowrap">Des de vie</span>
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
                  toast.success('Inspiration retiree');
                } catch (error) {
                  console.error('Erreur maj inspiration:', error);
                  toast.error('Erreur lors de la mise a jour');
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
                  toast.success('Inspiration ajoutee');
                } catch (error) {
                  console.error('Erreur maj inspiration:', error);
                  toast.error('Erreur lors de la mise a jour');
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

              toast.success(player.is_concentrating ? 'Concentration interrompue' : 'Concentration activee');
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

      <RestSelectionModal
        open={showRestModal}
        onClose={() => setShowRestModal(false)}
        player={player}
        onConfirm={handleShortRestConfirm}
      />
    </>
  );
}
