import React from 'react';
import { Settings, Dices } from 'lucide-react';
import { Player } from '../../types/dnd';
import { CompactAvatar } from './CompactAvatar';
import { QuickStatsCells } from './QuickStatsCells';
import { DesktopActionsGrid } from './DesktopActionsGrid';
import { ActiveConditionsBadges } from './ActiveConditionsBadges';

interface DesktopHeaderProps {
  player: Player;
  inventory: any[];
  onUpdate: (player: Player) => void;
  onEdit: () => void;
  onOpenCampaigns: () => void;
  onOpenFamiliar?: () => void;
  activeTooltip?: 'ac' | 'speed' | null;
  setActiveTooltip?: (tooltip: 'ac' | 'speed' | null) => void;
}

export function DesktopHeader({ 
  player, 
  inventory, 
  onUpdate, 
  onEdit, 
  onOpenCampaigns, 
  onOpenDiceSettings,
  onOpenFamiliar,
  activeTooltip, 
  setActiveTooltip 
}: DesktopHeaderProps) {
  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 relative">
      {/* Boutons Éditer / Paramètres en haut à droite */}
      <div className="absolute top-2 right-4 flex gap-1 z-50 mb-2">
        <button
          onClick={onEdit}
          className="px-2 py-1 rounded bg-transparent text-white hover:bg-gray-800/50 flex items-center gap-1 transition-colors text-xs"
          title="Éditer le profil"
        >
          <Settings className="w-3 h-3" />
          <span>Éditer</span>
        </button>

        {onOpenDiceSettings && (
          <button
            onClick={onOpenDiceSettings}
            className="px-2 py-1 rounded bg-transparent text-purple-300 hover:bg-purple-800/30 flex items-center gap-1 transition-colors text-xs"
            title="Paramètres des dés"
          >
            <Dices className="w-3 h-3" />
            <span>Paramètres</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-6">
        <CompactAvatar 
          player={player} 
          onEdit={onEdit}
          onOpenDiceSettings={onOpenDiceSettings} // ✅ Passer la prop
          onOpenFamiliar={onOpenFamiliar}
        />

        <div className="flex-1 flex items-center justify-center">
          <QuickStatsCells
            player={player}
            inventory={inventory}
            activeTooltip={activeTooltip}
            setActiveTooltip={setActiveTooltip}
          />
        </div>

        <div className="min-w-0 shrink">
          <DesktopActionsGrid
            player={player}
            onUpdate={onUpdate}
            onOpenCampaigns={onOpenCampaigns}
          />
        </div>
      </div>

      <div className="mt-4">
        <ActiveConditionsBadges activeConditions={player.active_conditions || []} />
      </div>
    </div>
  );
}