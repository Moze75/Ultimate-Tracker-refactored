import React from 'react';
import { Users, Sparkles, Sunset, Moon, Dice6, Focus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Player } from '../../types/dnd';

interface CompactActionsRowProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onOpenCampaigns: () => void;
}

export function CompactActionsRow({ player, onUpdate, onOpenCampaigns }: CompactActionsRowProps) {
  const handleInspirationToggle = () => {
    const newInspirations = (player.stats?.inspirations || 0) === 0 ? 1 : 0;
    onUpdate({
      ...player,
      stats: { ...player.stats, inspirations: newInspirations }
    });
    toast.success(newInspirations ? 'Inspiration activée' : 'Inspiration utilisée');
  };

  const handleLongRest = () => {
    if (!window.confirm('Effectuer un repos long ? (restaure tous les PV, sorts, etc.)')) return;
    const maxHp = player.max_hp || 1;
    onUpdate({
      ...player,
      current_hp: maxHp,
      temp_hp: 0,
      hit_dice_used: 0,
      stats: { ...player.stats, inspirations: 0 }
    });
    toast.success('Repos long effectué');
  };

  const handleShortRest = () => {
    if (!window.confirm('Effectuer un repos court ?')) return;
    toast.success('Repos court effectué');
  };

  const handleHitDiceToggle = () => {
    toast.info('Gestion des dés de vie (à implémenter)');
  };

  const handleConcentrationToggle = () => {
    toast.info('Gestion de la concentration (à implémenter)');
  };

  const hasInspiration = (player.stats?.inspirations || 0) > 0;

  return (
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
        onClick={handleShortRest}
        className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
        title="Repos court"
      >
        <Sunset className="w-4 h-4" />
        <span className="text-sm">Repos court</span>
      </button>

      <button
        onClick={handleHitDiceToggle}
        className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
        title="Dés de vie"
      >
        <Dice6 className="w-4 h-4" />
        <span className="text-sm">Dés de vie</span>
      </button>

      <button
        onClick={handleConcentrationToggle}
        className="px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-300 hover:bg-gray-700/50 transition-colors flex items-center gap-2"
        title="Concentration"
      >
        <Focus className="w-4 h-4" />
        <span className="text-sm">Concentration</span>
      </button>
    </div>
  );
}
