import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { Player } from '../types/dnd';
import { PlayerProfileSettingsModal } from './PlayerProfileSettingsModal';
import { CampaignPlayerModal } from './CampaignPlayerModal';
import { ActiveConditionsBadges } from './PlayerProfile/ActiveConditionsBadges';
import { QuickStatsDisplay } from './PlayerProfile/QuickStatsDisplay';
import { PlayerActionsPanel } from './PlayerProfile/PlayerActionsPanel';
import { PlayerAvatar } from './PlayerProfile/PlayerAvatar';
import { HPManagerConnected } from './Combat/HPManagerConnected';
import { AbilityScoreGrid } from './AbilityScoreGrid';
import { SkillsTable } from './SkillsTable';
import { StatsTab } from './StatsTab';
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
  const [activeTooltip, setActiveTooltip] = useState<'ac' | 'speed' | 'initiative' | 'proficiency' | null>(null);
  const [showCampaignModal, setShowCampaignModal] = useState(false);

  return (
    <>
      <div className="min-h-screen p-4 lg:p-6 bg-gray-900">
        <div className="max-w-[1920px] mx-auto space-y-6">

          {/* LIGNE 1: Header - Bouton paramètres + Stats rapides + Actions */}
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Bouton Paramètres */}
            <div className="col-span-1 flex items-start">
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300 transition-colors"
                title="Paramètres du personnage"
              >
                <Settings className="w-6 h-6" />
              </button>
            </div>

            {/* CA / Vitesse / Initiative / Maîtrise */}
            <div className="col-span-6 bg-gray-800/30 rounded-lg border border-gray-700 p-4">
              <ActiveConditionsBadges activeConditions={player.active_conditions || []} />
              <QuickStatsDisplay
                player={player}
                inventory={inventory}
                activeTooltip={activeTooltip}
                setActiveTooltip={setActiveTooltip}
              />
            </div>

            {/* Boutons d'actions (Campagnes, Inspiration, Repos, etc.) */}
            <div className="col-span-5 bg-gray-800/30 rounded-lg border border-gray-700 p-4 flex justify-center">
              <PlayerActionsPanel
                player={player}
                onUpdate={onPlayerUpdate}
                onOpenCampaigns={() => setShowCampaignModal(true)}
              />
            </div>
          </div>

          {/* LIGNE 2: Caractéristiques + Gestionnaire HP */}
          <div className="grid grid-cols-12 gap-4">
            {/* Contenants des caractéristiques (Force, Dex, etc.) */}
            <div className="col-span-8">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Caractéristiques</h3>
                <StatsTab
                  player={player}
                  inventory={inventory}
                  onUpdate={onPlayerUpdate}
                />
              </div>
            </div>

            {/* Gestionnaire HP */}
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
          </div>

          {/* LIGNE 3: Compétences + Avatar + Bloc à onglets (placeholder) */}
          <div className="grid grid-cols-12 gap-4">
            {/* Compétences à gauche */}
            <div className="col-span-4">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 max-h-[600px] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-100 mb-4 sticky top-0 bg-gray-800/30 pb-2">Compétences</h3>
                {/* On affichera les compétences ici */}
                <div className="text-gray-400 text-center py-8">
                  Compétences (à venir Phase 2)
                </div>
              </div>
            </div>

            {/* Avatar au centre */}
            <div className="col-span-2 flex items-start justify-center">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4">
                <div className="w-32 h-48">
                  <PlayerAvatar player={player} onEdit={() => setSettingsOpen(true)} />
                </div>
              </div>
            </div>

            {/* Bloc à onglets à droite */}
            <div className="col-span-6">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 h-[600px]">
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
