import React, { useState } from 'react';
import { Player } from '../types/dnd';
import { PlayerProfileSettingsModal } from './PlayerProfileSettingsModal';
import { SwipeNavigator } from './SwipeNavigator';
import { CampaignPlayerModal } from './CampaignPlayerModal';
import { ActiveConditionsBadges } from './PlayerProfile/ActiveConditionsBadges';
import { PlayerAvatar } from './PlayerProfile/PlayerAvatar';
import { PlayerActionsPanel } from './PlayerProfile/PlayerActionsPanel';
import { QuickStatsDisplay } from './PlayerProfile/QuickStatsDisplay';
import { DiceSettingsModal } from './DiceSettingsModal';
import { useDiceSettings } from '../hooks/useDiceSettings';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'; // 🆕

export interface PlayerProfileProps {
  player: Player;
  onUpdate: (player: Player) => void;
  onInventoryAdd?: (item: any) => void;
  inventory?: any[];
  currentBackground?: string; // 🆕
  onBackgroundChange?: (url: string) => void; // 🆕
}

export function PlayerProfile({ 
  player, 
  onUpdate, 
  onInventoryAdd, 
  inventory,
  currentBackground, // 🆕
  onBackgroundChange // 🆕
}: PlayerProfileProps) {
  const [editing, setEditing] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<'ac' | 'speed' | 'initiative' | 'proficiency' | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  
  // State pour les paramètres de dés
  const [isDiceSettingsOpen, setIsDiceSettingsOpen] = useState(false);
  const { settings: diceSettings, saveSettings: saveDiceSettings } = useDiceSettings();
  const deviceType = useResponsiveLayout(); // 🆕

  return (
    <>
      <div className="fixed inset-y-0 left-0 w-4 sm:w-6 z-40 md:hidden">
        <SwipeNavigator threshold={45} onSwipeRight={() => setEditing(true)}>
          <div className="w-full h-full" aria-hidden />
        </SwipeNavigator>
      </div>

  <div className="stat-card w-full">
  <div className="stat-header flex items-start justify-between pb-4">
    <div className="flex flex-col gap-4 w-full">
      <ActiveConditionsBadges activeConditions={player.active_conditions || []} />

      <div
        className="grid items-start gap-3 sm:gap-4"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 8rem' }}
      >
        <PlayerAvatar 
          player={player} 
          onEdit={() => setEditing(true)}
          onOpenDiceSettings={() => setIsDiceSettingsOpen(true)}
        />

        <PlayerActionsPanel
          player={player}
          onUpdate={onUpdate}
          onOpenCampaigns={() => setShowCampaignModal(true)}
        />
      </div>
    </div>
    <div></div>
  </div>

        <QuickStatsDisplay
          player={player}
          inventory={inventory || []}
          activeTooltip={activeTooltip}
          setActiveTooltip={setActiveTooltip}
        />

      <PlayerProfileSettingsModal
        open={editing}
        onClose={() => setEditing(false)}
        player={player}
        onUpdate={onUpdate}
      />

      {/* Modal Campagnes */}
      <CampaignPlayerModal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        player={player}
        onUpdate={onUpdate}
        onInventoryAdd={onInventoryAdd}
      />

      {/* ✅ Modal Paramètres des dés avec background */}
      <DiceSettingsModal
        open={isDiceSettingsOpen}
        onClose={() => setIsDiceSettingsOpen(false)}
        settings={diceSettings}
        onSave={saveDiceSettings}
        currentBackground={currentBackground}
        onBackgroundChange={onBackgroundChange}
        deviceType={deviceType}
      />
    </>
  );  
}