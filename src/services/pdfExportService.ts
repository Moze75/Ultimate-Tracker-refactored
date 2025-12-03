import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// ============================================================================
// 1. CONFIGURATION
// ============================================================================

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

// ============================================================================
// 2. HELPERS
// ============================================================================

async function fetchMarkdown(path: string): Promise<string> {
  try {
    const cleanPath = path.split('/').map(encodeURIComponent).join('/');
    const res = await fetch(`${REPO_URL}/${cleanPath}`);
    if (!res.ok) return '';
    return await res.text();
  } catch (e) { return ''; }
}

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
        if (!['Type de créature', 'Catégorie de taille', 'Vitesse'].includes(t)) traits.push(t);
      }
    }
  }
  return traits;
}

function parseFeatsFromMD(mdList: string[], featNames: string[]): string[] {
  const found: string[] = [];
  const normalizedFeats = featNames.map(n => n.toLowerCase().trim());
  mdList.forEach(md => {
    const lines = md.split('\n');
    lines.forEach(line => {
      if (line.startsWith('###')) {
        const title = line.replace('###', '').trim();
        if (normalizedFeats.includes(title.toLowerCase())) found.push(title);
      }
    });
  });
  return featNames.map(name => found.find(f => f.toLowerCase() === name.toLowerCase()) || name);
}

function parseMeta(description: string | null | undefined) {
  if (!description) return null;
  const lines = description.split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith('#meta:'));
  if (!metaLine) return null;
  try { return JSON.parse(metaLine.slice(6)); } catch { return null; }
}

function getProficiency(level: number) {
  if (level >= 17) return 6; if (level >= 13) return 5; if (level >= 9) return 4; if (level >= 5) return 3; return 2;
}

function getHitDieSize(className?: string | null): number {
    if (!className) return 8;
    const c = className.toLowerCase();
    if (c.includes('barbare')) return 12;
    if (c.includes('guerrier') || c.includes('paladin') || c.includes('rôdeur')) return 10;
    if (c.includes('magicien') || c.includes('ensorceleur')) return 6;
    return 8;
}

// ============================================================================
// 3. GENERATE FUNCTION
// ============================================================================

