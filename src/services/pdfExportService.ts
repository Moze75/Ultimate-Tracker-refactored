import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// ============================================================================
// 1. CONFIGURATION & HELPERS
// ============================================================================
const REPO_URL = 'https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main';

// Helpers de parsing (inchangés)
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

// ============================================================================
// 2. FONCTION DE SONDE (DIAGNOSTIC)
// ============================================================================
function runProbe(form: any) {
    const fields = form.getFields().map((f: any) => f.getName());
    
    console.group("🕵️ SUPER SONDE PDF v8");
    
    // 1. Chercher les champs d'identité manquants
    const identityCandidates = fields.filter((n: string) => {
        const low = n.toLowerCase();
        return low.includes('race') || low.includes('species') || low.includes('esp') || 
               low.includes('back') || low.includes('hist') || 
               low.length <= 3; // Cherche les petits champs c1, c2...
    });
    console.log("Candidats Identité (Race/Historique) :", identityCandidates);

    // 2. Chercher les champs de Sorts
    const spellFields = fields.filter((n: string) => n.startsWith('spell1'));
    console.log("Structure d'une ligne de sort (Ligne 1) :", spellFields);
    // Analyse : spell1 (Nom), spell1l (Level?), spell1r (Time?), spell1c (Range?)

    // 3. Chercher les Maîtrises
    const profFields = fields.filter((n: string) => 
        n.toLowerCase().includes('weapon') || n.toLowerCase().includes('tool') || n.toLowerCase().includes('armor')
    );
    console.log("Champs Maîtrises trouvés :", profFields);
    
    console.groupEnd();
}

// ============================================================================
// 3. MAIN EXPORT
// ============================================================================

