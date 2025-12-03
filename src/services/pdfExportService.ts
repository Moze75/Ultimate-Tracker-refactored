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

    // --- 3. IDENTITÉ (Ciblage précis d'après le log) ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('subclass', player.subclass);
    setTxt('level', level);
    setTxt('race', player.race); // Le log ne montre pas 'species', mais essayons 'race' si 'species' échoue
    
    // HISTORIQUE : Le log confirme que le champ est 'background'
    // Si ça ne s'affichait pas avant, c'est que la valeur player.background était vide
    const bg = player.background || (stats.background_custom ? stats.background_custom : '');
    setTxt('background', bg);
    
    setTxt('alignment', player.alignment);
    setTxt('xp', ""); 
    setTxt('backstory', player.character_history);

    // --- 4. CARACS ---
    const statKeyMap: Record<string, string> = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier); // Le log montre 'modstr', 'moddex', etc.
            
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

    // --- 6. MAÎTRISES (Ciblage précis d'après le log) ---
    
    // 6.1 ARMURES (Cases à cocher 'armor1' à 'armor4')
    const armorProfs = creatorMeta.armor_proficiencies || [];
    const hasLight = armorProfs.some((a: string) => a.toLowerCase().includes('légère'));
    const hasMedium = armorProfs.some((a: string) => a.toLowerCase().includes('intermédiaire'));
    const hasHeavy = armorProfs.some((a: string) => a.toLowerCase().includes('lourde'));
    const hasShield = armorProfs.some((a: string) => a.toLowerCase().includes('bouclier'));

    setChk('armor1', hasLight);  // Légère
    setChk('armor2', hasMedium); // Intermédiaire
    setChk('armor3', hasHeavy);  // Lourde
    setChk('armor4', hasShield); // Bouclier

    // 6.2 ARMES & OUTILS & LANGUES (Champs texte identifiés dans le log)
    const weaponProfs = creatorMeta.weapon_proficiencies || [];
    setTxt('weapons', weaponProfs.join(', ')); // Champ 'weapons' identifié dans le log

    const toolProfs = creatorMeta.tool_proficiencies || [];
    setTxt('tools', toolProfs.join(', ')); // Champ 'tools' identifié dans le log

    if (player.languages) {
        const langs = Array.isArray(player.languages) ? player.languages : [];
        const clean = langs.filter(x => x && !x.toLowerCase().includes('choix')).join(', ');
        setTxt('languages', clean); // Champ 'languages' identifié dans le log
    }

    // --- 7. ARMES & ÉQUIPEMENT (Grille 'weaponsX') ---
    // Le log montre weapons11, weapons12, etc.
    // Hypothèse : weapons[Ligne][Colonne]
    // Colonne 1 = Nom, Colonne 2 = Bonus, Colonne 3 = Dégâts, Colonne 4 = Notes ?
    const inventory = inventoryRes.data || [];
    const allWeapons = inventory
        .map((item: any) => ({ item, meta: parseMeta(item.description) }))
        .filter((x: any) => x.meta?.type === 'weapon')
        .sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));

    allWeapons.slice(0, 6).forEach((w: any, i: number) => {
        const row = i + 1; // 1 à 6
        // Nom
        setTxt(`weapons${row}1`, w.item.name);
        
        const meta = w.meta.weapon || {};
        // Dégâts
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setTxt(`weapons${row}3`, dmg.trim());
        
        // Notes / Propriétés
        setTxt(`weapons${row}4`, meta.properties || '');
        
        // Bonus Attaque
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

    // --- 8. MAGIE (Ciblage précis d'après le log) ---
    // Le log montre : spell1, spell1l, spell1r, spell1c... C'est parfait !
    const spellList = spellsRes.data || [];
    spellList.slice(0, 30).forEach((entry: any, idx: number) => {
        if (entry.spells) {
            const s = entry.spells;
            const id = idx + 1; // 1 à 30
            const lvl = s.level === 0 ? 'T' : String(s.level);
            
            setTxt(`spell${id}`, s.name);   // Nom
            setTxt(`spell${id}l`, lvl);     // Level (suffixe 'l')
            setTxt(`spell${id}r`, s.range || ''); // Range (suffixe 'r')
            // spell${id}c est probablement 'Concentration' (case à cocher ou texte)
        }
    });

    // Stats Magiques
    const castStatName = SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence';
    const castStat = abilitiesData.find((a: any) => a.name === castStatName);
    if (castStat) {
        // Le log ne montre pas explicitement 'spell-ability', on tente les standards
        setTxt('spell-ability', castStatName); 
        // Mais on a vu 'm1', 'm10' dans le log, peut-être lié à la magie ? 
        // Restons sur les standards pour l'instant, le log était tronqué ([0...99], etc.)
        setTxt('spell-dc', 8 + pb + castStat.modifier);
        setBonus('spell-bonus', pb + castStat.modifier);
        setBonus('spell-mod', castStat.modifier);
    }
    
    // Emplacements de sorts (Slots)
    // Le log montre 'cbslot11', 'cbslot12'... Ce sont des cases à cocher pour les slots utilisés !
    // Il n'y a peut-être pas de champ texte pour le "Total".
    // On va essayer de remplir les premières cases à cocher en fonction du nombre total de slots.
    for (let niv = 1; niv <= 9; niv++) {
        const totalSlots = spellSlots[`level${niv}`] || 0;
        const usedSlots = spellSlots[`used${niv}`] || 0; // Si vous trackez les utilisés
        
        // On coche les cases "disponibles" (ou l'inverse selon la logique de la feuille)
        // Si cbslot = "CheckBox Slot", alors cbslot11 est le 1er slot du niveau 1.
        for (let slotNum = 1; slotNum <= 4; slotNum++) { // Max 4 slots par niveau généralement
             // Si le joueur a ce slot (total >= slotNum), on pourrait vouloir le rendre visible ou le cocher
             // Sur les PDF, souvent cocher = utilisé.
             // Sans certitude, on laisse tel quel ou on coche si utilisé.
             // setChk(`cbslot${niv}${slotNum}`, slotNum <= usedSlots);
        }
        
        // Si un champ texte existe pour le total (souvent caché ou nommé bizarrement), on essaie 'slot1', 'Level 1 Slots'
        setTxt(`slot${niv}`, totalSlots);
    }

    // --- 9. TRAITS / DONS / APTITUDES ---
    const featsStats = (stats as any).feats || {};
    const rawFeats = [...(featsStats.origins || []), ...(featsStats.generals || []), ...(featsStats.styles || [])].filter(Boolean);
    
    const featsFormatted = parseFeatsFromMD([donsOriginMd, donsGeneralMd, donsStyleMd], rawFeats).map(f => `• ${f} (Don)`).join('\n');
    const traitsFormatted = parseRaceTraits(raceMd, player.race || '').map(t => `• ${t}`).join('\n');
    const featuresFormatted = parseClassFeatures(classMd, level).map(c => `• ${c}`).join('\n');

    setTxt('traits', traitsFormatted); // Traits d'espèce
    setTxt('feats', featsFormatted);   // Dons
    setTxt('features1', featuresFormatted); // Aptitudes de classe

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