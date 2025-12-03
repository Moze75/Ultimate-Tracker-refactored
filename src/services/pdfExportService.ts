import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';
import { supabase } from '../lib/supabase';

// Mapping FR (App) vers Index PDF (Ordre Alphabétique EN)
const SKILL_MAPPING: Record<string, number> = {
  'Acrobaties': 1, 'Dressage': 2, 'Arcanes': 3, 'Athlétisme': 4,
  'Tromperie': 5, 'Histoire': 6, 'Perspicacité': 7, 'Intimidation': 8,
  'Investigation': 9, 'Médecine': 10, 'Nature': 11, 'Perception': 12,
  'Représentation': 13, 'Persuasion': 14, 'Religion': 15,
  'Escamotage': 16, 'Discrétion': 17, 'Survie': 18
};

const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

export const generateCharacterSheet = async (player: Player) => {
  try {
    // 1. Chargement du PDF vide
    const formUrl = '/FDP/eFeuillePersoDD2024.pdf';
    const formBytes = await fetch(formUrl).then(res => {
      if (!res.ok) throw new Error("Impossible de charger le modèle PDF");
      return res.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(formBytes);
    const form = pdfDoc.getForm();

    // Helpers
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

    // --- Parsing des données JSON ---
    const stats = typeof player.stats === 'string' ? JSON.parse(player.stats) : player.stats || {};
    const abilities = typeof player.abilities_json === 'string' ? JSON.parse(player.abilities_json) : player.abilities_json || [];
    const equipment = player.equipment_json 
      ? (typeof player.equipment_json === 'string' ? JSON.parse(player.equipment_json) : player.equipment_json)
      : { weapons: [], armor: [], gear: [], tools: [] };
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};

    // --- Remplissage Identité ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('level', player.level);
    setTxt('species', player.race);
    setTxt('background', player.background);
    setTxt('alignment', player.alignment);

    // --- Stats & Combat ---
    setTxt('ac', stats.armor_class);
    setBonus('init', stats.initiative || 0);
    setTxt('speed', stats.speed);
    setBonus('pb', stats.proficiency_bonus || 2);
    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    setTxt('hp-temp', player.temporary_hp);

    // --- Caractéristiques & Compétences ---
    const statKeyMap: Record<string, string> = {
      'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con',
      'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha'
    };

    abilities.forEach((ab: any) => {
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
        if (ab.skills) {
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

    // --- Armes (Max 6) & Overflow ---
    const allWeapons = equipment.weapons || [];
    const mainWeapons = allWeapons.slice(0, 6);
    const overflowWeapons = allWeapons.slice(6); // Armes restantes

    mainWeapons.forEach((w: any, i: number) => {
      const row = i + 1;
      setTxt(`weapons${row}1`, w.name);
      const meta = w.weapon_meta || {};
      const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
      setTxt(`weapons${row}3`, dmg.trim());
      setTxt(`weapons${row}4`, meta.properties || '');
    });

    // --- Équipement ---
    // On ajoute les armes en trop au début de la liste textuelle
    const overflowNames = overflowWeapons.map((w: any) => `${w.name} (Arme)`);
    const gearItems = [
      ...overflowNames,
      ...(equipment.armor || []).map((i: any) => i.name),
      ...(equipment.gear || []).map((i: any) => i.name),
      ...(equipment.tools || []).map((i: any) => i.name)
    ].join(', ');
    setTxt('equipment', gearItems);

    setTxt('gp', player.gold);
    setTxt('sp', player.silver);
    setTxt('cp', player.copper);

    // --- Magie (Slots & Sorts) ---
    // 1. Slots
    for (let i = 1; i <= 9; i++) {
      const key = `level${i}`;
      if (spellSlots[key]) setTxt(`slot${i}`, spellSlots[key]);
    }

    // 2. Récupération des sorts depuis Supabase (car absents de l'objet player)
    try {
      const { data: spellData } = await supabase
        .from('player_spells')
        .select('spells (name, level)')
        .eq('player_id', player.id)
        .order('created_at', { ascending: true });

      if (spellData && spellData.length > 0) {
        // On a une liste simple : spell1, spell2... spell30
        // On remplit dans l'ordre trouvé
        spellData.slice(0, 30).forEach((item: any, index: number) => {
          if (item.spells && item.spells.name) {
            const fieldId = index + 1;
            // Nom du sort
            setTxt(`spell${fieldId}`, item.spells.name);
            // On pourrait mettre le niveau à côté si on veut, mais le champ est petit
            // setTxt(`spell${fieldId}l`, item.spells.level); // Optionnel si le PDF a un champ niveau
          }
        });
      }
    } catch (spellError) {
      console.warn("Impossible de récupérer les sorts pour le PDF", spellError);
    }

    // --- Langues ---
    if (player.languages) {
      const langStr = Array.isArray(player.languages) 
          ? player.languages.join(', ') 
          : String(player.languages);
      setTxt('languages', langStr);
    }

    // --- Téléchargement ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${player.adventurer_name || 'Personnage'}_Fiche.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error("Erreur export PDF:", err);
    throw err;
  }
};