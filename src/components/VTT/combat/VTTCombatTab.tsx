import { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Plus,
  Search,
  BookOpen,
  Loader2,
  ArrowLeft,
  Users,
  Skull,
  Save,
  Trash2,
  X,
  Dices,
  Shield,
  Heart,
  User,
  SkipForward,
  Square,
  Minus,
  Eye,
  AlertTriangle,
  Upload,
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

type VTTCombatTabProps = CombatTabProps & {
  autoFocusCombatTurn?: boolean;
  onFocusCombatTokenByLabel?: (displayName: string) => void;
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
}: VTTCombatTabProps) {
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
      <div className="space-y-3 border-b border-gray-800 px-3 py-3">
        {isGM && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                if (!mobileSearchOpen) setPanelView('search');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                mobileSearchOpen && panelView === 'search'
                  ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Search size={12} /> Ajouter monstres
            </button>

            <button
              onClick={() => {
                setEditingMonster(null);
                setShowCustomModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <Plus size={12} /> Créer monstre
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <Upload size={12} /> Importer
            </button>

            <button
              onClick={() => setShowLoadEncounterModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <BookOpen size={12} /> Charger
            </button>
          </div>
        )}

        {mobileSearchOpen && isGM && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/80 overflow-hidden">
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

      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-3 border-b border-gray-800 space-y-2">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isActive ? 'bg-red-600/40' : 'bg-red-900/30'
            }`}>
              <Swords size={16} className="text-red-400" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <span className="truncate">{isActive ? encounter.name : 'Préparation du combat'}</span>
                {isActive && (
                  <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded whitespace-nowrap shrink-0 border border-gray-700">
                    Round {encounter.round_number}
                  </span>
                )}
              </h3>

              <p className="text-[11px] text-gray-500">
                {isActive
                  ? `${participants.length} participant${participants.length > 1 ? 's' : ''}`
                  : `${prepEntries.length} participant${prepEntries.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {isGM && (
            <div className="flex gap-1.5 w-full">
              {isActive ? (
                <>
                  <button
                    onClick={handleRollMonsterInitiativeActive}
                    className="flex items-center justify-center p-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs rounded-lg border border-gray-700 transition-colors"
                    title="Relancer l'initiative des monstres"
                  >
                    <Dices size={12} />
                  </button>

                  <button
                    onClick={handleNextTurn}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                  >
                    <SkipForward size={12} className="shrink-0" /> Suivant
                  </button>

                  <button
                    onClick={handleSaveEncounter}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                  >
                    <Save size={12} className="shrink-0" /> Sauver
                  </button>

                  <button
                    onClick={handleEndCombat}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg border border-red-800/50 transition-colors"
                  >
                    <Square size={12} className="shrink-0" /> Fin
                  </button>
                </>
              ) : (
                <button
                  onClick={handleRollAllInitiative}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/40 transition-colors"
                >
                  <Dices size={12} /> Initiatives
                </button>
              )}
            </div>
          )}
        </div>

        {!isActive && isGM && (
          <div className="px-4 py-2 border-b border-gray-800">
            <input
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none"
              placeholder="Nom du combat (optionnel)"
              value={encounterName}
              onChange={(e) => setEncounterName(e.target.value)}
            />
          </div>
        )}

        {isActive && isGM && (
          <div className="px-4 py-2 border-b border-gray-800 space-y-2">
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
                      />
          ) : isGM ? (
            <PrepParticipantsList
              playerEntries={playerPrep}
              monsterEntries={monsterPrep}
              onUpdateInitiative={handleUpdatePrepInitiative}
              onRemove={handleRemovePrepEntry}
              onClickMonster={viewMonsterBySlug}
              selectedMonster={selectedMonster}
              loadingDetail={loadingDetail}
              onRollDice={onRollDice}
              isDesktop={isDesktop}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
              <Swords size={28} className="text-gray-600" />
              <p className="text-sm text-gray-400">Aucun combat en cours.</p>
              <p className="text-xs text-gray-600">Le Maître de Jeu n'a pas encore lancé de combat.</p>
            </div>
          )}
        </div>

        {!isActive && isGM && (
          <div className="px-4 py-3 border-t border-gray-800 space-y-2">
            <button
              onClick={handleLaunchCombat}
              disabled={prepEntries.length === 0 || launching}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {launching ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
              Lancer le combat
            </button>

            <button
              onClick={handleSavePreparation}
              disabled={prepEntries.length === 0 || launching}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-900/40 hover:bg-blue-900/60 disabled:bg-gray-700 disabled:text-gray-500 text-blue-300 font-medium rounded-lg border border-blue-800/50 transition-colors text-sm"
            >
              <Save size={14} />
              Sauvegarder pour plus tard
            </button>
          </div>
        )}
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
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (playerEntries.length === 0 && monsterEntries.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-gray-500 text-sm">
        Ajoutez des monstres depuis la recherche
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
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Users size={12} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Joueurs</span>
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
              />
            ))}
          </div>
        </div>
      )}

      {monsterEntries.length > 0 && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <Skull size={12} className="text-red-400" />
            <span className="text-xs font-semibold text-red-300 uppercase tracking-wider">Monstres</span>
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrepRow({
  entry,
  onUpdateInitiative,
  onRemove,
  onClick,
  expanded,
  expandedContent,
}: {
  entry: CombatPreparationEntry;
  onUpdateInitiative: (id: string, value: number) => void;
  onRemove: (id: string) => void;
  onClick: (() => void) | undefined;
  expanded: boolean;
  expandedContent: React.ReactNode;
}) {
  const isPlayer = entry.type === 'player';
  const clickable = !!onClick;

  return (
    <div className={`rounded-lg transition-colors ${
      isPlayer ? 'bg-gray-800/50 hover:bg-gray-800/70' : 'bg-red-900/20 hover:bg-red-900/30'
    }`}>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          isPlayer ? 'bg-gray-800' : 'bg-red-900/40'
        }`}>
          {isPlayer ? (
            <User size={11} className="text-gray-400" />
          ) : (
            <Skull size={11} className="text-red-400" />
          )}
        </div>

        <button
          onClick={onClick}
          disabled={!clickable}
          className={`flex-1 min-w-0 text-left ${clickable ? 'cursor-pointer' : ''}`}
        >
          <span className={`text-sm font-medium truncate block ${
            isPlayer ? 'text-white' : 'text-red-300'
          } ${clickable ? 'hover:underline' : ''}`}>
            {entry.name}
          </span>
        </button>

        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-0.5">
            <Shield size={10} className="text-gray-500" />
            {entry.ac}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={10} className="text-red-500" />
            {entry.hp}/{entry.maxHp}
          </span>
        </div>

        {clickable && (
          <button
            onClick={onClick}
            className="p-1 text-gray-500 hover:text-amber-400 transition-colors shrink-0"
            title="Voir les stats"
          >
            <Eye size={12} />
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <label className="text-[10px] text-gray-500">Init:</label>
          <input
            type="number"
            min={0}
            max={30}
            className="w-12 px-1.5 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-center text-gray-200 focus:border-amber-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={entry.initiative || ''}
            onChange={(e) => onUpdateInitiative(entry.id, parseInt(e.target.value) || 0)}
          />
        </div>

        <button
          onClick={() => onRemove(entry.id)}
          className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors shrink-0"
        >
          <Trash2 size={12} />
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

function HpBar({ current, max, temp = 0 }: { current: number; max: number; temp?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const tempPct = max > 0 ? Math.max(0, Math.min(100 - pct, (temp / max) * 100)) : 0;

  let color = 'bg-emerald-500';
  if (pct <= 25) color = 'bg-red-500';
  else if (pct <= 50) color = 'bg-amber-500';

  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
      <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      {temp > 0 && (
        <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${tempPct}%` }} />
      )}
    </div>
  );
}

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
    <div className="divide-y divide-gray-800/50">
      {participants.map((p, idx) => {
        const isCurrentTurn = idx === encounter.current_turn_index;
        const isDead = p.current_hp <= 0 && p.max_hp > 0;
        const isMonster = p.participant_type === 'monster';
        const isPlayer = p.participant_type === 'player';
        const clickable = isMonster || (isPlayer && !!p.player_member_id);

        const useInlineExpand = !isDesktop || vttMode;
        const isExpanded = useInlineExpand && expandedId === p.id && isMonster;

        const handleParticipantClick = () => {
          if (!clickable) return;

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
            ref={(el) => {
              participantRefs.current[p.id] = el;
            }}
            className={`px-3 py-2.5 transition-all ${
              isCurrentTurn
                ? 'bg-amber-900/30 border-l-2 border-l-amber-500'
                : isDead
                  ? 'bg-gray-800 opacity-60'
                  : 'hover:bg-gray-800/50'
            }`}
          >
            <div className="flex items-start gap-2">
              <input
                type="number"
                min={0}
                max={30}
                className="w-8 h-7 px-0 py-0 bg-black/30 border border-gray-700 rounded text-[11px] text-center text-gray-300 focus:border-amber-600 focus:outline-none shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={p.initiative_roll || ''}
                onChange={(e) => onUpdateInitiative(p.id, parseInt(e.target.value) || 0)}
                title="Initiative"
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleParticipantClick}
                    disabled={!clickable}
                    className={`text-sm font-medium truncate ${
                      isDead ? 'text-gray-500 line-through' : isMonster ? 'text-red-400' : 'text-white'
                    } ${clickable ? 'hover:underline cursor-pointer' : ''}`}
                  >
                    {p.display_name}
                  </button>

                  {isDead && <Skull size={12} className="text-gray-500 shrink-0" />}

                  {isMonster && clickable && (
                    <button
                      onClick={handleParticipantClick}
                      className="text-gray-500 hover:text-gray-300 transition-colors shrink-0"
                      title="Voir les stats"
                    >
                      <Eye size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-xs">
                    <Heart size={10} className={isDead ? 'text-gray-600' : 'text-red-500'} />
                    <span className={isDead ? 'text-gray-600' : 'text-gray-400'}>
                      {p.current_hp}/{p.max_hp}
                      {(p.temporary_hp || 0) > 0 && <span className="text-gray-300"> +{p.temporary_hp}</span>}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs">
                    <Shield size={10} className="text-gray-500" />
                    <span className="text-gray-400">{p.armor_class}</span>
                  </div>

                  {!vttMode && (
                    <div className="flex-1">
                      <HpBar current={p.current_hp} max={p.max_hp} temp={p.temporary_hp || 0} />
                    </div>
                  )}
                </div>

                {vttMode && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <input
                      type="number"
                      className="w-12 px-1 py-1 bg-black/30 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-red-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                      value={hpDelta[p.id] || ''}
                      onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onApplyHp(p, 'damage');
                      }}
                    />

                    <button
                      onClick={() => onApplyHp(p, 'damage')}
                      className="p-1 text-red-500 hover:bg-red-900/30 rounded transition-colors"
                      title="Degats"
                    >
                      <Minus size={12} />
                    </button>

                    <button
                      onClick={() => onApplyHp(p, 'heal')}
                      className="p-1 text-green-500 hover:bg-green-900/30 rounded transition-colors"
                      title="Soins"
                    >
                      <Plus size={12} />
                    </button>

                    <button
                      onClick={() => onRemove(p.id)}
                      className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {!vttMode && (
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <input
                    type="number"
                    className="w-12 px-1 py-1 bg-black/30 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-red-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    value={hpDelta[p.id] || ''}
                    onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onApplyHp(p, 'damage');
                    }}
                  />

                  <button
                    onClick={() => onApplyHp(p, 'damage')}
                    className="p-1 text-red-500 hover:bg-red-900/30 rounded transition-colors"
                    title="Degats"
                  >
                    <Minus size={12} />
                  </button>

                  <button
                    onClick={() => onApplyHp(p, 'heal')}
                    className="p-1 text-green-500 hover:bg-green-900/30 rounded transition-colors"
                    title="Soins"
                  >
                    <Plus size={12} />
                  </button>

                  <button
                    onClick={() => onRemove(p.id)}
                    className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            {(p.conditions?.length > 0 || isCurrentTurn) && (
              <div className="mt-1.5 ml-10">
                <ConditionBadges conditions={p.conditions || []} onToggle={(c) => onToggleCondition(p, c)} />
              </div>
            )}

            {p.conditions?.includes('Concentration') && isCurrentTurn && (
              <div className="mt-1 ml-10 flex items-center gap-1 text-[10px] text-amber-400">
                <AlertTriangle size={10} />
                Concentration active
              </div>
            )}

            {isExpanded && (
              <div className="mt-2 ml-0 sm:ml-10">
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