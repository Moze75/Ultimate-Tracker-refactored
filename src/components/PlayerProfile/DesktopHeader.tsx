import React from 'react';
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
  onOpenDiceSettings?: () => void;
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
  activeTooltip, 
  setActiveTooltip 
}: DesktopHeaderProps) {
  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between gap-6">
        <CompactAvatar 
          player={player} 
          onEdit={onEdit}
          onOpenDiceSettings={onOpenDiceSettings} // ✅ Passer la prop
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