import { supabase } from '../lib/supabase';
import { Player } from '../types/dnd';
import { CharacterExportPayload, EnrichedEquipment, ItemMeta } from '../types/CharacterExport';
import { attackService } from './attackService';
import { checkWeaponProficiency, getPlayerWeaponProficiencies } from '../utils/weaponProficiencyChecker';
import { getSpellSlotsByLevel } from '../utils/spellSlots2024';
import inventoryService from './inventoryService'; // ✅ AJOUT

// Skills utilisés par StatsTab (orthographe FR)
const SKILL_GROUPS: Record<'Force' | 'Dextérité' | 'Constitution' | 'Intelligence' | 'Sagesse' | 'Charisme', string[]> = {
  Force: ['Athlétisme'],
  Dextérité: ['Acrobaties', 'Discrétion', 'Escamotage'],
  Constitution: [],
  Intelligence: ['Arcanes', 'Histoire', 'Investigation', 'Nature', 'Religion'],
  Sagesse: ['Dressage', 'Médecine', 'Perception', 'Perspicacité'],
  Charisme: ['Intimidation', 'Persuasion', 'Représentation', 'Tromperie'],
};

const SKILL_NAME_MAP: Record<string, string> = {
  Furtivité: 'Discrétion',
  Performance: 'Représentation',
  Perspicacité: 'Perspicacité',
};

function normalizeSkillForTracker(name: string): string {
  return SKILL_NAME_MAP[name] ?? name;
}

