import React, { useState } from 'react';
import { Player, Ability } from '../types/dnd';
import { PlayerProfileSettingsModal } from './PlayerProfileSettingsModal';
import { CampaignPlayerModal } from './CampaignPlayerModal';
import { DesktopHeader } from './PlayerProfile/DesktopHeader';
import { HPManagerConnected } from './Combat/HPManagerConnected';
import { HorizontalAbilityScores } from './HorizontalAbilityScores';
import { StandaloneSkillsSection } from './StandaloneSkillsSection';
import { TabbedPanel } from './TabbedPanel';
import { DiceRoller } from './DiceRoller';
import { ConcentrationCheckModal } from './Combat/ConcentrationCheckModal';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout'; // <-- import du hook

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
  const [diceRoll, setDiceRoll] = useState<{ show: boolean; result: number; modifier: number; description: string } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<'ac' | 'speed' | null>(null);
  const [showConcentrationCheck, setShowConcentrationCheck] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);

  const deviceType = useResponsiveLayout(); // <-- usage

  const abilities = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : [];

  const handleAbilityClick = (ability: Ability) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setDiceRoll({
      show: true,
      result: roll,
      modifier: ability.modifier,
      description: `Test de ${ability.name}`
    });
    setTimeout(() => setDiceRoll(null), 3000);
  };

  const handleSavingThrowClick = (ability: Ability) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setDiceRoll({
      show: true,
      result: roll,
      modifier: ability.savingThrow,
      description: `Sauvegarde de ${ability.name}`
    });
    setTimeout(() => setDiceRoll(null), 3000);
  };

  const handleSkillClick = (skillName: string, bonus: number) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    setDiceRoll({
      show: true,
      result: roll,
      modifier: bonus,
      description: `Test de ${skillName}`
    });
    setTimeout(() => setDiceRoll(null), 3000);
  };

  return (
    <>
      {/* Calque de fond Desktop uniquement */}
      {deviceType === 'desktop' && (
        <div className="fixed inset-0 z-0 flex justify-center overflow-hidden pointer-events-none">
          <img
            src="/background/bgfan.jpg"
            alt="Background"
            style={{
              width: '3600px',      // 2x plus grand qu'avant
              height: 'auto',
              objectFit: 'cover',
              filter: 'brightness(0.85)',
            }}
          />
        </div>
      )}

      <div className="relative z-10 min-h-screen p-4 lg:p-6 bg-gray-900/40 backdrop-blur-sm desktop-compact-layout">
        <div className="max-w-[1280px] mx-auto space-y-4">

          <DesktopHeader
            player={player}
            inventory={inventory}
            onUpdate={onPlayerUpdate}
            onEdit={() => setSettingsOpen(true)}
            onOpenCampaigns={() => setShowCampaignModal(true)}
            activeTooltip={activeTooltip}
            setActiveTooltip={setActiveTooltip}
          />

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 h-full">
                <HPManagerConnected
                  player={player}
                  onUpdate={onPlayerUpdate}
                  onConcentrationCheck={(dc) => {
                    setConcentrationDC(dc);
                    setShowConcentrationCheck(true);
                  }}
                />
              </div>
            </div>

            <div className="col-span-8">
              {abilities.length > 0 && (
                <HorizontalAbilityScores
                  abilities={abilities}
                  inventory={inventory}
                  onAbilityClick={handleAbilityClick}
                  onSavingThrowClick={handleSavingThrowClick}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-stretch">
            <div className="col-span-4 flex">
              <StandaloneSkillsSection
                player={player}
                onSkillClick={handleSkillClick}
              />
            </div>

            <div className="col-span-8 flex">
              <div className="bg-gray-800/30 rounded-lg border border-gray-700 p-4 w-full flex flex-col">
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

      {diceRoll && (
        <DiceRoller
          result={diceRoll.result}
          modifier={diceRoll.modifier}
          description={diceRoll.description}
          onClose={() => setDiceRoll(null)}
        />
      )}

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

      {showConcentrationCheck && (
        <ConcentrationCheckModal
          player={player}
          concentrationDC={concentrationDC}
          onUpdate={onPlayerUpdate}
          onClose={() => setShowConcentrationCheck(false)}
        />
      )}
    </>
  );
}