export const generateCharacterSheet = async (player: Player) => {
  try {
    const level = player.level || 1;
    const pb = level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2;

    // CHARGEMENT
    const [pdfBytes, invRes, spellRes, classMd, raceMd, ...donsMds] = await Promise.all([
        fetch('/FDP/eFeuillePersoDD2024.pdf').then(r => r.arrayBuffer()),
        supabase.from('inventory_items').select('*').eq('player_id', player.id),
        supabase.from('player_spells').select('spells (name, level, range)').eq('player_id', player.id).order('created_at', { ascending: true }),
        player.class ? fetchMarkdown(`Classes/${player.class}/${player.class}.md`) : Promise.resolve(''),
        player.race ? fetchMarkdown(`RACES/DESCRIPTION_DES_RACES.md`) : Promise.resolve(''),
        fetchMarkdown(`DONS/DONS_D_ORIGINE.md`), fetchMarkdown(`DONS/DONS_GENERAUX.md`), fetchMarkdown(`DONS/STYLES_DE_COMBAT.md`),
    ]);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // --- LANCEMENT DE LA SONDE ---
    runProbe(form);

    // HELPERS
    const setTxt = (n: string, v: any) => { try { form.getTextField(n).setText(String(v ?? '')); } catch (e) {} };
    const setChk = (n: string, v: boolean) => { try { const f = form.getCheckBox(n); if(v) f.check(); else f.uncheck(); } catch(e) {} };

    // DATA PREP
    let abilities = []; try { abilities = Array.isArray(player.abilities) ? player.abilities : JSON.parse(player.abilities_json as string); } catch {}
    const stats = player.stats || {};
    const meta = (stats as any).creator_meta || {};

    // --- IDENTITÉ ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('subclass', player.subclass);
    setTxt('level', level);
    
    // HISTORIQUE & RACE (On tente les champs standards + les champs mystères 'c1' à 'c10')
    // Si 'background' ne marche pas, on essaie de voir si c'est un problème de couleur/font en loguant
    const bg = player.background || '';
    setTxt('background', bg); 
    setTxt('Background', bg);
    
    setTxt('race', player.race);
    setTxt('species', player.race);
    
    setTxt('alignment', player.alignment);
    setTxt('backstory', player.character_history);

    // --- CARACS ---
    abilities.forEach((ab: any) => {
        const map: any = { 'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con', 'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha' };
        const k = map[ab.name];
        if (k) {
            setTxt(k, ab.score);
            setTxt(`mod${k}`, `${ab.modifier >= 0 ? '+' : ''}${ab.modifier}`);
            const saveIdx = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'].indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                const isProf = ab.savingThrow > ab.modifier;
                setTxt(`save${num}`, `${ab.modifier + (isProf ? pb : 0) >= 0 ? '+' : ''}${ab.modifier + (isProf ? pb : 0)}`);
                setChk(`s${num}`, isProf);
            }
            // Skills... (Mapping inchangé, je raccourcis pour la lisibilité)
             if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const idx = SKILL_MAPPING[sk.name];
                    if (idx) {
                        const bonus = ab.modifier + (sk.isProficient ? pb : 0) + (sk.hasExpertise ? pb : 0);
                        setTxt(`skill${idx}`, `${bonus >= 0 ? '+' : ''}${bonus}`);
                        setChk(`sk${idx}`, sk.isProficient || sk.hasExpertise);
                    }
                });
            }
        }
    });

    // --- COMBAT ---
    setTxt('ac', (stats as any).armor_class || 10);
    setTxt('init', `${(stats as any).initiative >= 0 ? '+' : ''}${(stats as any).initiative || 0}`);
    setTxt('speed', (stats as any).speed || 9);
    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    const hdSize = getHitDieSize(player.class);
    setTxt('hd-max', `${(player.hit_dice as any)?.total ?? level}d${hdSize}`);
    setTxt('hd-spent', (player.hit_dice as any)?.used ?? 0);

    // --- MAÎTRISES (Correction) ---
    const wProfs = meta.weapon_proficiencies || [];
    const tProfs = meta.tool_proficiencies || [];
    const langs = (player.languages || []).filter((l: string) => l && !l.toLowerCase().includes('choix'));
    
    // Forçage dans les champs identifiés par le log précédent
    setTxt('weapons', wProfs.join(', '));
    setTxt('tools', tProfs.join(', '));
    setTxt('languages', langs.join(', '));

    // Armures (Cases à cocher)
    const aProfs = meta.armor_proficiencies || [];
    setChk('armor1', aProfs.some((x: string) => x.includes('légère')));
    setChk('armor2', aProfs.some((x: string) => x.includes('intermédiaire')));
    setChk('armor3', aProfs.some((x: string) => x.includes('lourde')));
    setChk('armor4', aProfs.some((x: string) => x.includes('bouclier')));

    // --- ARMES (Grille) ---
    const items = invRes.data || [];
    const weapons = items.map((i: any) => ({ ...i, meta: parseMeta(i.description) }))
                         .filter((i: any) => i.meta?.type === 'weapon')
                         .sort((a: any, b: any) => (b.meta.equipped ? 1 : 0) - (a.meta.equipped ? 1 : 0));
    
    weapons.slice(0, 6).forEach((w: any, i: number) => {
        const r = i + 1;
        const m = w.meta.weapon || {};
        setTxt(`weapons${r}1`, w.name);
        // Bonus Attaque
        const isFin = m.properties?.toLowerCase().includes('finesse');
        const stat = abilities.find((a: any) => a.name === (isFin ? 'Dextérité' : 'Force'));
        if (stat) setTxt(`weapons${r}2`, `${stat.modifier + pb + (m.weapon_bonus || 0) >= 0 ? '+' : ''}${stat.modifier + pb + (m.weapon_bonus || 0)}`);
        // Dégâts
        setTxt(`weapons${r}3`, `${m.damageDice || ''} ${m.damageType || ''}`);
        setTxt(`weapons${r}4`, m.properties || '');
    });

    const gear = items.filter((i: any) => !weapons.slice(0, 6).find((w: any) => w.id === i.id))
                      .map((i: any) => i.name).join(', ');
    setTxt('equipment', gear);

    // --- SORTS (CORRECTIF V8) ---
    const spells = spellRes.data || [];
    spells.slice(0, 30).forEach((e: any, i: number) => {
        if (!e.spells) return;
        const s = e.spells;
        const id = i + 1;
        const lvl = s.level === 0 ? 'T' : String(s.level);
        const rng = s.range || '';

        setTxt(`spell${id}`, s.name);
        
        // D'après votre retour : "Distance se remplit dans Temps d'incantation"
        // Votre log précédent montrait : spell1, spell1l, spell1r, spell1c
        // Si j'avais mis Range -> spell1r et que ça s'est affiché dans Temps...
        // ALORS : spell1r = Temps d'incantation.
        // IL RESTE : spell1c. 
        // HYPOTHÈSE : spell1c = Portée (Range)
        
        setTxt(`spell${id}l`, lvl);      // Level
        setTxt(`spell${id}c`, rng);      // Range (Nouvelle tentative !)
        setTxt(`spell${id}r`, "1 act");  // Time (Puisque 'r' semble être le temps)
    });

    // Stats magie
    const castStat = abilities.find((a: any) => a.name === (SPELLCASTING_ABILITY[player.class || ''] || 'Intelligence'));
    if (castStat) {
        setTxt('spell-dc', 8 + pb + castStat.modifier);
        setTxt('spell-bonus', `+${pb + castStat.modifier}`);
        setTxt('spell-mod', `+${castStat.modifier}`);
    }
    const slots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};
    for(let i=1; i<=9; i++) { 
        // Si cbslotXY sont des cases à cocher, on ne peut pas mettre de nombre.
        // On cherche un champ texte potentiel 'slot1'
        setTxt(`slot${i}`, slots[`level${i}`]); 
    }

    // --- TRAITS & DONS ---
    const featsRaw = [...(stats.feats?.origins || []), ...(stats.feats?.generals || []), ...(stats.feats?.styles || [])].filter(Boolean);
    const feats = parseFeatsFromMD(donsMds, featsRaw).map(x => `• ${x}`).join('\n');
    const traits = parseRaceTraits(raceMd, player.race || '').map(x => `• ${x}`).join('\n');
    const features = parseClassFeatures(classMd, level).map(x => `• ${x}`).join('\n');

    setTxt('traits', traits);
    setTxt('feats', feats);
    setTxt('features1', features);

    // --- EXPORT ---
    const blob = new Blob([await pdfDoc.save()], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${player.adventurer_name}_Fiche.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (e) { console.error(e); throw e; }
};