import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// --- CONSTANTES DE MAPPING ---

// Mapping des compétences (Ordre PDF anglais -> Nom FR dans votre app)
const SKILL_MAPPING: Record<string, number> = {
  'Acrobaties': 1, 'Dressage': 2, 'Arcanes': 3, 'Athlétisme': 4,
  'Tromperie': 5, 'Histoire': 6, 'Perspicacité': 7, 'Intimidation': 8,
  'Investigation': 9, 'Médecine': 10, 'Nature': 11, 'Perception': 12,
  'Représentation': 13, 'Persuasion': 14, 'Religion': 15,
  'Escamotage': 16, 'Discrétion': 17, 'Survie': 18
};

const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

const SPELLCASTING_ABILITY: Record<string, string> = {
  'Magicien': 'Intelligence', 'Artificier': 'Intelligence', 'Guerrier': 'Intelligence', // Eldritch Knight
  'Clerc': 'Sagesse', 'Druide': 'Sagesse', 'Rôdeur': 'Sagesse', 'Moine': 'Sagesse',
  'Barde': 'Charisme', 'Ensorceleur': 'Charisme', 'Occultiste': 'Charisme', 'Paladin': 'Charisme'
};

// --- HELPERS ---

const getMod = (score: number) => Math.floor((score - 10) / 2);

const getProficiency = (level: number) => {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
};

function getHitDieSize(className?: string | null): number {
    if (!className) return 8;
    const c = className.toLowerCase();
    if (c.includes('barbare')) return 12;
    if (c.includes('guerrier') || c.includes('paladin') || c.includes('rôdeur') || c.includes('rodeur')) return 10;
    if (c.includes('magicien') || c.includes('ensorceleur')) return 6;
    return 8; // Clerc, Barde, Druide, Roublard, Moine, Occultiste, Artificier
}

// Parser pour les métadonnées d'inventaire (#meta:{...})
function parseMeta(description: string | null | undefined) {
  if (!description) return null;
  const lines = description.split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith('#meta:'));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine.slice(6));
  } catch {
    return null;
  }
}

