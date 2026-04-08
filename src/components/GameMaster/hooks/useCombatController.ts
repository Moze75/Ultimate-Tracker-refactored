import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CampaignMember,
  CampaignEncounter,
  EncounterParticipant,
  Monster,
  MonsterListItem,
} from '../../../types/campaign';
import type { VTTToken } from '../../../types/vtt';
import { monsterService } from '../../../services/monsterService';
import { supabase } from '../../../lib/supabase';
import type { SelectedMonsterEntry } from '../../Combat/MonsterSearch';
import type { DiceRollData } from '../../Combat/MonsterStatBlock';
import { useCombatPlayersRealtimeSync } from './useCombatPlayersRealtimeSync';
import { useCombatEncounterRealtimeSync } from './useCombatEncounterRealtimeSync';
import toast from 'react-hot-toast';

export interface CombatTabProps {
  campaignId: string;
  roomId?: string;
  members: CampaignMember[];
  onReload: () => void;
  onRollDice?: (data: DiceRollData) => void;
  initialTokens?: VTTToken[];
  liveTokens?: VTTToken[];
  vttMode?: boolean;
  role?: 'gm' | 'player';
  onUpdateToken?: (tokenId: string, changes: Partial<VTTToken>) => void;
  onRoundLaunchedFromRealtime?: () => void;
}

