import { PDFDocument } from 'pdf-lib';
import { Player } from '../types/dnd';

// Mapping des Compétences (Ordre alphabétique standard D&D 5e)
const SKILL_ORDER = [
  'Acrobaties', 'Dressage', 'Arcanes', 'Athlétisme', 'Tromperie', 'Histoire',
  'Perspicacité', 'Intimidation', 'Investigation', 'Médecine', 'Nature',
  'Perception', 'Représentation', 'Persuasion', 'Religion', 'Escamotage',
  'Discrétion', 'Survie'
];

// Mapping des Sauvegardes (Ordre standard fiche D&D: Str, Dex, Con, Int, Wis, Cha)
const SAVE_ORDER = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

export const generateCharacterSheet = async (player: Player) => {
  try {
    // 1. Charger le PDF vide
    const formBytes = await fetch('/FDP/eFeuillePersoDD2024.pdf').then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(formBytes);
    const form = pdfDoc.getForm();

    // --- Helpers pour remplir les champs sans crash ---
    const setText = (name: string, value: string | number) => {
      try {
        const field = form.getTextField(name);
        field.setText(String(value));
      } catch (e) { /* Champ introuvable, on ignore silencieusement */ }
    };

    const setCheck = (name: string, checked: boolean) => {
      try {
        const field = form.getCheckBox(name);
        if (checked) field.check();
        else field.uncheck();
      } catch (e) { /* Champ introuvable */ }
    };

    // --- Préparation des Données ---
    
    // 1. Parsing des JSONs
    const abilitiesData = typeof player.abilities_json === 'string' 
      ? JSON.parse(player.abilities_json) 
      : player.abilities_json || []; // Tableau d'objets {name: "Force", score: 10, modifier: 0, savingThrow: 2, skills: []}

    const statsData = typeof player.stats === 'string' 
      ? JSON.parse(player.stats) 
      : player.stats || {}; // {armor_class, initiative, speed...}

    const equipmentData = player.equipment_json 
      ? (typeof player.equipment_json === 'string' ? JSON.parse(player.equipment_json) : player.equipment_json)
      : { weapons: [], armor: [], gear: [], tools: [] };

    // --- Remplissage : En-tête ---
    setText('charactername', player.adventurer_name || '');
    setText('class', player.class || ''); // Ex: "Guerrier"
    setText('level', player.level?.toString() || '1');
    setText('background', player.background || '');
    setText('species', player.race || ''); // Champ "species" dans le PDF = Race
    setText('alignment', player.alignment || '');
    setText('xp', ''); // Pas de champ XP dans Player, laisser vide ou calculer

    // --- Remplissage : Stats Principales (Scores & Modif) ---
    // On map les noms français vers les clés du PDF (str, dex, con, int, wis, cha)
    const statMap: Record<string, string> = {
      'Force': 'str', 'Dextérité': 'dex', 'Constitution': 'con',
      'Intelligence': 'int', 'Sagesse': 'wis', 'Charisme': 'cha'
    };

    abilitiesData.forEach((ab: any) => {
      const pdfKey = statMap[ab.name]; // ex: 'str'
      if (pdfKey) {
        setText(pdfKey, ab.score);
        setText(`mod${pdfKey}`, ab.modifier >= 0 ? `+${ab.modifier}` : ab.modifier);
        
        // Sauvegardes (Saves)
        // Le PDF utilise save1..save6 et s1..s6 (checkbox)
        const saveIndex = SAVE_ORDER.indexOf(ab.name);
        if (saveIndex !== -1) {
            const saveId = saveIndex + 1; // 1 à 6
            setText(`save${saveId}`, ab.savingThrow >= 0 ? `+${ab.savingThrow}` : ab.savingThrow);
            
            // Détection maîtrise sauvegarde (si save > mod, on suppose maîtrisé, ou via une prop 'isProficient' si elle existe)
            // Ici on compare grossièrement savingThrow vs modifier
            const isProficient = ab.savingThrow > ab.modifier; 
            setCheck(`s${saveId}`, isProficient);
        }
      }
    });

    // --- Remplissage : Combat ---
    setText('ac', statsData.armor_class || 10);
    setText('init', (statsData.initiative >= 0 ? '+' : '') + (statsData.initiative || 0));
    setText('speed', statsData.speed || 30);
    setText('hp-current', player.current_hp || 0);
    setText('hp-max', player.max_hp || 0);
    setText('hp-temp', player.temporary_hp || '');
    // Pb = Proficiency Bonus (Bonus de Maîtrise)
    setText('pb', `+${statsData.proficiency_bonus || 2}`);

    // --- Remplissage : Compétences (Skills) ---
    // On parcourt la liste ordonnée D&D pour remplir skill1..18 et sk1..18
    SKILL_ORDER.forEach((skillName, index) => {
        const pdfIndex = index + 1; // 1 à 18
        
        // Trouver le skill dans les données du joueur (imbriqué dans abilitiesData)
        let foundSkill: any = null;
        
        for (const ability of abilitiesData) {
            const s = ability.skills.find((sk: any) => sk.name === skillName);
            if (s) {
                foundSkill = s;
                break;
            }
        }

        if (foundSkill) {
            setText(`skill${pdfIndex}`, foundSkill.bonus >= 0 ? `+${foundSkill.bonus}` : foundSkill.bonus);
            setCheck(`sk${pdfIndex}`, foundSkill.isProficient);
        }
    });

    // --- Remplissage : Argent ---
    setText('gp', player.gold || 0);
    setText('sp', player.silver || 0);
    setText('cp', player.copper || 0);

    // --- Remplissage : Équipement (Liste texte) ---
    const gearList = [
        ...(equipmentData.gear || []).map((i: any) => i.name),
        ...(equipmentData.tools || []).map((i: any) => i.name),
        ...(equipmentData.armor || []).map((i: any) => i.name)
    ].join(', ');
    setText('equipment', gearList);

    // --- Remplissage : Armes (Grid) ---
    // PDF fields: weapons11 (Name), weapons12 (Atk), weapons13 (Dmg) ... jusqu'à weapons6X
    // Attention: votre log montre weapons11, weapons12... puis weapons21...
    // Hypothèse forte: Row 1 = weapons1X, Row 2 = weapons2X...
    // Col 1 = Name, Col 2 = Bonus, Col 3 = Damage
    
    const weapons = equipmentData.weapons || [];
    weapons.slice(0, 6).forEach((w: any, idx: number) => {
        const row = idx + 1;
        // Nom de l'arme
        setText(`weapons${row}1`, w.name);
        
        // Bonus d'attaque (souvent non stocké explicitement, on met vide ou calculé si possible)
        // On laisse vide pour remplissage manuel ou on met 'Str/Dex'
        setText(`weapons${row}2`, ""); 

        // Dégâts
        const meta = w.weapon_meta || {};
        const dmg = `${meta.damageDice || ''} ${meta.damageType || ''}`;
        setText(`weapons${row}3`, dmg.trim());
        
        // Notes (Portée, propriétés) -> Col 4 ? (weapons14)
        setText(`weapons${row}4`, meta.properties || '');
    });

    // --- Remplissage : Langues ---
    // Le tableau player.languages est une string[] ou string json
    let langs = "";
    if (Array.isArray(player.languages)) langs = player.languages.join(', ');
    else if (typeof player.languages === 'string') langs = player.languages;
    setText('languages', langs);

    // --- Téléchargement ---
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Feuille_${player.adventurer_name || 'Perso'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error("Erreur génération PDF:", error);
    alert("Erreur lors de la génération du PDF. Vérifiez la console.");
  }
};