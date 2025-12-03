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

// --- HELPERS PARSING ---

async function fetchMarkdown(path: string): Promise<string> {
  try {
    const cleanPath = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${REPO_URL}/${cleanPath}`);
    if (!res.ok) return '';
    return await res.text();
  } catch (e) {
    console.warn(`[PDF] Impossible de charger ${path}`, e);
    return '';
  }
}

// Extrait les titres de capacités de classe (Format: ### NIVEAU X : TITRE)
function parseClassFeatures(md: string, level: number): string[] {
  const features: string[] = [];
  const regex = /^###\s+NIVEAU\s+(\d+)\s*:\s*(.+)$/gim;
  let match;
  while ((match = regex.exec(md)) !== null) {
    if (parseInt(match[1], 10) <= level) {
      features.push(match[2].replace(/\*\*/g, '').trim());
    }
  }
  return features;
}

// Extrait les traits raciaux (**Trait.**)
function parseRaceTraits(md: string, raceName: string): string[] {
  if (!raceName) return [];
  const traits: string[] = [];
  const normalizedRace = raceName.toUpperCase().split(' ')[0]; 
  const lines = md.split('\n');
  let inRaceSection = false;
  
  for (const line of lines) {
    if (line.startsWith('###')) {
      inRaceSection = line.toUpperCase().includes(normalizedRace);
      continue;
    }
    if (inRaceSection) {
      const match = line.match(/^\*\*(.+?)\.?\*\*/);
      if (match) {
        const t = match[1].trim();
        if (!['Type de créature', 'Catégorie de taille', 'Vitesse'].includes(t)) {
           traits.push(t);
        }
      }
    }
  }
  return traits;
}

// Extrait les dons (titres uniquement)
function parseFeatsFromMD(mdList: string[], featNames: string[]): string[] {
  const found: string[] = [];
  const normalizedFeats = featNames.map(n => n.toLowerCase().trim());
  
  mdList.forEach(md => {
    const lines = md.split('\n');
    lines.forEach(line => {
      if (line.startsWith('###')) {
        const title = line.replace('###', '').trim();
        if (normalizedFeats.includes(title.toLowerCase())) {
          found.push(title);
        }
      }
    });
  });
  // Si on ne trouve pas dans le MD, on garde le nom original
  return featNames.map(name => {
    const match = found.find(f => f.toLowerCase() === name.toLowerCase());
    return match || name;
  });
}

function parseMeta(description: string | null | undefined) {
  if (!description) return null;
  const lines = description.split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith('#meta:'));
  if (!metaLine) return null;
  try { return JSON.parse(metaLine.slice(6)); } catch { return null; }
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

// --- FONCTION PRINCIPALE ---

export const generateCharacterSheet = async (player: Player) => {
  try {
    const level = player.level || 1;
    const pb = getProficiency(level);

    // 1. Récupération des données (Parallèle pour la vitesse)
    const [
        pdfBytes,
        inventoryRes,
        spellsRes,
        classMd,
        raceMd,
        donsOriginMd,
        donsGeneralMd,
        donsStyleMd
    ] = await Promise.all([
        fetch('/FDP/eFeuillePersoDD2024.pdf').then(res => res.arrayBuffer()),
        supabase.from('inventory_items').select('*').eq('player_id', player.id),
        supabase.from('player_spells').select('spells (name, level, range)').eq('player_id', player.id).order('created_at', { ascending: true }),
        // Markdown
        player.class ? fetchMarkdown(`Classes/${player.class}/${player.class}.md`) : Promise.resolve(''),
        player.race ? fetchMarkdown(`RACES/DESCRIPTION_DES_RACES.md`) : Promise.resolve(''),
        fetchMarkdown(`DONS/DONS_D_ORIGINE.md`),
        fetchMarkdown(`DONS/DONS_GENERAUX.md`),
        fetchMarkdown(`DONS/STYLES_DE_COMBAT.md`),
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // Helpers PDF (Sécurisés)
    const setTxt = (name: string, val: any) => { try { form.getTextField(name).setText(String(val ?? '')); } catch (e) {} };
    const setBonus = (name: string, val: number) => { try { form.getTextField(name).setText(`${val >= 0 ? '+' : ''}${val}`); } catch (e) {} };
    const setChk = (name: string, isChecked: boolean) => { try { const f = form.getCheckBox(name); if (isChecked) f.check(); else f.uncheck(); } catch (e) {} };

    // --- 2. DONNÉES LOCALES ---
    let abilitiesData: any[] = [];
    if (player.abilities && Array.isArray(player.abilities)) {
        abilitiesData = player.abilities;
    } else if (typeof player.abilities_json === 'string') {
        try { abilitiesData = JSON.parse(player.abilities_json); } catch {}
    }

    const stats = player.stats || {};
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};
    const creatorMeta = (stats as any).creator_meta || {};

    // --- 3. REMPLISSAGE IDENTITÉ ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', `${player.class || ''} ${player.subclass ? `(${player.subclass})` : ''}`); // Classe (Sous-classe)
    setTxt('level', level);
    setTxt('species', player.race);
    setTxt('background', player.background); // Nom de l'historique
    setTxt('alignment', player.alignment);
    setTxt('xp', ""); 

    // Histoire / Personnalité
    setTxt('backstory', player.character_history); // Champ "Histoire du personnage"

    // --- 4. CARACTÉRISTIQUES & COMPÉTENCES ---
    const statKeyMap: Record<string, string> = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
    
    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);
            
            // Sauvegardes
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                // On applique le bonus de maîtrise si sauvegardé
                const isSaveProf = ab.savingThrow > ab.modifier; 
                setBonus(`save${num}`, ab.modifier + (isSaveProf ? pb : 0));
                setChk(`s${num}`, isSaveProf);
            }

            // Compétences
            if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const idx = SKILL_MAPPING[sk.name];
                    if (idx) {
                        // Calcul du bonus total : Mod + (PB si maitrise) + (PB si expertise)
                        let totalBonus = ab.modifier;
                        if (sk.isProficient) totalBonus += pb;
                        if (sk.hasExpertise) totalBonus += pb; // Expertise ajoute encore PB

                        setBonus(`skill${idx}`, totalBonus);
                        setChk(`sk${idx}`, sk.isProficient || sk.hasExpertise);
                    }
                });
            }
        }
    });

    // --- 5. COMBAT ---
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

    // --- 6. MAÎTRISES (Armes, Armures, Outils, Langues) ---
    const proficiencies: string[] = [];
    
    // Langues
    if (player.languages && player.languages.length) proficiencies.push(`Langues: ${player.languages.join(', ')}`);
    
    // Armures
    const armorProfs = creatorMeta.armor_proficiencies || [];
    if (armorProfs.length) proficiencies.push(`Armures: ${armorProfs.join(', ')}`);

    // Armes
    const weaponProfs = creatorMeta.weapon_proficiencies || [];
    if (weaponProfs.length) proficiencies.push(`Armes: ${weaponProfs.join(', ')}`);

    // Outils
    const toolProfs = creatorMeta.tool_proficiencies || [];
    if (toolProfs.length) proficiencies.push(`Outils: ${toolProfs.join(', ')}`);

    setTxt('proficiencies', proficiencies.join('\n'));

    // --- 7. ARMES (Grille) ---
    const inventory = inventoryRes.data || [];
    const allWeapons = inventory
        .map((item: any) => ({ item, meta: parseMeta(item.description) }))
        .filter((x: any) => x.meta?.type === 'weapon');

    // Trier: Équipées d'abord
    allWeapons.sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));

    // Grille (6 max)
    allWeapons.slice(0, 6).forEach((w: any, i: number) => {
        const row = i + 1;
        setTxt(`weapons${row}1`, w.item.name);
        
        const meta = w.meta.weapon || {};
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setTxt(`weapons${row}3`, dmg.trim());
        setTxt(`weapons${row}4`, meta.properties || '');

        const isFinesse = meta.properties?.toLowerCase().includes('finesse') || meta.range?.includes('m');
        const statName = isFinesse ? 'Dextérité' : 'Force';
        const stat = abilitiesData.find(a => a.name === statName);
        if (stat) {
            const atk = stat.modifier + pb + (meta.weapon_bonus || 0);
            setBonus(`weapons${row}2`, atk);
        }
    });

    // --- 8. ÉQUIPEMENT (Tout sauf les armes) ---
    // Note : Si une arme n'est pas dans la grille (plus de 6), elle ira dans l'équipement
    const otherGear = inventory.filter((item: any) => {
        const m = parseMeta(item.description);
        return m?.type !== 'weapon'; // On exclut toutes les armes, elles sont gérées par la grille ou ignorées si > 6
    });
    
    // On ajoute les armes en trop (celles après la 6ème)
    const overflowWeapons = allWeapons.slice(6).map((w: any) => w.item);

    const gearText = [
        ...overflowWeapons.map((i: any) => `${i.name} (Arme)`),
        ...otherGear.map((i: any) => i.name)
    ].join(', ');

    setTxt('equipment', gearText);
    setTxt('gp', player.gold || 0); setTxt('sp', player.silver || 0); setTxt('cp', player.copper || 0);

    // --- 9. MAGIE ---
    const spellList = spellsRes.data || [];
    spellList.slice(0, 30).forEach((entry: any, idx: number) => {
        if (entry.spells) {
            const s = entry.spells;
            const id = idx + 1;
            setTxt(`spell${id}`, s.name); // Nom seul
            
            // Tentative de remplir les champs séparés (selon format standard PDF)
            // Souvent: spellX-level ou slX, et spellX-range ou srX
            // Ici on tente des noms génériques probables
            try {
                // Si le PDF a des champs spécifiques :
                form.getTextField(`spell${id}-level`).setText(s.level === 0 ? 'T' : String(s.level));
                form.getTextField(`spell${id}-range`).setText(s.range || '');
            } catch (e) {
                // Fallback: Si les champs n'existent pas, on met tout dans le nom
                // Mais vous avez demandé de séparer, donc on laisse vide si échec pour ne pas polluer
            }
        }
    });

    const castStatName = SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence';
    const castStat = abilitiesData.find((a: any) => a.name === castStatName);
    if (castStat) {
        setTxt('spell-ability', castStatName);
        setTxt('spell-dc', 8 + pb + castStat.modifier);
        setBonus('spell-bonus', pb + castStat.modifier);
        setBonus('spell-mod', castStat.modifier);
    }
    for (let i = 1; i <= 9; i++) {
        if (spellSlots[`level${i}`]) setTxt(`slot${i}`, spellSlots[`level${i}`]);
    }

    // --- 10. APTITUDES & TRAITS (Compilation) ---
    const featsStats = (stats as any).feats || {};
    const rawFeats = [
        ...(featsStats.origins || []),
        ...(featsStats.generals || []),
        ...(featsStats.styles || [])
    ].filter(Boolean);

    // Parsing des noms de dons depuis les MD pour avoir les bons titres
    const featsClean = parseFeatsFromMD([donsOriginMd, donsGeneralMd, donsStyleMd], rawFeats);
    
    // Aptitudes de classe (MD)
    const classFeatures = parseClassFeatures(classMd, level);
    
    // Traits raciaux (MD)
    const raceTraits = parseRaceTraits(raceMd, player.race || '');

    // Assemblage dans la case "Aptitudes et traits"
    // On met d'abord les traits raciaux, puis les dons, puis les capacités de classe
    const allFeatures = [
        ...raceTraits.map(t => `• ${t} (Espèce)`),
        ...featsClean.map(f => `• ${f} (Don)`),
        ...classFeatures.map(c => `• ${c}`)
    ].join('\n');

    setTxt('features1', allFeatures); // Grande case de droite
    // setTxt('traits', ...); // Si vous préférez séparer race/dons dans la case "Traits" à gauche

    // --- EXPORT ---
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