export interface CombatPreparationEntry {
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

export type PanelView = 'search' | 'detail';

let prepIdCounter = 0;

export function useIsDesktop() {
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

export function useCombatController({
  campaignId,
  roomId,
  members,
  initialTokens,
  liveTokens,
  role = 'gm',
  onUpdateToken,
  onRoundLaunchedFromRealtime,
}: CombatTabProps) {
  const isGM = role === 'gm';

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
  const initialTokensAppliedRef = useRef(false);
  const liveTokensRef = useRef(liveTokens ?? initialTokens);
  const prevInitialTokensRef = useRef<VTTToken[] | undefined>(undefined);

  liveTokensRef.current = liveTokens ?? initialTokens;

  const isDesktop = useIsDesktop();
  const isActive = !!encounter;

  useEffect(() => {
    if (!initialTokens || initialTokens.length === 0) return;

    if (prevInitialTokensRef.current !== initialTokens) {
      prevInitialTokensRef.current = initialTokens;
      initialTokensAppliedRef.current = false;
    }

    if (initialTokensAppliedRef.current || isActive) return;

    initialTokensAppliedRef.current = true;

    const tokenEntries: CombatPreparationEntry[] = initialTokens.map((t) => {
      const matchedMember = members.find((m) => m.player_id && t.characterId && m.player_id === t.characterId);

      return {
        id: `prep-token-${t.id}-${++prepIdCounter}`,
        type: matchedMember ? 'player' : 'monster',
        name: t.label || 'Token',
        memberId: matchedMember?.id,
        playerId: matchedMember?.player_id,
        hp: t.hp ?? matchedMember?.current_hp ?? 0,
        maxHp: t.maxHp ?? matchedMember?.max_hp ?? 0,
        ac: matchedMember?.armor_class ?? 10,
        initiative: 0,
      };
    });

    setPrepEntries(tokenEntries);
  }, [initialTokens, isActive, members]);

  useEffect(() => {
    if (mobileSearchOpen && !isDesktop) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';

      return () => {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      };
    }
  }, [mobileSearchOpen, isDesktop]);

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

  const handlePlayerInitiativeUpdateFromRealtime = useCallback(
    (participantId: string, initiative_roll: number) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, initiative_roll } : p))
      );
    },
    []
  );

  const { markLocalUpdate, sendHpBroadcast, sendInitiativeBroadcast } = useCombatPlayersRealtimeSync({
    members,
    participants,
    onParticipantHPUpdate: handlePlayerHPUpdateFromRealtime,
    onParticipantInitiativeUpdate: handlePlayerInitiativeUpdateFromRealtime,
  });

  const handleEncounterUpdatedFromRealtime = useCallback((updates: Partial<CampaignEncounter>) => {
    if (updates.status && updates.status !== 'active') {
      setEncounter(null);
      setParticipants([]);
      return;
    }

    setEncounter((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const handleParticipantsUpdatedFromRealtime = useCallback(async (encounterId: string) => {
    try {
      const parts = await monsterService.getEncounterParticipants(encounterId);
      setParticipants(parts);
    } catch {
      // Silencieux
    }
  }, []);

  // -------------------
  // Réception du tri broadcast par le MJ
  // -------------------
  // On reçoit la liste ordonnée des IDs et on réordonne le state local
  // sans refaire de requête réseau (les données sont déjà en mémoire).
  const handleParticipantsReorderedFromRealtime = useCallback((orderedIds: string[]) => {
    setParticipants((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      const reordered = orderedIds
        .map((id, i) => {
          const p = map.get(id);
          return p ? { ...p, sort_order: i } : null;
        })
        .filter(Boolean) as typeof prev;
      // Ajoute les éventuels participants absents de l'ordre (sécurité)
      const orderedSet = new Set(orderedIds);
      const extras = prev.filter((p) => !orderedSet.has(p.id));
      return [...reordered, ...extras];
    });
  }, []);

  const handleFriendlyChangedFromRealtime = useCallback(
    (participantId: string, friendly: boolean) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, friendly } : p))
      );
    },
    []
  );

  useCombatEncounterRealtimeSync({
    encounterId: encounter?.id,
    onEncounterUpdated: handleEncounterUpdatedFromRealtime,
    onParticipantsReordered: handleParticipantsReorderedFromRealtime,
    onFriendlyChanged: handleFriendlyChangedFromRealtime,
    onParticipantsUpdated: handleParticipantsUpdatedFromRealtime,
    onRoundLaunched: onRoundLaunchedFromRealtime,
    onInitiativeRerolled: (updates) => {
      setParticipants((prev) =>
        prev.map((p) => {
          const upd = updates.find((u) => u.id === p.id);
          return upd ? { ...p, initiative_roll: upd.initiative_roll } : p;
        })
      );
    },
  });

  useEffect(() => {
    if (isGM) return;
    if (isActive) return;

    const interval = setInterval(async () => {
      try {
        const enc = await monsterService.getActiveEncounter(campaignId);
        if (enc) {
          setEncounter(enc);
          const parts = await monsterService.getEncounterParticipants(enc.id);
          setParticipants(parts);
        }
      } catch {
        // Polling silencieux
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isGM, isActive, campaignId]);

  const handleLoadEncounter = async (encounterId: string) => {
    try {
      setShowLoadEncounterModal(false);
      setLoading(true);

      // Désactiver l'encounter actif éventuel avant d'en charger un nouveau
      if (encounter) {
        await monsterService.endEncounter(encounter.id);
      }

      // Réactiver l'encounter chargé en base
      const { data: encounterData, error: encounterError } = await supabase
        .from('campaign_encounters')
        .update({ status: 'active' })
        .eq('id', encounterId)
        .select('*')
        .single();

      if (encounterError) throw encounterError;

      const { data: participantsData, error: participantsError } = await supabase
        .from('encounter_participants')
        .select('*')
        .eq('encounter_id', encounterId)
        .order('sort_order');

      if (participantsError) throw participantsError;

      // Mettre à jour l'état : encounter actif + participants dans la liste active
      setEncounter(encounterData);
      setParticipants(participantsData || []);
      setPrepEntries([]);
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
      setPrepEntries(
        members.map((m) => ({
          id: `prep-player-${m.id}`,
          type: 'player' as const,
          name: m.player_name || m.email || 'Joueur',
          memberId: m.id,
          playerId: m.player_id,
          hp: m.current_hp ?? 0,
          maxHp: m.max_hp ?? 0,
          ac: m.armor_class ?? 10,
          initiative: 0,
        }))
      );
    }
  }, [encounter, members, prepEntries.length]);

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
    if (!monster) return;

    if (isDesktop) {
      setMobileSearchOpen(true);
    }

    refreshMonsterFromSource(monster);
  };

  const viewMonsterById = (id?: string) => {
    if (!id) return;

    const monster = savedMonsters.find((m) => m.id === id);
    if (monster) {
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
    setPrepEntries((prev) =>
      prev.map((e) => ({
        ...e,
        initiative: e.type === 'monster' ? Math.floor(Math.random() * 20) + 1 : e.initiative,
      }))
    );
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

    supabase.channel(`combat-encounter-sync-${encounter.id}`).send({
      type: 'broadcast',
      event: 'initiative-rerolled',
      payload: { updates },
    });

    toast.success(`Initiative lancée pour ${updates.length} monstre${updates.length > 1 ? 's' : ''}`);
  };

  // Ajoute des tokens VTT au combat depuis le clic droit canvas → "Ajouter au combat"
  // Si un encounter existe déjà, ajoute les participants sans écraser.
  // Si aucun encounter n'existe, crée l'encounter mais sans déclencher le highlight/focus.
  const handleDirectLaunchCombat = async (tokens: VTTToken[]) => {
    if (tokens.length === 0) {
      toast.error('Sélectionnez au moins un token pour ajouter au combat');
      return;
    }

    try {
      setLaunching(true);

      const currentEncounter = encounter;

      if (currentEncounter) {
        const nextSortOrder = participants.length;
        const participantData = tokens.map((t, i) => {
          const matchedMember = members.find(
            (m) => m.player_id && t.characterId && m.player_id === t.characterId
          );
          const isPlayer = !!(matchedMember || t.characterId || (t.controlledByUserIds && t.controlledByUserIds.length > 0));

          return {
            encounter_id: currentEncounter.id,
            participant_type: (isPlayer ? 'player' : 'monster') as 'player' | 'monster',
            monster_id: undefined as string | undefined,
            player_member_id: matchedMember?.id,
            display_name: t.label || 'Token',
            initiative_roll: 0,
            current_hp: t.hp ?? matchedMember?.current_hp ?? 0,
            max_hp: t.maxHp ?? matchedMember?.max_hp ?? 0,
            temporary_hp: 0,
            armor_class: matchedMember?.armor_class ?? 10,
            conditions: [] as string[],
            sort_order: nextSortOrder + i,
            is_active: true,
            notes: '',
            friendly: isPlayer,
          };
        });

        const added = await monsterService.addParticipants(participantData);
        setParticipants((prev) => [...prev, ...added]);

        supabase.channel(`combat-encounter-sync-${currentEncounter.id}`).send({
          type: 'broadcast',
          event: 'participants-updated',
          payload: { encounterId: currentEncounter.id },
        });

        toast.success(`${tokens.length} token${tokens.length > 1 ? 's' : ''} ajouté${tokens.length > 1 ? 's' : ''} au combat`);
      } else {
        const enc = await monsterService.createEncounter(campaignId, 'Combat');

        const participantData = tokens.map((t, i) => {
          const matchedMember = members.find(
            (m) => m.player_id && t.characterId && m.player_id === t.characterId
          );
          const isPlayer = !!(matchedMember || t.characterId || (t.controlledByUserIds && t.controlledByUserIds.length > 0));

          return {
            encounter_id: enc.id,
            participant_type: (isPlayer ? 'player' : 'monster') as 'player' | 'monster',
            monster_id: undefined as string | undefined,
            player_member_id: matchedMember?.id,
            display_name: t.label || 'Token',
            initiative_roll: 0,
            current_hp: t.hp ?? matchedMember?.current_hp ?? 0,
            max_hp: t.maxHp ?? matchedMember?.max_hp ?? 0,
            temporary_hp: 0,
            armor_class: matchedMember?.armor_class ?? 10,
            conditions: [] as string[],
            sort_order: i,
            is_active: true,
            notes: '',
            friendly: isPlayer,
          };
        });

        const added = await monsterService.addParticipants(participantData);

        setEncounter(enc);
        setParticipants(added);
        setPrepEntries([]);
        toast.success(`${tokens.length} token${tokens.length > 1 ? 's' : ''} ajouté${tokens.length > 1 ? 's' : ''} au combat`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erreur ajout au combat');
    } finally {
      setLaunching(false);
    }
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
        temporary_hp: 0,
        armor_class: entry.ac,
        conditions: [] as string[],
        sort_order: i,
        is_active: true,
        notes: '',
        friendly: entry.type === 'player', // joueurs = amicaux, monstres = hostiles par défaut
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
        saved: true,
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
        temporary_hp: 0,
        armor_class: entry.ac,
        conditions: [] as string[],
        sort_order: i,
        is_active: true,
        notes: '',
        friendly: entry.type === 'player', // joueurs = amicaux, monstres = hostiles par défaut
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

  const handleSaveEncounter = async (newName?: string) => {
    if (!encounter) return;

    try {
      if (newName && newName.trim() !== encounter.name) {
        await supabase
          .from('campaign_encounters')
          .update({ name: newName.trim() })
          .eq('id', encounter.id);
        setEncounter((prev) => prev ? { ...prev, name: newName.trim() } : prev);
      }
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
      const endedEncounterId = encounter.id;

      await monsterService.endEncounter(endedEncounterId);

      supabase.channel(`combat-encounter-sync-${endedEncounterId}`).send({
        type: 'broadcast',
        event: 'combat-ended',
        payload: {
          encounterId: endedEncounterId,
          status: 'completed',
        },
      });

      setEncounter(null);
      setParticipants([]);
      setPrepEntries(
        members.map((m) => ({
          id: `prep-player-${m.id}`,
          type: 'player' as const,
          name: m.player_name || m.email || 'Joueur',
          memberId: m.id,
          playerId: m.player_id,
          hp: m.current_hp ?? 0,
          maxHp: m.max_hp ?? 0,
          ac: m.armor_class ?? 10,
          initiative: 0,
        }))
      );
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

      supabase.channel(`combat-encounter-sync-${encounter.id}`).send({
        type: 'broadcast',
        event: 'turn-changed',
        payload: {
          current_turn_index: nextIdx,
          round_number: newRound,
          status: updated.status,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Erreur tour suivant');
    }
  };

  const handlePreviousTurn = async () => {
    if (!encounter || participants.length === 0) return;

    let prevIdx = encounter.current_turn_index - 1;
    let newRound = encounter.round_number;

    if (prevIdx < 0) {
      prevIdx = participants.length - 1;
      newRound = Math.max(1, newRound - 1);
    }

    try {
      const updated = await monsterService.updateEncounter(encounter.id, {
        current_turn_index: prevIdx,
        round_number: newRound,
      });

      setEncounter(updated);

      supabase.channel(`combat-encounter-sync-${encounter.id}`).send({
        type: 'broadcast',
        event: 'turn-changed',
        payload: {
          current_turn_index: prevIdx,
          round_number: newRound,
          status: updated.status,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Erreur tour précédent');
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

  const toggleFriendly = async (participant: EncounterParticipant) => {
    if (!encounter) return;
    const newFriendly = !participant.friendly;
    // Mise à jour optimiste locale
    setParticipants((prev) =>
      prev.map((p) => (p.id === participant.id ? { ...p, friendly: newFriendly } : p))
    );
    // Broadcast immédiat vers les joueurs
    supabase.channel(`combat-encounter-sync-${encounter.id}`).send({
      type: 'broadcast',
      event: 'friendly-changed',
      payload: { participantId: participant.id, friendly: newFriendly },
    });
    try {
      await monsterService.updateParticipant(participant.id, { friendly: newFriendly });
    } catch (err) {
      // Rollback si erreur
      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? { ...p, friendly: participant.friendly } : p))
      );
      console.error(err);
      toast.error('Erreur mise à jour amicalité');
    }
  };
  
  const handleUpdateActiveInitiative = async (id: string, value: number) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, initiative_roll: value } : p)));
    // Broadcast immédiat pour la vue MJ (et tous les autres clients)
    markLocalUpdate(id);
    sendInitiativeBroadcast({ participantId: id, initiative_roll: value });

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
      const sortedWithOrder = sorted.map((p, i) => ({ ...p, sort_order: i }));
      setParticipants(sortedWithOrder);

      const updated = await monsterService.updateEncounter(encounter.id, {
        current_turn_index: 0,
        round_number: encounter.round_number,
      });
      setEncounter(updated);

      const channel = supabase.channel(`combat-encounter-sync-${encounter.id}`);

      // Broadcast 1 : nouvel ordre des participants → les joueurs réordonnent leur liste
      channel.send({
        type: 'broadcast',
        event: 'participants-reordered',
        payload: { orderedIds: ids },
      });

      // Broadcast 2 : index remis à 0 + signal round lancé → les joueurs focus le premier participant
      channel.send({
        type: 'broadcast',
        event: 'turn-changed',
        payload: {
          current_turn_index: 0,
          round_number: updated.round_number,
          status: updated.status,
          roundLaunched: true,
        },
      });
    } catch (err) {
      console.error(err);
      toast.error('Erreur tri initiative');
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
          temporary_hp: 0,
          armor_class: monster.armor_class,
          conditions: [] as string[],
          sort_order: participants.length + i,
          is_active: true,
          notes: '',
          friendly: false, // monstre du bestiaire → hostile par défaut
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
        temporary_hp: m.player_id ? playerTempHpMap[m.player_id] || 0 : 0,
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

    const newHp =
      mode === 'damage'
        ? Math.max(0, p.current_hp - val)
        : Math.min(p.max_hp, p.current_hp + val);

    handleUpdateParticipant(p.id, { current_hp: newHp });
    setHpDelta((prev) => ({ ...prev, [p.id]: '' }));

    markLocalUpdate(p.id);
    sendHpBroadcast({
      participantId: p.id,
      current_hp: newHp,
      temporary_hp: p.temporary_hp ?? 0,
    });

    if (onUpdateToken && liveTokensRef.current) {
      const matchingToken = liveTokensRef.current.find(
        (t) =>
          (p.participant_type === 'player' &&
            t.characterId &&
            p.player_member_id &&
            members.find((m) => m.id === p.player_member_id)?.player_id === t.characterId) ||
          t.label === p.display_name
      );

      if (matchingToken) {
        onUpdateToken(matchingToken.id, { hp: newHp, maxHp: p.max_hp });
        // Déclenche la mise à jour de VTTCharacterSheetPanel si la fiche est ouverte
        window.dispatchEvent(new CustomEvent('vtt:token-hp-changed', {
          detail: { tokenId: matchingToken.id, newHp }
        }));
      }
    }

    if (p.participant_type === 'player' && p.player_member_id) {
      const member = members.find((m) => m.id === p.player_member_id);

      if (member?.player_id) {
        markLocalUpdate(member.player_id);

        // Persistance longue durée dans players
        supabase
          .from('players')
          .update({ current_hp: newHp })
          .eq('id', member.player_id)
          .then(({ error }) => {
            if (error) console.error('Erreur sync HP joueur:', error);
          });

        // Filet Realtime léger : alimente vtt_player_state
        // Le broadcast hp-changed est déjà parti (< 100ms).
        // Ce upsert sert uniquement au rattrapage (reconnexion, arrivée tardive).
          console.log('[applyHp] roomId=', roomId, 'player_id=', member.player_id);
          if (roomId) {
            supabase.rpc('update_player_state_hp', {
              p_player_id: member.player_id,
              p_room_id: roomId,
              p_current_hp: newHp,
              p_temporary_hp: p.temporary_hp ?? 0,
            }).then(({ error }) => {
              if (error) console.error('Erreur sync vtt_player_state HP:', error);
            });
          }
      }
    }
  };

  const participantsForSyncRef = useRef(participants);
  participantsForSyncRef.current = participants;

   const syncTokenHpToParticipant = useCallback(
    (tokenId: string, newHp: number) => {
      if (!liveTokensRef.current) return;
      const token = liveTokensRef.current.find((t) => t.id === tokenId);
      if (!token) return;

      const matched = participantsForSyncRef.current.find(
        (p) =>
          (p.participant_type === 'player' &&
            token.characterId &&
            p.player_member_id &&
            members.find((m) => m.id === p.player_member_id)?.player_id === token.characterId) ||
          token.label === p.display_name,
      );
      if (!matched) return;

      const clampedHp = Math.max(0, Math.min(matched.max_hp, newHp));

      setParticipants((prev) =>
        prev.map((p) => (p.id === matched.id ? { ...p, current_hp: clampedHp } : p)),
      );
      handleUpdateParticipant(matched.id, { current_hp: clampedHp });
      markLocalUpdate(matched.id);
      sendHpBroadcast({
        participantId: matched.id,
        current_hp: clampedHp,
        temporary_hp: matched.temporary_hp ?? 0,
      });

      if (matched.participant_type === 'player' && matched.player_member_id) {
        const member = members.find((m) => m.id === matched.player_member_id);
        if (member?.player_id) {
          markLocalUpdate(member.player_id);
          supabase
            .from('players')
            .update({ current_hp: clampedHp })
            .eq('id', member.player_id)
            .then(({ error }) => {
              if (error) console.error('Erreur sync HP joueur (syncTokenHpToParticipant):', error);
            });
            if (roomId) {
            supabase
              .from('vtt_player_state')
              .update({
                current_hp: clampedHp,
                temporary_hp: matched.temporary_hp ?? 0,
              })
              .eq('player_id', member.player_id)
              .eq('room_id', roomId)
              .then(({ error }) => {
                if (error) console.error('Erreur sync vtt_player_state (syncTokenHpToParticipant):', error);
              });
          }
        }
      }
    },
    [members, markLocalUpdate, sendHpBroadcast, handleUpdateParticipant, roomId],
  );

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

        if (roomId) {
          supabase
            .from('vtt_player_state')
            .update({ active_conditions: next })
            .eq('player_id', member.player_id)
            .eq('room_id', roomId)
            .then(({ error }) => {
              if (error) console.error('Erreur sync vtt_player_state conditions:', error);
            });
        }
      }
    }
  };

  return {
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

    setEncounter,
    setParticipants,
    setSavedMonsters,
    setPanelView,
    setSelectedMonster,
    setShowCustomModal,
    setEditingMonster,
    setAddCount,
    setPrepEntries,
    setEncounterName,
    setHpDelta,
    setShowLoadEncounterModal,
    setShowImportModal,
    setSelectedPlayerDetails,
    setMobileSearchOpen,

    loadData,
    handleLoadEncounter,
    refreshMonsterFromSource,
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
    handlePreviousTurn,
    handleSelectMonsterFromSearch,
    handleSaveMonster,
    handleDeleteMonster,
    handleUpdateParticipant,
    handleRemoveParticipant,
    handleUpdateActiveInitiative,
    handleSortByInitiative,
    handleAddMonsterToEncounter,
    handleAddPlayersToEncounter,
    applyHp,
    toggleCondition,
    toggleFriendly,
    syncTokenHpToParticipant,
  };
}