export const generateCharacterSheet = async (player: Player) => {
  try {
    // 1. Charger le PDF
    const formBytes = await fetch('/FDP/eFeuillePersoDD2024.pdf').then(res => {
      if (!res.ok) throw new Error("Impossible de charger le template PDF");
      return res.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(formBytes);
    const form = pdfDoc.getForm();

    // --- Helpers Setters ---
    const setTxt = (name: string, val: any) => {
      try {
        const strVal = val === null || val === undefined ? '' : String(val);
        form.getTextField(name).setText(strVal);
      } catch (e) {}
    };
    const setBonus = (name: string, val: number) => {
      try {
        const prefix = val >= 0 ? '+' : '';
        form.getTextField(name).setText(`${prefix}${val}`);
      } catch (e) {}
    };
    const setChk = (name: string, isChecked: boolean) => {
      try {
        const field = form.getCheckBox(name);
        if (isChecked) field.check(); else field.uncheck();
      } catch (e) {}
    };

    // 2. Récupération des données externes (Supabase)
    // On lance toutes les requêtes en parallèle pour la vitesse
    const [inventoryRes, spellsRes, featuresRes] = await Promise.all([
        supabase.from('inventory_items').select('*').eq('player_id', player.id),
        supabase.from('player_spells').select('spells (name, level)').eq('player_id', player.id).order('created_at', { ascending: true }),
        supabase.from('feature_checks').select('feature_key').eq('player_id', player.id).eq('checked', true)
    ]);

    const inventoryItems = inventoryRes.data || [];
    const spellList = spellsRes.data || [];
    const featureList = featuresRes.data || [];

    // 3. Parsing des données locales
    
    // Stats (Priorité à player.abilities qui est la structure utilisée par StatsTab)
    let abilitiesData: any[] = [];
    if (player.abilities && Array.isArray(player.abilities)) {
        abilitiesData = player.abilities;
    } else if (typeof player.abilities_json === 'string') {
        try { abilitiesData = JSON.parse(player.abilities_json); } catch {}
    }

    const stats = player.stats || {};
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};
    const level = player.level || 1;
    const pb = getProficiency(level);

    // --- Remplissage : Identité ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('level', level);
    setTxt('species', player.race);
    setTxt('background', player.background);
    setTxt('alignment', player.alignment);
    
    // Langues
    const langs = Array.isArray(player.languages) ? player.languages.join(', ') : (player.languages || '');
    setTxt('languages', langs);

    // --- Remplissage : Caractéristiques & Compétences ---
    const statKeyMap: Record<string, string> = {
        'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con',
        'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha'
    };

    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);

            // Sauvegardes
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                setBonus(`save${num}`, ab.savingThrow);
                // On coche si la save est supérieure au modificateur (signe de maîtrise)
                setChk(`s${num}`, ab.savingThrow > ab.modifier);
            }

            // Compétences
            if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const idx = SKILL_MAPPING[sk.name];
                    if (idx) {
                        setBonus(`skill${idx}`, sk.bonus);
                        setChk(`sk${idx}`, sk.isProficient || sk.hasExpertise);
                    }
                });
            }
        }
    });

    // --- Remplissage : Combat ---
    // CA : on prend celle stockée (calculée par StatsTab) ou 10 par défaut
    setTxt('ac', (stats as any).armor_class || 10);
    setBonus('init', (stats as any).initiative || 0);
    setTxt('speed', (stats as any).speed || 9);
    setBonus('pb', pb);

    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    setTxt('hp-temp', player.temporary_hp || '');

    // Dés de vie
    const hitDieSize = getHitDieSize(player.class);
    const hitDiceInfo = player.hit_dice as any;
    const totalHD = hitDiceInfo?.total ?? level;
    const usedHD = hitDiceInfo?.used ?? 0;
    setTxt('hd-max', `${totalHD}d${hitDieSize}`);
    setTxt('hd-spent', usedHD);

    // --- Remplissage : Magie ---
    // 1. Stats Magiques (DD, Bonus)
    const castingStatName = SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence'; // Fallback
    const castingStat = abilitiesData.find((a: any) => a.name === castingStatName);
    if (castingStat) {
        setTxt('spell-ability', castingStatName);
        const mod = castingStat.modifier;
        setTxt('spell-dc', 8 + pb + mod);
        setBonus('spell-bonus', pb + mod);
        setBonus('spell-mod', mod);
    }

    // 2. Slots
    for (let i = 1; i <= 9; i++) {
        const key = `level${i}`;
        // spellSlots contient souvent { level1: 4, used1: 0 }
        if (spellSlots[key]) setTxt(`slot${i}`, spellSlots[key]);
    }

    // 3. Liste des Sorts (depuis player_spells)
    spellList.slice(0, 30).forEach((item: any, idx: number) => {
        if (item.spells?.name) {
            setTxt(`spell${idx + 1}`, item.spells.name);
        }
    });

    // --- Remplissage : Armes & Équipement (depuis inventory_items) ---
    
    const weapons: any[] = [];
    const gear: string[] = [];

    inventoryItems.forEach((item: any) => {
        const meta = parseMeta(item.description);
        
        if (meta?.type === 'weapon') {
            // C'est une arme
            // On vérifie si elle est équipée pour la mettre dans la grille
            if (meta.equipped) {
                weapons.push({ name: item.name, meta: meta.weapon, proficient: true }); // On suppose la maitrise si équipé
            } else {
                // Arme dans le sac
                gear.push(`${item.name} (Arme)`);
            }
        } else if (meta?.type === 'armor' || meta?.type === 'shield') {
             if (meta.equipped) {
                 // Note : Le PDF n'a pas de case dédiée "Armure portée", on la met dans l'équipement
                 gear.push(`${item.name} (Équipé)`);
             } else {
                 gear.push(item.name);
             }
        } else {
            // Autre équipement
            gear.push(item.name);
        }
    });

    // Remplir la grille d'armes (max 6)
    weapons.slice(0, 6).forEach((w, i) => {
        const row = i + 1;
        setTxt(`weapons${row}1`, w.name);
        
        // Calcul dégâts
        if (w.meta) {
            const dmg = `${w.meta.damageDice || ''} ${w.meta.damageType || ''}`;
            setTxt(`weapons${row}3`, dmg.trim());
            setTxt(`weapons${row}4`, w.meta.properties || '');
            
            // Bonus Attaque (approximatif car pas stocké explicitement sur l'objet)
            // On essaie de deviner la carac
            const isFinesse = w.meta.properties?.toLowerCase().includes('finesse') || w.meta.range?.includes('m');
            const statName = isFinesse ? 'Dextérité' : 'Force';
            const stat = abilitiesData.find(a => a.name === statName);
            if (stat) {
                const atk = stat.modifier + pb + (w.meta.weapon_bonus || 0);
                setBonus(`weapons${row}2`, atk);
            }
        }
    });

    // Remplir la zone équipement
    setTxt('equipment', gear.join(', '));
    
    // Or
    setTxt('gp', player.gold || 0);
    setTxt('sp', player.silver || 0);
    setTxt('cp', player.copper || 0);

    // --- Remplissage : Traits & Capacités ---
    
    // 1. Dons (depuis stats)
    const feats = (player.stats as any)?.feats || {};
    const featsList = [
        ...(feats.origins || []),
        ...(feats.generals || []),
        ...(feats.styles || [])
    ].filter(Boolean).join('\n');
    setTxt('feats', featsList);

    // 2. Traits (Race)
    setTxt('traits', player.race ? `Trait racial: ${player.race}` : '');

    // 3. Capacités de Classe (depuis feature_checks)
    // On récupère les clés cochées dans ClassesTab (ex: "Barbare-Niveau 1 : Rage")
    // On nettoie le texte pour que ça rentre
    const classFeatures = featureList
        .map((f: any) => {
            // "Barbare-Niveau 1 : Rage" -> "Rage"
            const parts = f.feature_key.split(':');
            return parts.length > 1 ? parts[1].trim() : f.feature_key;
        })
        .join(', '); // Ou '\n' si beaucoup de place, mais la case 'features1' est petite
    
    setTxt('features1', classFeatures); // Case "Aptitudes de classe"
    // setTxt('features2', ...); // Si besoin d'une 2eme case

    // 4. Export
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${player.adventurer_name || 'Perso'}_Fiche.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error("Erreur export PDF:", err);
    throw err;
  }
};