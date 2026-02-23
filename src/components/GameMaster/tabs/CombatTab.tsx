import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  User,
  SkipForward,
  Square,
  Minus,
  Eye,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import {
  CampaignMember,
  CampaignEncounter,
  EncounterParticipant,
  Monster,
  MonsterListItem,
  DND_CONDITIONS,
} from '../../../types/campaign';
import { monsterService } from '../../../services/monsterService';
import { supabase } from '../../../lib/supabase';
import { MonsterSearch, SelectedMonsterEntry } from '../../Combat/MonsterSearch';
import { MonsterStatBlock, DiceRollData } from '../../Combat/MonsterStatBlock';
import { CustomMonsterModal } from '../../Combat/CustomMonsterModal';
import { ImportMonsterModal } from '../../Combat/ImportMonsterModal';
import { LoadEncounterModal } from '../modals/LoadEncounterModal';
import { PlayerDetailsModal } from '../../modals/PlayerDetailsModal';
import { useCombatPlayersRealtimeSync } from '../hooks/useCombatPlayersRealtimeSync';
import toast from 'react-hot-toast';

interface CombatTabProps {
  campaignId: string;
  members: CampaignMember[];
  onReload: () => void;
  onRollDice?: (data: DiceRollData) => void;
}

interface CombatPreparationEntry {
  id: string;
  type: 'player' | 'monster';
  name: string;
  memberId?: string;
  playerId?: string;
  monsterSlug?: string;
  monsterId?: string;
  hp: number;
  maxHp: number;
  ac: number;
  initiative: number;
}

type PanelView = 'search' | 'detail' | 'saved';

