import { supabase } from '../lib/supabase';
import {
  Monster,
  MonsterListItem,
  CampaignEncounter,
  EncounterParticipant,
} from '../types/campaign';

const EDGE_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-monster`;

let cachedList: MonsterListItem[] | null = null;

export const monsterService = {
  async fetchMonsterList(): Promise<MonsterListItem[]> {
    if (cachedList) return cachedList;

    const res = await fetch(`${EDGE_FN_BASE}?action=list`, {
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) throw new Error(`Erreur chargement bestiaire: ${res.status}`);
    const data = await res.json();
    cachedList = data as MonsterListItem[];
    return cachedList;
  },

  async fetchMonsterDetail(slug: string): Promise<Monster> {
    const res = await fetch(
      `${EDGE_FN_BASE}?action=detail&slug=${encodeURIComponent(slug)}`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) throw new Error(`Monstre non trouvé: ${res.status}`);
    const data = await res.json();
    return { ...data, source: 'aidedd' } as Monster;
  },

  async saveToCampaign(campaignId: string, monster: Monster): Promise<Monster> {
    const { data, error } = await supabase
      .from('campaign_monsters')
      .insert({
        campaign_id: campaignId,
        source: monster.source,
        slug: monster.slug || null,
        name: monster.name,
        size: monster.size,
        type: monster.type,
        alignment: monster.alignment,
        armor_class: monster.armor_class,
        armor_desc: monster.armor_desc,
        hit_points: monster.hit_points,
        hit_points_formula: monster.hit_points_formula,
        speed: monster.speed,
        abilities: monster.abilities,
        saving_throws: monster.saving_throws,
        skills: monster.skills,
        vulnerabilities: monster.vulnerabilities,
        resistances: monster.resistances,
        damage_immunities: monster.damage_immunities,
        condition_immunities: monster.condition_immunities,
        senses: monster.senses,
        languages: monster.languages,
        challenge_rating: monster.challenge_rating,
        xp: monster.xp,
        traits: monster.traits,
        actions: monster.actions,
        bonus_actions: monster.bonus_actions,
        reactions: monster.reactions,
        legendary_actions: monster.legendary_actions,
        legendary_description: monster.legendary_description,
        image_url: monster.image_url || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as Monster;
  },

  async getCampaignMonsters(campaignId: string): Promise<Monster[]> {
    const { data, error } = await supabase
      .from('campaign_monsters')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []) as Monster[];
  },

  async updateCampaignMonster(
    monsterId: string,
    updates: Partial<Monster>
  ): Promise<Monster> {
    const { data, error } = await supabase
      .from('campaign_monsters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', monsterId)
      .select()
      .single();

    if (error) throw error;
    return data as Monster;
  },

  async deleteCampaignMonster(monsterId: string): Promise<void> {
    const { error } = await supabase
      .from('campaign_monsters')
      .delete()
      .eq('id', monsterId);

    if (error) throw error;
  },

  async createEncounter(
    campaignId: string,
    name: string
  ): Promise<CampaignEncounter> {
    const { data, error } = await supabase
      .from('campaign_encounters')
      .insert({ campaign_id: campaignId, name, status: 'active' })
      .select()
      .single();

    if (error) throw error;
    return data as CampaignEncounter;
  },

  async getActiveEncounter(
    campaignId: string
  ): Promise<CampaignEncounter | null> {
    const { data, error } = await supabase
      .from('campaign_encounters')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as CampaignEncounter | null;
  },

  async updateEncounter(
    encounterId: string,
    updates: Partial<CampaignEncounter>
  ): Promise<CampaignEncounter> {
    const { data, error } = await supabase
      .from('campaign_encounters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', encounterId)
      .select()
      .single();

    if (error) throw error;
    return data as CampaignEncounter;
  },

  async endEncounter(encounterId: string): Promise<void> {
    const { error } = await supabase
      .from('campaign_encounters')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', encounterId);

    if (error) throw error;
  },

  async saveEncounter(encounterId: string): Promise<void> {
    const { error } = await supabase
      .from('campaign_encounters')
      .update({ saved: true, updated_at: new Date().toISOString() })
      .eq('id', encounterId);

    if (error) throw error;
  },

  async getSavedEncounters(campaignId: string): Promise<CampaignEncounter[]> {
    const { data, error } = await supabase
      .from('campaign_encounters')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('saved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as CampaignEncounter[];
  },

  async deleteEncounter(encounterId: string): Promise<void> {
    const { error } = await supabase
      .from('campaign_encounters')
      .delete()
      .eq('id', encounterId);

    if (error) throw error;
  },

  async getEncounterParticipants(
    encounterId: string
  ): Promise<EncounterParticipant[]> {
    const { data, error } = await supabase
      .from('encounter_participants')
      .select('*')
      .eq('encounter_id', encounterId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data || []) as EncounterParticipant[];
  },

  async addParticipant(
    participant: Omit<EncounterParticipant, 'id' | 'created_at'>
  ): Promise<EncounterParticipant> {
    const { data, error } = await supabase
      .from('encounter_participants')
      .insert(participant)
      .select()
      .single();

    if (error) throw error;
    return data as EncounterParticipant;
  },

  async addParticipants(
    participants: Omit<EncounterParticipant, 'id' | 'created_at'>[]
  ): Promise<EncounterParticipant[]> {
    const { data, error } = await supabase
      .from('encounter_participants')
      .insert(participants)
      .select();

    if (error) throw error;
    return (data || []) as EncounterParticipant[];
  },

  async updateParticipant(
    participantId: string,
    updates: Partial<EncounterParticipant>
  ): Promise<EncounterParticipant> {
    const { data, error } = await supabase
      .from('encounter_participants')
      .update(updates)
      .eq('id', participantId)
      .select()
      .single();

    if (error) throw error;
    return data as EncounterParticipant;
  },

  async removeParticipant(participantId: string): Promise<void> {
    const { error } = await supabase
      .from('encounter_participants')
      .delete()
      .eq('id', participantId);

    if (error) throw error;
  },

  async reorderParticipants(
    encounterId: string,
    participantIds: string[]
  ): Promise<void> {
    for (let i = 0; i < participantIds.length; i++) {
      const { error } = await supabase
        .from('encounter_participants')
        .update({ sort_order: i })
        .eq('id', participantIds[i]);

      if (error) throw error;
    }
  },
};
