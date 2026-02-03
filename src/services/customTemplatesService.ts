import { supabase } from '../lib/supabase';
import type { DndRace, CustomClassData } from '../features/character-creator/types/character';

// =====================
// RACES PERSONNALISÉES
// =====================

export async function getUserCustomRaces(): Promise<DndRace[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];

  const { data, error } = await supabase
    .from('user_custom_races')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('name');

  if (error) {
    console.error('Erreur chargement races personnalisées:', error);
    return [];
  }

  return (data || []).map((row) => ({
    name: row.name,
    description: row.description || '',
    speed: row.speed || 30,
    size: row.size || 'Medium',
    traits: row.traits || [],
    languages: row.languages || [],
    proficiencies: row.proficiencies || [],
    abilityScoreIncrease: row.ability_score_increase || {},
    isCustom: true,
  }));
}

export async function saveUserCustomRace(race: DndRace): Promise<{ success: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { success: false, error: 'Non authentifié' };
  }

  const { error } = await supabase
    .from('user_custom_races')
    .upsert({
      user_id: auth.user.id,
      name: race.name,
      description: race.description,
      speed: race.speed,
      size: race.size,
      traits: race.traits,
      languages: race.languages,
      proficiencies: race.proficiencies || [],
      ability_score_increase: race.abilityScoreIncrease || {},
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,name',
    });

  if (error) {
    console.error('Erreur sauvegarde race personnalisée:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteUserCustomRace(raceName: string): Promise<{ success: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { success: false };

  const { error } = await supabase
    .from('user_custom_races')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('name', raceName);

  return { success: !error };
}

// =====================
// CLASSES PERSONNALISÉES
// =====================

export async function getUserCustomClasses(): Promise<CustomClassData[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];

  const { data, error } = await supabase
    .from('user_custom_classes')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('name');

  if (error) {
    console.error('Erreur chargement classes personnalisées:', error);
    return [];
  }

  return (data || []).map((row) => ({
    name: row.name,
    description: row.description || '',
    hitDie: row.hit_die || 8,
    primaryAbility: row.primary_ability || [],
    savingThrows: row.saving_throws || [],
    skillProficiencies: row.skill_proficiencies || [],
    weaponProficiencies: row.weapon_proficiencies || [],
    armorProficiencies: row.armor_proficiencies || [],
    toolProficiencies: row.tool_proficiencies || [],
    equipment: row.equipment || [],
    equipmentOptions: row.equipment_options || [],
    resources: row.resources || [],
    abilities: row.abilities || [],
    features: row.features || [],
    spellcasting: row.spellcasting || null,
    isCustom: true,
  }));
}

export async function saveUserCustomClass(classData: CustomClassData): Promise<{ success: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { success: false, error: 'Non authentifié' };
  }

  const { error } = await supabase
    .from('user_custom_classes')
    .upsert({
      user_id: auth.user.id,
      name: classData.name,
      description: classData.description,
      hit_die: classData.hitDie,
      primary_ability: classData.primaryAbility,
      saving_throws: classData.savingThrows,
      skill_proficiencies: (classData as any).skillProficiencies || [],
      weapon_proficiencies: (classData as any).weaponProficiencies || [],
      armor_proficiencies: (classData as any).armorProficiencies || [],
      tool_proficiencies: (classData as any).toolProficiencies || [],
      equipment: (classData as any).equipment || [],
      equipment_options: (classData as any).equipmentOptions || [],
      resources: classData.resources || [],
      abilities: classData.abilities || [],
      features: (classData as any).features || [],
      spellcasting: (classData as any).spellcasting || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,name',
    });

  if (error) {
    console.error('Erreur sauvegarde classe personnalisée:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteUserCustomClass(className: string): Promise<{ success: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { success: false };

  const { error } = await supabase
    .from('user_custom_classes')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('name', className);

  return { success: !error };
}


// =====================
// HISTORIQUES PERSONNALISÉS
// =====================

export async function getUserCustomBackgrounds(): Promise<CustomBackgroundData[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];

  const { data, error } = await supabase
    .from('user_custom_backgrounds')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('name');

  if (error) {
    console.error('Erreur chargement historiques personnalisés:', error);
    return [];
  }

  return (data || []).map((row) => ({
    name: row.name,
    description: row.description || '',
    abilityScores: row.ability_scores || [],
    feat: row.feat || '',
    skillProficiencies: row.skill_proficiencies || [],
    toolProficiencies: row.tool_proficiencies || [],
    equipmentOptions: row.equipment_options || { optionA: [], optionB: [] },
    isCustom: true,
  }));
}

export async function saveUserCustomBackground(background: CustomBackgroundData): Promise<{ success: boolean; error?: string }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { success: false, error: 'Non authentifié' };
  }

  const { error } = await supabase
    .from('user_custom_backgrounds')
    .upsert({
      user_id: auth.user.id,
      name: background.name,
      description: background.description,
      ability_scores: background.abilityScores,
      feat: background.feat,
      skill_proficiencies: background.skillProficiencies,
      tool_proficiencies: background.toolProficiencies,
      equipment_options: background.equipmentOptions,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,name',
    });

  if (error) {
    console.error('Erreur sauvegarde historique personnalisé:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteUserCustomBackground(backgroundName: string): Promise<{ success: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { success: false };

  const { error } = await supabase
    .from('user_custom_backgrounds')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('name', backgroundName);

  return { success: !error };
}