import React, { useState } from 'react';
import { Player } from '../types/dnd';
import { PlayerProfileSettingsModal } from './PlayerProfileSettingsModal';
import { CampaignPlayerModal } from './CampaignPlayerModal';
import { ActiveConditionsBadges } from './PlayerProfile/ActiveConditionsBadges';
import { CompactAvatar } from './PlayerProfile/CompactAvatar';
import { CompactActionsRow } from './PlayerProfile/CompactActionsRow';
import { CompactStatsPanel } from './PlayerProfile/CompactStatsPanel';
import { HPManagerConnected } from './Combat/HPManagerConnected';
import { HorizontalAbilityScores } from './HorizontalAbilityScores';
import { StandaloneSkillsSection } from './StandaloneSkillsSection';
import { TabbedPanel } from './TabbedPanel';

interface DesktopViewProps {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: any[]) => void;
  classSections: any[] | null;
  session: any;
}

export function DesktopView({
  player,
  inventory,
  onPlayerUpdate,
  onInventoryUpdate,
  classSections,
  session,
}: DesktopViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  const abilities = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : [];

  return (
    <>
      <div className="min-h-screen p-4 lg:p-6 bg-gray-900 desktop-compact-layout">
        <div className="max-w-[1920px] mx-auto space-y-4">

          {/* LIGNE 1: Header - Avatar compact + Infos + Actions horizontales */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
            <div className="flex items-start gap-6">
              {/* Avatar compact + Infos */}
              <div className="flex-shrink-0">
                <CompactAvatar
                  player={player}
                  onEdit={() => setSettingsOpen(true)}
                />
              </div>

              {/* Boutons d'actions horizontaux */}
              <div className="flex-1">
                <CompactActionsRow
                  player={player}
                  onUpdate={onPlayerUpdate}
                  onOpenCampaigns={() => setShowCampaignModal(true)}
                />
              </div>
            </div>

            {/* Conditions actives */}
            <div className="mt-4">
              <ActiveConditionsBadges activeConditions={player.active_conditions || []} />
            </div>
          </div>

          {/* LIGNE 2: Caractéristiques horizontales */}
          {abilities.length > 0 && (
            <HorizontalAbilityScores
              abilities={abilities}
              inventory={inventory}
              onAbilityClick={() => {}}
              onSavingThrowClick={() => {}}
            />
          )}

          {/* LIGNE 3: Compétences à gauche + HP et Stats compacts à droite */}
          <div className="grid grid-cols-12 gap-4">
            {/* Compétences */}
            <div className="col-span-4">
              <StandaloneSkillsSection
                player={player}
                onSkillClick={() => {}}
              />
            </div>

            {/* HP Manager */}
            <div className="col-span-4">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
                <HPManagerConnected
                  player={player}
                  onUpdate={onPlayerUpdate}
                  onConcentrationCheck={(dc) => {
                    console.log('Concentration check DC:', dc);
                  }}
                />
              </div>
            </div>

            {/* Stats compacts (CA, Vitesse, Init, Maîtrise) */}
            <div className="col-span-4">
              <CompactStatsPanel
                player={player}
                inventory={inventory}
              />
            </div>
          </div>

          {/* LIGNE 4: Bloc à onglets pleine largeur */}
          <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
            <TabbedPanel
              player={player}
              inventory={inventory}
              onPlayerUpdate={onPlayerUpdate}
              onInventoryUpdate={onInventoryUpdate}
              classSections={classSections}
            />
          </div>

        </div>
      </div>

      {/* Modals */}
      <PlayerProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        player={player}
        onUpdate={onPlayerUpdate}
        slideFrom="left"
      />

      <CampaignPlayerModal
        open={showCampaignModal}
        onClose={() => setShowCampaignModal(false)}
        player={player}
        onUpdate={onPlayerUpdate}
        onInventoryAdd={(item) => {
          console.log('New item added:', item);
        }}
      />
    </>
  );
}
