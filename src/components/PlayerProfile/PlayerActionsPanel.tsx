import React, { useState } from 'react';
import { Moon, Star, Sun, Brain, Plus, Minus, Scroll } from 'lucide-react';
import { Player, PlayerStats } from '../../types/dnd';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { RestSelectionModal } from '../modals/RestSelectionModal';
import { buildShortRestUpdate, buildLongRestUpdate } from '../../services/restService';

interface PlayerActionsPanelProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onOpenCampaigns: () => void;
}

export function PlayerActionsPanel({ player, onUpdate, onOpenCampaigns }: PlayerActionsPanelProps) {
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
      <div className="flex flex-col gap-3 sm:gap-4 items-stretch w-32 justify-start">
        <button
          onClick={onOpenCampaigns}
          className="w-32 h-9 rounded text-sm bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/40 text-purple-300 hover:from-purple-600/30 hover:to-blue-600/30 flex items-center justify-between px-2"
        >
          <span className="ml-1.5 flex-1 text-left">Campagnes</span>
          <Scroll className="w-4 h-4" />
        </button>

        <div className="w-32 rounded text-sm bg-gray-800/50 flex flex-col">
          <div className="text-gray-400 text-sm text-center h-8 flex items-center justify-center gap-1">
            <span className="ml-3">Inspiration</span>
            <Star className="w-4 h-4 ml-2" />
          </div>
          <div className="flex items-center justify-center gap-2 h-8">
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
            <span className={`font-medium w-4 text-center ${(player.stats?.inspirations || 0) > 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
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
          onClick={handleLongRest}
          className="w-32 h-9 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3"
        >
          <span className="ml-1.5 flex-1 text-left">Repos long</span>
          <Moon className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowRestModal(true)}
          className="w-32 h-9 rounded text-sm bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 flex items-center justify-between px-3"
        >
          <span className="ml-1.5 flex-1 text-left">Repos court</span>
          <Sun className="w-4 h-4" />
        </button>

        {player.hit_dice && (
          <div className="w-32 px-2 py-1 text-sm bg-gray-800/30 rounded flex flex-col items-center">
            <span className="text-gray-400 mb-0.5">Des de viee</span>
            <span className="text-gray-300 font-medium text-center">
              {player.hit_dice.total - player.hit_dice.used} / {player.hit_dice.total}
            </span>
          </div>
        )}

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
          className={`w-32 h-9 rounded text-sm flex items-center px-3 transition-all duration-200 ${
            player.is_concentrating
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-lg shadow-purple-500/20 animate-pulse'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <div className="ml-auto inline-flex items-center gap-1">
            <span>Concentration</span>
            <Brain className={`w-4 h-4 ${player.is_concentrating ? 'text-purple-400' : 'text-gray-400'}`} />
          </div>
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
