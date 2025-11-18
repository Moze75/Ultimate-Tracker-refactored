import React, { useState, useMemo, useEffect } from 'react';
import Button from '../ui/Button';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Input from '../ui/Input';
import { calculateHitPoints, calculateArmorClass, calculateModifier } from '../../utils/dndCalculations';
import { races } from '../../data/races';
import { classes } from '../../data/classes';
import { backgrounds } from '../../data/backgrounds';
import { DndClass } from '../../types/character';
import { User, Heart, Shield, Zap, Users, BookOpen, Package, Scroll, Star, AlertCircle, X, Sword, Wrench, Sparkles, Globe, Calendar, UserCircle } from 'lucide-react';

interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  casting_time: string;
  range: string;
  components: {
    V: boolean;
    S: boolean;
    M: string | null;
  };
  duration: string;
  description: string;
  higher_levels?: string;
  classes: string[];
}

interface CharacterSummaryProps {
  characterName: string;
  onCharacterNameChange: (name: string) => void;
  selectedRace: string;
  selectedClass: DndClass;
  selectedBackground: string;
  abilities: Record<string, number>;
  onFinish: () => void;
  onPrevious: () => void;

  // Compétences choisies dans ClassSelection
  selectedClassSkills?: string[];

  // Équipement choisi dans ClassSelection
  selectedEquipmentOption?: string;

  // Équipement d'historique
  selectedBackgroundEquipmentOption?: 'A' | 'B' | '';

  // Sorts sélectionnés
  selectedCantrips?: Spell[];
  selectedLevel1Spells?: Spell[];

  // ✅ Nouveaux props de profil
  selectedAlignment?: string;
  selectedLanguages?: string[];
  age?: string;
  gender?: string;
}

// Liste canonique des compétences (FR)
const ALL_SKILLS = [
  'Acrobaties',
  'Athlétisme',
  'Arcanes',
  'Histoire',
  'Intuition',
  'Investigation',
  'Médecine',
  'Nature',
  'Perception',
  'Représentation',
  'Persuasion',
  'Tromperie',
  'Intimidation',
  'Escamotage',
  'Discrétion',
  'Survie',
  'Dressage',
  'Religion',
] as const;

type SkillName = typeof ALL_SKILLS[number];

// Synonymes -> Canonique pour le calcul
const SKILL_SYNONYMS: Record<string, SkillName> = {
  'Furtivité': 'Discrétion',
  'Perspicacité': 'Intuition',
  'Performance': 'Représentation',
};

function normalizeSkill(name: string): SkillName | string {
  const direct = ALL_SKILLS.find((s) => s.toLowerCase() === name.toLowerCase());
  if (direct) return direct;
  const synKey = Object.keys(SKILL_SYNONYMS).find((k) => k.toLowerCase() === name.toLowerCase());
  if (synKey) return SKILL_SYNONYMS[synKey];
  return name; // si inconnu, on le laisse tel quel
}

// Map compétence -> caractéristique
const SKILL_ABILITY_MAP: Record<SkillName, keyof Record<string, number>> = {
  'Acrobaties': 'Dextérité',
  'Athlétisme': 'Force',
  'Arcanes': 'Intelligence',
  'Histoire': 'Intelligence',
  'Intuition': 'Sagesse',
  'Investigation': 'Intelligence',
  'Médecine': 'Sagesse',
  'Nature': 'Intelligence',
  'Perception': 'Sagesse',
  'Représentation': 'Charisme',
  'Persuasion': 'Charisme',
  'Tromperie': 'Charisme',
  'Intimidation': 'Charisme',
  'Escamotage': 'Dextérité',
  'Discrétion': 'Dextérité',
  'Survie': 'Sagesse',
  'Dressage': 'Sagesse',
  'Religion': 'Intelligence',
};

// Convertit ft -> m en arrondissant au 0,5 m (30 ft → 9 m)
const feetToMeters = (ft?: number) => {
  const n = Number(ft);
  if (!Number.isFinite(n)) return 9; // fallback raisonnable
  return Math.round(n * 0.3048 * 2) / 2;
};