export const generateCharacterSheet = async (player: Player) => {
  try {
    const level = player.level || 1;
    const pb = getProficiency(level);

    // --- 1. CHARGEMENT ---
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
        player.class ? fetchMarkdown(`Classes/${player.class}/${player.class}.md`) : Promise.resolve(''),
        player.race ? fetchMarkdown(`RACES/DESCRIPTION_DES_RACES.md`) : Promise.resolve(''),
        fetchMarkdown(`DONS/DONS_D_ORIGINE.md`),
        fetchMarkdown(`DONS/DONS_GENERAUX.md`),
        fetchMarkdown(`DONS/STYLES_DE_COMBAT.md`),
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // --- 1.5 DIAGNOSTIC (AFFICHER LES CHAMPS DANS LA CONSOLE) ---
    // 👇 Regardez la console du navigateur (F12) pour voir cette liste
    const allFields = form.getFields().map(f => f.getName());
    console.group("🔍 DIAGNOSTIC CHAMPS PDF");
    console.log("Cherchez 'Background', 'Historique' ou 'Sort' dans cette liste :");
    console.log(allFields.sort());
    console.groupEnd();

    // Helpers
    const setTxt = (name: string, val: any) => { try { form.getTextField(name).setText(String(val ?? '')); } catch (e) {} };
    const setBonus = (name: string, val: number) => { try { form.getTextField(name).setText(`${val >= 0 ? '+' : ''}${val}`); } catch (e) {} };
    const setChk = (name: string, isChecked: boolean) => { try { const f = form.getCheckBox(name); if (isChecked) f.check(); else f.uncheck(); } catch (e) {} };

    // --- 2. DATA PREP ---
    let abilitiesData: any[] = [];
    try { abilitiesData = Array.isArray(player.abilities) ? player.abilities : JSON.parse(player.abilities_json as string); } catch {}
    const stats = player.stats || {};
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};
    const creatorMeta = (stats as any).creator_meta || {};

    // --- 3. IDENTITÉ ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('classname', player.class);
    setTxt('subclass', player.subclass);
    setTxt('level', level);
    setTxt('species', player.race);
    
    // HISTORIQUE (On essaie tout ce qui est logique)
    const bg = player.background || '';
    setTxt('background', bg);
    setTxt('Background', bg);
    setTxt('Historique', bg);
    setTxt('History', bg);
    
    setTxt('alignment', player.alignment);
    setTxt('xp', ""); 
    setTxt('backstory', player.character_history);

    // --- 4. CARACS ---
    const statKeyMap: Record<string, string> = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                const isSaveProf = ab.savingThrow > ab.modifier; 
                setBonus(`save${num}`, ab.modifier + (isSaveProf ? pb : 0));
                setChk(`s${num}`, isSaveProf);
            }
            if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const idx = SKILL_MAPPING[sk.name];
                    if (idx) {
                        let totalBonus = ab.modifier;
                        if (sk.isProficient) totalBonus += pb;
                        if (sk.hasExpertise) totalBonus += pb;
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

    // --- 6. MAÎTRISES & LANGUES ---
    const profsList: string[] = [];
    if (player.languages) {
        const l = Array.isArray(player.languages) ? player.languages : [];
        const clean = l.filter(x => x && !x.toLowerCase().includes('choix'));
        if (clean.length) profsList.push(`Langues: ${clean.join(', ')}`);
    }
    if (creatorMeta.armor_proficiencies?.length) profsList.push(`Armures: ${creatorMeta.armor_proficiencies.join(', ')}`);
    if (creatorMeta.weapon_proficiencies?.length) profsList.push(`Armes: ${creatorMeta.weapon_proficiencies.join(', ')}`);
    if (creatorMeta.tool_proficiencies?.length) profsList.push(`Outils: ${creatorMeta.tool_proficiencies.join(', ')}`);

    setTxt('proficiencies', profsList.join('\n'));
    setTxt('other_profs', profsList.join('\n')); // Variante

    // --- 7. ARMES & ÉQUIPEMENT ---
    const inventory = inventoryRes.data || [];
    const allWeapons = inventory
        .map((item: any) => ({ item, meta: parseMeta(item.description) }))
        .filter((x: any) => x.meta?.type === 'weapon')
        .sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));

    allWeapons.slice(0, 6).forEach((w: any, i: number) => {
        const row = i + 1;
        setTxt(`weapons${row}1`, w.item.name);
        const meta = w.meta.weapon || {};
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setTxt(`weapons${row}3`, dmg.trim());
        setTxt(`weapons${row}4`, meta.properties || '');
        const isFinesse = meta.properties?.toLowerCase().includes('finesse');
        const stat = abilitiesData.find(a => a.name === (isFinesse ? 'Dextérité' : 'Force'));
        if (stat) setBonus(`weapons${row}2`, stat.modifier + pb + (meta.weapon_bonus || 0));
    });

    const otherGear = inventory.filter(i => !allWeapons.some(w => w.item.id === i.id));
    const gearText = [
        ...allWeapons.slice(6).map(w => `${w.item.name} (Arme)`),
        ...otherGear.map(i => i.name)
    ].join(', ');
    setTxt('equipment', gearText);
    setTxt('gp', player.gold); setTxt('sp', player.silver); setTxt('cp', player.copper);

    // --- 8. MAGIE (TENTATIVES MULTIPLES) ---
    const spellList = spellsRes.data || [];
    spellList.slice(0, 30).forEach((entry: any, idx: number) => {
        if (entry.spells) {
            const s = entry.spells;
            const id = idx + 1;
            const lvl = s.level === 0 ? 'T' : String(s.level);
            
            setTxt(`spell${id}`, s.name);
            
            // Tentatives NIVEAU
            try { form.getTextField(`spell${id}-level`).setText(lvl); } catch(e) {}
            try { form.getTextField(`sl${id}`).setText(lvl); } catch(e) {}
            try { form.getTextField(`Level${id}`).setText(lvl); } catch(e) {}
            
            // Tentatives PORTÉE
            try { form.getTextField(`spell${id}-range`).setText(s.range || ''); } catch(e) {}
            try { form.getTextField(`sr${id}`).setText(s.range || ''); } catch(e) {}
            try { form.getTextField(`Range${id}`).setText(s.range || ''); } catch(e) {}
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
    for (let i = 1; i <= 9; i++) {
        if (spellSlots[`level${i}`]) setTxt(`slot${i}`, spellSlots[`level${i}`]);
    }

    // --- 9. TRAITS / DONS / APTITUDES ---
    const featsStats = (stats as any).feats || {};
    const rawFeats = [...(featsStats.origins || []), ...(featsStats.generals || []), ...(featsStats.styles || [])].filter(Boolean);
    
    const featsFormatted = parseFeatsFromMD([donsOriginMd, donsGeneralMd, donsStyleMd], rawFeats).map(f => `• ${f} (Don)`).join('\n');
    const traitsFormatted = parseRaceTraits(raceMd, player.race || '').map(t => `• ${t}`).join('\n');
    const featuresFormatted = parseClassFeatures(classMd, level).map(c => `• ${c}`).join('\n');

    setTxt('traits', traitsFormatted);
    setTxt('feats', featsFormatted);
    setTxt('dons', featsFormatted); // Au cas où
    setTxt('features1', featuresFormatted);

    // --- 10. EXPORT ---
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