let prepIdCounter = 0;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export function CombatTab({ campaignId, members, onRollDice }: CombatTabProps) {
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
  const [hpDelta, setHpDelta] = useState<Record<string, string>>({});
  const [showLoadEncounterModal, setShowLoadEncounterModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedPlayerDetails, setSelectedPlayerDetails] = useState<{ id: string; name: string } | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useIsDesktop();
  const isActive = !!encounter;

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

  useEffect(() => { loadData(); }, [loadData]);

  const handlePlayerHPUpdateFromRealtime = useCallback(
    async (participantId: string, updates: { current_hp: number; temporary_hp: number }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === participantId ? { ...p, current_hp: updates.current_hp, temporary_hp: updates.temporary_hp } : p
        )
      );
      try {
        await supabase
          .from('encounter_participants')
          .update({ current_hp: updates.current_hp, temporary_hp: updates.temporary_hp })
          .eq('id', participantId);
      } catch (err) {
        console.error('Erreur sync participant HP:', err);
      }
    },
    []
  );

  const { markLocalUpdate } = useCombatPlayersRealtimeSync({
    members,
    participants,
    onParticipantHPUpdate: handlePlayerHPUpdateFromRealtime,
  });

  const handleLoadEncounter = async (encounterId: string) => {
    try {
      setShowLoadEncounterModal(false);
      setLoading(true);

      const { data: encounterData, error: encounterError } = await supabase
        .from('campaign_encounters')
        .select('*')
        .eq('id', encounterId)
        .single();

      if (encounterError) throw encounterError;

      const { data: participantsData, error: participantsError } = await supabase
        .from('encounter_participants')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('sort_order');

      if (participantsError) throw participantsError;

      const prepEntries: CombatPreparationEntry[] = (participantsData || []).map((p) => ({
        id: `prep-${p.participant_type}-${p.id}`,
        type: p.participant_type as 'player' | 'monster',
        name: p.display_name,
        memberId: p.player_member_id || undefined,
        monsterId: p.monster_id || undefined,
        hp: p.current_hp,
        maxHp: p.max_hp,
        ac: p.armor_class,
        initiative: p.initiative_roll,
      }));

      setPrepEntries(prepEntries);
      setEncounterName(encounterData.name);
      toast.success(`Combat "${encounterData.name}" chargé`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors du chargement du combat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!encounter && members.length > 0 && prepEntries.length === 0) {
      setPrepEntries(members.map((m) => ({
        id: `prep-player-${m.id}`,
        type: 'player' as const,
        name: m.player_name || m.email || 'Joueur',
        memberId: m.id,
        playerId: m.player_id,
        hp: m.current_hp ?? 0,
        maxHp: m.max_hp ?? 0,
        ac: m.armor_class ?? 10,
        initiative: 0,
      })));
    }
  }, [encounter, members]);

  const refreshMonsterFromSource = async (monster: Monster) => {
    if (!monster.slug || monster.source === 'custom') {
      setSelectedMonster(monster);
      setPanelView('detail');
      return;
    }
    try {
      setLoadingDetail(true);
      setPanelView('detail');
      const fresh = await monsterService.fetchMonsterDetail(monster.slug);
      const merged: Monster = { ...monster, ...fresh, id: monster.id, source: monster.source || 'aidedd' };
      setSelectedMonster(merged);
      if (monster.id) {
        await monsterService.updateCampaignMonster(monster.id, fresh);
        setSavedMonsters((prev) => prev.map((m) => (m.id === monster.id ? merged : m)));
      }
    } catch {
      setSelectedMonster(monster);
    } finally {
      setLoadingDetail(false);
    }
  };

  const viewMonsterBySlug = (slug?: string) => {
    if (!slug) return;
    const monster = savedMonsters.find((m) => m.slug === slug);
    if (monster) {
      if (isDesktop) {
        setMobileSearchOpen(true);
      }
      refreshMonsterFromSource(monster);
    }
  };

  const viewMonsterById = (id?: string) => {
    if (!id) return;
    const monster = savedMonsters.find((m) => m.id === id);
    if (monster) {
      if (isDesktop) {
        setMobileSearchOpen(true);
      }
      refreshMonsterFromSource(monster);
    }
  };

  const viewPlayerById = (memberId?: string) => {
    if (!memberId) return;
    const member = members.find((m) => m.id === memberId);
    if (member?.player_id) {
      setSelectedPlayerDetails({
        id: member.player_id,
        name: member.player_name || 'Personnage',
      });
    }
  };

  const handleAddMonstersFromSearch = async (entries: SelectedMonsterEntry[]) => {
    const newEntries: CombatPreparationEntry[] = [];
    for (const entry of entries) {
      try {
        // Pour les monstres custom/sauvegardés, utiliser directement les données en base
        let existing = savedMonsters.find((m) => m.slug === entry.monster.slug);
        let monsterData: Monster;
        if (existing && existing.source === 'custom') {
          monsterData = existing;
        } else {
          monsterData = await monsterService.fetchMonsterDetail(entry.monster.slug);
          if (!existing) {
            existing = await monsterService.saveToCampaign(campaignId, monsterData);
            setSavedMonsters((prev) => [...prev, existing!]);
          }
        }
        for (let i = 0; i < entry.quantity; i++) {
          prepIdCounter++;
          newEntries.push({
            id: `prep-monster-${prepIdCounter}`,
            type: 'monster',
            name: entry.quantity > 1 ? `${monsterData.name} ${i + 1}` : monsterData.name,
            monsterSlug: monsterData.slug,
            monsterId: existing!.id,
            hp: monsterData.hit_points,
            maxHp: monsterData.hit_points,
            ac: monsterData.armor_class,
            initiative: 0,
          });
        }
      } catch (err) {
        console.error(err);
        toast.error(`Impossible de charger ${entry.monster.name}`);
      }
    }
    setPrepEntries((prev) => [...prev, ...newEntries]);
    if (newEntries.length > 0) {
      setMobileSearchOpen(false);
      toast.success(`${newEntries.length} monstre${newEntries.length > 1 ? 's' : ''} ajoute${newEntries.length > 1 ? 's' : ''}`);
    }
  };

  const handleAddMonstersFromSearchToEncounter = async (entries: SelectedMonsterEntry[]) => {
    if (!encounter) return;
    for (const entry of entries) {
      try {
        // Pour les monstres custom/sauvegardés, utiliser directement les données en base
        let existing = savedMonsters.find((m) => m.slug === entry.monster.slug);
        if (existing && existing.source === 'custom') {
          await handleAddMonsterToEncounter(existing, entry.quantity);
          continue;
        }
        const detail = await monsterService.fetchMonsterDetail(entry.monster.slug);
        if (!existing) {
          existing = await monsterService.saveToCampaign(campaignId, detail);
          setSavedMonsters((prev) => [...prev, existing!]);
        }
        await handleAddMonsterToEncounter({ ...detail, id: existing.id }, entry.quantity);
      } catch (err) {
        console.error(err);
        toast.error(`Impossible de charger ${entry.monster.name}`);
      }
    }
    setMobileSearchOpen(false);
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
        monsterId: monster.id,
        hp: monster.hit_points,
        maxHp: monster.hit_points,
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
    setPrepEntries((prev) => prev.map((e) => (e.id === id ? { ...e, initiative: value } : e)));
  };

  const handleRollAllInitiative = () => {
    setPrepEntries((prev) => prev.map((e) => ({
      ...e,
      initiative: e.type === 'monster' ? Math.floor(Math.random() * 20) + 1 : e.initiative,
    })));
  };

  const handleRollMonsterInitiativeActive = async () => {
    if (!encounter) return;
    const updates = participants
      .filter((p) => p.participant_type === 'monster')
      .map((p) => ({ id: p.id, initiative_roll: Math.floor(Math.random() * 20) + 1 }));
    if (updates.length === 0) {
      toast('Aucun monstre dans le combat');
      return;
    }
    for (const u of updates) {
      try {
        await monsterService.updateParticipant(u.id, { initiative_roll: u.initiative_roll });
      } catch (err) {
        console.error(err);
      }
    }
    setParticipants((prev) =>
      prev.map((p) => {
        const upd = updates.find((u) => u.id === p.id);
        return upd ? { ...p, initiative_roll: upd.initiative_roll } : p;
      })
    );
    toast.success(`Initiative lancée pour ${updates.length} monstre${updates.length > 1 ? 's' : ''}`);
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
      const participantData = sorted.map((entry, i) => ({
        encounter_id: enc.id,
        participant_type: entry.type as 'player' | 'monster',
        monster_id: entry.monsterId || undefined,
        player_member_id: entry.memberId || undefined,
        display_name: entry.name,
        initiative_roll: entry.initiative,
        current_hp: entry.hp,
        max_hp: entry.maxHp,
        armor_class: entry.ac,
        conditions: [] as string[],
        sort_order: i,
        is_active: true,
        notes: '',
      }));
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

  const handleSavePreparation = async () => {
    if (prepEntries.length === 0) return;
    try {
      setLaunching(true);
      const finalName = encounterName.trim() || 'Combat sauvegardé';

      const enc = await monsterService.createEncounter(campaignId, finalName);
      await monsterService.updateEncounter(enc.id, {
        status: 'completed',
        saved: true
      });

      const sortedPrep = [...prepEntries].sort((a, b) => b.initiative - a.initiative);
      const participantData = sortedPrep.map((entry, i) => ({
        encounter_id: enc.id,
        participant_type: entry.type as 'player' | 'monster',
        monster_id: entry.monsterId || undefined,
        player_member_id: entry.memberId || undefined,
        display_name: entry.name,
        initiative_roll: entry.initiative,
        current_hp: entry.hp,
        max_hp: entry.maxHp,
        armor_class: entry.ac,
        conditions: [] as string[],
        sort_order: i,
        is_active: true,
        notes: '',
      }));
      await monsterService.addParticipants(participantData);

      setPrepEntries([]);
      setEncounterName('');
      toast.success('Combat sauvegardé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur sauvegarde du combat');
    } finally {
      setLaunching(false);
    }
  };

  const handleSaveEncounter = async () => {
    if (!encounter) return;
    try {
      await monsterService.saveEncounter(encounter.id);
      toast.success('Combat sauvegardé');
    } catch (err) {
      console.error(err);
      toast.error('Erreur sauvegarde du combat');
    }
  };

  const handleEndCombat = async () => {
    if (!encounter) return;
    try {
      await monsterService.endEncounter(encounter.id);
      setEncounter(null);
      setParticipants([]);
      setPrepEntries(members.map((m) => ({
        id: `prep-player-${m.id}`,
        type: 'player' as const,
        name: m.player_name || m.email || 'Joueur',
        memberId: m.id,
        playerId: m.player_id,
        hp: m.current_hp ?? 0,
        maxHp: m.max_hp ?? 0,
        ac: m.armor_class ?? 10,
        initiative: 0,
      })));
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

  const handleUpdateParticipant = async (id: string, updates: Partial<EncounterParticipant>) => {
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

  const handleUpdateActiveInitiative = async (id: string, value: number) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, initiative_roll: value } : p)));
    try {
      await monsterService.updateParticipant(id, { initiative_roll: value });
    } catch (err) {
      console.error(err);
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
        setSavedMonsters(await monsterService.getCampaignMonsters(campaignId));
      }
      const newParticipants = [];
      for (let i = 0; i < count; i++) {
        newParticipants.push({
          encounter_id: encounter.id,
          participant_type: 'monster' as const,
          monster_id: saved.id!,
          player_member_id: undefined,
          display_name: count > 1 ? `${monster.name} ${i + 1}` : monster.name,
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
      setMobileSearchOpen(false);
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
      const membersToAdd = members.filter((m) => !existingNames.has(m.player_name || m.email || ''));

      if (membersToAdd.length === 0) {
        toast('Tous les joueurs sont deja dans le combat');
        return;
      }

      const playerIds = membersToAdd.map((m) => m.player_id).filter(Boolean) as string[];
      let playerTempHpMap: Record<string, number> = {};
      if (playerIds.length > 0) {
        const { data: playersData } = await supabase
          .from('players')
          .select('id, temporary_hp')
          .in('id', playerIds);
        if (playersData) {
          playerTempHpMap = Object.fromEntries(playersData.map((p) => [p.id, p.temporary_hp || 0]));
        }
      }

      const newParticipants = membersToAdd.map((m, i) => ({
        encounter_id: encounter.id,
        participant_type: 'player' as const,
        monster_id: undefined,
        player_member_id: m.id,
        display_name: m.player_name || m.email || 'Joueur',
        initiative_roll: 0,
        current_hp: m.current_hp ?? 0,
        max_hp: m.max_hp ?? 0,
        temporary_hp: m.player_id ? (playerTempHpMap[m.player_id] || 0) : 0,
        armor_class: m.armor_class ?? 10,
        conditions: [] as string[],
        sort_order: participants.length + i,
        is_active: true,
        notes: '',
      }));

      const added = await monsterService.addParticipants(newParticipants);
      setParticipants((prev) => [...prev, ...added]);
      toast.success(`${newParticipants.length} joueur(s) ajoute(s)`);
    } catch (err) {
      console.error(err);
      toast.error('Erreur ajout joueurs');
    }
  };

  const applyHp = async (p: EncounterParticipant, mode: 'damage' | 'heal') => {
    const val = parseInt(hpDelta[p.id] || '0', 10);
    if (!val || val <= 0) return;
    const newHp = mode === 'damage'
      ? Math.max(0, p.current_hp - val)
      : Math.min(p.max_hp, p.current_hp + val);
    handleUpdateParticipant(p.id, { current_hp: newHp });
    setHpDelta((prev) => ({ ...prev, [p.id]: '' }));

    if (p.participant_type === 'player' && p.player_member_id) {
      const member = members.find((m) => m.id === p.player_member_id);
      if (member?.player_id) {
        markLocalUpdate(member.player_id);
        supabase
          .from('players')
          .update({ current_hp: newHp })
          .eq('id', member.player_id)
          .then(({ error }) => {
            if (error) console.error('Erreur sync HP joueur:', error);
          });
      }
    }
  };

  const toggleCondition = (p: EncounterParticipant, condition: string) => {
    const current = p.conditions || [];
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    handleUpdateParticipant(p.id, { conditions: next });

    if (p.participant_type === 'player' && p.player_member_id) {
      const member = members.find((m) => m.id === p.player_member_id);
      if (member?.player_id) {
        supabase
          .from('players')
          .update({ conditions: next })
          .eq('id', member.player_id)
          .then(({ error }) => {
            if (error) console.error('Erreur sync conditions joueur:', error);
          });
      }
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

  const playerPrep = prepEntries.filter((e) => e.type === 'player');
  const monsterPrep = prepEntries.filter((e) => e.type === 'monster');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Search / Bestiary - Desktop only */}
      <div className="hidden lg:block space-y-4">
        <div className="flex gap-2 border-b border-gray-700 pb-2">
          {panelView === 'detail' && (
            <button
              onClick={() => setPanelView('search')}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <ArrowLeft size={12} className="inline mr-1" /> Retour
            </button>
          )}
          <button
            onClick={() => setPanelView('search')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              panelView === 'search'
                ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                : 'text-gray-400 hover:text-gray-200' 
            }`}
          >
            <Search size={12} className="inline mr-1" /> Rechercher monstres
          </button>
          <button
            onClick={() => { setEditingMonster(null); setShowCustomModal(true); }}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
          >
            <Plus size={12} className="inline mr-1" /> Creer monstre
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
          >
            <Upload size={12} className="inline mr-1" /> Importer
          </button>
          <button
            onClick={() => setShowLoadEncounterModal(true)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
          >
            <BookOpen size={12} className="inline mr-1" /> Charger combat
          </button>
        </div>

        {panelView === 'search' && (
          <MonsterSearch
            selectionMode
            onAddToCombat={isActive ? handleAddMonstersFromSearchToEncounter : handleAddMonstersFromSearch}
            onSelect={handleSelectMonsterFromSearch}
            savedMonsters={savedMonsters}
            onEditMonster={(m) => { setEditingMonster(m); setShowCustomModal(true); }}
            onDeleteMonster={handleDeleteMonster}
            onRollDice={onRollDice}
          />
        )}

        {panelView === 'detail' && (
          <div className="space-y-3"> 
            {loadingDetail ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" /> 
              </div>
            ) : selectedMonster ? (
              <div className="space-y-3">
                <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
                <div className="flex gap-2">
                  {!selectedMonster.id && (
                    <button
                      onClick={() => handleSaveMonster(selectedMonster)} 
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600/80 hover:bg-amber-500 text-black text-sm font-medium rounded-lg transition-colors"
                    >
                      <Save size={14} /> Sauvegarder
                    </button>
                  )}
                  {isActive ? (
                    <button
                      onClick={() => handleAddMonsterToEncounter(selectedMonster, addCount)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <Swords size={14} /> Ajouter au combat ({addCount})
                    </button>
                  ) : (
                    <button
                      onClick={() => { handleAddSavedMonsterToPrep(selectedMonster, 1); setPanelView('search'); }}
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

      {/* RIGHT: Unified combat panel */}
      <div className="space-y-4">
        {/* Mobile-only: search toolbar + panel ABOVE combat box */}
        <div className="lg:hidden space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {panelView === 'detail' && mobileSearchOpen && (
              <button
                onClick={() => setPanelView('search')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-black hover:text-amber-300 transition-colors"
              >
                <ArrowLeft size={12} /> Retour
              </button>
            )}
            <button
              onClick={() => { setMobileSearchOpen(!mobileSearchOpen); if (!mobileSearchOpen) setPanelView('search'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                mobileSearchOpen && panelView === 'search'
                  ? 'bg-amber-900/40 text-amber-300 border border-amber-700'
                  : 'text-gray-400 hover:text-black'
              }`}  
            >
              <Search size={12} /> Rechercher monstres
            </button>
            <button
              onClick={() => { setEditingMonster(null); setShowCustomModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-amber-300 transition-colors"
            >
              <Plus size={12} /> Creer monstre
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
              <BookOpen size={12} /> Charger combat
            </button>
          </div>
          {mobileSearchOpen && (
            <div className="max-h-[50vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl p-3">
              {panelView === 'search' && (
                <MonsterSearch
                  selectionMode
                  onAddToCombat={isActive ? handleAddMonstersFromSearchToEncounter : handleAddMonstersFromSearch}
                  onSelect={handleSelectMonsterFromSearch}
                  savedMonsters={savedMonsters}
                  onEditMonster={(m) => { setEditingMonster(m); setShowCustomModal(true); }}
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
                      <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
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
                            <Swords size={14} /> Ajouter au combat ({addCount})
                          </button>
                        ) : (
                          <button
                            onClick={() => { handleAddSavedMonsterToPrep(selectedMonster, 1); setPanelView('search'); }}
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
          )}
        </div>

        <div className="hidden lg:flex gap-2 border-b border-gray-700 pb-2">
          <span className="px-3 py-1.5 text-xs invisible">Alignement</span>
        </div>
   <div className="frame-card--light frame-card--no-frame rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isActive ? 'bg-red-600/40' : 'bg-red-900/30'
              }`}>
                <Swords size={16} className="text-red-400" />
              </div>
              <div className="min-w-0"> 
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="truncate">{isActive ? encounter.name : 'Preparation du combat'}</span>
                  {isActive && (
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded whitespace-nowrap shrink-0 border border-gray-700"> 
                      Round {encounter.round_number}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {isActive
                    ? `${participants.length} participant${participants.length > 1 ? 's' : ''}`
                    : `${prepEntries.length} participant${prepEntries.length > 1 ? 's' : ''}`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto">
              {isActive ? (
           
      
<div className="hidden sm:flex gap-1.5">
                  <button
                    onClick={handleRollMonsterInitiativeActive}
                    className="flex items-center justify-center p-1.5 bg-gray-800 hover:bg-gray-700 text-amber-300 text-xs rounded-lg border border-gray-700 transition-colors"
                    title="Relancer l'initiative des monstres"
                  >
                    <Dices size={12} />
                  </button>
                  <button
                    onClick={handleNextTurn}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                  >
                    <SkipForward size={12} className="shrink-0" /> Tour suivant
                  </button>
                  <button
                    onClick={handleSaveEncounter}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg border border-gray-700 transition-colors"
                  >
                    <Save size={12} className="shrink-0" /> Sauvegarder
                  </button>
                  <button
                    onClick={handleEndCombat}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg border border-red-800/50 transition-colors"
                  >
                    <Square size={12} className="shrink-0" /> Fin
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleRollAllInitiative}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 text-xs font-medium rounded-lg border border-amber-800/40 transition-colors"
                >
                  <Dices size={12} /> Initiatives
                </button>
              )}
            </div>
          </div>

          {/* Encounter name (prep only) */}
          {!isActive && (
            <div className="px-4 py-2">
              <input
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none"
                placeholder="Nom du combat (optionnel)"
                value={encounterName}
                onChange={(e) => setEncounterName(e.target.value)}
              />
            </div>
          )}

          {isActive && (
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
                  Trier par initiative
                </button>
              </div>
            </div>
          )}

          {isActive && (
<div className="sm:hidden px-4 py-2 border-b border-gray-800 flex gap-1.5">
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
            </div>
          )}

          {/* Participants list */}
          <div className="max-h-[70vh] overflow-y-auto" ref={scrollContainerRef}>
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
              />
            ) : (
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
            )}
          </div>

          {/* Footer: Launch / empty state */}
          {!isActive && (
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
      </div>

      {showCustomModal && (
        <CustomMonsterModal
          onClose={() => { setShowCustomModal(false); setEditingMonster(null); }}
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
          existingMonsterNames={savedMonsters.map(m => m.name)}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(imported) => {
            setSavedMonsters(prev => [...prev, ...imported]);
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

/* ── Prep mode participant list ── */

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
      // En desktop, on affiche le détail dans le panneau de gauche, pas de dépliement
      onClickMonster(entry.monsterSlug);
    } else {
      // En mobile, on déplie/replie sous le monstre
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
          {isPlayer
            ? <User size={11} className="text-gray-400" />
            : <Skull size={11} className="text-red-400" />
          }
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
          <span className="flex items-center gap-0.5"><Shield size={10} className="text-gray-500" />{entry.ac}</span>
          <span className="flex items-center gap-0.5"><Heart size={10} className="text-red-500" />{entry.hp}/{entry.maxHp}</span>
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

/* ── Active combat participant list ── */

function HpBar({ current, max, temp = 0 }: { current: number; max: number; temp?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const tempPct = max > 0 ? Math.max(0, Math.min(100 - pct, (temp / max) * 100)) : 0;
  let color = 'bg-emerald-500';
  if (pct <= 25) color = 'bg-red-500';
  else if (pct <= 50) color = 'bg-amber-500';
  return (
    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
      <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      {temp > 0 && <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${tempPct}%` }} />}
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
            {c}<X size={8} />
          </span>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 rounded transition-colors"
        >+</button>
      </div>
      {showPicker && (
        <div className="absolute z-20 mt-1 left-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 w-48 max-h-48 overflow-y-auto">
          {DND_CONDITIONS.map((c) => {
            const active = conditions.includes(c);
            return (
              <button
                key={c}
                onClick={() => { onToggle(c); setShowPicker(false); }}
                className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                  active ? 'bg-red-900/30 text-red-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                {active ? '- ' : '+ '}{c}
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
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const participantRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll vers le participant actif quand le tour change (en haut du conteneur)
  // setTimeout pour laisser le DOM se mettre à jour (repli de la carte précédente)
  useEffect(() => {
    if (participants.length === 0) return;
    const currentParticipant = participants[encounter.current_turn_index];
    if (!currentParticipant) return;

    // Replier toute carte dépliée quand le tour change
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
        const clickable = (isMonster && !!p.monster_id) || (isPlayer && !!p.player_member_id);
              const isExpanded = !isDesktop && expandedId === p.id && isMonster;

             const handleParticipantClick = () => {
          if (!clickable) return;
          if (isMonster) {
            if (isDesktop) {
              // En desktop, afficher dans le panneau de gauche uniquement
              onViewMonster(p.monster_id);
            } else {
              // En mobile, déplier/replier sous le monstre
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
                  <div className="flex-1"><HpBar current={p.current_hp} max={p.max_hp} temp={p.temporary_hp || 0} /></div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                <input
                  type="number"
                  className="w-12 px-1 py-1 bg-black/30 border border-gray-700 rounded text-xs text-center text-gray-200 focus:border-red-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                  value={hpDelta[p.id] || ''}
                  onChange={(e) => setHpDelta((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') onApplyHp(p, 'damage'); }}
                />
                <button onClick={() => onApplyHp(p, 'damage')} className="p-1 text-red-500 hover:bg-red-900/30 rounded transition-colors" title="Degats">
                  <Minus size={12} />
                </button>
                <button onClick={() => onApplyHp(p, 'heal')} className="p-1 text-green-500 hover:bg-green-900/30 rounded transition-colors" title="Soins">
                  <Plus size={12} />
                </button>
                <button onClick={() => onRemove(p.id)} className="p-1 text-gray-600 hover:text-red-400 rounded transition-colors" title="Supprimer">
                  <Trash2 size={12} />
                </button>
              </div>
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
                  <MonsterStatBlock monster={selectedMonster} onRollDice={onRollDice} />
                ) : null}
              </div> 
            )} 
          </div>
        );
      })}
    </div>
  );
}
