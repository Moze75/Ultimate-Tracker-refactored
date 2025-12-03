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
    const res = await fetch(`${REPO_URL}/${path.split('/').map(encodeURIComponent).join('/')}`);
    return res.ok ? await res.text() : '';
  } catch (e) { return ''; }
}
function parseClassFeatures(md: string, level: number): string[] {
  const features: string[] = [];
  const regex = /^###\s+NIVEAU\s+(\d+)\s*:\s*(.+)$/gim;
  let match;
  while ((match = regex.exec(md)) !== null) {
    if (parseInt(match[1], 10) <= level) features.push(match[2].replace(/\*\*/g, '').trim());
  }
  return features;
}
function parseRaceTraits(md: string, raceName: string): string[] {
  if (!raceName) return [];
  const traits: string[] = [];
  const normalized = raceName.toUpperCase().split(' ')[0]; 
  const lines = md.split('\n');
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('###')) { inSection = line.toUpperCase().includes(normalized); continue; }
    if (inSection) {
      const match = line.match(/^\*\*(.+?)\.?\*\*/);
      if (match && !['Type de créature', 'Catégorie de taille', 'Vitesse'].includes(match[1].trim())) traits.push(match[1].trim());
    }
  }
  return traits;
}
function parseFeatsFromMD(mdList: string[], featNames: string[]): string[] {
  const found: string[] = [];
  const norm = featNames.map(n => n.toLowerCase().trim());
  mdList.forEach(md => {
    md.split('\n').forEach(l => {
      if (l.startsWith('###')) {
        const t = l.replace('###', '').trim();
        if (norm.includes(t.toLowerCase())) found.push(t);
      }
    });
  });
  return featNames.map(n => found.find(f => f.toLowerCase() === n.toLowerCase()) || n);
}
function parseMeta(desc: string | null | undefined) {
  if (!desc) return null;
  const l = desc.split('\n').map(x => x.trim()).reverse().find(x => x.startsWith('#meta:'));
  try { return l ? JSON.parse(l.slice(6)) : null; } catch { return null; }
}
function getHitDieSize(c?: string | null): number {
    if (!c) return 8; const l = c.toLowerCase();
    if (l.includes('barbare')) return 12;
    if (l.includes('guerrier') || l.includes('paladin') || l.includes('rôdeur')) return 10;
    if (l.includes('magicien') || l.includes('ensorceleur')) return 6; return 8;
}
function getProficiency(level: number) {
  if (level >= 17) return 6; if (level >= 13) return 5; if (level >= 9) return 4; if (level >= 5) return 3; return 2;
}

