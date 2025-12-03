import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// --- CONSTANTES DE MAPPING ---

const SKILL_MAPPING: Record<string, number> = {
  'Acrobaties': 1, 'Dressage': 2, 'Arcanes': 3, 'Athlétisme': 4,
  'Tromperie': 5, 'Histoire': 6, 'Perspicacité': 7, 'Intimidation': 8,
  'Investigation': 9, 'Médecine': 10, 'Nature': 11, 'Perception': 12,
  'Représentation': 13, 'Persuasion': 14, 'Religion': 15,
  'Escamotage': 16, 'Discrétion': 17, 'Survie': 18
};

const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

const SPELLCASTING_ABILITY: Record<string, string> = {
  'Magicien': 'Intelligence', 'Artificier': 'Intelligence',
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

    // 2. Parsing & Récupération des Données
    
    // --- Données "En Dur" dans l'objet Player ---
    const stats = typeof player.stats === 'string' ? JSON.parse(player.stats) : player.stats || {};
    const rawAbilities = typeof player.abilities_json === 'string' ? JSON.parse(player.abilities_json) : player.abilities_json || [];
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};
    
    // Normalisation des Caractéristiques (parfois Array, parfois Object)
    let abilitiesData: any[] = [];
    if (Array.isArray(rawAbilities)) {
      abilitiesData = rawAbilities;
    } else if (typeof rawAbilities === 'object') {
      // Conversion Map -> Array si nécessaire
      abilitiesData = Object.entries(rawAbilities).map(([name, data]: [string, any]) => ({
        name,
        score: data.score,
        modifier: data.modifier,
        savingThrow: data.savingThrow,
        skills: data.skills || []
      }));
    }

    // --- Récupération INVENTAIRE (Armes & Équipement) depuis la BDD ---
    // ✅ NOUVEAU : On fetch l'inventaire réel car equipment_json est souvent vide
    let weapons: any[] = [];
    let otherGear: any[] = [];
    
    try {
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('player_id', player.id);

      if (inventoryItems) {
        // Séparer Armes vs Le reste
        weapons = inventoryItems.filter((i: any) => 
          i.item_type === 'weapon' || (i.tags && i.tags.includes('Arme'))
        );
        otherGear = inventoryItems.filter((i: any) => !weapons.includes(i));
      }
    } catch (e) { console.error("Erreur fetch inventaire", e); }

    // 3. Remplissage du PDF

    // --- Identité ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('level', player.level);
    setTxt('species', player.race); // Race = Species
    setTxt('background', player.background);
    setTxt('alignment', player.alignment);
    setTxt('xp', ""); 

    // --- Combat & Vie ---
    setTxt('ac', stats.armor_class || 10);
    setBonus('init', stats.initiative || 0);
    setTxt('speed', stats.speed || 9);
    
    // Bonus de maîtrise (calculé)
    const pb = getProficiency(player.level || 1);
    setBonus('pb', pb);

    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    setTxt('hp-temp', player.temporary_hp || '');
    
    // ✅ NOUVEAU : Dés de vie
    if (player.hit_dice) {
        // Format attendu : hit_dice = { total: 5, used: 2 }
        const hdTotal = typeof player.hit_dice === 'object' ? (player.hit_dice as any).total : player.level;
        const hdUsed = typeof player.hit_dice === 'object' ? (player.hit_dice as any).used : 0;
        setTxt('hd-max', `${hdTotal}d${getHitDieSize(player.class)}`); // Ex: 5d8
        setTxt('hd-spent', hdUsed);
    }

    // --- Caractéristiques (Scores & Sauvegardes) ---
    const statKeyMap: Record<string, string> = {
        'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con',
        'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha'
    };

    abilitiesData.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            // ✅ Score & Modif
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);

            // ✅ Sauvegardes (Save1 -> Save6)
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                setBonus(`save${num}`, ab.savingThrow);
                // Checkbox si maîtrisé (si save > mod)
                setChk(`s${num}`, ab.savingThrow > ab.modifier);
            }

            // ✅ Compétences
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

    // --- Magie (Calculs automatiques) ---
    // ✅ NOUVEAU : Calcul DD, Bonus Attaque, Carac Incantation
    const castingAbility = SPELLCASTING_ABILITY[player.class || ''] || null;
    if (castingAbility) {
        setTxt('spell-ability', castingAbility); // Ex: "Intelligence"
        
        const abilityObj = abilitiesData.find((a: any) => a.name === castingAbility);
        const mod = abilityObj ? abilityObj.modifier : 0;
        
        setBonus('spell-mod', mod); // Modif carac
        setTxt('spell-dc', 8 + pb + mod); // DD = 8 + PB + Mod
        setBonus('spell-bonus', pb + mod); // Attaque = PB + Mod
    }

    // --- Armes (Depuis l'inventaire fetché) ---
    const displayWeapons = weapons.slice(0, 6);
    const overflowWeapons = weapons.slice(6);

    displayWeapons.forEach((w: any, i: number) => {
        const row = i + 1;
        // Nom
        setTxt(`weapons${row}1`, w.name);
        
        // Bonus d'attaque (Approximation : FOR ou DEX + PB)
        // On essaie de deviner si c'est une arme Finesse/Distance pour utiliser DEX
        const isFinesse = w.properties?.toLowerCase().includes('finesse') || w.range?.includes('m');
        const statName = isFinesse ? 'Dextérité' : 'Force';
        const statObj = abilitiesData.find((a: any) => a.name === statName);
        const atkBonus = (statObj?.modifier || 0) + (w.is_proficient ? pb : 0); // On suppose maîtrise par défaut pour simplifier
        // setBonus(`weapons${row}2`, atkBonus); // Peut être activé si voulu

        // Dégâts
        const dmg = `${w.damage_dice || ''} ${w.damage_type || ''}`;
        setTxt(`weapons${row}3`, dmg.trim());
        
        // Notes
        setTxt(`weapons${row}4`, w.properties || '');
    });

    // --- Équipement & Or ---
    const gearText = [
        ...overflowWeapons.map((w: any) => w.name), // Armes en trop
        ...otherGear.map((i: any) => `${i.name} (x${i.quantity || 1})`)
    ].join(', ');
    
    setTxt('equipment', gearText);
    
    setTxt('gp', player.gold);
    setTxt('sp', player.silver);
    setTxt('cp', player.copper);

    // --- Traits & Dons (Aggregation) ---
    // ✅ NOUVEAU : On remplit les cases de texte
    const feats = stats.feats || {};
    const featsList = [
        ...(feats.origins || []),
        ...(feats.generals || []),
        ...(feats.styles || [])
    ].filter(Boolean);
    
    setTxt('feats', featsList.join('\n')); // Liste des dons
    setTxt('traits', player.race ? `Trait racial: ${player.race}` : ''); // Traits raciaux (simplifié)
    
    // Capacités de classe (simplifié via les notes ou historique si dispo)
    // Si vous avez une colonne 'class_features', utilisez-la ici.
    // setTxt('features1', "..."); 

    // --- Langues ---
    if (player.languages) {
      const langStr = Array.isArray(player.languages) 
          ? player.languages.join(', ') 
          : String(player.languages);
      setTxt('languages', langStr);
    }

    // --- Magie (Slots & Sorts connus) ---
    for (let i = 1; i <= 9; i++) {
        if (spellSlots[`level${i}`]) setTxt(`slot${i}`, spellSlots[`level${i}`]);
    }

    try {
      const { data: spellData } = await supabase
        .from('player_spells')
        .select('spells (name, level)')
        .eq('player_id', player.id)
        .order('created_at', { ascending: true });

      if (spellData && spellData.length > 0) {
        spellData.slice(0, 30).forEach((item: any, index: number) => {
          if (item.spells && item.spells.name) {
            setTxt(`spell${index + 1}`, item.spells.name);
          }
        });
      }
    } catch (spellError) { console.warn("Erreur sorts", spellError); }

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

// Helper pour la taille du dé de vie
function getHitDieSize(className?: string | null): number {
    switch (className) {
        case 'Barbare': return 12;
        case 'Guerrier':
        case 'Paladin':
        case 'Rôdeur': return 10;
        case 'Barde':
        case 'Clerc':
        case 'Druide':
        case 'Roublard':
        case 'Moine':
        case 'Occultiste':
        case 'Artificier': return 8;
        case 'Magicien':
        case 'Ensorceleur': return 6;
        default: return 8;
    }
}