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
import { DiceRollContext } from './ResponsiveGameLayout';
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

  const [activeTooltip, setActiveTooltip] = useState<'ac' | 'speed' | null>(null);
  const [showConcentrationCheck, setShowConcentrationCheck] = useState(false);
  const [concentrationDC, setConcentrationDC] = useState(10);
  
  // État pour gérer le fond d'écran avec valeur par défaut depuis localStorage
  const [backgroundImage, setBackgroundImage] = useState<string>(() => {
    return localStorage.getItem('desktop-background') || '/fondecran/Table.png';
  });

  const deviceType = useResponsiveLayout();
  const { rollDice } = React.useContext(DiceRollContext);
  const { settings: diceSettings, saveSettings: saveDiceSettings } = useDiceSettings();

  const abilities = Array.isArray(player.abilities) && player.abilities.length > 0
    ? player.abilities
    : [];

  // 🔍 DEBUG: Vérifier si les abilities sont chargées
  console.log('🔍 [DesktopView] abilities:', {
    playerAbilities: player. abilities,
    abilitiesLength: abilities.length,
    abilities: abilities.map(a => a.name)
  });

  const handleAbilityClick = (ability: Ability) => {
    console.log('🎲 [DesktopView] Lancer caractéristique:', ability.name);
    rollDice({
      type: 'ability',
      attackName: `Test de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.modifier
    });
  };

  const handleSavingThrowClick = (ability: Ability) => {
    console.log('🎲 [DesktopView] Lancer sauvegarde:', ability.name);
    rollDice({
      type: 'saving-throw',
      attackName: `Sauvegarde de ${ability.name}`,
      diceFormula: '1d20',
      modifier: ability.savingThrow
    });
  };

  const handleSkillClick = (skillName: string, bonus: number) => {
    console.log('🎲 [DesktopView] Lancer compétence:', skillName);
    rollDice({
      type: 'skill',
      attackName: `Test de ${skillName}`,
      diceFormula: '1d20',
      modifier: bonus
    });
  };

  // Fonction pour changer et sauvegarder le fond d'écran
  const handleBackgroundChange = (url: string) => {
    setBackgroundImage(url);
    localStorage.setItem('desktop-background', url);
  };

  return ( 
    <>
      {/* 🔥 IMAGE DE BACKGROUND FIXE - NE BOUGE JAMAIS */} 
      {deviceType === 'desktop' && (
        <div 
          className="fixed inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          {backgroundImage.startsWith('color:') ? (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: backgroundImage.replace('color:', ''),
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          ) : backgroundImage.startsWith('gradient:') ? (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: backgroundImage.replace('gradient:', ''),
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            />
          ) : (
            <img
              src={backgroundImage}
              alt="background"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%', 
                objectFit: 'cover',
                objectPosition: 'center top',
                pointerEvents: 'none', 
                userSelect: 'none',
                filter: 'brightness(0.95)',
              }}
            />
          )}
        </div>
      )}

      {/* 🔥 CONTENEUR PRINCIPAL - OCCUPE TOUT L'ÉCRAN */}
      <div className="fixed inset-0 flex flex-col" style={{ zIndex: 1 }}>
        
        {/* 🔥 ZONE SCROLLABLE - CONTIENT TOUT LE CONTENU */}
       <div 
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6"
          style={{
            scrollbarGutter: 'stable',
            minHeight: 0,
          }}
        >
          <div
            className="max-w-[1280px] mx-auto space-y-4"
            style={{
              minWidth: 0,
            }}
          >

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
            
            {/* Grille HP + Abilities */}
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
                <div className="bg-gray-800/70 rounded-lg border border-gray-700 backdrop-blur-sm p-4 h-full min-h-[180px]">
                  {abilities.length > 0 ?  (
                    <HorizontalAbilityScores
                      abilities={abilities}
                      inventory={inventory}
                      onAbilityClick={handleAbilityClick}
                      onSavingThrowClick={handleSavingThrowClick}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500 text-sm">
                        Aucune caractéristique configurée.  
                        <br />
                        <span className="text-xs">Allez dans l'onglet "Stats" pour les configurer.</span>
                      </p>
                    </div>
                  )}
                </div>  
              </div>
            </div> 

            {/* Grille Skills + TabbedPanel */}
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

            {/* Bouton Retour aux personnages - À LA FIN DE LA ZONE SCROLLABLE */}
            {onBackToSelection && (
              <div className="w-full mt-6 pb-6">
                <button
                  onClick={onBackToSelection}
                  className="w-full btn-secondary px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                >
                  <LogOut size={20} />
                  Retour aux personnages
                </button>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* 🔥 MODALS EN OVERLAY */}

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

      <DiceSettingsModal
        open={showDiceSettings}
        onClose={() => setShowDiceSettings(false)}
        settings={diceSettings}
        onSave={saveDiceSettings}
        currentBackground={backgroundImage}
        onBackgroundChange={handleBackgroundChange}
        deviceType="desktop"
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