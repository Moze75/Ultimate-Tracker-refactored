import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';

// Mapping FR (App) vers Index PDF (Ordre Alphabétique EN)
// L'index correspond au numéro du champ skillX et skX
const SKILL_MAPPING: Record<string, number> = {
  'Acrobaties': 1,      // Acrobatics
  'Dressage': 2,        // Animal Handling
  'Arcanes': 3,         // Arcana
  'Athlétisme': 4,      // Athletics
  'Tromperie': 5,       // Deception
  'Histoire': 6,        // History
  'Perspicacité': 7,    // Insight
  'Intimidation': 8,    // Intimidation
  'Investigation': 9,   // Investigation
  'Médecine': 10,       // Medicine
  'Nature': 11,         // Nature
  'Perception': 12,     // Perception
  'Représentation': 13, // Performance
  'Persuasion': 14,     // Persuasion
  'Religion': 15,       // Religion
  'Escamotage': 16,     // Sleight of Hand
  'Discrétion': 17,     // Stealth
  'Survie': 18          // Survival
};

// Ordre des caractéristiques pour les sauvegardes (Save1 -> Save6)
const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

export const generateCharacterSheet = async (player: Player) => {
  try {
    // 1. Chargement du PDF
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
        // Si c'est un bonus positif, on ajoute le + (sauf pour les champs vides)
        form.getTextField(name).setText(strVal);
      } catch (e) { /* ignore missing fields */ }
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
        if (isChecked) field.check();
        else field.uncheck();
      } catch (e) {}
    };

    // 2. Parsing des données
    const stats = typeof player.stats === 'string' ? JSON.parse(player.stats) : player.stats || {};
    const abilities = typeof player.abilities_json === 'string' ? JSON.parse(player.abilities_json) : player.abilities_json || [];
    const equipment = player.equipment_json 
      ? (typeof player.equipment_json === 'string' ? JSON.parse(player.equipment_json) : player.equipment_json)
      : { weapons: [], armor: [], gear: [], tools: [] };
    const spellSlots = typeof player.spell_slots === 'string' ? JSON.parse(player.spell_slots) : player.spell_slots || {};

    // 3. Remplissage
    
    // --- En-tête ---
    setTxt('charactername', player.adventurer_name);
    setTxt('class', player.class);
    setTxt('level', player.level);
    setTxt('species', player.race);
    setTxt('background', player.background);
    setTxt('alignment', player.alignment);
    setTxt('xp', ""); // Calculer si dispo

    // --- Combat ---
    setTxt('ac', stats.armor_class);
    setBonus('init', stats.initiative || 0);
    setTxt('speed', stats.speed);
    setBonus('pb', stats.proficiency_bonus || 2);
    setTxt('hp-current', player.current_hp);
    setTxt('hp-max', player.max_hp);
    setTxt('hp-temp', player.temporary_hp);

    // --- Caractéristiques (Abilities) ---
    const statKeyMap: Record<string, string> = {
        'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con',
        'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha'
    };

    abilities.forEach((ab: any) => {
        const key = statKeyMap[ab.name];
        if (key) {
            setTxt(key, ab.score);
            setBonus(`mod${key}`, ab.modifier);

            // Saves
            const saveIdx = SAVE_ORDER.indexOf(ab.name);
            if (saveIdx >= 0) {
                const num = saveIdx + 1;
                setBonus(`save${num}`, ab.savingThrow);
                // Logique de maîtrise : si Save > Mod, on considère maîtrisé (ou si info dispo)
                setChk(`s${num}`, ab.savingThrow > ab.modifier);
            }

            // Skills liés à cette carac
            if (ab.skills && Array.isArray(ab.skills)) {
                ab.skills.forEach((sk: any) => {
                    const skillIdx = SKILL_MAPPING[sk.name];
                    if (skillIdx) {
                        setBonus(`skill${skillIdx}`, sk.bonus);
                        setChk(`sk${skillIdx}`, sk.isProficient || sk.hasExpertise);
                    }
                });
            }
        }
    });

    // --- Argent ---
    setTxt('gp', player.gold);
    setTxt('sp', player.silver);
    setTxt('cp', player.copper);

    // --- Équipement ---
    const gearItems = [
        ...(equipment.armor || []).map((i: any) => i.name),
        ...(equipment.gear || []).map((i: any) => i.name),
        ...(equipment.tools || []).map((i: any) => i.name)
    ].join(', ');
    setTxt('equipment', gearItems);

    // --- Armes (Grid) ---
    // Format PDF: weapons[Row][Col] -> Row 1-6, Col 1(Name), 3(Dmg), 4(Prop)
    const weapons = equipment.weapons || [];
    weapons.slice(0, 6).forEach((w: any, i: number) => {
        const row = i + 1;
        setTxt(`weapons${row}1`, w.name);
        
        const meta = w.weapon_meta || {};
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setTxt(`weapons${row}3`, dmg.trim());
        setTxt(`weapons${row}4`, meta.properties || '');
        
        // Bonus attaque (Col 2) - Non dispo directement, on laisse vide
    });

    // --- Magie (Slots) ---
    // Mapping slot1..slot9 (Total slots, pas utilisés)
    for (let i = 1; i <= 9; i++) {
        const key = `level${i}`;
        if (spellSlots[key]) {
            setTxt(`slot${i}`, spellSlots[key]);
        }
    }

    // --- Langues ---
    if (player.languages) {
        const langStr = Array.isArray(player.languages) 
            ? player.languages.join(', ') 
            : String(player.languages);
        setTxt('languages', langStr);
    }

    // 4. Export
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
    throw err; // Propager l'erreur pour que l'UI puisse afficher un toast
  }
};