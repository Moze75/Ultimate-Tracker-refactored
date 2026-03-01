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

    // === FIX: Re-parser les champs depuis le HTML brut car l'edge function parse mal les accents ===
    // L'edge function retourne des données corrompues (ex: skills="étences" au lieu de "Perception +5, Discrétion +4")
    // On re-fetch le HTML et on re-parse côté client si les données semblent corrompues
    const needsReparse =
      (data.skills && /^[éèe]tences/i.test(data.skills)) ||
      (data.saving_throws && /^contre\s/i.test(data.saving_throws)) ||
      (!data.senses && !data.languages);

    if (needsReparse) {
      try {
        const fixedFields = await this.reparseMonsterFields(data.slug || slug);
        if (fixedFields) {
          data.skills = fixedFields.skills || data.skills;
          data.senses = fixedFields.senses || data.senses;
          data.languages = fixedFields.languages || data.languages;
          data.saving_throws = fixedFields.saving_throws || '';
          data.vulnerabilities = fixedFields.vulnerabilities || data.vulnerabilities;
          data.resistances = fixedFields.resistances || data.resistances;
          data.damage_immunities = fixedFields.damage_immunities || data.damage_immunities;
          data.condition_immunities = fixedFields.condition_immunities || data.condition_immunities;
        }
      } catch (e) {
        console.warn('⚠️ Reparse failed, using raw data:', e);
      }
    }

    // Nettoyage final : supprimer les artefacts de parsing
    if (data.skills && /^[éèe]tences\b/i.test(data.skills)) {
      data.skills = data.skills.replace(/^[éèe]tences\s*/i, '');
    }
    if (data.saving_throws && /^contre\s/i.test(data.saving_throws)) {
      data.saving_throws = '';
    }

    return { ...data, source: 'aidedd' } as Monster;
  },

  async reparseMonsterFields(slug: string): Promise<Record<string, string> | null> {
    // Fetch la page HTML directement via un proxy CORS ou via l'edge function en mode debug
    // On utilise l'edge function avec un paramètre spécial pour obtenir le HTML brut
    // Mais comme on ne peut pas modifier l'edge function, on parse le HTML côté client
    // via une approche alternative : on fetch la page aidedd via un proxy
    try {
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-monster?action=raw-html&slug=${encodeURIComponent(slug)}`;
      const res = await fetch(proxyUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      // Si l'edge function ne supporte pas "raw-html", on ne peut rien faire
      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await res.text();
        return this.parseFieldsFromHtml(html);
      }
      return null;
    } catch {
      return null;
    }
  },

  parseFieldsFromHtml(html: string): Record<string, string> {
    const stripHtml = (s: string): string =>
      s.replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&eacute;/g, 'é')
        .replace(/&egrave;/g, 'è')
        .replace(/&agrave;/g, 'à')
        .replace(/&ocirc;/g, 'ô')
        .replace(/&icirc;/g, 'î')
        .replace(/&ucirc;/g, 'û')
        .replace(/&ccedil;/g, 'ç')
        .replace(/&ecirc;/g, 'ê')
        .replace(/&acirc;/g, 'â')
        .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code, 10)))
        .trim();

    const fields: Record<string, string> = {};
    const strongRegex = /<strong>(.*?)<\/strong>\s*(.*?)(?=<br|<strong|<div|<\/div|$)/gis;
    let m;

    while ((m = strongRegex.exec(html)) !== null) {
      const label = stripHtml(m[1]).trim().toLowerCase();
      const value = stripHtml(m[2]).trim();

      if (label.includes('compétences') || label.includes('competences') || label === 'comp.') {
        fields.skills = value;
      } else if (label.includes('sens')) {
        fields.senses = value;
      } else if (label.includes('langues')) {
        fields.languages = value;
      } else if (label.includes('vulnérabilité') || label.includes('vulnerabilite')) {
        fields.vulnerabilities = value;
      } else if (label.includes('résistance') || label.includes('resistance')) {
        fields.resistances = value;
      } else if (label.includes('immunité') && label.includes('dégât')) {
        fields.damage_immunities = value;
      } else if (label.includes('immunité') && label.includes('condition')) {
        fields.condition_immunities = value;
      } else if (label.includes('sauvegarde') || label === 'jds') {
        fields.saving_throws = value;
      }
    }

    return fields;
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

    return (data || []).map((m: any) => {
      // Nettoyer skills corrompus par l'ancien parsing
      if (m.skills && typeof m.skills === 'string' && /^[eéè]tences\b/i.test(m.skills)) {
        m.skills = m.skills.replace(/^[eéè]tences\s*/i, '');
      }
      // Fix: recalculer les HP depuis la formule si hit_points semble incorrect (1 ou 0)
      if (m.hit_points && m.hit_points > 1) return m as Monster;
      // Tenter de parser depuis hit_points_formula (ex: "6d6 + 24")
      if (m.hit_points_formula) {
        const match = m.hit_points_formula.match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/);
        if (match) {
          const numDice = parseInt(match[1], 10);
          const dieSize = parseInt(match[2], 10);
          const bonus = match[3] ? parseInt(match[3].replace(/\s/g, ''), 10) : 0;
          const avgHp = Math.floor(numDice * ((dieSize + 1) / 2)) + bonus;
          if (avgHp > 1) {
            return { ...m, hit_points: avgHp } as Monster;
          }
        }
      }
      return m as Monster;
    });
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

  parseMonsterFromJSON(json: unknown): Monster {
    const data = json as Record<string, unknown>;
    const stats = data.stats as Record<string, unknown> | undefined;
    const flavor = data.flavor as Record<string, unknown> | undefined;

    if (!stats || !data.name) {
      throw new Error('Format JSON invalide: champs requis manquants');
    }

    const abilityScores = stats.abilityScores as Record<string, number> | undefined;
    const savingThrows = stats.savingThrows as Array<{ ability: string; modifier: number }> | undefined;
    const skills = stats.skills as Array<{ name: string; modifier: number }> | undefined;
    const additionalAbilities = stats.additionalAbilities as Array<{ name: string; description: string }> | undefined;
    const actions = stats.actions as Array<{ name: string; description: string }> | undefined;
    const reactions = stats.reactions as Array<{ name: string; description: string }> | undefined;
    const legendaryActions = stats.legendaryActions as Array<{ name: string; description: string }> | undefined;

    const name = String(data.name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const speedRaw = stats.speed;
    let speed: Record<string, string> = {};
    if (typeof speedRaw === 'string') {
      speed = { walk: speedRaw };
    } else if (typeof speedRaw === 'object' && speedRaw !== null) {
      speed = speedRaw as Record<string, string>;
    }

    const formatSavingThrows = (st: typeof savingThrows): string => {
      if (!st || st.length === 0) return '';
      return st.map(s => {
        const abbr = s.ability.slice(0, 3).charAt(0).toUpperCase() + s.ability.slice(1, 3);
        const mod = s.modifier >= 0 ? `+${s.modifier}` : `${s.modifier}`;
        return `${abbr} ${mod}`;
      }).join(', ');
    };

    const formatSkills = (sk: typeof skills): string => {
      if (!sk || sk.length === 0) return '';
      return sk.map(s => {
        const mod = s.modifier >= 0 ? `+${s.modifier}` : `${s.modifier}`;
        return `${s.name} ${mod}`;
      }).join(', ');
    };

    const stripHtml = (str: string): string => {
      return str.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    };

    const formatEntries = (entries: Array<{ name: string; description: string }> | undefined): { name: string; description: string }[] => {
      if (!entries || entries.length === 0) return [];
      return entries.map(e => ({
        name: e.name || '',
        description: stripHtml(e.description || ''),
      }));
    };

    const joinArray = (arr: unknown): string => {
      if (Array.isArray(arr)) return arr.join(', ');
      if (typeof arr === 'string') return arr;
      return '';
    };

      const numHitDie = Number(stats.numHitDie) || 1;
    const hitDieSize = Number(stats.hitDieSize) || 8;
    const conMod = abilityScores ? Math.floor((Number(abilityScores.constitution || 10) - 10) / 2) : 0;
    const extraHp = numHitDie * conMod;
    const hitPointsFormula = `${numHitDie}d${hitDieSize}${extraHp >= 0 ? ` + ${extraHp}` : ` - ${Math.abs(extraHp)}`}`;

    // Calcul robuste des HP : hitPoints direct, sinon parse depuis hitPointsStr, sinon calcul depuis les dés
    const parsedHitPoints = Number(stats.hitPoints);
    const hitPointsFromStr = typeof stats.hitPointsStr === 'string' ? parseInt(stats.hitPointsStr, 10) : NaN;
    const calculatedHp = Math.floor(numHitDie * ((hitDieSize + 1) / 2)) + extraHp;
    const finalHitPoints = (parsedHitPoints > 0 ? parsedHitPoints : NaN)
      || (hitPointsFromStr > 0 ? hitPointsFromStr : NaN)
      || (calculatedHp > 0 ? calculatedHp : 10);

    return {
      source: 'custom',
      slug,
      name,
      size: String(stats.size || 'Medium'),
      type: String(stats.race || 'Unknown'),
      alignment: String(stats.alignment || 'Unaligned'),
      armor_class: Number(stats.armorClass) || 10,
      armor_desc: String(stats.armorType || stats.armorTypeStr || ''),
      hit_points: finalHitPoints,
      hit_points_formula: hitPointsFormula,
      speed,
      abilities: {
        str: abilityScores?.strength || 10,
        dex: abilityScores?.dexterity || 10,
        con: abilityScores?.constitution || 10,
        int: abilityScores?.intelligence || 10,
        wis: abilityScores?.wisdom || 10,
        cha: abilityScores?.charisma || 10,
      },
      saving_throws: formatSavingThrows(savingThrows),
      skills: formatSkills(skills),
      vulnerabilities: joinArray(stats.damageVulnerabilities),
      resistances: joinArray(stats.damageResistances),
      damage_immunities: joinArray(stats.damageImmunities),
      condition_immunities: joinArray(stats.conditionImmunities),
      senses: joinArray(stats.senses),
      languages: joinArray(stats.languages),
      challenge_rating: String(stats.challengeRating ?? '0'),
      xp: Number(stats.experiencePoints) || 0,
      traits: formatEntries(additionalAbilities),
      actions: formatEntries(actions),
      bonus_actions: [],
      reactions: formatEntries(reactions),
      legendary_actions: formatEntries(legendaryActions),
      legendary_description: String(stats.legendaryActionsDescription || ''),
      image_url: flavor?.imageUrl ? String(flavor.imageUrl) : undefined,
    };
  },

  async importMonstersFromJSON(
    campaignId: string,
    jsonData: unknown[],
    existingNames: string[]
  ): Promise<{ imported: Monster[]; errors: string[] }> {
    const imported: Monster[] = [];
    const errors: string[] = [];

    for (const json of jsonData) {
      try {
        const monster = this.parseMonsterFromJSON(json);

        let finalName = monster.name;
        let counter = 2;
        while (existingNames.includes(finalName)) {
          finalName = `${monster.name} (${counter})`;
          counter++;
        }
        monster.name = finalName;
        monster.slug = finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        existingNames.push(finalName);

        const saved = await this.saveToCampaign(campaignId, monster);
        imported.push(saved);
      } catch (err) {
        const name = (json as Record<string, unknown>)?.name || 'Inconnu';
        errors.push(`${name}: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
      }
    }

    return { imported, errors };
  },
};
