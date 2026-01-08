import React, { useState } from 'react';
import { Users, Sparkles, Sun, Moon, Dice6, Focus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Player } from '../../types/dnd';
import { supabase } from '../../lib/supabase';
import { RestSelectionModal } from '../modals/RestSelectionModal';
import { buildShortRestUpdate, buildLongRestUpdate } from '../../services/restService';

interface CompactActionsRowProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onOpenCampaigns: () => void;
}

export function CompactActionsRow({ player, onUpdate, onOpenCampaigns }: CompactActionsRowProps) {
  const [showRestModal, setShowRestModal] = useState(false);

  const handleInspirationToggle = async () => {
    try {
      const newInspirations = (player.stats?.inspirations || 0) === 0 ? 1 : 0;
      const newStats = { ...player.stats, inspirations: newInspirations };

      const { error } = await supabase
        .from('players')
        .update({ stats: newStats })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        stats: newStats
      });
      toast.success(newInspirations ? 'Inspiration activee' : 'Inspiration utilisee');
    } catch (error) {
      console.error('Erreur maj inspiration:', error);
      toast.error('Erreur lors de la mise a jour');
    }
  };

  const handleLongRest = async () => {
    if (!window.confirm('Effectuer un repos long ? (restaure tous les PV, sorts, etc.)')) return;

    try {
      const { updateData } = buildLongRestUpdate(player);

      const { error } = await supabase
        .from('players')
        .update(updateData)
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        ...updateData,
      });

      toast.success('Repos long effectue');
    } catch (error) {
      console.error('Erreur lors du repos long:', error);
      toast.error('Erreur lors du repos');
    }
  };

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

  const handleConcentrationToggle = async () => {
    try {
      const newConcentrating = !player.is_concentrating;

      const { error } = await supabase
        .from('players')
        .update({
          is_concentrating: newConcentrating,
          concentration_spell: newConcentrating ? 'Sort actif' : null
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        is_concentrating: newConcentrating,
        concentration_spell: newConcentrating ? 'Sort actif' : null
      });

      toast.success(newConcentrating ? 'Concentration activee' : 'Concentration interrompue');
    } catch (error) {
      console.error('Erreur concentration:', error);
      toast.error('Erreur lors de la modification');
    }
  };

  const hasInspiration = (player.stats?.inspirations || 0) > 0;
  const availableHitDice = player.hit_dice
    ? player.hit_dice.total - player.hit_dice.used
    : 0;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onOpenCampaigns}
          className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
          title="Campagnes"
        >
          <Users className="w-4 h-4" />
          <span className="text-sm">Campagnes</span>
        </button>

        <button
          onClick={handleInspirationToggle}
          className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            hasInspiration
              ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/30'
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700/50'
          }`}
          title={hasInspiration ? 'Inspiration active' : 'Inspiration inactive'}
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Inspiration</span>
        </button>

        <button
          onClick={handleLongRest}
          className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
          title="Repos long"
        >
          <Moon className="w-4 h-4" />
          <span className="text-sm">Repos long</span>
        </button>

        <button
          onClick={() => setShowRestModal(true)}
          className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
          title="Repos court"
        >
          <Sun className="w-4 h-4" />
          <span className="text-sm">Repos court</span>
        </button>

        <div
          className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 flex items-center gap-2"
          title="Des de vie"
        >
          <Dice6 className="w-4 h-4" />
          <span className="text-sm">{availableHitDice}/{player.hit_dice?.total || player.level}</span>
        </div>

        <button
          onClick={handleConcentrationToggle}
          className={`px-3 py-2 rounded-lg border transition-colors flex items-center gap-2 ${
            player.is_concentrating
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 hover:bg-purple-500/30 animate-pulse'
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-700/50'
          }`}
          title="Concentration"
        >
          <Focus className="w-4 h-4" />
          <span className="text-sm">Concentration</span>
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
