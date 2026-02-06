import { useState, useEffect, useCallback } from 'react';
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
  Edit3,
  Trash2,
  X,
  Dices,
  Shield,
  Heart,
  Minus,
  User,
} from 'lucide-react';
import {
  CampaignMember,
  CampaignEncounter,
  EncounterParticipant,
  Monster,
  MonsterListItem,
} from '../../../types/campaign';
import { monsterService } from '../../../services/monsterService';
import { MonsterSearch, SelectedMonsterEntry } from '../../Combat/MonsterSearch';
import { MonsterStatBlock } from '../../Combat/MonsterStatBlock';
import { CustomMonsterModal } from '../../Combat/CustomMonsterModal';
import { InitiativeTracker } from '../../Combat/InitiativeTracker';
import toast from 'react-hot-toast';

interface CombatTabProps {
  campaignId: string;
  members: CampaignMember[];
  onReload: () => void;
}

interface CombatPreparationEntry {
  id: string;
  type: 'player' | 'monster';
  name: string;
  memberId?: string;
  monsterSlug?: string;
  hp: number;
  ac: number;
  initiative: number;
}

type PanelView = 'search' | 'detail' | 'saved';

let prepIdCounter = 0;

export function CombatTab({ campaignId, members }: CombatTabProps) {
  const [encounter, setEncounter] = useState<CampaignEncounter | null>(null);
  const [participants, setParticipants] = useState<EncounterParticipant[]>([]);
  const [savedMonsters, setSavedMonsters] = useState<Monster[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelView, setPanelView] = useState<PanelView>('search');
  const [selectedMonster, setSelectedMonster] = useState<Monster | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editingMonster, setEditingMonster] = useState<Monster | null>(null);
  const [addCount, setAddCount] = useState(1);

  const [prepEntries, setPrepEntries] = useState<CombatPreparationEntry[]>([]);
  const [encounterName, setEncounterName] = useState('');
  const [launching, setLaunching] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [enc, monsters] = await Promise.all([
        monsterService.getActiveEncounter(campaignId),
        monsterService.getCampaignMonsters(campaignId),
      ]);
      setEncounter(enc);
      setSavedMonsters(monsters);

      if (enc) {
        const parts = await monsterService.getEncounterParticipants(enc.id);
        setParticipants(parts);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur chargement combat');
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!encounter && members.length > 0 && prepEntries.length === 0) {
      const playerEntries: CombatPreparationEntry[] = members.map((m) => ({
        id: `prep-player-${m.id}`,
        type: 'player' as const,
        name: m.player_name || m.email || 'Joueur',
        memberId: m.id,
        hp: 0,
        ac: 10,
        initiative: 0,
      }));
      setPrepEntries(playerEntries);
    }
  }, [encounter, members]);

  const handleAddMonstersFromSearch = async (entries: SelectedMonsterEntry[]) => {
    const newEntries: CombatPreparationEntry[] = [];

    for (const entry of entries) {
      try {
        const detail = await monsterService.fetchMonsterDetail(entry.monster.slug);

        let existing = savedMonsters.find((m) => m.slug === entry.monster.slug);
        if (!existing) {
          existing = await monsterService.saveToCampaign(campaignId, detail);
          setSavedMonsters((prev) => [...prev, existing!]);
        }

        for (let i = 0; i < entry.quantity; i++) {
          prepIdCounter++;
          newEntries.push({
            id: `prep-monster-${prepIdCounter}`,
            type: 'monster',
            name: entry.quantity > 1 ? `${detail.name} ${i + 1}` : detail.name,
            monsterSlug: detail.slug,
            hp: detail.hit_points,
            ac: detail.armor_class,
            initiative: 0,
          });
        }
      } catch (err) {
        console.error(err);
        toast.error(`Impossible de charger ${entry.monster.name}`);
      }
    }

    setPrepEntries((prev) => [...prev, ...newEntries]);
    const totalAdded = newEntries.length;
    if (totalAdded > 0) {
      toast.success(`${totalAdded} monstre${totalAdded > 1 ? 's' : ''} ajoute${totalAdded > 1 ? 's' : ''}`);
    }
  };

  const handleAddSavedMonsterToPrep = (monster: Monster, count: number) => {
    const newEntries: CombatPreparationEntry[] = [];
    for (let i = 0; i < count; i++) {
      prepIdCounter++;
      newEntries.push({
        id: `prep-monster-${prepIdCounter}`,
        type: 'monster',
        name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
        monsterSlug: monster.slug,
        hp: monster.hit_points,
        ac: monster.armor_class,
        initiative: 0,
      });
    }
    setPrepEntries((prev) => [...prev, ...newEntries]);
    toast.success(`${count}x ${monster.name} ajoute${count > 1 ? 's' : ''}`);
  };

  const handleRemovePrepEntry = (id: string) => {
    setPrepEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdatePrepInitiative = (id: string, value: number) => {
    setPrepEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, initiative: value } : e))
    );
  };

  const handleRollAllInitiative = () => {
    setPrepEntries((prev) =>
      prev.map((e) => ({
        ...e,
        initiative: Math.floor(Math.random() * 20) + 1,
      }))
    );
  };

  const handleLaunchCombat = async () => {
    if (prepEntries.length === 0) {
      toast.error('Ajoutez des participants avant de lancer le combat');
      return;
    }

    try {
      setLaunching(true);
      const name = encounterName.trim() || 'Combat';
      const enc = await monsterService.createEncounter(campaignId, name);

      const sorted = [...prepEntries].sort((a, b) => b.initiative - a.initiative);

      const participantData = sorted.map((entry, i) => {
        const isMonster = entry.type === 'monster';
        const monster = isMonster
          ? savedMonsters.find((m) => m.slug === entry.monsterSlug)
          : null;

        return {
          encounter_id: enc.id,
          participant_type: entry.type as 'player' | 'monster',
          monster_id: monster?.id || undefined,
          player_member_id: entry.memberId || undefined,
          display_name: entry.name,
          initiative_roll: entry.initiative,
          current_hp: entry.hp,
          max_hp: entry.hp,
          armor_class: entry.ac,
          conditions: [] as string[],
          sort_order: i,
          is_active: true,
          notes: '',
        };
      });

      const added = await monsterService.addParticipants(participantData);
      setEncounter(enc);
      setParticipants(added);
      setPrepEntries([]);
      setEncounterName('');
      toast.success('Combat lance !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur creation combat');
    } finally {
      setLaunching(false);
    }
  };

  const handleEndCombat = async () => {
    if (!encounter) return;
    try {
      await monsterService.endEncounter(encounter.id);
      setEncounter(null);
      setParticipants([]);
      const playerEntries: CombatPreparationEntry[] = members.map((m) => ({
        id: `prep-player-${m.id}`,
        type: 'player' as const,
        name: m.player_name || m.email || 'Joueur',
        memberId: m.id,
        hp: 0,
        ac: 10,
        initiative: 0,
      }));
      setPrepEntries(playerEntries);
      toast.success('Combat termine');
    } catch (err) {
      console.error(err);
      toast.error('Erreur fin combat');
    }
  };

  const handleNextTurn = async () => {
    if (!encounter || participants.length === 0) return;
    let nextIdx = encounter.current_turn_index + 1;
    let newRound = encounter.round_number;
    if (nextIdx >= participants.length) {
      nextIdx = 0;
      newRound += 1;
    }
    try {
      const updated = await monsterService.updateEncounter(encounter.id, {
        current_turn_index: nextIdx,
        round_number: newRound,
      });
      setEncounter(updated);
    } catch (err) {
      console.error(err);
      toast.error('Erreur tour suivant');
    }
  };

  const handleSelectMonsterFromSearch = async (item: MonsterListItem) => {
    try {
      setLoadingDetail(true);
      setPanelView('detail');
      const detail = await monsterService.fetchMonsterDetail(item.slug);
      setSelectedMonster(detail);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger ce monstre');
      setPanelView('search');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveMonster = async (monster: Monster) => {
    try {
      if (monster.id) {
        await monsterService.updateCampaignMonster(monster.id, monster);
        toast.success('Monstre mis a jour');
      } else {
        await monsterService.saveToCampaign(campaignId, monster);
        toast.success('Monstre sauvegarde');
      }
      const monsters = await monsterService.getCampaignMonsters(campaignId);
      setSavedMonsters(monsters);
      setShowCustomModal(false);
      setEditingMonster(null);
    } catch (err) {
      console.error(err);
      toast.error('Erreur sauvegarde');
    }
  };

  const handleDeleteMonster = async (id: string) => {
    try {
      await monsterService.deleteCampaignMonster(id);
      setSavedMonsters((prev) => prev.filter((m) => m.id !== id));
      toast.success('Monstre supprime');
    } catch (err) {
      console.error(err);
      toast.error('Erreur suppression');
    }
  };

  const handleUpdateParticipant = async (
    id: string,
    updates: Partial<EncounterParticipant>
  ) => {
    try {
      const updated = await monsterService.updateParticipant(id, updates);
      setParticipants((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveParticipant = async (id: string) => {
    try {
      await monsterService.removeParticipant(id);
      setParticipants((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewMonster = (monsterId: string) => {
    const monster = savedMonsters.find((m) => m.id === monsterId);
    if (monster) {
      setSelectedMonster(monster);
      setPanelView('detail');
    }
  };

  const handleSortByInitiative = async () => {
    if (!encounter) return;
    const sorted = [...participants].sort((a, b) => b.initiative_roll - a.initiative_roll);
    const ids = sorted.map((p) => p.id);
    try {
      await monsterService.reorderParticipants(encounter.id, ids);
      setParticipants(sorted.map((p, i) => ({ ...p, sort_order: i })));
      await monsterService.updateEncounter(encounter.id, { current_turn_index: 0 });
      setEncounter((prev) => prev ? { ...prev, current_turn_index: 0 } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddMonsterToEncounter = async (monster: Monster, count: number) => {
    if (!encounter) return;
    try {
      let saved = monster;
      if (!monster.id) {
        saved = await monsterService.saveToCampaign(campaignId, monster);
        const monsters = await monsterService.getCampaignMonsters(campaignId);
        setSavedMonsters(monsters);
      }
      const newParticipants = [];
      for (let i = 0; i < count; i++) {
        const label = count > 1 ? `${monster.name} ${i + 1}` : monster.name;
        newParticipants.push({
          encounter_id: encounter.id,
          participant_type: 'monster' as const,
          monster_id: saved.id!,
          player_member_id: undefined,
          display_name: label,
          initiative_roll: 0,
          current_hp: monster.hit_points,
          max_hp: monster.hit_points,
          armor_class: monster.armor_class,
          conditions: [] as string[],
          sort_order: participants.length + i,
          is_active: true,
          notes: '',
        });
      }
      const added = await monsterService.addParticipants(newParticipants);
      setParticipants((prev) => [...prev, ...added]);
      setAddCount(1);
      toast.success(`${count > 1 ? count + 'x ' : ''}${monster.name} ajoute(s)`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur ajout au combat');
    }
  };

  const handleAddPlayersToEncounter = async () => {
    if (!encounter) return;
    try {
      const existingNames = new Set(participants.map((p) => p.display_name));
      const newParticipants = members
        .filter((m) => !existingNames.has(m.player_name || m.email || ''))
        .map((m, i) => ({
          encounter_id: encounter.id,
          participant_type: 'player' as const,
          monster_id: undefined,
          player_member_id: m.id,
          display_name: m.player_name || m.email || 'Joueur',
          initiative_roll: 0,
          current_hp: 0,
          max_hp: 0,
          armor_class: 10,
          conditions: [] as string[],
          sort_order: participants.length + i,
          is_active: true,
          notes: '',
        }));
      if (newParticipants.length === 0) {
        toast('Tous les joueurs sont deja dans le combat');
        return;
      }
      const added = await monsterService.addParticipants(newParticipants);
      setParticipants((prev) => [...prev, ...added]);
      toast.success(`${newParticipants.length} joueur(s) ajoute(s)`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur ajout joueurs');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-3" />
        Chargement...
      </div>
    );
  }

  if (encounter) {
    return (
      <ActiveCombatView
        encounter={encounter}
        participants={participants}
        savedMonsters={savedMonsters}
        panelView={panelView}
        setPanelView={setPanelView}
        selectedMonster={selectedMonster}
        setSelectedMonster={setSelectedMonster}
        loadingDetail={loadingDetail}
        addCount={addCount}
        setAddCount={setAddCount}
        showCustomModal={showCustomModal}
        setShowCustomModal={setShowCustomModal}
        editingMonster={editingMonster}
        setEditingMonster={setEditingMonster}
        onNextTurn={handleNextTurn}
        onEndCombat={handleEndCombat}
        onUpdateParticipant={handleUpdateParticipant}
        onRemoveParticipant={handleRemoveParticipant}
        onViewMonster={handleViewMonster}
        onSortByInitiative={handleSortByInitiative}
        onAddPlayersToEncounter={handleAddPlayersToEncounter}
        onSelectMonsterFromSearch={handleSelectMonsterFromSearch}
        onSaveMonster={handleSaveMonster}
        onDeleteMonster={handleDeleteMonster}
        onAddMonsterToEncounter={handleAddMonsterToEncounter}
      />
    );
  }

  const playerEntries = prepEntries.filter((e) => e.type === 'player');
  const monsterEntries = prepEntries.filter((e) => e.type === 'monster');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-gray-800 pb-2">
          <button
            onClick={() => setPanelView('search')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              panelView === 'search'
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search size={12} className="inline mr-1" /> Chercher AideDD
          </button>
          <button
            onClick={() => setPanelView('saved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              panelView === 'saved'
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <BookOpen size={12} className="inline mr-1" /> Bestiaire ({savedMonsters.length})
          </button>
          <button
            onClick={() => { setEditingMonster(null); setShowCustomModal(true); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
          >
            <Plus size={12} className="inline mr-1" /> Custom
          </button>
        </div>

        {panelView === 'search' && (
          <MonsterSearch
            selectionMode
            onAddToCombat={handleAddMonstersFromSearch}
            onSelect={handleSelectMonsterFromSearch}
          />
        )}

        {panelView === 'detail' && (
          <div className="space-y-3">
            <button
              onClick={() => setPanelView('search')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={12} /> Retour
            </button>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
              </div>
            ) : selectedMonster ? (
              <div className="space-y-3">
                <MonsterStatBlock monster={selectedMonster} />
                <div className="flex gap-2">
                  {!selectedMonster.id && (
                    <button
                      onClick={() => handleSaveMonster(selectedMonster)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Save size={14} /> Sauvegarder
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleAddSavedMonsterToPrep(selectedMonster, 1);
                      setPanelView('search');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Swords size={14} /> Ajouter au combat
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {panelView === 'saved' && (
          <div className="space-y-1">
            {savedMonsters.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Aucun monstre sauvegarde
              </div>
            ) : (
              savedMonsters.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-800/50 transition-colors group"
                >
                  <button
                    onClick={() => { setSelectedMonster(m); setPanelView('detail'); }}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="text-sm font-medium text-gray-200 group-hover:text-amber-200 truncate">
                      {m.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      FP {m.challenge_rating} | CA {m.armor_class} | PV {m.hit_points}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleAddSavedMonsterToPrep(m, 1)}
                      className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 transition-colors"
                    >
                      + Combat
                    </button>
                    {m.source === 'custom' && (
                      <button
                        onClick={() => { setEditingMonster(m); setShowCustomModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit3 size={12} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMonster(m.id!)}
                      className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {showCustomModal && (
          <CustomMonsterModal
            onClose={() => { setShowCustomModal(false); setEditingMonster(null); }}
            onSave={handleSaveMonster}
            editMonster={editingMonster}
          />
        )}
      </div>

      <div className="space-y-4">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-900/30 rounded-lg flex items-center justify-center">
                <Swords size={16} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Preparation du combat</h3>
                <p className="text-[11px] text-gray-500">{prepEntries.length} participant{prepEntries.length > 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={handleRollAllInitiative}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/40 transition-colors"
              title="Lancer l'initiative pour tous"
            >
              <Dices size={12} /> Initiatives
            </button>
          </div>

          <div className="px-4 py-2">
            <input
              className="w-full px-3 py-2 bg-black/30 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none"
              placeholder="Nom du combat (optionnel)"
              value={encounterName}
              onChange={(e) => setEncounterName(e.target.value)}
            />
          </div>

          {playerEntries.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-2">
                <Users size={12} className="text-sky-400" />
                <span className="text-xs font-semibold text-sky-300 uppercase tracking-wider">Joueurs</span>
              </div>
              <div className="space-y-1">
                {playerEntries.map((entry) => (
                  <PrepEntryRow
                    key={entry.id}
                    entry={entry}
                    onUpdateInitiative={handleUpdatePrepInitiative}
                    onRemove={handleRemovePrepEntry}
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
                  <PrepEntryRow
                    key={entry.id}
                    entry={entry}
                    onUpdateInitiative={handleUpdatePrepInitiative}
                    onRemove={handleRemovePrepEntry}
                  />
                ))}
              </div>
            </div>
          )}

          {prepEntries.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              Ajoutez des monstres depuis la recherche
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-800">
            <button
              onClick={handleLaunchCombat}
              disabled={prepEntries.length === 0 || launching}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {launching ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Swords size={16} />
              )}
              Lancer le combat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrepEntryRow({
  entry,
  onUpdateInitiative,
  onRemove,
}: {
  entry: CombatPreparationEntry;
  onUpdateInitiative: (id: string, value: number) => void;
  onRemove: (id: string) => void;
}) {
  const isPlayer = entry.type === 'player';

  return (
    <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
      isPlayer ? 'bg-sky-900/10 hover:bg-sky-900/20' : 'bg-red-900/10 hover:bg-red-900/20'
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
        isPlayer ? 'bg-sky-900/40' : 'bg-red-900/40'
      }`}>
        {isPlayer ? (
          <User size={11} className="text-sky-400" />
        ) : (
          <Skull size={11} className="text-red-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span className={`text-sm font-medium truncate block ${
          isPlayer ? 'text-sky-200' : 'text-red-200'
        }`}>
          {entry.name}
        </span>
      </div>

      {!isPlayer && (
        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-0.5">
            <Shield size={10} className="text-gray-500" />
            {entry.ac}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart size={10} className="text-red-500" />
            {entry.hp}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 shrink-0">
        <label className="text-[10px] text-gray-500">Init:</label>
        <input
          type="number"
          min={0}
          max={30}
          className="w-12 px-1.5 py-1 bg-black/40 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-amber-600 focus:outline-none"
          value={entry.initiative || ''}
          onChange={(e) => onUpdateInitiative(entry.id, parseInt(e.target.value) || 0)}
        />
      </div>

      <button
        onClick={() => onRemove(entry.id)}
        className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function ActiveCombatView({
  encounter,
  participants,
  savedMonsters,
  panelView,
  setPanelView,
  selectedMonster,
  setSelectedMonster,
  loadingDetail,
  addCount,
  setAddCount,
  showCustomModal,
  setShowCustomModal,
  editingMonster,
  setEditingMonster,
  onNextTurn,
  onEndCombat,
  onUpdateParticipant,
  onRemoveParticipant,
  onViewMonster,
  onSortByInitiative,
  onAddPlayersToEncounter,
  onSelectMonsterFromSearch,
  onSaveMonster,
  onDeleteMonster,
  onAddMonsterToEncounter,
}: {
  encounter: CampaignEncounter;
  participants: EncounterParticipant[];
  savedMonsters: Monster[];
  panelView: PanelView;
  setPanelView: (v: PanelView) => void;
  selectedMonster: Monster | null;
  setSelectedMonster: (m: Monster | null) => void;
  loadingDetail: boolean;
  addCount: number;
  setAddCount: (n: number) => void;
  showCustomModal: boolean;
  setShowCustomModal: (v: boolean) => void;
  editingMonster: Monster | null;
  setEditingMonster: (m: Monster | null) => void;
  onNextTurn: () => void;
  onEndCombat: () => void;
  onUpdateParticipant: (id: string, updates: Partial<EncounterParticipant>) => void;
  onRemoveParticipant: (id: string) => void;
  onViewMonster: (monsterId: string) => void;
  onSortByInitiative: () => void;
  onAddPlayersToEncounter: () => void;
  onSelectMonsterFromSearch: (item: MonsterListItem) => void;
  onSaveMonster: (monster: Monster) => void;
  onDeleteMonster: (id: string) => void;
  onAddMonsterToEncounter: (monster: Monster, count: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <InitiativeTracker
          encounter={encounter}
          participants={participants}
          onNextTurn={onNextTurn}
          onEndCombat={onEndCombat}
          onUpdateParticipant={onUpdateParticipant}
          onRemoveParticipant={onRemoveParticipant}
          onViewMonster={onViewMonster}
        />
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={onAddPlayersToEncounter}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 text-xs font-medium rounded-lg border border-sky-800/40 transition-colors"
            >
              <Users size={12} /> Ajouter joueurs
            </button>
            <button
              onClick={onSortByInitiative}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/40 transition-colors"
            >
              Trier par initiative
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Nb:</label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-14 px-2 py-1.5 bg-black/40 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-amber-600 focus:outline-none"
              value={addCount}
              onChange={(e) => setAddCount(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <div className="flex gap-1 flex-1 overflow-x-auto">
              {savedMonsters.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  onClick={() => onAddMonsterToEncounter(m, addCount)}
                  className="shrink-0 px-2.5 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs rounded-lg border border-red-800/40 transition-colors truncate max-w-[120px]"
                  title={`Ajouter ${addCount}x ${m.name}`}
                >
                  + {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-3">
        <div className="flex gap-2 border-b border-gray-800 pb-2">
          <button
            onClick={() => setPanelView('search')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              panelView === 'search'
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search size={12} className="inline mr-1" /> Chercher
          </button>
          <button
            onClick={() => setPanelView('saved')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              panelView === 'saved'
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Skull size={12} className="inline mr-1" /> Bestiaire ({savedMonsters.length})
          </button>
          <button
            onClick={() => { setEditingMonster(null); setShowCustomModal(true); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
          >
            <Plus size={12} className="inline mr-1" /> Custom
          </button>
        </div>

        {panelView === 'search' && (
          <MonsterSearch onSelect={onSelectMonsterFromSearch} />
        )}

        {panelView === 'detail' && (
          <div className="space-y-3">
            <button
              onClick={() => setPanelView('search')}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={12} /> Retour
            </button>
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" />
              </div>
            ) : selectedMonster ? (
              <div className="space-y-3">
                <MonsterStatBlock monster={selectedMonster} />
                <div className="flex gap-2">
                  {!selectedMonster.id && (
                    <button
                      onClick={() => onSaveMonster(selectedMonster)}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Save size={14} /> Sauvegarder
                    </button>
                  )}
                  <button
                    onClick={() => onAddMonsterToEncounter(selectedMonster, addCount)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Swords size={14} /> Ajouter au combat ({addCount})
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {panelView === 'saved' && (
          <div className="space-y-1">
            {savedMonsters.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Aucun monstre sauvegarde
              </div>
            ) : (
              savedMonsters.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-800/50 transition-colors group"
                >
                  <button
                    onClick={() => { setSelectedMonster(m); setPanelView('detail'); }}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="text-sm font-medium text-gray-200 group-hover:text-amber-200 truncate">
                      {m.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      FP {m.challenge_rating} | CA {m.armor_class} | PV {m.hit_points}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onAddMonsterToEncounter(m, addCount)}
                      className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 transition-colors"
                    >
                      + Combat
                    </button>
                    <button
                      onClick={() => onDeleteMonster(m.id!)}
                      className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {showCustomModal && (
          <CustomMonsterModal
            onClose={() => { setShowCustomModal(false); setEditingMonster(null); }}
            onSave={onSaveMonster}
            editMonster={editingMonster}
          />
        )}
      </div>
    </div>
  );
}
