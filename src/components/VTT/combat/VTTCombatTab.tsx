import { useState, useEffect, useRef } from 'react';
import {
  Swords,
  BookOpen,
  Loader2,
  ArrowLeft,
  Users,
  Skull,
  Save,
  Trash2,
  X,
  Shield,
  Heart,
  User,
  SkipForward,
  Square,
  Minus,
  Plus,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import {
  CampaignEncounter,
  EncounterParticipant,
  Monster,
  DND_CONDITIONS,
} from '../../../types/campaign';
import { monsterService } from '../../../services/monsterService';
import { MonsterSearch } from '../../Combat/MonsterSearch';
import { MonsterStatBlock, DiceRollData } from '../../Combat/MonsterStatBlock';
import { CustomMonsterModal } from '../../Combat/CustomMonsterModal';
import { ImportMonsterModal } from '../../Combat/ImportMonsterModal';
import { LoadEncounterModal } from '../../GameMaster/modals/LoadEncounterModal';
import { PlayerDetailsModal } from '../../modals/PlayerDetailsModal';
import {
  useCombatController,
  type CombatTabProps,
  type CombatPreparationEntry,
} from '../../GameMaster/hooks/useCombatController';

const DICE_ICON_URL =
  'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/icons/wmremove-transformed.webp';

type VTTCombatTabProps = CombatTabProps & {
  autoFocusCombatTurn?: boolean;
  onFocusCombatTokenByLabel?: (displayName: string) => void;
  onCurrentTurnLabelChange?: (displayName: string | null) => void;
  onDirectLaunchCombat?: (tokens: import('../../../types/vtt').VTTToken[]) => void;
};

export function VTTCombatTab({
  campaignId,
  members,
  onReload,
  onRollDice,
  initialTokens,
  liveTokens,
  role = 'gm',
  onUpdateToken,
  autoFocusCombatTurn = true,
  onFocusCombatTokenByLabel,
  onCurrentTurnLabelChange,
  onDirectLaunchCombatRef,
}: VTTCombatTabProps & {
  onDirectLaunchCombatRef?: React.MutableRefObject<((tokens: import('../../../types/vtt').VTTToken[]) => void) | null>;
}) {
  const {
    isGM,
    isDesktop,
    isActive,
    encounter,
    participants,
    savedMonsters,
    loading,
    panelView,
    selectedMonster,
    loadingDetail,
    showCustomModal,
    editingMonster,
    addCount,
    prepEntries,
    encounterName,
    launching,
    hpDelta,
    showLoadEncounterModal,
    showImportModal,
    selectedPlayerDetails,
    mobileSearchOpen,
    scrollContainerRef,
    setParticipants,
    setPanelView,
    setShowCustomModal,
    setEditingMonster,
    setSavedMonsters,
    setEncounterName,
    setHpDelta,
    setShowLoadEncounterModal,
    setShowImportModal,
    setSelectedPlayerDetails,
    setMobileSearchOpen,
    handleLoadEncounter,
    viewMonsterBySlug,
    viewMonsterById,
    viewPlayerById,
    handleAddMonstersFromSearch,
    handleAddMonstersFromSearchToEncounter,
    handleAddSavedMonsterToPrep,
    handleRemovePrepEntry,
    handleUpdatePrepInitiative,
    handleRollAllInitiative,
    handleRollMonsterInitiativeActive,
    handleLaunchCombat,
    handleDirectLaunchCombat,
    handleSavePreparation,
    handleSaveEncounter,
    handleEndCombat,
    handleNextTurn,
    handleSelectMonsterFromSearch,
    handleSaveMonster,
    handleDeleteMonster,
    handleRemoveParticipant,
    handleUpdateActiveInitiative,
    handleSortByInitiative,
    handleAddMonsterToEncounter,
    handleAddPlayersToEncounter,
    applyHp,
    toggleCondition,
  } = useCombatController({
    campaignId,
    members,
    onReload,
    onRollDice,
    initialTokens,
    liveTokens,
    vttMode: true,
    role,
    onUpdateToken,
  });

  // Expose handleDirectLaunchCombat vers VTTPage via ref
  useEffect(() => {
    if (onDirectLaunchCombatRef) {
      onDirectLaunchCombatRef.current = handleDirectLaunchCombat;
    }
    return () => {
      if (onDirectLaunchCombatRef) onDirectLaunchCombatRef.current = null;
    };
  }, [handleDirectLaunchCombat, onDirectLaunchCombatRef]);
  
  const lastAutoFocusedTurnKeyRef = useRef<string | null>(null);

  useEffect(() => { 
    if (!isActive || !encounter) {
      onCurrentTurnLabelChange?.(null);
      if (!autoFocusCombatTurn) {
        lastAutoFocusedTurnKeyRef.current = null;
      }
      return;
    }

    const currentParticipant = participants[encounter.current_turn_index];
    const currentLabel = currentParticipant?.display_name ?? null;

    onCurrentTurnLabelChange?.(currentLabel);

    if (!autoFocusCombatTurn) {
      lastAutoFocusedTurnKeyRef.current = null;
      return;
    }

    if (!currentLabel) return;

    const turnKey = `${encounter.id}:${encounter.current_turn_index}:${currentLabel}`;

    if (lastAutoFocusedTurnKeyRef.current === turnKey) return;

    lastAutoFocusedTurnKeyRef.current = turnKey;
    onFocusCombatTokenByLabel?.(currentLabel);
  }, [
    autoFocusCombatTurn,
    isActive,
    encounter?.id,
    encounter?.current_turn_index,
    participants,
    onFocusCombatTokenByLabel,
    onCurrentTurnLabelChange,
  ]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-amber-400" size={24} />
      </div>
    );
  }

  if (!isGM && !isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
        <Swords size={32} className="text-gray-600" />
        <p className="text-sm text-gray-400">Aucun combat en cours.</p>
        <p className="text-xs text-gray-600">Le Maître de Jeu n'a pas encore lancé de combat.</p>
      </div>
    );
  }

  const playerPrep = prepEntries.filter((e) => e.type === 'player');
  const monsterPrep = prepEntries.filter((e) => e.type === 'monster');

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Barre du bestiaire — uniquement le bouton "Charger" reste en haut */}
      {isGM && (
        <div className="border-b border-gray-800 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setShowLoadEncounterModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <BookOpen size={12} /> Charger combat
            </button>
            {isActive && (
              <button
                onClick={handleSaveEncounter}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
              >
                <Save size={12} /> Sauver combat
              </button>
            )}
          </div>

          {mobileSearchOpen && (
            <div className="mt-2 rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  {panelView === 'detail' && (
                    <button
                      onClick={() => setPanelView('search')}
                      className="p-1 text-gray-400 hover:text-amber-300 transition-colors"
                      title="Retour"
                    >
                      <ArrowLeft size={14} />
                    </button>
                  )}
                  <h3 className="text-sm font-semibold text-[#EFE6D8]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Bestiaire
                  </h3>
                </div>
                <button
                  onClick={() => setMobileSearchOpen(false)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[45vh] overflow-y-auto p-3">
                {panelView === 'search' && (
                  <MonsterSearch
                    selectionMode
                    onAddToCombat={isActive ? handleAddMonstersFromSearchToEncounter : handleAddMonstersFromSearch}
                    onSelect={handleSelectMonsterFromSearch}
                    savedMonsters={savedMonsters}
                    onEditMonster={(m) => {
                      setEditingMonster(m);
                      setShowCustomModal(true);
                    }}
                    onDeleteMonster={handleDeleteMonster}
                    onRollDice={onRollDice}
                  />
                )}

                {panelView === 'detail' && (
                  <div className="space-y-3">
                    {loadingDetail ? (
                      <div className="flex items-center justify-center py-8 text-gray-400">
                        <Loader2 size={20} className="animate-spin mr-2" />
                      </div>
                    ) : selectedMonster ? (
                      <div className="space-y-3">
                        <div className="monster-statblock-wrapper">
                          <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
                        </div>
                        <div className="flex gap-2">
                          {!selectedMonster.id && (
                            <button
                              onClick={() => handleSaveMonster(selectedMonster)}
                              className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <Save size={14} /> Sauvegarder
                            </button>
                          )}
                          {isActive ? (
                            <button
                              onClick={() => handleAddMonsterToEncounter(selectedMonster, addCount)}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <Swords size={14} /> Ajouter ({addCount})
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                handleAddSavedMonsterToPrep(selectedMonster, 1);
                                setPanelView('search');
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <Swords size={14} /> Ajouter au combat
                            </button>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0">
        {/* Header combat : nom + round + boutons actions */}
        <div className="px-4 py-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0 flex-1">
                        <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <span className="truncate">{isActive ? encounter.name : 'Combat'}</span>
                {isActive && (
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded whitespace-nowrap shrink-0 border border-gray-700">
                    Round {encounter.round_number}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-gray-500">
                {isActive
                  ? `${participants.length} participant${participants.length > 1 ? 's' : ''}`
                  : 'Aucun combat actif'}
              </p>
            </div>
          </div>

          {isGM && (
            <div className="flex gap-1.5 w-full">
              {isActive ? (
                <>
                  <SpinDiceButton
                    onRoll={handleRollMonsterInitiativeActive}
                    title="Relancer l'initiative des monstres"
                    className="flex items-center justify-center p-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs rounded-lg border border-gray-700 transition-colors"
                    imgSize="w-4 h-4"
                  />
                  <button
                    onClick={handleNextTurn}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                  >
                    <SkipForward size={12} className="shrink-0" /> Suivant
                  </button>

                  <button
                    onClick={handleEndCombat}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg border border-red-800/50 transition-colors"
                  >
                    <Square size={12} className="shrink-0" /> Fin
                  </button>
                </>
               ) : null}
            </div>
          )}
        </div>

           {/* Champ nom de combat supprimé — le combat se lance depuis le clic droit canvas */}

        {isActive && isGM && (
          <div className="px-4 py-2 border-b border-gray-800">
            <div className="flex gap-2">
              <button
                onClick={handleAddPlayersToEncounter}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-colors"
              >
                <Users size={12} /> Ajouter joueurs
              </button>
              <button
                onClick={handleSortByInitiative}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-colors"
              >
                Trier
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0" ref={scrollContainerRef}>
          {isActive ? (
            <ActiveParticipantsList
              encounter={encounter}
              participants={participants}
              hpDelta={hpDelta}
              setHpDelta={setHpDelta}
              onApplyHp={applyHp}
              onToggleCondition={toggleCondition}
              onRemove={handleRemoveParticipant}
              onViewMonster={viewMonsterById}
              onViewPlayer={viewPlayerById}
              onUpdateInitiative={handleUpdateActiveInitiative}
              selectedMonster={selectedMonster}
              loadingDetail={loadingDetail}
              onRollDice={onRollDice}
              isDesktop={isDesktop}
              scrollContainerRef={scrollContainerRef}
              vttMode
              onFocusToken={onFocusCombatTokenByLabel}
              liveTokens={liveTokens}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-4">
              <Swords size={28} className="text-gray-600" />
              {isGM ? (
                <>
                  <p className="text-sm text-gray-400">Aucun combat en cours.</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Sélectionnez des tokens sur le canvas puis faites un<br />
                    <span className="text-amber-400">Shift + clic droit</span> → "Lancer le combat"
                  </p>
                  <button
                    onClick={() => setShowLoadEncounterModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/40 rounded-lg transition-colors"
                  >
                    <BookOpen size={12} /> Charger un combat sauvegardé
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">Aucun combat en cours.</p>
                  <p className="text-xs text-gray-600">Le Maître de Jeu n'a pas encore lancé de combat.</p>
                </>
              )}
            </div>
          )}
        </div>
 
        {/* Footer préparation supprimé — le combat se lance depuis le clic droit canvas */}
      </div>

      {showCustomModal && (
        <CustomMonsterModal
          onClose={() => {
            setShowCustomModal(false);
            setEditingMonster(null);
          }}
          onSave={handleSaveMonster}
          editMonster={editingMonster}
        />
      )}

      {showLoadEncounterModal && (
        <LoadEncounterModal
          campaignId={campaignId}
          onClose={() => setShowLoadEncounterModal(false)}
          onLoad={handleLoadEncounter}
        />
      )}

      {showImportModal && (
        <ImportMonsterModal
          campaignId={campaignId}
          existingMonsterNames={savedMonsters.map((m) => m.name)}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(imported) => {
            setSavedMonsters((prev) => [...prev, ...imported]);
          }}
        />
      )}

      {selectedPlayerDetails && (
        <PlayerDetailsModal
          playerId={selectedPlayerDetails.id}
          playerName={selectedPlayerDetails.name}
          onClose={() => setSelectedPlayerDetails(null)}
          onPlayerUpdated={async () => {
            if (encounter) {
              const parts = await monsterService.getEncounterParticipants(encounter.id);
              setParticipants(parts);
            }
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers : résolution du token VTT pour l'avatar
// ---------------------------------------------------------------------------
type TokenLike = { label: string; imageUrl?: string | null; color?: string };

function resolveTokenAvatar(
  name: string,
  liveTokens?: TokenLike[]
): { imageUrl: string | null; color: string } {
  const match = liveTokens?.find(
    (t) => t.label.toLowerCase() === name.toLowerCase()
  );
  return {
    imageUrl: match?.imageUrl ?? null,
    color: match?.color ?? '#6b7280',
  };
}

function TokenAvatar({
  name,
  liveTokens,
  size = 28,
  isMonster = false,
  hpPct,
}: {
  name: string;
  liveTokens?: TokenLike[];
  size?: number;
  isMonster?: boolean;
  hpPct?: number; // 0–100, undefined = pas de barre
}) {
  const { imageUrl, color } = resolveTokenAvatar(name, liveTokens);

  // Calcul du cercle SVG
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = hpPct ?? 100;
  const dash = (pct / 100) * circumference;
  const gap = circumference - dash; 
  // Interpolation HSL continue : 120° (vert) → 0° (rouge)
  const hue = Math.round((pct / 100) * 120);
  const ringColor = `hsl(${hue}, 80%, 45%)`;

  const inner = imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      draggable={false}
      className="rounded-full object-cover"
      style={{ width: size - strokeWidth * 2 - 2, height: size - strokeWidth * 2 - 2 }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-[9px] font-bold text-white"
      style={{
        width: size - strokeWidth * 2 - 2,
        height: size - strokeWidth * 2 - 2,
        backgroundColor: isMonster ? '#7f1d1d' : color,
      }}
    >
      {isMonster ? <Skull size={10} className="text-red-300" /> : <User size={10} className="text-gray-300" />}
    </div>
  );

  if (hpPct === undefined) {
    // Pas de barre, juste le token simple
    return (
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <div
          className="rounded-full overflow-hidden border border-gray-700"
          style={{ width: size, height: size }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} draggable={false} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: isMonster ? '#7f1d1d' : color }}
            >
              {isMonster ? <Skull size={10} className="text-red-300" /> : <User size={10} className="text-gray-300" />}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Cercle barre de vie SVG */}
      <svg
        width={size}
        height={size}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track gris */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#374151"
          strokeWidth={strokeWidth}
        />
        {/* Arc coloré */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
        />
      </svg>
      {/* Image/icône centrée dans le cercle */}
      <div className="relative z-10 rounded-full overflow-hidden" style={{ width: size - strokeWidth * 2 - 2, height: size - strokeWidth * 2 - 2 }}>
        {inner}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icône dé avec animation spin au clic
// ---------------------------------------------------------------------------
function DiceInitButton({
  onRoll,
  value,
}: {
  onRoll: () => void;
  value: number | null | undefined;
}) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    setSpinning(true);
    onRoll();
    setTimeout(() => setSpinning(false), 500);
  };

  if (value) {
    return (
      <span className="w-8 text-center text-xs font-bold text-amber-300">{value}</span>
    );
  }

  return (
    <button
      onClick={handleClick}
      title="Lancer l'initiative"
      className="shrink-0"
    >
      <img
        src={DICE_ICON_URL}
        alt="dé"
        className={`w-6 h-6 object-contain transition-transform ${spinning ? 'animate-spin' : 'hover:scale-110'}`}
        style={{ animationDuration: '0.4s', animationIterationCount: 1 }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// SpinDiceButton — bouton dé générique avec animation spin au clic
// ---------------------------------------------------------------------------
function SpinDiceButton({
  onRoll,
  title,
  className,
  imgSize = 'w-6 h-6',
}: {
  onRoll: () => void;
  title?: string;
  className?: string;
  imgSize?: string;
}) {
  const [spinning, setSpinning] = useState(false);

  const handleClick = () => {
    setSpinning(true);
    onRoll();
    setTimeout(() => setSpinning(false), 500);
  };

  return (
    <button onClick={handleClick} title={title} className={className ?? 'shrink-0'}>
      <img
        src={DICE_ICON_URL}
        alt="dé"
        className={`${imgSize} object-contain ${spinning ? 'animate-spin' : ''}`}
        style={{ animationDuration: '0.4s', animationIterationCount: 1 }}
      />
    </button>
  );
}


// ---------------------------------------------------------------------------
// PrepParticipantsList
// ---------------------------------------------------------------------------
function PrepParticipantsList({
  playerEntries,
  monsterEntries,
  onUpdateInitiative,
  onRemove,
  onClickMonster,
  selectedMonster,
  loadingDetail,
  onRollDice,
  isDesktop,
  liveTokens,
  onLoadEncounter,
}: {
  playerEntries: CombatPreparationEntry[];
  monsterEntries: CombatPreparationEntry[];
  onUpdateInitiative: (id: string, value: number) => void;
  onRemove: (id: string) => void;
  onClickMonster: (slug?: string) => void;
  selectedMonster: Monster | null;
  loadingDetail: boolean;
  onRollDice?: (data: DiceRollData) => void;
  isDesktop: boolean;
  liveTokens?: TokenLike[];
  onLoadEncounter?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (playerEntries.length === 0 && monsterEntries.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 text-sm flex flex-col items-center gap-3">
        <p>Ajoutez des monstres depuis la recherche</p>
        {onLoadEncounter && (
          <button
            onClick={onLoadEncounter}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-800/40 rounded-lg transition-colors"
          >
            <BookOpen size={12} /> Charger un combat
          </button>
        )}
      </div>
    );
  }

  const handleMonsterClick = (entry: CombatPreparationEntry) => {
    if (isDesktop) {
      onClickMonster(entry.monsterSlug);
    } else {
      if (expandedId === entry.id) {
        setExpandedId(null);
      } else {
        setExpandedId(entry.id);
        onClickMonster(entry.monsterSlug);
      }
    }
  };

  return (
    <div>
      {playerEntries.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Users size={11} className="text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Joueurs</span>
          </div>
          <div className="space-y-1">
            {playerEntries.map((entry) => (
              <PrepRow
                key={entry.id}
                entry={entry}
                onUpdateInitiative={onUpdateInitiative}
                onRemove={onRemove}
                onClick={undefined}
                expanded={false}
                expandedContent={null}
                liveTokens={liveTokens}
              />
            ))}
          </div>
        </div>
      )}

      {monsterEntries.length > 0 && (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Skull size={11} className="text-red-400" />
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Monstres</span>
          </div>
          <div className="space-y-1">
            {monsterEntries.map((entry) => (
              <PrepRow
                key={entry.id}
                entry={entry}
                onUpdateInitiative={onUpdateInitiative}
                onRemove={onRemove}
                onClick={() => handleMonsterClick(entry)}
                expanded={!isDesktop && expandedId === entry.id}
                expandedContent={
                  !isDesktop && expandedId === entry.id ? (
                    loadingDetail ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 size={18} className="animate-spin mr-2" />
                      </div>
                    ) : selectedMonster ? (
                      <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
                    ) : null
                  ) : null
                }
                liveTokens={liveTokens}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrepRow
// ---------------------------------------------------------------------------
function PrepRow({
  entry,
  onUpdateInitiative,
  onRemove,
  onClick,
  expanded,
  expandedContent,
  liveTokens,
}: {
  entry: CombatPreparationEntry;
  onUpdateInitiative: (id: string, value: number) => void;
  onRemove: (id: string) => void;
  onClick: (() => void) | undefined;
  expanded: boolean;
  expandedContent: React.ReactNode;
  liveTokens?: TokenLike[];
}) {
   const isPlayer = entry.type === 'player';
  const clickable = !!onClick;
  const [spinning, setSpinning] = useState(false);
  const [editingInit, setEditingInit] = useState(false);

  const handleDiceClick = () => {
    setSpinning(true);
    const rolled = Math.floor(Math.random() * 20) + 1;
    onUpdateInitiative(entry.id, rolled);
    setEditingInit(false);
    setTimeout(() => setSpinning(false), 450);
  };

  const hasInitiative = !!entry.initiative && entry.initiative > 0;

  return (
    <div
      className={`rounded-lg transition-colors ${
        isPlayer ? 'bg-gray-800/50 hover:bg-gray-800/70' : 'bg-red-900/20 hover:bg-red-900/30'
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        {/* Avatar token */}
        <TokenAvatar name={entry.name} liveTokens={liveTokens} size={26} isMonster={!isPlayer} />

        {/* Nom */}
        <button
          onClick={onClick}
          disabled={!clickable}
          className={`flex-1 min-w-0 text-left ${clickable ? 'cursor-pointer' : ''}`}
        >
          <span
            className={`text-xs font-medium truncate block ${
              isPlayer ? 'text-white' : 'text-red-300'
            } ${clickable ? 'hover:underline' : ''}`}
          >
            {entry.name}
          </span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
            <Shield size={8} className="text-gray-600" />
            {entry.ac}
            <Heart size={8} className="text-red-700 ml-1" />
            {entry.hp}/{entry.maxHp}
          </span>
        </button>

        {/* Bouton voir stats monstre */}
        {clickable && (
          <button
            onClick={onClick}
            className="p-1 text-gray-500 hover:text-amber-400 transition-colors shrink-0"
            title="Voir les stats"
          >
            <Eye size={11} />
          </button>
        )}

             {/* Initiative : dé cliquable + valeur cliquable pour édition inline */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Dé — toujours visible */}
          <button
            onClick={handleDiceClick}
            title={hasInitiative ? 'Relancer' : "Lancer l'initiative"}
            className={`shrink-0 transition-opacity ${hasInitiative ? 'opacity-40 hover:opacity-100' : ''}`}
          >
            <img
              src={DICE_ICON_URL}
              alt="dé"
              className={`object-contain transition-transform ${
                hasInitiative ? 'w-4 h-4' : 'w-6 h-6 hover:scale-110'
              } ${spinning ? 'animate-spin' : ''}`}
              style={{ animationDuration: '0.4s', animationIterationCount: 1 }}
            />
          </button>

          {/* Valeur : clic → input inline, sinon affichage */}
          {hasInitiative && (
            editingInit ? (
              <input
                type="number"
                min={0}
                max={30}
                autoFocus
                className="w-9 px-1 py-0.5 bg-gray-900 border border-amber-600 rounded text-[10px] text-center text-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                defaultValue={entry.initiative ?? ''}
                onBlur={(e) => {
                  onUpdateInitiative(entry.id, parseInt(e.target.value) || 0);
                  setEditingInit(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onUpdateInitiative(entry.id, parseInt((e.target as HTMLInputElement).value) || 0);
                    setEditingInit(false);
                  }
                  if (e.key === 'Escape') setEditingInit(false);
                }}
              />
            ) : (
              <button
                onClick={() => setEditingInit(true)}
                title="Modifier l'initiative"
                className="w-7 text-center text-xs font-bold text-amber-300 hover:text-amber-100 hover:bg-gray-800 rounded transition-colors px-0.5"
              >
                {entry.initiative}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onRemove(entry.id)}
          className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {expanded && expandedContent && (
        <div className="px-2.5 pb-2">
          {expandedContent}
        </div>
      )}
    </div>
  );
}



// ---------------------------------------------------------------------------
// ConditionBadges
// ---------------------------------------------------------------------------
function ConditionBadges({ conditions, onToggle }: { conditions: string[]; onToggle: (c: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 items-center">
        {conditions.map((c) => (
          <span
            key={c}
            onClick={() => onToggle(c)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-900/30 text-red-300 text-[10px] rounded cursor-pointer hover:bg-red-900/50 border border-red-800/30 transition-colors"
          >
            {c}
            <X size={8} />
          </span>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 rounded transition-colors"
        >
          +
        </button>
      </div>

      {showPicker && (
        <div className="absolute z-20 mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 w-48 max-h-48 overflow-y-auto">
          {DND_CONDITIONS.map((c) => {
            const active = conditions.includes(c);
            return (
              <button
                key={c}
                onClick={() => {
                  onToggle(c);
                  setShowPicker(false);
                }}
                className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                  active ? 'bg-red-900/30 text-red-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {active ? '- ' : '+ '}
                {c}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InitiativeCell — initiative éditable inline dans le combat actif
// ---------------------------------------------------------------------------
// InitiativeCell — combat actif uniquement
// Pas de dé aléatoire : saisie manuelle uniquement.
// - Si pas de valeur : input direct avec placeholder
// - Si valeur présente : clic sur la valeur → input inline
function InitiativeCell({
  participantId,
  value,
  onUpdate,
  canRollDice = false,
}: {
  participantId: string;
  value: number | null | undefined;
  onUpdate: (id: string, value: number) => void;
  canRollDice?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [spinning, setSpinning] = useState(false);

  const hasValue = !!value && value > 0;

  const handleDiceClick = () => {
    setSpinning(true);
    const rolled = Math.floor(Math.random() * 20) + 1;
    onUpdate(participantId, rolled);
    setTimeout(() => setSpinning(false), 450);
  };
  
  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* Dé — visible si canRollDice */}
      {canRollDice && (
        <button
          onClick={handleDiceClick}
          title={hasValue ? 'Relancer l\'initiative' : 'Lancer l\'initiative'}
          className={`shrink-0 transition-opacity ${hasValue ? 'opacity-40 hover:opacity-100' : ''}`}
        >
          <img
            src={DICE_ICON_URL}
            alt="dé"
            className={`object-contain transition-transform ${
              hasValue ? 'w-4 h-4' : 'w-6 h-6 hover:scale-110'
            } ${spinning ? 'animate-spin' : ''}`}
            style={{ animationDuration: '0.4s', animationIterationCount: 1 }}
          />
        </button>
      )}

      {/* Valeur : si présente → cliquable pour édition inline */}
      {hasValue ? (
        editing ? (
          <input
            type="number"
            min={0}
            max={30}
            autoFocus
            className="w-9 px-1 py-0.5 bg-gray-900 border border-amber-600 rounded text-[10px] text-center text-amber-300 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            defaultValue={value ?? ''}
            onBlur={(e) => {
              onUpdate(participantId, parseInt(e.target.value) || 0);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate(participantId, parseInt((e.target as HTMLInputElement).value) || 0);
                setEditing(false);
              }
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Modifier l'initiative"
            className="w-7 text-center text-xs font-bold text-amber-300 hover:text-amber-100 hover:bg-gray-800 rounded transition-colors px-0.5"
          >
            {value}
          </button>
        )
      ) : !canRollDice ? (
        /* Joueur non autorisé à lancer : input manuel direct */
        <input
          type="number"
          min={0}
          max={30}
          className="w-9 px-1 py-0.5 bg-gray-900 border border-gray-700 rounded text-[10px] text-center text-gray-400 focus:border-amber-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="—"
          defaultValue=""
          onBlur={(e) => {
            const v = parseInt(e.target.value);
            if (v > 0) onUpdate(participantId, v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = parseInt((e.target as HTMLInputElement).value);
              if (v > 0) onUpdate(participantId, v);
            }
          }}
        />
      ) : null}
    </div>
  );
}
  
// ---------------------------------------------------------------------------
// ActiveParticipantsList
// ---------------------------------------------------------------------------
function ActiveParticipantsList({
  encounter,
  participants,
  hpDelta,
  setHpDelta,
  onApplyHp,
  onToggleCondition,
  onRemove,
  onViewMonster,
  onViewPlayer,
  onUpdateInitiative,
  selectedMonster,
  loadingDetail,
  onRollDice,
  isDesktop,
  scrollContainerRef,
  vttMode,
  onFocusToken,
  liveTokens,
  role,
  userId,
}: {
  encounter: CampaignEncounter;
  participants: EncounterParticipant[];
  hpDelta: Record<string, string>;
  setHpDelta: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onApplyHp: (p: EncounterParticipant, mode: 'damage' | 'heal') => void;
  onToggleCondition: (p: EncounterParticipant, condition: string) => void;
  onRemove: (id: string) => void;
  onViewMonster: (monsterId?: string) => void;
  onViewPlayer: (memberId?: string) => void;
  onUpdateInitiative: (id: string, value: number) => void;
  selectedMonster: Monster | null;
  loadingDetail: boolean;
  onRollDice?: (data: DiceRollData) => void;
  isDesktop: boolean;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  vttMode?: boolean;
  onFocusToken?: (displayName: string) => void;
  liveTokens?: TokenLike[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const participantRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (participants.length === 0) return;
    const currentParticipant = participants[encounter.current_turn_index];
    if (!currentParticipant) return;

    setExpandedId(null);

    const timer = setTimeout(() => {
      const el = participantRefs.current[currentParticipant.id];
      if (el && scrollContainerRef?.current) {
        const container = scrollContainerRef.current;
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget = container.scrollTop + (elRect.top - containerRect.top);
        container.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [encounter.current_turn_index, participants, scrollContainerRef]);

  if (participants.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 text-sm">
        Ajoutez des participants pour commencer le combat
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800/40">
      {participants.map((p, idx) => {
        const isCurrentTurn = idx === encounter.current_turn_index;
        const isDead = p.current_hp <= 0 && p.max_hp > 0;
        const isMonster = p.participant_type === 'monster';
        const isPlayer = p.participant_type === 'player';
        const clickable = isMonster || (isPlayer && !!p.player_member_id);
        const hasInitiative = !!p.initiative_roll && p.initiative_roll > 0;

        const useInlineExpand = !isDesktop || vttMode;
        const isExpanded = useInlineExpand && expandedId === p.id && isMonster;

        const handleParticipantClick = () => {
          if (!clickable) return;
          onFocusToken?.(p.display_name);
          if (isMonster) {
            if (!useInlineExpand) {
              onViewMonster(p.monster_id);
            } else {
              if (expandedId === p.id) {
                setExpandedId(null);
              } else {
                setExpandedId(p.id);
                onViewMonster(p.monster_id);
              }
            }
          } else if (isPlayer) {
            onViewPlayer(p.player_member_id);
          }
        };

        return (
          <div
            key={p.id}
            ref={(el) => { participantRefs.current[p.id] = el; }}
            className={`px-2 py-2 transition-all ${
              isCurrentTurn
                ? 'bg-amber-900/30 border-l-2 border-l-amber-500'
                : isDead
                  ? 'bg-gray-800/60 opacity-60'
                  : 'hover:bg-gray-800/40'
            }`}
          >
            {/* Ligne principale : avatar | nom+hp | stats | dégâts | initiative */}
            <div className="flex items-center gap-1.5">
                          {/* Avatar avec cercle barre de vie — taille 48px */}
              <div className="shrink-0" onClick={handleParticipantClick} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                <TokenAvatar
                  name={p.display_name}
                  liveTokens={liveTokens}
                  size={48}
                  isMonster={isMonster}
                  hpPct={p.max_hp > 0 ? Math.max(0, Math.min(100, (p.current_hp / p.max_hp) * 100)) : undefined}
                />
              </div>

              {/* Nom seul (barre HP supprimée, remplacée par le cercle SVG) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleParticipantClick}
                    disabled={!clickable}
                    className={`text-xs font-semibold truncate leading-tight ${
                      isDead ? 'text-gray-500 line-through' : isMonster ? 'text-red-400' : 'text-white'
                    } ${clickable ? 'hover:underline cursor-pointer' : ''}`}
                  >
                    {p.display_name}
                  </button>
                  {isDead && <Skull size={10} className="text-gray-500 shrink-0" />}
                </div>
              </div>

              {/* HP / CA compacts */}
              <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                <span className={`flex items-center gap-0.5 ${isDead ? 'text-gray-600' : 'text-gray-300'}`}>
                  <Heart size={9} className={isDead ? 'text-gray-700' : 'text-red-500'} />
                  {p.current_hp}
                  {(p.temporary_hp || 0) > 0 && <span className="text-cyan-400">+{p.temporary_hp}</span>}
                </span>
                <span className="text-gray-600">|</span>
                <span className="flex items-center gap-0.5 text-gray-400">
                  <Shield size={9} className="text-gray-500" />
                  {p.armor_class}
                </span>
              </div>

              {/* Zone dégâts */}
              <div className="flex items-center gap-0.5 shrink-0">
                <input
                  type="number"
                  className="w-9 h-6 px-0.5 bg-black/40 border border-gray-700 rounded text-[10px] text-center text-gray-200 focus:border-red-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={hpDelta[p.id] || ''}
                  onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') onApplyHp(p, 'damage'); }}
                />
                <button
                  onClick={() => onApplyHp(p, 'damage')}
                  className="w-5 h-6 flex items-center justify-center text-red-500 hover:bg-red-900/30 rounded transition-colors"
                  title="Dégâts"
                >
                  <Minus size={10} />
                </button>
                <button
                  onClick={() => onApplyHp(p, 'heal')}
                  className="w-5 h-6 flex items-center justify-center text-green-500 hover:bg-green-900/30 rounded transition-colors"
                  title="Soins"
                >
                  <Plus size={10} />
                </button>
              </div>

              {/* Initiative éditable inline */}
              <InitiativeCell
                participantId={p.id}
                value={p.initiative_roll}
                onUpdate={onUpdateInitiative}
              />

              {/* Supprimer */}
              <button
                onClick={() => onRemove(p.id)}
                className="w-5 h-5 flex items-center justify-center text-gray-700 hover:text-red-400 rounded transition-colors shrink-0"
                title="Supprimer"
              >
                <Trash2 size={10} />
              </button>
            </div>

            {/* Conditions */}
            {(p.conditions?.length > 0 || isCurrentTurn) && (
              <div className="mt-1 ml-9">
                <ConditionBadges conditions={p.conditions || []} onToggle={(c) => onToggleCondition(p, c)} />
              </div>
            )}

            {p.conditions?.includes('Concentration') && isCurrentTurn && (
              <div className="mt-0.5 ml-9 flex items-center gap-1 text-[10px] text-amber-400">
                <AlertTriangle size={9} />
                Concentration active
              </div>
            )}

            {/* Bloc statblock expandé */}
            {isExpanded && (
              <div className="mt-2 ml-0">
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 size={18} className="animate-spin mr-2" />
                  </div>
                ) : selectedMonster ? (
                  <div className="monster-statblock-wrapper">
                    <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}