import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// --- CONFIGURATION ---
const REPO_URL = 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main';

const SKILL_MAPPING: Record<string, number> = {
  'Acrobaties': 1, 'Dressage': 2, 'Arcanes': 3, 'Athlétisme': 4,
  'Tromperie': 5, 'Histoire': 6, 'Perspicacité': 7, 'Intimidation': 8,
  'Investigation': 9, 'Médecine': 10, 'Nature': 11, 'Perception': 12,
  'Représentation': 13, 'Persuasion': 14, 'Religion': 15,
  'Escamotage': 16, 'Discrétion': 17, 'Survie': 18
};

const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

const SPELLCASTING_ABILITY: Record<string, string> = {
  'Magicien': 'Intelligence', 'Artificier': 'Intelligence', 'Guerrier': 'Intelligence',
  'Clerc': 'Sagesse', 'Druide': 'Sagesse', 'Rôdeur': 'Sagesse', 'Moine': 'Sagesse',
  'Barde': 'Charisme', 'Ensorceleur': 'Charisme', 'Occultiste': 'Charisme', 'Paladin': 'Charisme'
};

// --- HELPERS PARSING MARKDOWN ---

// Récupère le texte brut d'un fichier MD
async function fetchMarkdown(path: string): Promise<string> {
  try {
    // On gère les espaces et accents dans l'URL
    const cleanPath = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${REPO_URL}/${cleanPath}`);
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    console.warn(`Impossible de charger ${path}`, e);
    return '';
  }
}

// Extrait les titres de capacités de classe (Format: ### NIVEAU X : TITRE)
function parseClassFeatures(md: string, level: number): string[] {
  const features: string[] = [];
  const regex = /^###\s+NIVEAU\s+(\d+)\s*:\s*(.+)$/gim;
  let match;
  
  while ((match = regex.exec(md)) !== null) {
    const lvl = parseInt(match[1], 10);
    if (lvl <= level) {
      // On nettoie le titre (enlève le gras markdown s'il y en a)
      features.push(match[2].replace(/\*\*/g, '').trim());
    }
  }
  return features;
}

// Extrait les traits raciaux (Cherche la section de la race, puis les lignes **Trait.**)
function parseRaceTraits(md: string, raceName: string): string[] {
  if (!raceName) return [];
  const traits: string[] = [];
  
  // Normalisation pour la recherche
  const normalizedRace = raceName.toUpperCase().split(' ')[0]; // ex: "ELFE" pour "Elfe Sylvestre"
  
  // Trouver le début de la section race (### NOM)
  const lines = md.split('\n');
  let inRaceSection = false;
  
  for (const line of lines) {
    if (line.startsWith('###')) {
      if (line.toUpperCase().includes(normalizedRace)) {
        inRaceSection = true;
      } else {
        inRaceSection = false; // On est passé à une autre race
      }
      continue;
    }

    if (inRaceSection) {
      // Cherche les lignes commençant par **NomDuTrait.**
      const match = line.match(/^\*\*(.+?)\.?\*\*/);
      if (match) {
        // Exclure les infos techniques (Type, Taille, Vitesse)
        const traitName = match[1].trim();
        if (!['Type de créature', 'Catégorie de taille', 'Vitesse'].includes(traitName)) {
           traits.push(traitName);
        }
      }
    }
  }
  return traits;
}

// Parse les métadonnées d'inventaire (#meta:{...})
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

function getProficiency(level: number) {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function getHitDieSize(className?: string | null): number {
    if (!className) return 8;
    const c = className.toLowerCase();
    if (c.includes('barbare')) return 12;
    if (c.includes('guerrier') || c.includes('paladin') || c.includes('rôdeur') || c.includes('rodeur')) return 10;
    if (c.includes('magicien') || c.includes('ensorceleur')) return 6;
    return 8;
}

// --- MAIN FUNCTION ---

export const generateCharacterSheet = async (player: Player) => {
  try {
    const level = player.level || 1;
    const pb = getProficiency(level);

    // 1. Chargement PDF & Données Supabase (Parallèle)
    const [
        pdfBytes,
        inventoryRes,
        spellsRes,
        classMd,
        raceMd
    ] = await Promise.all([
        fetch('/FDP/eFeuillePersoDD2024.pdf').then(res => res.arrayBuffer()),
        supabase.from('inventory_items').select('*').eq('player_id', player.id),
        supabase.from('player_spells').select('spells (name, level, range)').eq('player_id', player.id).order('created_at', { ascending: true }),
        // Chargement dynamique des MD basés sur la classe/race du joueur
        player.class ? fetchMarkdown(`Classes/${player.class}/${player.class}.md`) : Promise.resolve(''),
        player.race ? fetchMarkdown(`RACES/DESCRIPTION_DES_RACES.md`) : Promise.resolve('')
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Helpers d'écriture
    const setTxt = (name: string, val: any) => { try { form.getTextField(name).setText(String(val ?? '')); } catch (e) {} };
    const setBonus = (name: string, val: number) => { try { form.getTextField(name).setText(`${val >= 0 ? '+' : ''}${val}`); } catch (e) {} };
    const setChk = (name: string, isChecked: boolean) => { try { const f = form.getCheckBox(name); if (isChecked) f.check(); else f.uncheck(); } catch (e) {} };

    // --- 2. Parsing Données Locales ---
    let abilitiesData: any[] = [];
    if (player.abilities && Array.isArray(player.abilities)) {
        abilitiesData = player.abilities;
    } else if (typeof player.abilities_json === 'string') {
        try { abilitiesData = JSON.parse(player.abilities_json); } catch {}
    }

    const stats = player.stats || {};
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};

    // --- 3. Remplissage Identité & Stats ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('level', level);
    setTxt('species', player.race);
    setTxt('background', player.background);
    setTxt('alignment', player.alignment);
    
    const langs = Array.isArray(player.languages) ? player.languages.join(', ') : (player.languages || '');
    setTxt('languages', langs);

    // Stats Combat
    setTxt('ac', (stats as any).armor_class || 10);
    setBonus('init', (stats as any).initiative || 0);
    setTxt('speed', (stats as any).speed || 9);
    setBonus('pb', pb);
    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    setTxt('hp-temp', player.temporary_hp);

    const hitDieSize = getHitDieSize(player.class);
    const hitDiceInfo = player.hit_dice as any;
    setTxt('hd-max', `${hitDiceInfo?.total ?? level}d${hitDieSize}`);
    setTxt('hd-spent', hitDiceInfo?.used ?? 0);

    // Caractéristiques
    const statKeyMap: Record<string, string> = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                setBonus(`save${num}`, ab.savingThrow);
                setChk(`s${num}`, ab.savingThrow > ab.modifier);
            }
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

    // --- 4. ARMES (Logique corrigée) ---
    // On récupère TOUS les items de type "weapon"
    const inventory = inventoryRes.data || [];
    const allWeapons = inventory
        .map((item: any) => ({ item, meta: parseMeta(item.description) }))
        .filter((x: any) => x.meta?.type === 'weapon');

    // On trie : équipés d'abord, puis les autres
    allWeapons.sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));

    // Les 6 premiers vont dans la grille
    const gridWeapons = allWeapons.slice(0, 6);
    // Les autres vont dans l'équipement
    const bagWeapons = allWeapons.slice(6);

    gridWeapons.forEach((w: any, i: number) => {
        const row = i + 1;
        setTxt(`weapons${row}1`, w.item.name); // Nom
        
        const meta = w.meta.weapon || {};
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setTxt(`weapons${row}3`, dmg.trim()); // Dégâts
        setTxt(`weapons${row}4`, meta.properties || ''); // Propriétés

        // Bonus Attaque (Devinette de carac)
        const isFinesse = meta.properties?.toLowerCase().includes('finesse') || meta.range?.includes('m');
        const statName = isFinesse ? 'Dextérité' : 'Force';
        const stat = abilitiesData.find(a => a.name === statName);
        if (stat) {
            // Si on veut être précis, on ajoute PB seulement si maîtrisé (souvent vrai pour arme principale)
            const atk = stat.modifier + pb + (meta.weapon_bonus || 0);
            setBonus(`weapons${row}2`, atk);
        }
    });

    // --- 5. ÉQUIPEMENT (Sans les armes de la grille) ---
    const gearList = [
        // Armes excédentaires
        ...bagWeapons.map((w: any) => `${w.item.name} (Arme)`),
        // Reste de l'inventaire (sauf type weapon)
        ...inventory
            .filter((item: any) => {
                const m = parseMeta(item.description);
                return m?.type !== 'weapon';
            })
            .map((item: any) => {
                const m = parseMeta(item.description);
                // Marquer l'armure portée
                if ((m?.type === 'armor' || m?.type === 'shield') && m.equipped) {
                    return `${item.name} (Équipé)`;
                }
                return item.name;
            })
    ].join(', ');
    
    setTxt('equipment', gearList);
    
    setTxt('gp', player.gold || 0);
    setTxt('sp', player.silver || 0);
    setTxt('cp', player.copper || 0);

    // --- 6. MAGIE (Niveau + Portée) ---
    const spellList = spellsRes.data || [];
    spellList.slice(0, 30).forEach((entry: any, idx: number) => {
        if (entry.spells) {
            const s = entry.spells;
            // Format: "Boule de feu (Niv 3, 45m)"
            const label = `${s.name} (${s.level === 0 ? 'Tour' : `Niv ${s.level}`}${s.range ? `, ${s.range}` : ''})`;
            setTxt(`spell${idx + 1}`, label);
        }
    });

    // Stats Magiques
    const castStatName = SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence';
    const castStat = abilitiesData.find((a: any) => a.name === castStatName);
    if (castStat) {
        setTxt('spell-ability', castStatName);
        setTxt('spell-dc', 8 + pb + castStat.modifier);
        setBonus('spell-bonus', pb + castStat.modifier);
        setBonus('spell-mod', castStat.modifier);
    }
    
    // Slots
    for (let i = 1; i <= 9; i++) {
        if (spellSlots[`level${i}`]) setTxt(`slot${i}`, spellSlots[`level${i}`]);
    }

    // --- 7. CAPACITÉS & TRAITS (Depuis MD) ---
    
    // Capacités de Classe (MD)
    const classFeatures = parseClassFeatures(classMd, level);
    setTxt('features1', classFeatures.join('\n')); // Case "Aptitudes de classe"

    // Traits Raciaux (MD)
    const raceTraits = parseRaceTraits(raceMd, player.race || '');
    setTxt('traits', raceTraits.length > 0 ? raceTraits.join('\n') : (player.race || ''));

    // Dons (Player Stats)
    const feats = (player.stats as any)?.feats || {};
    const featsList = [
        ...(feats.origins || []),
        ...(feats.generals || []),
        ...(feats.styles || [])
    ].filter(Boolean).join('\n');
    setTxt('feats', featsList);

    // --- 8. EXPORT ---
    const finalPdf = await pdfDoc.save();
    const blob = new Blob([finalPdf], { type: 'application/pdf' });
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