function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function getProficiencyBonusForLevel(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function feetToMeters(ft?: number): number {
  const n = Number(ft);
  if (!Number.isFinite(n)) return 9;
  return Math.round(n * 0.3048 * 2) / 2;
}

function buildAbilitiesForTracker(
  finalAbilities: Record<string, number>, 
  proficientSkillsRaw: string[], 
  level: number,
  savingThrowProficiencies: string[] = [] // ✅ NOUVEAU PARAMÈTRE
) {
  const proficiency = getProficiencyBonusForLevel(level);
  const profSet = new Set(proficientSkillsRaw.map(normalizeSkillForTracker));
  const savingThrowSet = new Set(savingThrowProficiencies); // ✅ NOUVEAU

  const ORDER: Array<keyof typeof finalAbilities> = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

  return ORDER.map((abilityName) => {
    const score = Number(finalAbilities[abilityName] ?? 10);
    const modifier = getModifier(score);

    const skills = (SKILL_GROUPS as any)[abilityName] as string[];
    const skillsDetails = skills.map((skillName) => {
      const isProficient = profSet.has(skillName);
      const hasExpertise = false;
      const bonus = modifier + (isProficient ? proficiency : 0);
      return { name: skillName, bonus, isProficient, hasExpertise };
    });

    // ✅ Appliquer le bonus de maîtrise si cette caractéristique est dans savingThrows
    const isSavingThrowProficient = savingThrowSet.has(abilityName);
    const savingThrow = modifier + (isSavingThrowProficient ? proficiency : 0);

    return { name: abilityName, score, modifier, savingThrow, skills: skillsDetails };
  });
}

async function tryUploadAvatarFromUrl(playerId: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    // Déduire le content-type/extension
    const contentType = blob.type || 'image/png';
    const ext = (() => {
      const t = contentType.split('/')[1]?.toLowerCase();
      if (t === 'jpeg') return 'jpg';
      return t || 'png';
    })();

    const fileName = `class-${Date.now()}.${ext}`;
    const filePath = `${playerId}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, { upsert: true, contentType });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl || null;
  } catch (e) {
    console.warn('Upload avatar depuis URL/dataURL impossible, fallback sur URL directe:', e);
    return null;
  }
}

const META_PREFIX = '#meta:';

const stripPriceParentheses = (name: string) =>
  name.replace(/\s*\((?:\d+|\w+|\s|,|\.|\/|-)+\s*p[oa]?\)\s*$/i, '').trim();

const smartCapitalize = (name: string) => {
  const base = stripPriceParentheses(name).trim();
  if (!base) return '';
  const lower = base.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

function injectMetaIntoDescription(desc: string, meta: ItemMeta): string {
  const metaLine = `${META_PREFIX}${JSON.stringify(meta)}`;
  return desc ? `${desc}\n${metaLine}` : metaLine;
}

async function insertEquipmentIntoInventory(
  playerId: string,
  items: EnrichedEquipment[]
): Promise<void> {
  if (!items || items.length === 0) return;

  const insertions = items.map(item => ({
    player_id: playerId,
    name: smartCapitalize(item.name),
    description: injectMetaIntoDescription(item.description, item.meta),
  }));

  const { error } = await supabase
    .from('inventory_items')
    .insert(insertions);

  if (error) {
    console.error('Erreur insertion équipements:', error);
    throw error;
  }
}

async function createWeaponAttack(
  playerId: string,
  weaponName: string,
  weaponMeta: any,
  player: Player
): Promise<void> {
  try {
    console.log('[createWeaponAttack] 🗡️ Création attaque pour:', weaponName);
    console.log('[createWeaponAttack] Player ID:', playerId);
    console.log('[createWeaponAttack] Weapon meta:', weaponMeta);
    
    const weaponProficiencies = getPlayerWeaponProficiencies(player);
    console.log('[createWeaponAttack] Proficiencies du player:', weaponProficiencies);
    
    const explicitCategory = weaponMeta?.category;
    const weaponProperties = weaponMeta?.properties;
    const proficiencyResult = checkWeaponProficiency(weaponName, weaponProficiencies, explicitCategory, weaponProperties);
    
    console.log('[createWeaponAttack] Résultat proficiency check:', proficiencyResult);

    const payload = {
      player_id: playerId,
      name: weaponName,
      damage_dice: weaponMeta.damageDice || '1d6',
      damage_type: weaponMeta.damageType || 'Tranchant',
      range: weaponMeta.range || 'Corps à corps',
      properties: weaponMeta.properties || '',
      manual_attack_bonus: null,
      manual_damage_bonus: null,
      expertise: proficiencyResult.shouldApplyProficiencyBonus,
      attack_type: 'physical' as const,
      spell_level: null as any,
      ammo_count: 0,
    };

    console.log('[createWeaponAttack] Payload à insérer:', payload);
    const result = await attackService.addAttack(payload);
    console.log('[createWeaponAttack] ✅ Attaque créée avec succès:', result);
  } catch (err) {
    console.error('[createWeaponAttack] ❌ ERREUR création attaque:', err);
    console.error('[createWeaponAttack] Stack trace:', err);
  }
}

async function autoEquipItems(
  playerId: string,
  items: EnrichedEquipment[],
  player: Player
): Promise<void> {
  const { data: inventoryItems, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('player_id', playerId);

  if (error || !inventoryItems) {
    console.error('Impossible de récupérer l\'inventaire:', error);
    return;
  }

  console.log('[autoEquipItems] Items reçus:', items.map(i => ({ name: i.name, type: i.meta.type, autoEquip: i.autoEquip })));
  const toEquip = items.filter(item => item.autoEquip);
  console.log('[autoEquipItems] Items à équiper:', toEquip.map(i => ({ name: i.name, type: i.meta.type })));

  // Récupérer le player le plus à jour
  const { data: freshPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (!freshPlayer) {
    console.error('Impossible de récupérer le player');
    return;
  }



  // Équiper l'armure
  const armorItem = toEquip.find(item => item.meta.type === 'armor');
  if (armorItem) {
    console.log('[autoEquipItems] Armure trouvée à équiper:', armorItem.name);
    const dbItem = inventoryItems.find(i =>
      smartCapitalize(i.name) === smartCapitalize(armorItem.name)
    );
    console.log('[autoEquipItems] DB item trouvé:', dbItem ? `${dbItem.name} (id: ${dbItem.id})` : 'NON TROUVÉ');
    if (dbItem) {
      console.log('[autoEquipItems] Appel de equipItem pour l\'armure:', armorItem.name);
      const success = await inventoryService.equipItem(playerId, dbItem, freshPlayer, 'armor');
      console.log('[autoEquipItems] Résultat equipItem armure:', success ? 'SUCCÈS' : 'ÉCHEC');
    } else {
      console.error('[autoEquipItems] ERREUR: Impossible de trouver l\'armure dans l\'inventaire DB');
    }
  } else {
    console.log('[autoEquipItems] Aucune armure à équiper dans toEquip');
  }

  // IMPORTANT : Récupérer le player à jour APRÈS l'armure et AVANT le bouclier
  const { data: playerAfterArmor } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (!playerAfterArmor) {
    console.error('[autoEquipItems] Impossible de récupérer le player après armure');
    return;
  }

  console.log('[autoEquipItems] Player après armure:', {
    hasArmor: !!playerAfterArmor.equipment?.armor,
    equipment: playerAfterArmor.equipment
  });

  // Équiper le bouclier
  const shieldItem = toEquip.find(item => item.meta.type === 'shield');
  if (shieldItem) {
    console.log('[autoEquipItems] Bouclier trouvé à équiper:', shieldItem.name);
    const dbItem = inventoryItems.find(i =>
      smartCapitalize(i.name) === smartCapitalize(shieldItem.name)
    );
    console.log('[autoEquipItems] DB item trouvé:', dbItem ? `${dbItem.name} (id: ${dbItem.id})` : 'NON TROUVÉ');
    if (dbItem) {
      console.log('[autoEquipItems] Appel de equipItem pour le bouclier:', shieldItem.name);
      const success = await inventoryService.equipItem(playerId, dbItem, playerAfterArmor, 'shield');
      console.log('[autoEquipItems] Résultat equipItem bouclier:', success ? 'SUCCÈS' : 'ÉCHEC');
    } else {
      console.error('[autoEquipItems] ERREUR: Impossible de trouver le bouclier dans l\'inventaire DB');
    }
  } else {
    console.log('[autoEquipItems] Aucun bouclier à équiper dans toEquip');
  }



   // ✅ CORRECTION: Récupérer le player APRÈS équipement armure/bouclier
  const { data: playerAfterArmorShield } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();

  if (!playerAfterArmorShield) {
    console.error('[autoEquipItems] Impossible de récupérer le player après armure/bouclier');
    return;
  }

  console.log('[autoEquipItems] Player après armure/bouclier:', {
    hasArmor: !!playerAfterArmorShield.equipment?.armor,
    hasShield: !!playerAfterArmorShield.equipment?.shield,
    equipment: playerAfterArmorShield.equipment
  });

  // Équiper les armes
  const weaponItems = toEquip.filter(item => item.meta.type === 'weapon');
  if (weaponItems.length > 0) {
    const equippedWeapons = [];
    const equippedWeaponNames = new Set<string>();
    const inventoryUpdates: Promise<any>[] = [];

    for (const weaponItem of weaponItems) {
      const normalizedName = smartCapitalize(weaponItem.name);
      if (equippedWeaponNames.has(normalizedName)) {
        continue;
      }

      const dbItem = inventoryItems.find(i =>
        smartCapitalize(i.name) === normalizedName
      );
      if (dbItem && weaponItem.meta.weapon) {
        equippedWeapons.push({
          inventory_item_id: dbItem.id,
          name: weaponItem.name,
          description: weaponItem.description,
          weapon_meta: weaponItem.meta.weapon,
        });

        equippedWeaponNames.add(normalizedName);

        const updatedMeta = { ...weaponItem.meta, equipped: true };
        const updatedDesc = injectMetaIntoDescription(weaponItem.description, updatedMeta);
        inventoryUpdates.push(
          supabase
            .from('inventory_items')
            .update({ description: updatedDesc })
            .eq('id', dbItem.id)
        );
        console.log('[autoEquipItems] Arme marquée comme équipée:', weaponItem.name);

        // ✅ CORRECTION: Utiliser playerAfterArmorShield au lieu de updatedPlayer
        await createWeaponAttack(
          playerId,
          weaponItem.name,
          weaponItem.meta.weapon,
          playerAfterArmorShield
        );
      }
    }

    if (inventoryUpdates.length > 0) {
      await Promise.allSettled(inventoryUpdates);
    }

    if (equippedWeapons.length > 0) {
      // ✅ CORRECTION: Utiliser playerAfterArmorShield.equipment au lieu de updatedPlayer.equipment
      const equipmentUpdates = {
        ...playerAfterArmorShield.equipment,
        weapons: equippedWeapons
      };

      const { error: updateError } = await supabase
        .from('players')
        .update({ equipment: equipmentUpdates })
        .eq('id', playerId);

      if (updateError) {
        console.error('Erreur mise à jour armes:', updateError);
      } else {
        console.log('[autoEquipItems] Armes mises à jour avec succès');
      }
    }
  }

  console.log('[autoEquipItems] Auto-équipement terminé');
}

async function insertSpellsForCharacter(
  playerId: string,
  selectedCantrips: any[],
  selectedLevel1Spells: any[]
): Promise<void> {
  const allSpells = [...selectedCantrips, ...selectedLevel1Spells];

  if (allSpells.length === 0) {
    console.log('[insertSpellsForCharacter] Aucun sort à insérer');
    return;
  }

  try {
    console.log(`[insertSpellsForCharacter] Insertion de ${allSpells.length} sorts pour le personnage ${playerId}`);

    const spellsToInsert = allSpells.map(spell => ({
      id: spell.id,
      name: spell.name,
      level: spell.level,
      school: spell.school,
      casting_time: spell.casting_time,
      range: spell.range,
      components: spell.components,
      duration: spell.duration,
      description: spell.description,
      higher_levels: spell.higher_levels || null,
    }));

    const { error: spellsError } = await supabase
      .from('spells')
      .upsert(spellsToInsert, {
        onConflict: 'id',
        ignoreDuplicates: true
      });

    if (spellsError) {
      console.error('[insertSpellsForCharacter] Erreur insertion sorts:', spellsError);
      throw spellsError;
    }

const playerSpellsLinks = allSpells.map(spell => ({
  player_id: playerId,
  spell_id: spell.id,
  is_prepared: true,  // ✅ SOLUTION : marquer comme préparé par défaut
}));

    const { error: linksError } = await supabase
      .from('player_spells')
      .upsert(playerSpellsLinks, {
        onConflict: 'player_id,spell_id',
        ignoreDuplicates: true,
      });

    if (linksError) {
      console.error('[insertSpellsForCharacter] Erreur création liens player_spells:', linksError);
      throw linksError;
    }

    console.log(`[insertSpellsForCharacter] ${allSpells.length} sorts insérés avec succès`);
  } catch (error) {
    console.error('[insertSpellsForCharacter] Erreur lors de l\'insertion des sorts:', error);
    throw error;
  }
}

export async function createCharacterFromCreatorPayload(
  session: any,
  payload: CharacterExportPayload
): Promise<Player> {
  if (!session?.user?.id) throw new Error('Session invalide');

  // 1) Création de base (retourne l'id)
  const { data: playerId, error: rpcError } = await supabase.rpc('create_player_with_defaults', {
    p_user_id: session.user.id,
    p_name: payload.characterName,
    p_adventurer_name: payload.characterName,
  });
  if (rpcError) throw rpcError;

  // 2) Construction des données
  const level = Math.max(1, payload.level ?? 1);
  const proficiency_bonus = getProficiencyBonusForLevel(level);

 const abilitiesArray = buildAbilitiesForTracker(
  payload.finalAbilities || {}, 
  payload.proficientSkills || [], 
  level,
  payload.savingThrows || [] // ✅ PASSER LES SAVING THROWS
);

  // Don d’historique → feats.origins/origin
  const feats: any = {
    origins: payload.backgroundFeat ? [payload.backgroundFeat] : [],
  };
  if (feats.origins.length > 0) feats.origin = feats.origins[0];

  // Argent
  const initialGold =
    typeof payload.gold === 'number'
      ? Math.max(0, payload.gold)
      : payload.selectedBackgroundEquipmentOption === 'A'
      ? 50
      : payload.selectedBackgroundEquipmentOption === 'B'
      ? 15
      : 0;

  const coins = { gp: initialGold, sp: 0, cp: 0 };

  const stats = {
    armor_class: payload.armorClass ?? 10,
    initiative: payload.initiative ?? getModifier((payload.finalAbilities || {})['Dextérité'] ?? 10),
    speed: feetToMeters(payload.speed ?? 30), // mètres (SettingsModal)
    proficiency_bonus,
    inspirations: 0,
    feats,
    coins, // compat
    gold: initialGold, // compat éventuelle
    creator_meta: {
      weapon_proficiencies: payload.weaponProficiencies || [],
      armor_proficiencies: payload.armorProficiencies || [],
      tool_proficiencies: payload.toolProficiencies || [],
      custom_race: payload.customRaceData || null, // ✅ AJOUTER cette ligne
    },
    weapon_proficiencies: payload.weaponProficiencies || [],
    armor_proficiencies: payload.armorProficiencies || [],
  };

  // 3) Update robuste sur des colonnes existantes
const { error: updError } = await supabase
  .from('players')
  .update({
    class: payload.selectedClass || null,
    level,
    race: payload.selectedRace || null,
    background: payload.selectedBackground || null,
    max_hp: payload.hitPoints,
    current_hp: payload.hitPoints,
    abilities: abilitiesArray,
    stats,
    hit_dice: payload.hitDice
      ? { total: payload.hitDice.total, used: payload.hitDice.used, die: payload.hitDice.die }
      : { total: level, used: 0 },

    // Argent top-level (utilisé par EquipmentTab)
    gold: initialGold,
    silver: 0,
    copper: 0,

    // ✅ AJOUT : Champs de profil
    alignment: payload.selectedAlignment || null,
   languages: (payload.selectedLanguages || []).filter(lang => 
      lang && 
      lang.trim() !== '' && 
      !lang.toLowerCase().includes('au choix') &&
      !lang.toLowerCase().includes('choisir')
    ),
    age: payload.age || null,
    gender: payload.gender || null,
    character_history: payload.characterHistory || null,
  })
  .eq('id', playerId);
  if (updError) throw updError;

  if (payload.avatarImageUrl) {
    const uploaded = await tryUploadAvatarFromUrl(playerId as string, payload.avatarImageUrl);
    const finalUrl = uploaded ?? payload.avatarImageUrl;
    const { error: avatarErr } = await supabase
      .from('players')
      .update({ avatar_url: finalUrl })
      .eq('id', playerId);
    if (avatarErr) console.warn('Impossible de fixer avatar_url:', avatarErr);
  }

  // Récupérer le player AVANT l'équipement (pour passer à autoEquipItems)
  const { data: playerBeforeEquip, error: fetchError1 } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();
  if (fetchError1) throw fetchError1;

  if (payload.equipmentDetails && payload.equipmentDetails.length > 0) {
    try {
      await insertEquipmentIntoInventory(playerId as string, payload.equipmentDetails);
      await autoEquipItems(playerId as string, payload.equipmentDetails, playerBeforeEquip as Player);
    } catch (error) {
      console.error('Erreur lors de l\'insertion/équipement des items:', error);
    }
  }

// IMPORTANT: Initialiser les spell_slots pour toutes les classes de lanceurs de sorts
// Cela permet aux boutons Zap d'apparaître immédiatement après la création du personnage
const spellcasters = ['Magicien', 'Ensorceleur', 'Barde', 'Clerc', 'Druide', 'Paladin', 'Rôdeur', 'Occultiste'];
if (payload.selectedClass && spellcasters.includes(payload.selectedClass)) {
  try {
    // 1) Initialiser les spell_slots selon la classe et le niveau
    const initialSpellSlots = getSpellSlotsByLevel(payload.selectedClass, level);

    console.log('🎯 [AVANT UPDATE] Initialisation des spell_slots pour', payload.selectedClass, 'niveau', level, ':', initialSpellSlots);

    const { error: spellSlotsError } = await supabase
      .from('players')
      .update({ spell_slots: initialSpellSlots })
      .eq('id', playerId);

    if (spellSlotsError) {
      console.error('❌ [ERREUR] Erreur lors de l\'initialisation des spell_slots:', spellSlotsError);
      throw spellSlotsError;
    }

    console.log('✅ [SUCCÈS] Spell slots initialisés avec succès !');

    // ✅ AJOUTER : Vérifier que ça a bien été sauvegardé
    const { data: verif } = await supabase
      .from('players')
      .select('spell_slots')
      .eq('id', playerId)
      .single();
    
    console.log('🔍 [VERIFICATION] Spell slots en base après update:', verif?.spell_slots);

  } catch (error) {
    console.error('💥 [CATCH] Erreur lors de l\'initialisation des spell_slots:', error);
  }
}

  // 2) Insérer les sorts s'il y en a
  if (payload.selectedCantrips || payload.selectedLevel1Spells) {
    try {
      await insertSpellsForCharacter(
        playerId as string,
        payload.selectedCantrips || [],
        payload.selectedLevel1Spells || []
      );
    } catch (error) {
      console.error('Erreur lors de l\'insertion des sorts:', error);
    }
  }

  // IMPORTANT : Récupérer le player APRÈS l'équipement pour avoir les données à jour
  const { data: finalPlayer, error: fetchError2 } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .single();
  if (fetchError2) throw fetchError2;

  console.log('[createCharacterFromCreatorPayload] Player final retourné avec equipment:', finalPlayer?.equipment);
  return finalPlayer as Player;
}