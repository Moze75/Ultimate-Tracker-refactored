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
}

export function DesktopHeader({ player, inventory, onUpdate, onEdit, onOpenCampaigns }: DesktopHeaderProps) {
  return (
    <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-6">
        <CompactAvatar player={player} onEdit={onEdit} />

        <div className="flex items-center gap-4 flex-1">
          <QuickStatsCells player={player} inventory={inventory} />

          <div className="w-64">
            <DesktopActionsGrid
              player={player}
              onUpdate={onUpdate}
              onOpenCampaigns={onOpenCampaigns}
            />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ActiveConditionsBadges activeConditions={player.active_conditions || []} />
      </div>
    </div>
  );
}