// ============================================================================
// 3. GENERATE
// ============================================================================
export const generateCharacterSheet = async (player: Player) => {
  try {
    const level = player.level || 1;
    const pb = getProficiency(level);

    // 1. LOAD
    const [pdfBytes, invRes, spellRes, classMd, raceMd, ...donsMds] = await Promise.all([
        fetch('/FDP/eFeuillePersoDD2024.pdf').then(r => r.arrayBuffer()),
        supabase.from('inventory_items').select('*').eq('player_id', player.id),
        supabase.from('player_spells').select('spells (name, level, range, components, duration, casting_time)').eq('player_id', player.id).order('created_at', { ascending: true }),
        player.class ? fetchMarkdown(`Classes/${player.class}/${player.class}.md`) : Promise.resolve(''),
        player.race ? fetchMarkdown(`RACES/DESCRIPTION_DES_RACES.md`) : Promise.resolve(''),
        fetchMarkdown(`DONS/DONS_D_ORIGINE.md`), fetchMarkdown(`DONS/DONS_GENERAUX.md`), fetchMarkdown(`DONS/STYLES_DE_COMBAT.md`),
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // HELPERS
    const setTxt = (n: string, v: any) => { try { form.getTextField(n).setText(String(v ?? '')); } catch (e) {} };
    const setBonus = (n: string, v: number) => { try { form.getTextField(n).setText(`${v >= 0 ? '+' : ''}${v}`); } catch (e) {} };
    const setChk = (n: string, v: boolean) => { try { const f = form.getCheckBox(n); if(v) f.check(); else f.uncheck(); } catch(e) {} };

    // DATA
    let abilities = []; try { abilities = Array.isArray(player.abilities) ? player.abilities : JSON.parse(player.abilities_json as string); } catch {}
    const stats = player.stats || {};
    const meta = (stats as any).creator_meta || {};
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};

    // --- IDENTITÉ ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('subclass', player.subclass);
    setTxt('level', level);
    setTxt('species', player.race);
    setTxt('race', player.race);
    const bg = player.background || (stats as any).background_custom || (stats as any).historique || '';
    setTxt('background', bg);
    setTxt('Background', bg);
    setTxt('alignment', player.alignment);
    setTxt('backstory', player.character_history);

    // --- CARACS ---
    abilities.forEach((ab: any) => {
        const map: any = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
        const k = map[ab.name];
        if (k) {
            setTxt(k, ab.score);
            setBonus(`mod${k}`, ab.modifier);
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                const isProf = ab.savingThrow > ab.modifier;
                setBonus(`save${num}`, ab.modifier + (isProf ? pb : 0));
                setChk(`s${num}`, isProf);
            }
            if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const idx = SKILL_MAPPING[sk.name];
                    if (idx) {
                        const bonus = ab.modifier + (sk.isProficient ? pb : 0) + (sk.hasExpertise ? pb : 0);
                        setBonus(`skill${idx}`, bonus);
                        setChk(`sk${idx}`, sk.isProficient || sk.hasExpertise);
                    }
                });
            }
        }
    });

    // --- COMBAT ---
    setTxt('ac', (stats as any).armor_class || 10);
    setBonus('init', (stats as any).initiative || 0);
    setTxt('speed', (stats as any).speed || 9);
    setBonus('pb', pb); // ✅ RÉTABLI: Bonus de maîtrise
    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    const hdSize = getHitDieSize(player.class);
    setTxt('hd-max', `${(player.hit_dice as any)?.total ?? level}d${hdSize}`);
    setTxt('hd-spent', (player.hit_dice as any)?.used ?? 0);

    // --- MAÎTRISES ---
    const wProfs = meta.weapon_proficiencies || [];
    const tProfs = meta.tool_proficiencies || [];
    const langs = (player.languages || []).filter((l: string) => l && !l.toLowerCase().includes('choix'));
    setTxt('weapons', wProfs.join(', '));
    setTxt('tools', tProfs.join(', '));
    setTxt('languages', langs.join(', '));
    const aProfs = meta.armor_proficiencies || [];
    setChk('armor1', aProfs.some((x: string) => x.includes('légère')));
    setChk('armor2', aProfs.some((x: string) => x.includes('intermédiaire')));
    setChk('armor3', aProfs.some((x: string) => x.includes('lourde')));
    setChk('armor4', aProfs.some((x: string) => x.includes('bouclier')));

    // --- ARMES ---
    const items = invRes.data || [];
    const weapons = items.map((i: any) => ({ ...i, meta: parseMeta(i.description) }))
                         .filter((i: any) => i.meta?.type === 'weapon')
                         .sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));
    weapons.slice(0, 6).forEach((w: any, i: number) => {
        const r = i + 1;
        const m = w.meta.weapon || {};
        setTxt(`weapons${r}1`, w.name);
        const isFin = m.properties?.toLowerCase().includes('finesse');
        const stat = abilities.find((a: any) => a.name === (isFin ? 'Dextérité' : 'Force'));
        if (stat) setBonus(`weapons${r}2`, stat.modifier + pb + (m.weapon_bonus || 0));
        setTxt(`weapons${r}3`, `${m.damageDice || ''} ${m.damageType || ''}`);
        setTxt(`weapons${r}4`, m.properties || '');
    });
    setTxt('equipment', items.filter((i: any) => !weapons.slice(0, 6).find((w: any) => w.id === i.id)).map((i: any) => i.name).join(', '));
    setTxt('gp', String(player.gold || 0)); setTxt('sp', String(player.silver || 0)); setTxt('cp', String(player.copper || 0)); setTxt('ep', "0"); setTxt('pp', "0");

    // --- SORTS (V17 : Fusion Temps/Portée + Anti-Crash) ---
    const spells = spellRes.data || [];
    spells.slice(0, 30).forEach((entry: any, idx: number) => {
        if (!entry.spells) return;
        const s = entry.spells;
        const id = idx + 1;
        const lvl = s.level === 0 ? 'T' : String(s.level);
        const time = (s.casting_time && String(s.casting_time)) || '1 action';
        const range = s.range ? String(s.range) : '-';
        
        // Gestion sécurisée Composantes
        let compsStr = '';
        if (Array.isArray(s.components)) {
            compsStr = s.components.join(', ');
        } else if (typeof s.components === 'string') {
            compsStr = s.components;
        }

        const dur = s.duration ? String(s.duration) : '';

        // Remplissage
        setTxt(`spell${id}`, s.name);
        setTxt(`spell${id}l`, lvl);
        
        // ✅ FUSION: "1 action - 18m" dans la colonne Temps (spellXr)
        // C'est la solution pour forcer l'affichage de la portée
        const timeAndRange = `${time} - ${range}`;
        setTxt(`spell${id}r`, timeAndRange);
        setTxt(`r${id}`, timeAndRange); // Sécurité double nommage

        // Colonne Notes: Composantes
        setTxt(`spell${id}c`, compsStr);

        // Checkboxes (en minuscule pour comparaison safe)
        const lowerComps = compsStr.toLowerCase();
        const lowerDur = dur.toLowerCase();
        
        setChk(`c${id}`, lowerDur.includes('concentration'));
        setChk(`r${id}`, lowerComps.includes('rituel') || s.name.toLowerCase().includes('(r)'));
        setChk(`m${id}`, lowerComps.includes('m')); 
    });

    // --- EMPLACEMENTS DE SORTS ---
    for (let niv = 1; niv <= 9; niv++) {
        const total = spellSlots[`level${niv}`] || 0;
        const used = spellSlots[`used${niv}`] || 0;
        setTxt(`slot${niv}`, total); // Champ Total
        for (let i = 1; i <= 4; i++) {
            setChk(`cbslot${niv}${i}`, i <= used);
        }
    }

    // --- STATS MAGIE ---
    const castStat = abilities.find((a: any) => a.name === (SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence'));
    if (castStat) {
        setTxt('spell-ability', castStat.name);
        setTxt('spell-dc', 8 + pb + castStat.modifier);
        setBonus('spell-bonus', pb + castStat.modifier);
        setBonus('spell-mod', castStat.modifier);
    }

    // --- FEATS/TRAITS ---
    const featsRaw = [...(stats.feats?.origins || []), ...(stats.feats?.generals || []), ...(stats.feats?.styles || [])].filter(Boolean);
    const feats = parseFeatsFromMD(donsMds, featsRaw).map(x => `• ${x}`).join('\n');
    const traits = parseRaceTraits(raceMd, player.race || '').map(x => `• ${x}`).join('\n');
    const features = parseClassFeatures(classMd, level).map(x => `• ${x}`).join('\n');
    setTxt('traits', traits);
    setTxt('feats', feats);
    setTxt('features1', features);

    // EXPORT
    const blob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${player.adventurer_name}_Fiche.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (e) { console.error(e); throw e; }
};