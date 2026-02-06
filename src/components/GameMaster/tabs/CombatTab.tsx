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
} from 'lucide-react';
import {
  CampaignMember,
  CampaignEncounter,
  EncounterParticipant,
  Monster,
  MonsterListItem,
} from '../../../types/campaign';
import { monsterService } from '../../../services/monsterService';
import { MonsterSearch } from '../../Combat/MonsterSearch';
import { MonsterStatBlock } from '../../Combat/MonsterStatBlock';
import { CustomMonsterModal } from '../../Combat/CustomMonsterModal';
import { InitiativeTracker } from '../../Combat/InitiativeTracker';
import toast from 'react-hot-toast';

interface CombatTabProps {
  campaignId: string;
  members: CampaignMember[];
  onReload: () => void;
}

type PanelView = 'search' | 'detail' | 'saved' | 'add-participants';

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
  const [encounterName, setEncounterName] = useState('');
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [addCount, setAddCount] = useState(1);

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

  const handleCreateEncounter = async () => {
    try {
      const name = encounterName.trim() || 'Combat';
      const enc = await monsterService.createEncounter(campaignId, name);
      setEncounter(enc);
      setParticipants([]);
      setShowNewEncounter(false);
      setEncounterName('');
      toast.success('Combat lance !');
    } catch (err) {
      console.error(err);
      toast.error('Erreur creation combat');
    }
  };

  const handleEndCombat = async () => {
    if (!encounter) return;
    try {
      await monsterService.endEncounter(encounter.id);
      setEncounter(null);
      setParticipants([]);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-3" />
        Chargement...
      </div>
    );
  }

  if (!encounter) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-900/30 rounded-lg flex items-center justify-center">
                <Swords size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Nouveau combat</h3>
                <p className="text-xs text-gray-500">Lancez un tracker d'initiative</p>
              </div>
            </div>

            {showNewEncounter ? (
              <div className="space-y-3">
                <input
                  className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none"
                  placeholder="Nom du combat (optionnel)"
                  value={encounterName}
                  onChange={(e) => setEncounterName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateEncounter(); }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateEncounter}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Lancer le combat
                  </button>
                  <button
                    onClick={() => setShowNewEncounter(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded-lg text-sm transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewEncounter(true)}
                className="w-full px-4 py-3 bg-red-600/80 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Swords size={16} /> Lancer un combat
              </button>
            )}
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-900/30 rounded-lg flex items-center justify-center">
                <BookOpen size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Bestiaire ({savedMonsters.length})</h3>
                <p className="text-xs text-gray-500">Monstres sauvegardes dans la campagne</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setPanelView('search'); }}
                className="flex-1 px-3 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Search size={14} /> Chercher AideDD
              </button>
              <button
                onClick={() => { setEditingMonster(null); setShowCustomModal(true); }}
                className="flex-1 px-3 py-2 border border-amber-700 text-amber-300 hover:bg-amber-900/20 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Monstre custom
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            {panelView === 'search' && (
              <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Search size={14} /> Rechercher un monstre (AideDD)
                </h4>
                <MonsterSearch onSelect={handleSelectMonsterFromSearch} />
              </div>
            )}

            {panelView === 'detail' && (
              <div className="space-y-3">
                <button
                  onClick={() => { setPanelView('search'); setSelectedMonster(null); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={12} /> Retour a la recherche
                </button>

                {loadingDetail ? (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <Loader2 size={20} className="animate-spin mr-2" />
                    Chargement du monstre...
                  </div>
                ) : selectedMonster ? (
                  <div className="space-y-3">
                    <MonsterStatBlock monster={selectedMonster} />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveMonster(selectedMonster)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <Save size={14} /> Sauvegarder
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {savedMonsters.length > 0 && (
            <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Skull size={14} /> Monstres sauvegardes
              </h4>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {savedMonsters.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
                  >
                    <button
                      onClick={() => { setSelectedMonster(m); setPanelView('detail'); }}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="text-sm font-medium text-gray-200 group-hover:text-amber-200 truncate">
                        {m.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        FP {m.challenge_rating} - {m.type} - {m.source === 'custom' ? 'Custom' : 'AideDD'}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.source === 'custom' && (
                        <button
                          onClick={() => { setEditingMonster(m); setShowCustomModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMonster(m.id!)}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showCustomModal && (
          <CustomMonsterModal
            onClose={() => { setShowCustomModal(false); setEditingMonster(null); }}
            onSave={handleSaveMonster}
            editMonster={editingMonster}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <InitiativeTracker
          encounter={encounter}
          participants={participants}
          onNextTurn={handleNextTurn}
          onEndCombat={handleEndCombat}
          onUpdateParticipant={handleUpdateParticipant}
          onRemoveParticipant={handleRemoveParticipant}
          onViewMonster={handleViewMonster}
        />

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleAddPlayersToEncounter}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-900/30 hover:bg-sky-900/50 text-sky-300 text-xs font-medium rounded-lg border border-sky-800/40 transition-colors"
            >
              <Users size={12} /> Ajouter joueurs
            </button>
            <button
              onClick={handleSortByInitiative}
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
                  onClick={() => handleAddMonsterToEncounter(m, addCount)}
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
          <MonsterSearch onSelect={handleSelectMonsterFromSearch} />
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
                    onClick={() => handleAddMonsterToEncounter(selectedMonster, addCount)}
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
                      onClick={() => handleAddMonsterToEncounter(m, addCount)}
                      className="px-2 py-1 text-xs bg-red-900/30 text-red-300 rounded hover:bg-red-900/50 transition-colors"
                    >
                      + Combat
                    </button>
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
    </div>
  );
}
