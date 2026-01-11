import React, { useEffect, useMemo, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
 
import ProgressBar from './ui/ProgressBar';
import { stopWizardMusic } from './ui/musicControl';
import RaceSelection from './steps/RaceSelection';
import ClassSelection from './steps/ClassSelection';
import SpellSelection from './steps/SpellSelection';
import BackgroundSelection from './steps/BackgroundSelection';
import ProfileSelection from './steps/ProfileSelection';
import AbilityScores from './steps/AbilityScores';
import CharacterSummary from './steps/CharacterSummary';

import { DndClass, DndRace, CustomClassData } from '../types/character';
import type { CharacterExportPayload } from '../types/CharacterExport'; 
import { supabase } from '../../../lib/supabase';
import { calculateArmorClass, calculateHitPoints, calculateModifier } from '../utils/dndCalculations';

import { races } from '../data/races';
import { classes } from '../data/classes';
import { backgrounds } from '../data/backgrounds';
import { enrichEquipmentList, determineAutoEquip } from '../../../services/equipmentLookupService';
import { appContextService } from '../../../services/appContextService'; // ✅ IMPORT


/* ===========================================================
   Utilitaires
   =========================================================== */

// Convertit ft -> m en arrondissant au 0,5 m (30 ft → 9 m)
const feetToMeters = (ft?: number) => {
  const n = Number(ft);
  if (!Number.isFinite(n)) return 9;
  return Math.round(n * 0.3048 * 2) / 2;
};

import { DEFAULT_CUSTOM_CLASS_IMAGE } from '../utils/classImages';
import { getClassImageUrl } from '../../../config/assets';

function getClassImageUrlLocal(className: DndClass | string | undefined | null): string {
  if (!className) return DEFAULT_CUSTOM_CLASS_IMAGE;
  return getClassImageUrl(className as string) || DEFAULT_CUSTOM_CLASS_IMAGE;
}

// Normalise le don d'historique pour coller à la liste attendue par l'app
function normalizeBackgroundFeat(feat?: string | null): string | undefined {
  if (!feat) return undefined;
  const trimmed = feat.trim();
  if (trimmed.toLowerCase().startsWith('initié à la magie')) {
    return 'Initié à la magie';
  }
  return trimmed;
}

// Parse l'or ("X po") dans la liste d'items d'équipement
function parseGoldFromItems(items?: string[]): number | undefined {
  if (!Array.isArray(items)) return undefined;
  let total = 0;
  for (const it of items) {
    const m = String(it).match(/(\d+)\s*po\b/i);
    if (m) total += parseInt(m[1], 10);
  }
  return total > 0 ? total : undefined;
}

// Tente d'uploader une image dans le bucket Supabase "avatars"
async function tryUploadAvatarFromUrl(playerId: string, url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();

    const contentType = blob.type || 'image/png';
    const ext = (() => {
      const t = contentType.split('/')[1]?.toLowerCase();
      if (t === 'jpeg') return 'jpg';
      return t || 'png';
    })();

    const fileName = `class-${Date.now()}.${ext}`;
    const filePath = `${playerId}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(filePath, blob, { upsert: true, contentType });

    if (uploadErr) throw uploadErr;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return publicUrl || null;
  } catch (e) {
    console.warn('Upload avatar depuis URL impossible:', e);
    return null;
  }
}

// Notifie le parent qu'un personnage a été créé
type CreatedEvent = {
  type: 'creator:character_created';
  payload: { playerId: string; player?: any };
};

const notifyParentCreated = (playerId: string, player?: any) => {
  const msg: CreatedEvent = { type: 'creator:character_created', payload: { playerId, player } };
  try { window.parent?.postMessage(msg, '*'); } catch {}
  try { (window as any).opener?.postMessage(msg, '*'); } catch {}
  try { window.postMessage(msg, '*'); } catch {}
};

/* ===========================================================
   Étapes
   =========================================================== */

const steps = ['Race', 'Classe', 'Sorts', 'Historique', 'Profil', 'Caractéristiques', 'Résumé'];

interface WizardProps {
  onFinish?: (payload: CharacterExportPayload) => void;
  onCancel?: () => void;
  initialSnapshot?: any; // ✅ NOUVEAU PROP
}

export default function CharacterCreationWizard({ onFinish, onCancel, initialSnapshot }: WizardProps) {
  // ✅ Initialiser depuis le snapshot si présent
  const [currentStep, setCurrentStep] = useState(initialSnapshot?.currentStep ?? 0);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [characterName, setCharacterName] = useState(initialSnapshot?.characterName ?? '');
  const [selectedRace, setSelectedRace] = useState('');
const [customRaceData, setCustomRaceData] = useState<DndRace | null>(null);
const [selectedClass, setSelectedClass] = useState<DndClass | string>('');
const [customClassData, setCustomClassData] = useState<CustomClassData | null>(null);
  const [selectedBackground, setSelectedBackground] = useState(initialSnapshot?.selectedBackground ?? '');
  const [backgroundEquipmentOption, setBackgroundEquipmentOption] = useState<'A' | 'B' | ''>(initialSnapshot?.backgroundEquipmentOption ?? '');
  const [selectedClassSkills, setSelectedClassSkills] = useState<string[]>(initialSnapshot?.selectedClassSkills ?? []);
  const [selectedEquipmentOption, setSelectedEquipmentOption] = useState<string>(initialSnapshot?.selectedEquipmentOption ?? '');
  const [selectedCantrips, setSelectedCantrips] = useState<any[]>(initialSnapshot?.selectedCantrips ?? []);
  const [selectedLevel1Spells, setSelectedLevel1Spells] = useState<any[]>(initialSnapshot?.selectedLevel1Spells ?? []);
  const [selectedAlignment, setSelectedAlignment] = useState(initialSnapshot?.selectedAlignment ?? '');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(initialSnapshot?.selectedLanguages ?? []);
  const [age, setAge] = useState(initialSnapshot?.age ?? '');
  const [gender, setGender] = useState(initialSnapshot?.gender ?? '');
  const [characterHistory, setCharacterHistory] = useState(initialSnapshot?.characterHistory ?? '');
  const [abilities, setAbilities] = useState<Record<string, number>>(initialSnapshot?.abilities ?? {
    'Force': 8,
    'Dextérité': 8,
    'Constitution': 8,
    'Intelligence': 8,
    'Sagesse': 8,
    'Charisme': 8,
  });
  const [effectiveAbilities, setEffectiveAbilities] = useState<Record<string, number>>(initialSnapshot?.effectiveAbilities ?? abilities);



  // Objet d'historique sélectionné
  const selectedBackgroundObj = useMemo(
    () => backgrounds.find((b) => b.name === selectedBackground) || null,
    [selectedBackground]
  );

  // Resets cohérents
  useEffect(() => {
    setSelectedClassSkills([]);
    setSelectedEquipmentOption('');
    setSelectedCantrips([]);
    setSelectedLevel1Spells([]);
  }, [selectedClass]);

  useEffect(() => {
    setBackgroundEquipmentOption('');
  }, [selectedBackground]);

// ✅ NOUVEAU: Sauvegarder uniquement lors du changement de step
useEffect(() => {
  const snapshot = {
    currentStep,
    characterName,
    selectedRace,
    selectedClass,
    selectedBackground,
    selectedAlignment,
    selectedLanguages,
    age,
    gender,
    characterHistory,
    backgroundEquipmentOption,
    selectedClassSkills,
    selectedEquipmentOption,
    selectedCantrips,
    selectedLevel1Spells,
    abilities,
    effectiveAbilities,
  };
  
  appContextService.saveWizardSnapshot(snapshot);
  console.log('[Wizard] Snapshot sauvegardé au step', currentStep);
}, [currentStep]); // ✅ UNIQUEMENT currentStep comme dépendance

  // Classes qui ne lancent pas de sorts au niveau 1
  const nonCasterClasses: DndClass[] = ['Guerrier', 'Roublard', 'Barbare', 'Moine'];
  const isNonCaster = selectedClass && nonCasterClasses.includes(selectedClass as DndClass);

  // Navigation
  const nextStep = () => {
    const next = currentStep + 1;
    if (next === 2 && isNonCaster) {
      setCurrentStep(3);
    } else {
      setCurrentStep(Math.min(next, steps.length - 1));
    }
  };

  const previousStep = () => {
    const prev = currentStep - 1;
    if (prev === 2 && isNonCaster) {
      setCurrentStep(1);
    } else {
      setCurrentStep(Math.max(prev, 0));
    }
  };

  // Finalisation
 const handleFinish = async () => {
  try {
    stopWizardMusic();

    // ✅ Vérifier qu'une création n'est pas déjà en cours
if (loadingEquipment) {
  console.warn('[Wizard] Création déjà en cours');
  return;
}

    // ✅ Utiliser customRaceData si la race sélectionnée est personnalisée
    const raceData = customRaceData && customRaceData.name === selectedRace
      ? customRaceData
      : races.find((r) => r.name === selectedRace);

    const classData = classes.find((c) => c.name === selectedClass);

  

      // Abilities finales
      const finalAbilities = { ...effectiveAbilities };
      if (raceData?.abilityScoreIncrease) {
        Object.entries(raceData.abilityScoreIncrease).forEach(([ability, bonus]) => {
          if (finalAbilities[ability] != null) {
            finalAbilities[ability] += bonus;
          }
        });
      }

      // Dérivés de combat
      const hitPoints = calculateHitPoints(
        finalAbilities['Constitution'] || 10,
        selectedClass,
        1,
        customClassData?.hitDie
      );
      const armorClass = calculateArmorClass(finalAbilities['Dextérité'] || 10);
      const initiative = calculateModifier(finalAbilities['Dextérité'] || 10);
      const speedFeet = raceData?.speed || 30;

      // Équipement de classe selon l'option sélectionnée
      const classEquipment = selectedEquipmentOption && classData?.equipmentOptions
        ? classData.equipmentOptions.find(opt => opt.label === selectedEquipmentOption)?.items || []
        : classData?.equipment || [];

      // Équipement d'historique
      const bgEquip =
        backgroundEquipmentOption === 'A'
          ? selectedBackgroundObj?.equipmentOptions?.optionA ?? []
          : backgroundEquipmentOption === 'B'
            ? selectedBackgroundObj?.equipmentOptions?.optionB ?? []
            : [];

      // Compétences maîtrisées
      const backgroundSkills = selectedBackgroundObj?.skillProficiencies ?? [];
      const proficientSkills = Array.from(new Set([...(selectedClassSkills || []), ...backgroundSkills]));

      // Équipement combiné
      const equipment = [...classEquipment, ...bgEquip];

      // Don d'historique
      const backgroundFeat = normalizeBackgroundFeat(selectedBackgroundObj?.feat);

      // Or initial
      const goldFromClassEquipment = parseGoldFromItems(classEquipment);
      const goldFromA = parseGoldFromItems(selectedBackgroundObj?.equipmentOptions?.optionA);
      const goldFromB = parseGoldFromItems(selectedBackgroundObj?.equipmentOptions?.optionB);
      
      const backgroundGold = backgroundEquipmentOption === 'A'
        ? goldFromA
        : backgroundEquipmentOption === 'B'
        ? goldFromB
        : undefined;

      const gold = (goldFromClassEquipment || 0) + (backgroundGold || 0);

      // Image de classe
      const avatarImageUrl = getClassImageUrlLocal(selectedClass) ?? undefined;

      // Combiner les langues raciales et sélectionnées
      const racialLanguages = raceData?.languages || [];
      const allLanguages = Array.from(new Set([...racialLanguages, ...selectedLanguages]));

     // MODE INTÉGRÉ
if (typeof onFinish === 'function') {
  setLoadingEquipment(true);

  let equipmentDetails;
  try {
    const enriched = await enrichEquipmentList(equipment);
    equipmentDetails = determineAutoEquip(enriched);
  } catch (error) {
    console.error('Erreur lors de l\'enrichissement des équipements:', error);
    toast.error('Impossible de charger les équipements. Création sans équipement.');
    equipmentDetails = [];
    setLoadingEquipment(false); // ✅ Désactiver uniquement en cas d'erreur
    return; // ✅ Arrêter le processus
  }
  // ⚠️ NE PAS mettre finally ici - le loading reste actif

const payload: CharacterExportPayload = {
  characterName: characterName.trim() || 'Héros sans nom',
  selectedRace: selectedRace || '',
  selectedClass: (selectedClass as string) || '',
  selectedBackground: selectedBackground || '',
  level: 1,
  finalAbilities,
  proficientSkills,
  equipment,
  selectedBackgroundEquipmentOption: backgroundEquipmentOption || '',
  selectedEquipmentOption: selectedEquipmentOption || '',
  hitPoints,
  armorClass,
  initiative,
  speed: speedFeet,
  backgroundFeat,
  gold: gold > 0 ? gold : undefined,
  weaponProficiencies: classData?.weaponProficiencies || [],
  equipmentDetails,
  armorProficiencies: classData?.armorProficiencies || [],
  toolProficiencies: classData?.toolProficiencies || [],
  racialTraits: raceData?.traits || [],
  classFeatures: classData?.features || [],
  backgroundFeature: selectedBackgroundObj?.feature || '',
  savingThrows: classData?.savingThrows || [],
  languages: allLanguages,
  hitDice: {
    die: (selectedClass === 'Magicien' || selectedClass === 'Ensorceleur') ? 'd6'
       : (selectedClass === 'Barde' || selectedClass === 'Clerc' || selectedClass === 'Druide' || selectedClass === 'Moine' || selectedClass === 'Rôdeur' || selectedClass === 'Roublard' || selectedClass === 'Occultiste') ? 'd8'
       : (selectedClass === 'Guerrier' || selectedClass === 'Paladin') ? 'd10'
       : 'd12',
    total: 1,
    used: 0,
  },
  avatarImageUrl,
  selectedCantrips,
  selectedLevel1Spells,
  selectedAlignment: selectedAlignment || undefined,
  selectedLanguages: allLanguages,
  age: age.trim() || undefined,
  gender: gender.trim() || undefined,
  characterHistory: characterHistory.trim() || undefined,
  customRaceData: customRaceData || undefined,
  customClassData: customClassData || undefined,
};

     // ✅ Nettoyer le snapshot et marquer le contexte "game"
  appContextService.clearWizardSnapshot();
  appContextService.setContext('game');
  console.log('[Wizard] Snapshot nettoyé, contexte = game');

  onFinish(payload);
  
  // ✅ Désactiver le loading APRÈS l'appel à onFinish
  // (le parent gérera la suite)
  setLoadingEquipment(false);
  return;
}

      // FALLBACK AUTONOME
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = auth?.user;
      if (!user) {
        toast.error('Vous devez être connecté pour créer un personnage');
        return;
      }

      const featsData: any = {};
      if (backgroundFeat) {
        featsData.origins = [backgroundFeat];
        featsData.origin = backgroundFeat;
      }

      const initialGold = gold > 0 ? gold : 0;

      const characterData: any = {
        user_id: user.id,
        name: characterName.trim(),
        adventurer_name: characterName.trim(),
        level: 1,
        current_hp: hitPoints,
        max_hp: hitPoints,
        class: selectedClass || null,
        subclass: null,
        race: selectedRace || null,
        background: selectedBackground || null,
        alignment: selectedAlignment || null,
        languages: allLanguages,
        age: age.trim() || null,
        gender: gender.trim() || null,
        character_history: characterHistory.trim() || null,
        stats: {
          armor_class: armorClass,
          initiative: initiative,
          speed: feetToMeters(speedFeet),
          proficiency_bonus: 2,
          inspirations: 0,
          feats: featsData,
          coins: { gp: initialGold, sp: 0, cp: 0 },
          gold: initialGold,
creator_meta: {
  class_skills: selectedClassSkills,
  class_equipment_option: selectedEquipmentOption || null,
  class_equipment_items: classEquipment,
  background_skillProficiencies: backgroundSkills,
  background_equipment_option: backgroundEquipmentOption || null,
  background_equipment_items: bgEquip,
  weapon_proficiencies: classData?.weaponProficiencies || [],
  armor_proficiencies: classData?.armorProficiencies || [],
  tool_proficiencies: classData?.toolProficiencies || [],
  custom_race: customRaceData || null,
  custom_class: customClassData || null,
},
        },
        abilities: null,
        gold: initialGold,
        silver: 0,
        copper: 0,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error } = await supabase
        .from('players')
        .insert([characterData])
        .select('*')
        .single();

      if (error) {
        console.error('Error creating character:', error);
        toast.error('Erreur lors de la création du personnage');
        return;
      }

      // Save spells to Supabase
      if (inserted?.id && (selectedCantrips.length > 0 || selectedLevel1Spells.length > 0)) {
        try {
          const allSpells = [...selectedCantrips, ...selectedLevel1Spells];

          const spellsToInsert = allSpells.map(spell => ({
            id: spell.id,
            name: spell.name,
            level: spell.level,
            school: spell.school,
            casting_time: spell.casting_time,
            range: spell.range,
            components: spell.components,
            duration: spell.duration,
            description: spell.description,
            higher_levels: spell.higher_levels || null,
          }));

          await supabase.from('spells').upsert(spellsToInsert, {
            onConflict: 'id',
            ignoreDuplicates: true
          });

          const playerSpellsLinks = allSpells.map(spell => ({
            player_id: inserted.id,
            spell_id: spell.id,
            is_prepared: true,
          }));

          await supabase.from('player_spells').upsert(playerSpellsLinks, {
            onConflict: 'player_id,spell_id',
            ignoreDuplicates: true,
          });

          console.log(`Saved ${allSpells.length} spells for new character`);
        } catch (spellErr) {
          console.error('Error saving spells:', spellErr);
        }
      }

      // Upload avatar
      let finalPlayer = inserted;
      if (inserted?.id && avatarImageUrl) {
        try {
          const uploaded = await tryUploadAvatarFromUrl(inserted.id, avatarImageUrl);
          const finalUrl = uploaded ?? avatarImageUrl;

          const { data: updatedPlayer, error: avatarErr } = await supabase
            .from('players')
            .update({ avatar_url: finalUrl })
            .eq('id', inserted.id)
            .select('*')
            .single();

          if (!avatarErr && updatedPlayer) {
            finalPlayer = updatedPlayer;
          }
        } catch (e) {
          console.warn('Echec avatar:', e);
        }
      }

      if (inserted?.id) {
        notifyParentCreated(inserted.id, finalPlayer);
      }

      // ✅ Nettoyer le snapshot après création réussie
      appContextService.clearWizardSnapshot();
      appContextService.setContext('game');

      toast.success('Personnage créé avec succès !');

      if (typeof onCancel === 'function') {
        onCancel();
        return;
      }

      // Reset
      setCurrentStep(0);
      setCharacterName('');
      setSelectedRace('');
      setCustomRaceData(null); // ← NOUVEAU : réinitialiser la race personnalisée
      setSelectedClass('');
      setSelectedBackground('');
      setBackgroundEquipmentOption('');
      setSelectedClassSkills([]);
      setSelectedEquipmentOption('');
      setSelectedCantrips([]);
      setSelectedLevel1Spells([]);
      setSelectedAlignment('');
      setSelectedLanguages([]);
      setAge('');
      setGender('');
      setCharacterHistory('');
      setAbilities({
        'Force': 8,
        'Dextérité': 8,
        'Constitution': 8,
        'Intelligence': 8,
        'Sagesse': 8,
        'Charisme': 8,
      });
      setEffectiveAbilities({
        'Force': 8,
        'Dextérité': 8,
        'Constitution': 8,
        'Intelligence': 8,
        'Sagesse': 8,
        'Charisme': 8,
      });
    } catch (err) {
      console.error('Error creating character:', err);
      toast.error('Erreur lors de la création du personnage');
    }
  };

  // Rendu des étapes
const renderStep = () => {
  switch (currentStep) {
    case 0:
      return (
        <RaceSelection
          selectedRace={selectedRace}
          onRaceSelect={setSelectedRace}
          customRaceData={customRaceData}              // ← NOUVEAU
          onCustomRaceDataChange={setCustomRaceData}   // ← NOUVEAU
          onNext={nextStep}
        />
      );

      case 1:
        return (
          <ClassSelection
            selectedClass={selectedClass}
            onClassSelect={setSelectedClass}
            selectedSkills={selectedClassSkills}
            onSelectedSkillsChange={setSelectedClassSkills}
            selectedEquipmentOption={selectedEquipmentOption}
            onSelectedEquipmentOptionChange={setSelectedEquipmentOption}
            customClassData={customClassData}
            onCustomClassDataChange={setCustomClassData}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 2:
        return (
          <SpellSelection
            selectedClass={selectedClass}
            selectedCantrips={selectedCantrips}
            selectedLevel1Spells={selectedLevel1Spells}
            onCantripsChange={setSelectedCantrips}
            onLevel1SpellsChange={setSelectedLevel1Spells}
            onNext={nextStep}
            onPrevious={previousStep}
            customClassData={customClassData}
          />
        );

      case 3:
        return (
          <BackgroundSelection
            selectedBackground={selectedBackground}
            onBackgroundSelect={setSelectedBackground}
            selectedEquipmentOption={backgroundEquipmentOption}
            onEquipmentOptionChange={setBackgroundEquipmentOption}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 4:
        return (
          <ProfileSelection
            selectedLanguages={selectedLanguages}
            onLanguagesChange={setSelectedLanguages}
            selectedAlignment={selectedAlignment}
            onAlignmentChange={setSelectedAlignment}
            characterHistory={characterHistory}
            onCharacterHistoryChange={setCharacterHistory}
            age={age}
            onAgeChange={setAge}
            gender={gender}
            onGenderChange={setGender}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 5:
        return (
          <AbilityScores
            abilities={abilities}
            onAbilitiesChange={setAbilities}
            selectedBackground={selectedBackgroundObj}
            onEffectiveAbilitiesChange={setEffectiveAbilities}
            onNext={nextStep}
            onPrevious={previousStep}
          />
        );

      case 6:
        return (
          <CharacterSummary
            characterName={characterName}
            onCharacterNameChange={setCharacterName}
            selectedRace={selectedRace}
            selectedClass={selectedClass}
            selectedBackground={selectedBackground}
            abilities={effectiveAbilities}
            selectedClassSkills={selectedClassSkills}
            selectedBackgroundEquipmentOption={backgroundEquipmentOption}
            selectedEquipmentOption={selectedEquipmentOption}
            selectedCantrips={selectedCantrips}
            selectedLevel1Spells={selectedLevel1Spells}
            selectedAlignment={selectedAlignment}
            selectedLanguages={selectedLanguages}
            age={age}
            gender={gender}
            customClassData={customClassData}
            onFinish={handleFinish}
            onPrevious={previousStep}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-fantasy relative wizard-container">
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'bg-gray-800 text-white border border-gray-700',
          duration: 4000,
        }}
      />



      {loadingEquipment && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 text-center">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Chargement..." 
              className="animate-spin h-12 w-12 mx-auto mb-4 object-contain"
              style={{ backgroundColor: 'transparent' }}
            />
            <p className="text-gray-200">Préparation de l'équipement...</p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 pt-0 pb-8">
        <div className="max-w-6xl mx-auto">
          <ProgressBar
            currentStep={currentStep}
            totalSteps={steps.length - 1}
            steps={steps}
          />

          <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-6 md:p-8">
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}