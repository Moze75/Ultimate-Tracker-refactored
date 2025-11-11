import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import { Player, Ability } from '../types/dnd';
import { PlayerProfileSettingsModal } from './PlayerProfileSettingsModal';
import { CampaignPlayerModal } from './CampaignPlayerModal';
import { DiceSettingsModal } from './DiceSettingsModal';
import { DesktopHeader } from './PlayerProfile/DesktopHeader';
import { HPManagerConnected } from './Combat/HPManagerConnected';
import { HorizontalAbilityScores } from './HorizontalAbilityScores';
import { StandaloneSkillsSection } from './StandaloneSkillsSection';
import { TabbedPanel } from './TabbedPanel';
import { DiceRollerLazy } from './DiceRollerLazy';
import { ConcentrationCheckModal } from './Combat/ConcentrationCheckModal';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useDiceSettings } from '../hooks/useDiceSettings';

interface DesktopViewProps {
  player: Player;
  inventory: any[];
  onPlayerUpdate: (player: Player) => void;
  onInventoryUpdate: (inventory: any[]) => void;
  classSections: any[] | null;
  session: any;
  onBackToSelection?: () => void;
}

export function DesktopView({
  player,
  inventory,
  onPlayerUpdate,
  onInventoryUpdate,
  classSections,
  session,
  onBackToSelection,
}: DesktopViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [showDiceSettings, setShowDiceSettings] = useState(false);
  const [diceRoll, setDiceRoll] = useState<{
    type: 'ability' | 'saving-throw' | 'skill' | 'attack' | 'damage';
    attackName: string;
    diceFormula: string;
    modifier: number;
  } | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<'ac' | 'speed' | null>(null);
  const [showConcentrationCheck, setShowConcentrationCheck] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);

  const deviceType = useResponsiveLayout();
  const { settings: diceSettings, saveSettings: saveDiceSettings } = useDiceSettings();

  const abilities = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : [];

  const handleAbilityClick = (ability: Ability) => {
    setDiceRoll({
      type: 'ability',
      attackName: `Test de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.modifier
    });
  };

  const handleSavingThrowClick = (ability: Ability) => {
    setDiceRoll({
      type: 'saving-throw',
      attackName: `Sauvegarde de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.savingThrow
    });
  };

  const handleSkillClick = (skillName: string, bonus: number) => {
    setDiceRoll({
      type: 'skill',
      attackName: `Test de ${skillName}`,
      diceFormula: '1d20',
      modifier: bonus
    });
  };

  // Hauteur de la bande grise (ajustable ici)
  const headerBandHeight = 294; // en pixels

  return (
    <>
      {deviceType === 'desktop' && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 flex justify-center">
            <div
              className="h-screen"
              style={{
                width: '3600px',
                backgroundImage: 'url(/background/bgfan.jpg)',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center top',
                backgroundSize: 'cover',
                filter: 'brightness(0.9)',
              }}
            />
          </div>
        </div>
      )}

      <div className="relative z-10 min-h-screen p-4 lg:p-6 desktop-compact-layout">
        <div className="max-w-[1280px] mx-auto space-y-4">

          {/* Bande grise foncée qui scroll avec le contenu */}
          <div 
            className="absolute left-0 right-0 -z-10 pointer-events-none"
            style={{ 
              height: `${headerBandHeight}px`,
              top: '1rem', // Aligne avec le padding p-4
              background: 'linear-gradient(to bottom, rgba(17, 24, 39, 0.95), rgba(17, 24, 39, 0.90), transparent)'
            }}
          />

          {/* Header */}
          <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4">
            <DesktopHeader
              player={player}
              inventory={inventory}
              onUpdate={onPlayerUpdate}
              onEdit={() => setSettingsOpen(true)}
              onOpenCampaigns={() => setShowCampaignModal(true)}
              onOpenDiceSettings={() => setShowDiceSettings(true)}
              activeTooltip={activeTooltip}
              setActiveTooltip={setActiveTooltip}
            />
          </div>
          
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
              <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4 h-full">
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
                <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4 h-full"> 
                  <HorizontalAbilityScores
                    abilities={abilities}
                    inventory={inventory}
                    onAbilityClick={handleAbilityClick}
                    onSavingThrowClick={handleSavingThrowClick}
                  />
                </div>
              )} 
            </div>
          </div> 

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4 flex">
              <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4 w-full max-h-[880px]">
                <StandaloneSkillsSection
                  player={player}
                  onSkillClick={handleSkillClick}
                />
              </div>
            </div>

            <div className="col-span-8 flex">
              <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4 w-full flex flex-col max-h-[880px]">
                <TabbedPanel
                  player={player}
                  inventory={inventory}
                  onPlayerUpdate={onPlayerUpdate}
                  onInventoryUpdate={onInventoryUpdate}
                  classSections={classSections}
                  hiddenTabs={['bag']}
                />
              </div>
            </div>
          </div>

          {/* Bouton Retour aux personnages */}
          {onBackToSelection && (
            <div className="w-full mt-6 pb-6">
              <button
                onClick={onBackToSelection}
                className="w-full btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Retour aux personnages
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ✅ DiceRoller en overlay sur toute l'interface */}
      <DiceRollerLazy
        isOpen={diceRoll !== null}
        onClose={() => setDiceRoll(null)}
        rollData={diceRoll}
        settings={diceSettings}
      />

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

      {/* ✅ Modal paramètres des dés */}
      <DiceSettingsModal
        open={showDiceSettings}
        onClose={() => setShowDiceSettings(false)}
        settings={diceSettings}
        onSave={saveDiceSettings}
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