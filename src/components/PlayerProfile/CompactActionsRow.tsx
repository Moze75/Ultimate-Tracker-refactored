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
  
  // 🔧 Reset classe principale
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

  // 🔧 AJOUTER : Reset classe secondaire
  const nextSecondaryCR: any = { ...(player.secondary_class_resources || {}) };
  nextSecondaryCR.used_rage = 0;
  nextSecondaryCR.used_bardic_inspiration = 0;
  nextSecondaryCR.used_channel_divinity = 0;
  nextSecondaryCR.used_wild_shape = 0;
  nextSecondaryCR.used_sorcery_points = 0;
  nextSecondaryCR.used_action_surge = 0;
  nextSecondaryCR.used_arcane_recovery = false;
  nextSecondaryCR.arcane_recovery_slots_used = 0;
  nextSecondaryCR.used_credo_points = 0;
  nextSecondaryCR.used_ki_points = 0;
  nextSecondaryCR.used_lay_on_hands = 0;
  nextSecondaryCR.used_favored_foe = 0;
  nextSecondaryCR.used_innate_sorcery = 0;
  nextSecondaryCR.used_supernatural_metabolism = 0;

  const updateData: any = {
    current_hp: maxHp,
    temp_hp: 0,
    hit_dice_used: 0,
    class_resources: nextCR,
    stats: { ...player.stats, inspirations: 0 }
  };

  // Ajouter secondary_class_resources si présent
  if (player.secondary_class) {
    updateData.secondary_class_resources = nextSecondaryCR;
  }

  onUpdate({
    ...player,
    ...updateData
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