export default function CharacterSummary({
  characterName,
  onCharacterNameChange,
  selectedRace,
  selectedClass,
  selectedBackground,
  abilities,
  onFinish,
  onPrevious,
  selectedClassSkills = [],
  selectedEquipmentOption = '',
  selectedBackgroundEquipmentOption = '',
  selectedCantrips = [],
  selectedLevel1Spells = [],
  selectedAlignment = '',
  selectedLanguages = [],
  age = '',
  gender = '',
}: CharacterSummaryProps) {
  const [nameError, setNameError] = useState('');
  const [showToast, setShowToast] = useState(false);
    const [isCreating, setIsCreating] = useState(false); // ✅ NOUVEAU 

  // Auto-masquer le toast après 4 secondes
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const raceData = races.find(r => r.name === selectedRace);
  const classData = classes.find(c => c.name === selectedClass);
  const backgroundData = backgrounds.find(b => b.name === selectedBackground);

  // Caracs finales = base + bonus historique déjà appliqués en amont
  // On ajoute ici les bonus raciaux
  const finalAbilities = useMemo(() => {
    const fa = { ...abilities };
    if (raceData?.abilityScoreIncrease) {
      Object.entries(raceData.abilityScoreIncrease).forEach(([ability, bonus]) => {
        if (fa[ability] != null) fa[ability] += bonus;
      });
    }
    return fa;
  }, [abilities, raceData]);

  const hitPoints = calculateHitPoints(finalAbilities['Constitution'] || 10, selectedClass);
  const armorClass = calculateArmorClass(finalAbilities['Dextérité'] || 10);
  const initiative = calculateModifier(finalAbilities['Dextérité'] || 10);

  // Maîtrises: union des compétences de classe sélectionnées + de l'historique
  const backgroundSkills = useMemo<string[]>(() => {
    const arr = backgroundData?.skillProficiencies ?? [];
    return Array.from(new Set(arr.map((s) => String(normalizeSkill(s)))));
  }, [backgroundData]);

  const proficientSet = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    selectedClassSkills.forEach((s) => set.add(String(normalizeSkill(s))));
    backgroundSkills.forEach((s) => set.add(String(normalizeSkill(s))));
    return set;
  }, [selectedClassSkills, backgroundSkills]);

  const proficiencyBonus = 2; // niveau 1

  // Équipement de classe sélectionné
  const selectedClassEquipment = useMemo(() => {
    if (!classData || !selectedEquipmentOption) return [];
    const option = classData.equipmentOptions.find(opt => opt.label === selectedEquipmentOption);
    return option ? option.items : [];
  }, [classData, selectedEquipmentOption]);

  // Équipement historique
  const bgEquip =
    selectedBackgroundEquipmentOption === 'A'
      ? backgroundData?.equipmentOptions?.optionA ?? []
      : selectedBackgroundEquipmentOption === 'B'
        ? backgroundData?.equipmentOptions?.optionB ?? []
        : [];

  const handleFinish = async () => {
  // ✅ Protection contre double-clic
  if (isCreating) {
    console.warn('[CharacterSummary] Création déjà en cours, clic ignoré');
    return;
  }

  if (!characterName.trim()) {
    setNameError('Le nom du personnage est requis');
    setShowToast(true);
    
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
    return;
  }

  setNameError('');
  setShowToast(false);
  setIsCreating(true); // ✅ Bloquer immédiatement
  
  try {
    await onFinish(); // ✅ Attendre la fin complète
  } catch (error) {
    console.error('[CharacterSummary] Erreur lors de la création:', error);
    setIsCreating(false); // ✅ Réactiver en cas d'erreur
  }
  // Note: Ne pas setIsCreating(false) en cas de succès car le composant sera démonté
};

  // Calcul du bonus de compétence
  const getSkillBonus = (skillLabel: SkillName): number => {
    const abilityKey = SKILL_ABILITY_MAP[skillLabel] || 'Dextérité';
    const score = finalAbilities[abilityKey] ?? 10;
    const mod = Math.floor((score - 10) / 2);
    const proficient = proficientSet.has(skillLabel);
    return mod + (proficient ? proficiencyBonus : 0);
  };

  // ✅ Combiner les langues raciales et sélectionnées
  const allLanguages = useMemo(() => {
    const racialLanguages = raceData?.languages || [];
    return Array.from(new Set([...racialLanguages, ...selectedLanguages]));
  }, [raceData, selectedLanguages]);

  return (
    <div className="wizard-step space-y-6 relative">
      {/* Toast d'erreur en bas à droite */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
          <div className="bg-red-900/90 border border-red-500/50 rounded-lg p-4 shadow-lg backdrop-blur-sm flex items-center gap-3 min-w-[300px]">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-red-100 text-sm">Le nom du personnage est requis</span>
            <button
              onClick={() => setShowToast(false)}
              className="text-red-300 hover:text-red-100 ml-auto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Résumé de votre personnage</h2>
        <p className="text-gray-400">Vérifiez les détails avant de créer votre personnage</p>
      </div>

      <div className="max-w-md mx-auto">
        <Input
          label="Nom du personnage"
          value={characterName}
          onChange={(e) => onCharacterNameChange(e.target.value)}
          error={nameError}
          placeholder="Entrez le nom de votre personnage"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <User className="w-5 h-5 text-blue-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Informations de base</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Race:</span>
              <span className="text-white font-medium">{selectedRace}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Classe:</span>
              <span className="text-white font-medium">{selectedClass}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Historique:</span>
              <span className="text-white font-medium">{selectedBackground}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Niveau:</span>
              <span className="text-white font-medium">1</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Heart className="w-5 h-5 text-red-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Statistiques de combat</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Points de vie:</span>
              <span className="text-white font-medium">{hitPoints}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Classe d'armure:</span>
              <span className="text-white font-medium">{armorClass}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Initiative:</span>
              <span className="text-white font-medium">
                {initiative >= 0 ? '+' : ''}{initiative}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Vitesse:</span>
              <span className="text-white font-medium">{feetToMeters(raceData?.speed || 30)} m</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ NOUVELLE SECTION: Profil du personnage */}
      {(age || gender || selectedAlignment || allLanguages.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <UserCircle className="w-5 h-5 text-cyan-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Profil</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {age && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Âge:</span>
                </div>
                <span className="text-white font-medium">{age}</span>
              </div>
            )}
            {gender && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Genre:</span>
                </div>
                <span className="text-white font-medium">{gender}</span>
              </div>
            )}
            {selectedAlignment && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Alignement:</span>
                </div>
                <span className="text-white font-medium">{selectedAlignment}</span>
              </div>
            )}
            {allLanguages.length > 0 && (
              <div className="border-t border-gray-700/50 pt-3 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-gray-400 text-sm">Langues maîtrisées:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allLanguages.map((lang, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-200 rounded border border-cyan-500/30"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Zap className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Caractéristiques</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(finalAbilities || {}).map(([ability, score]) => (
              <div key={ability} className="text-center">
                <div className="ability-score">
                  <div className="font-medium text-white text-sm">{ability}</div>
                  <div className="text-2xl font-bold text-white">{score}</div>
                  <div className="text-sm text-gray-400">
                    {calculateModifier(score) >= 0 ? '+' : ''}{calculateModifier(score)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

{/* Compétences et Jets de sauvegarde dans le même pavé */}
<Card>
  <CardHeader>
    <div className="flex items-center">
      <Star className="w-5 h-5 text-yellow-400 mr-2" />
      <h3 className="text-lg font-semibold text-white">Compétences et Jets de sauvegarde</h3>
    </div>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Jets de sauvegarde maîtrisés */}
    {classData?.savingThrows && classData.savingThrows.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-green-400" />
          <h4 className="text-sm font-medium text-gray-200">Jets de sauvegarde maîtrisés</h4>
          <span className="text-xs text-gray-400">(Bonus de maîtrise: +{proficiencyBonus})</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 mb-4 pb-4 border-b border-gray-700/50">
          {classData.savingThrows.map((save) => {
            const abilityScore = finalAbilities[save] ?? 10;
            const modifier = calculateModifier(abilityScore);
            const totalBonus = modifier + proficiencyBonus;
            const sign = totalBonus >= 0 ? '+' : '';
            
            return (
              <div key={save} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {save} <span className="text-xs text-green-400">[M]</span>
                </span>
                <span className="text-white font-medium">{sign}{totalBonus}</span>
              </div>
            );
          })}
        </div>
      </div>
    )}

    {/* Compétences maîtrisées */}
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-yellow-400" />
        <h4 className="text-sm font-medium text-gray-200">Compétences maîtrisées</h4>
        <span className="text-xs text-gray-400">(Classe + historique)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
        {ALL_SKILLS.map((skill) => {
          const bonus = getSkillBonus(skill);
          const proficient = proficientSet.has(skill);
          const sign = bonus >= 0 ? '+' : '';
          return (
            <div key={skill} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {skill} {proficient && <span className="text-xs text-red-400">[M]</span>}
              </span>
              <span className="text-white font-medium">{sign}{bonus}</span>
            </div>
          );
        })}
      </div>
    </div>
  </CardContent>
</Card>
      
      {/* Synthèse des compétences */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Star className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Compétences</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-gray-400 mb-3">
            Bonus de maîtrise: +{proficiencyBonus} | Maîtrises: classe + historique
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
            {ALL_SKILLS.map((skill) => {
              const bonus = getSkillBonus(skill);
              const proficient = proficientSet.has(skill);
              const sign = bonus >= 0 ? '+' : '';
              return (
                <div key={skill} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">
                    {skill} {proficient && <span className="text-xs text-red-400">[M]</span>}
                  </span>
                  <span className="text-white font-medium">{sign}{bonus}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

{/* ✅ NOUVELLE SECTION : Jets de sauvegarde maîtrisés */}
{classData?.savingThrows && classData.savingThrows.length > 0 && (
  <Card>
    <CardHeader>
      <div className="flex items-center">
        <Shield className="w-5 h-5 text-green-400 mr-2" />
        <h3 className="text-lg font-semibold text-white">Jets de sauvegarde maîtrisés</h3>
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-xs text-gray-400 mb-3">
        Bonus de maîtrise: +{proficiencyBonus}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4">
        {classData.savingThrows.map((save) => {
          const abilityScore = finalAbilities[save] ?? 10;
          const modifier = calculateModifier(abilityScore);
          const totalBonus = modifier + proficiencyBonus;
          const sign = totalBonus >= 0 ? '+' : '';
          
          return (
            <div key={save} className="flex items-center justify-between text-sm">
              <span className="text-gray-300">
                {save} <span className="text-xs text-green-400">[M]</span>
              </span>
              <span className="text-white font-medium">{sign}{totalBonus}</span>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
)}
      
      {/* Sorts sélectionnés */}
      {(selectedCantrips.length > 0 || selectedLevel1Spells.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {selectedCantrips.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <Sparkles className="w-5 h-5 text-blue-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Sorts mineurs</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-400 mb-3">
                  {selectedCantrips.length} tour{selectedCantrips.length > 1 ? 's' : ''} de magie sélectionné{selectedCantrips.length > 1 ? 's' : ''}
                </div>
                <div className="space-y-2">
                  {selectedCantrips.map((spell) => (
                    <div key={spell.id} className="bg-gray-800/30 rounded-lg p-3 border border-blue-500/20">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-blue-100 text-sm">{spell.name}</h4>
                        <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                          Tour
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {spell.school} • {spell.casting_time} • {spell.range}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedLevel1Spells.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <BookOpen className="w-5 h-5 text-purple-400 mr-2" />
                  <h3 className="text-lg font-semibold text-white">Sorts de niveau 1</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-400 mb-3">
                  {selectedLevel1Spells.length} sort{selectedLevel1Spells.length > 1 ? 's' : ''} sélectionné{selectedLevel1Spells.length > 1 ? 's' : ''}
                </div>
                <div className="space-y-2">
                  {selectedLevel1Spells.map((spell) => (
                    <div key={spell.id} className="bg-gray-800/30 rounded-lg p-3 border border-purple-500/20">
                      <div className="flex items-start justify-between mb-1">
                        <h4 className="font-medium text-purple-100 text-sm">{spell.name}</h4>
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                          Niv. 1
                        </span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {spell.school} • {spell.casting_time} • {spell.range}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Maîtrises d'armes et d'armures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Maîtrises d'armes */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Sword className="w-5 h-5 text-red-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Maîtrises d'armes</h3>
            </div>
          </CardHeader>
          <CardContent>
            {classData?.weaponProficiencies && classData.weaponProficiencies.length > 0 ? (
              <ul className="text-gray-300 text-sm space-y-1">
                {classData.weaponProficiencies.map((weapon, index) => (
                  <li key={index}>• {weapon}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">Aucune maîtrise d'arme</div>
            )}
          </CardContent>
        </Card>

        {/* Formation aux armures */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Shield className="w-5 h-5 text-blue-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Formation aux armures</h3>
            </div>
          </CardHeader>
          <CardContent>
            {classData?.armorProficiencies && classData.armorProficiencies.length > 0 ? (
              <ul className="text-gray-300 text-sm space-y-1">
                {classData.armorProficiencies.map((armor, index) => (
                  <li key={index}>• {armor}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">Aucune formation aux armures</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maîtrises d'outils (si applicable) */}
      {classData?.toolProficiencies && classData.toolProficiencies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Wrench className="w-5 h-5 text-yellow-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Maîtrises d'outils</h3>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-gray-300 text-sm space-y-1">
              {classData.toolProficiencies.map((tool, index) => (
                <li key={index}>• {tool}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Section Don d'historique */}
      {backgroundData?.feat && (
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Scroll className="w-5 h-5 text-purple-400 mr-2" />
              <h3 className="text-lg font-semibold text-white">Don d'historique</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Don acquis:</span>
              <span className="text-white font-medium">{backgroundData.feat}</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Accordé par l'historique {selectedBackground} - Voir chapitre 5 pour les détails
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Traits raciaux + espèce */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Users className="w-5 h-5 text-purple-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Traits</h3>
              </div>
              <div className="text-xs text-gray-400">
                Espèce: <span className="text-gray-200">{selectedRace}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-gray-300 text-sm space-y-1">
              {raceData?.traits?.map((trait, index) => (
                <li key={index}>• {trait}</li>
              )) || <li className="text-gray-500">Aucun trait disponible</li>}
            </ul>
          </CardContent>
        </Card>

        {/* Capacités de classe + classe choisie */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <BookOpen className="w-5 h-5 text-green-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Capacités de classe</h3>
              </div>
              <div className="text-xs text-gray-400">
                Classe: <span className="text-gray-200">{selectedClass}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-gray-300 text-sm space-y-1">
              {classData?.features?.map((feature, index) => (
                <li key={index}>• {feature}</li>
              )) || <li className="text-gray-500">Aucune capacité de classe disponible</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Équipement de départ (classe + historique) */}
      <Card>
        <CardHeader>
          <div className="flex items-center">
            <Package className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Équipement de départ</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-white mb-2">
                De classe {selectedEquipmentOption ? `(Option ${selectedEquipmentOption})` : ''}
              </h4>
              <ul className="text-gray-300 text-sm space-y-1">
                {selectedClassEquipment.length > 0
                  ? selectedClassEquipment.map((item, i) => (
                      <li key={`class-eq-${i}`}>• {item}</li>
                    ))
                  : <li className="text-gray-500">Aucune option sélectionnée</li>}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">
                D'historique {selectedBackgroundEquipmentOption ? `(Option ${selectedBackgroundEquipmentOption})` : ''}
              </h4>
              <ul className="text-gray-300 text-sm space-y-1">
                {bgEquip.length > 0
                  ? bgEquip.map((item, i) => <li key={`bg-eq-${i}`}>• {item}</li>)
                  : <li className="text-gray-500">Aucune option sélectionnée</li>}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-6">
        <Button
          onClick={onPrevious}
          variant="secondary"
          size="lg"
        >
          Précédent
        </Button>
 <Button
  onClick={handleFinish}
  size="lg"
  className="min-w-[200px]"
  disabled={isCreating} // ✅ Désactiver pendant création
>
  {isCreating ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
      </svg>
      Création en cours...
    </span>
  ) : (
    'Créer le personnage'
  )}
</Button>
      </div>
    </div>
  );
}