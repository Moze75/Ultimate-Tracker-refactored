import React, { useState, useMemo } from 'react';
import { classes } from '../../data/classes';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { Sword, Heart, Shield, Zap, BookOpen, CheckSquare, Square, Package, Wrench, Star, Sparkles, Settings } from 'lucide-react';
import { DndClass, CustomClassData } from '../../types/character';
import { normalizeSkill } from '../../data/skills';
import { getClassImageUrl } from '../../utils/classImages';
import CardDetailModal from '../ui/CardDetailModal';
import CustomClassModal from '../CustomClassModal';

interface ClassSelectionProps {
  selectedClass: DndClass | string | '';
  onClassSelect: (dndClass: DndClass | string) => void;
  onNext: () => void;
  onPrevious: () => void;

  selectedSkills?: string[];
  onSelectedSkillsChange?: (skills: string[]) => void;

  selectedEquipmentOption?: string;
  onSelectedEquipmentOptionChange?: (option: string) => void;

  customClassData?: CustomClassData | null;
  onCustomClassDataChange?: (classData: CustomClassData | null) => void;
}

const ClassSelection: React.FC<ClassSelectionProps> = ({
  selectedClass,
  onClassSelect,
  onNext,
  onPrevious,
  selectedSkills = [],
  onSelectedSkillsChange = () => {},
  selectedEquipmentOption = '',
  onSelectedEquipmentOptionChange = () => {},
  customClassData,
  onCustomClassDataChange,
}) => {
  const [modalCardIndex, setModalCardIndex] = useState<number | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const customClassCard = {
    name: 'Classe personnalisée',
    description: 'Créez votre propre classe avec des capacités uniques',
    hitDie: 8,
    primaryAbility: [],
    savingThrows: [],
    isCustomPlaceholder: true,
  };

  const allClassesIncludingCustom = useMemo(() => {
    const list: any[] = [...classes];
    if (customClassData) {
      list.push(customClassData);
    }
    list.push(customClassCard);
    return list;
  }, [customClassData]);

  const selectedClassData = useMemo(
    () => {
      if (customClassData && selectedClass === customClassData.name) {
        return customClassData;
      }
      return classes.find((c) => c.name === selectedClass);
    },
    [selectedClass, customClassData]
  );

  const handleCardClick = (index: number) => {
    const cls = allClassesIncludingCustom[index];

    if (cls.isCustomPlaceholder) {
      setShowCustomModal(true);
      return;
    }

    onClassSelect(cls.name);
    setModalCardIndex(index);
  };

  const handleSaveCustomClass = (classData: CustomClassData) => {
    if (onCustomClassDataChange) {
      onCustomClassDataChange(classData);
    }
    onClassSelect(classData.name);
    setShowCustomModal(false);
    setTimeout(() => {
      onNext();
    }, 100);
  };

  const getClassIcon = (className: DndClass) => {
    const iconMap: Record<DndClass, React.ReactNode> = {
      'Guerrier': <Sword className="w-5 h-5 text-red-400" />,
      'Magicien': <BookOpen className="w-5 h-5 text-blue-400" />,
      'Roublard': <Zap className="w-5 h-5 text-purple-400" />,
      'Clerc': <Shield className="w-5 h-5 text-yellow-400" />,
      'Rôdeur': <Sword className="w-5 h-5 text-green-400" />,
      'Barbare': <Heart className="w-5 h-5 text-red-500" />,
      'Barde': <BookOpen className="w-5 h-5 text-pink-400" />,
      'Druide': <Shield className="w-5 h-5 text-green-500" />,
      'Moine': <Zap className="w-5 h-5 text-orange-400" />,
      'Paladin': <Shield className="w-5 h-5 text-blue-500" />,
      'Ensorceleur': <Zap className="w-5 h-5 text-purple-500" />,
      'Occultiste': <BookOpen className="w-5 h-5 text-purple-600" />
    };
    return iconMap[className] || <Sword className="w-5 h-5 text-gray-400" />;
  };

  const toggleSkill = (rawSkill: string, limit: number) => {
    const skill = normalizeSkill(rawSkill);
    const set = new Set(selectedSkills);
    const already = set.has(skill);

    if (already) {
      set.delete(skill);
      onSelectedSkillsChange(Array.from(set));
      return;
    }

    // Ne pas dépasser la limite
    if ((selectedSkills?.length || 0) >= limit) return;

    set.add(skill);
    onSelectedSkillsChange(Array.from(set));
  };

  // ✅ EXACTEMENT la même logique que pour les compétences
  const toggleEquipment = (equipmentOption: string) => {
    if (!selectedClass) return;
    
    // Si déjà sélectionné, on désélectionne
    if (selectedEquipmentOption === equipmentOption) {
      onSelectedEquipmentOptionChange('');
    } else {
      // Sinon on sélectionne cette option (on remplace l'ancienne)
      onSelectedEquipmentOptionChange(equipmentOption);
    }
  };

  const getAvailableSkillsForClass = (cls: any) => {
    if (cls.name === 'Barde' && (!cls.availableSkills || cls.availableSkills.length === 0)) {
      return [
        'Acrobaties', 'Athlétisme', 'Arcanes', 'Histoire', 'Intuition', 'Investigation',
        'Médecine', 'Nature', 'Perception', 'Représentation', 'Persuasion', 'Tromperie',
        'Intimidation', 'Escamotage', 'Discrétion', 'Survie', 'Dressage', 'Religion'
      ];
    }
    return cls.availableSkills || [];
  };

  const renderClassCardContent = (cls: any) => {
    const imageSrc = getClassImageUrl(cls.name);
    const limit = cls.skillsToChoose ?? 0;
    const chosenCount = selectedClass === cls.name ? (selectedSkills?.length || 0) : 0;
    const availableSkillsForClass = getAvailableSkillsForClass(cls);
    const isSelected = selectedClass === cls.name;

    return (
      <div className="space-y-5">
        <p className="text-gray-300 text-base leading-relaxed">{cls.description}</p>

        {imageSrc && (
          <div>
            <img
              src={imageSrc}
              alt={cls.name}
              className="block w-full h-auto rounded-lg border border-gray-700/50"
              loading="lazy"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Heart className="w-5 h-5 mb-1 text-red-400" />
            <span className="text-xs text-gray-400">De de vie</span>
            <span className="text-sm font-medium text-white">d{cls.hitDie}</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Zap className="w-5 h-5 mb-1 text-yellow-400" />
            <span className="text-xs text-gray-400 text-center">Capacite</span>
            <span className="text-sm font-medium text-white text-center">{cls.primaryAbility.join(', ')}</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Shield className="w-5 h-5 mb-1 text-blue-400" />
            <span className="text-xs text-gray-400">Sauvegardes</span>
            <span className="text-sm font-medium text-white text-center">{cls.savingThrows.join(', ')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <h4 className="font-medium text-white mb-2 flex items-center text-sm">
              <Sword className="w-4 h-4 mr-2 text-red-400" />
              Armes
            </h4>
            <div className="text-sm text-gray-300">
              {cls.weaponProficiencies.length > 0 ? (
                <ul className="space-y-1">
                  {cls.weaponProficiencies.map((weapon: string, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-gray-500 mr-2">•</span>
                      <span>{weapon}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500">Aucune</span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <h4 className="font-medium text-white mb-2 flex items-center text-sm">
              <Shield className="w-4 h-4 mr-2 text-blue-400" />
              Armures
            </h4>
            <div className="text-sm text-gray-300">
              {cls.armorProficiencies.length > 0 ? (
                <ul className="space-y-1">
                  {cls.armorProficiencies.map((armor: string, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-gray-500 mr-2">•</span>
                      <span>{armor}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500">Aucune</span>
              )}
            </div>
          </div>
        </div>

        {cls.toolProficiencies && cls.toolProficiencies.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <h4 className="font-medium text-white mb-2 flex items-center text-sm">
              <Wrench className="w-4 h-4 mr-2 text-yellow-400" />
              Outils
            </h4>
            <div className="text-sm text-gray-300">
              <ul className="space-y-1">
                {cls.toolProficiencies.map((tool: string, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span>{tool}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {availableSkillsForClass.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white flex items-center text-sm">
                <Star className="w-4 h-4 mr-2 text-green-400" />
                Competences
              </h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                {isSelected ? chosenCount : 0}/{limit}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableSkillsForClass.map((raw: string, idx: number) => {
                const label = normalizeSkill(raw);
                const canToggle = isSelected;
                const isChecked = isSelected && selectedSkills?.includes(label);
                const disableCheck =
                  !canToggle ||
                  (!isChecked && (selectedSkills?.length || 0) >= limit);

                return (
                  <button
                    type="button"
                    key={`${raw}-${idx}`}
                    className={`flex items-center justify-start gap-2 px-3 py-2 rounded-md border text-left transition-colors ${
                      isChecked
                        ? 'border-green-500/60 bg-green-900/20 text-gray-100'
                        : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'
                    } ${disableCheck ? 'opacity-50 cursor-not-allowed' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disableCheck) toggleSkill(raw, limit);
                    }}
                    aria-disabled={disableCheck}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-500 shrink-0" />
                    )}
                    <span className="text-sm">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-white flex items-center text-sm">
              <Package className="w-4 h-4 mr-2 text-yellow-400" />
              Equipement de depart
            </h4>
            {isSelected && selectedEquipmentOption && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-300">
                Option {selectedEquipmentOption}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {cls.equipmentOptions.map((option: any, idx: number) => {
              const canToggle = isSelected;
              const isChecked = isSelected && selectedEquipmentOption === option.label;

              return (
                <button
                  type="button"
                  key={`${option.label}-${idx}`}
                  className={`w-full flex items-start justify-start gap-3 px-3 py-2.5 rounded-md border text-left transition-colors ${
                    isChecked
                      ? 'border-yellow-500/60 bg-yellow-900/20 text-gray-100'
                      : 'border-gray-600/50 bg-gray-900/30 text-gray-300 hover:bg-gray-800/50'
                  } ${!canToggle ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canToggle) toggleEquipment(option.label);
                  }}
                  aria-disabled={!canToggle}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">Option {option.label}</div>
                    <ul className="text-xs text-gray-400 space-y-0.5">
                      {option.items.map((item: string, itemIdx: number) => (
                        <li key={itemIdx} className="flex items-start">
                          <span className="text-gray-500 mr-1.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {Array.isArray(cls.features) && cls.features.length > 0 && (
          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <h4 className="font-medium text-white mb-2 flex items-center text-sm">
              <Sparkles className="w-4 h-4 mr-2 text-purple-400" />
              Capacites de classe (niveau 1)
            </h4>
            <ul className="text-gray-300 text-sm space-y-1.5">
              {cls.features.map((feat: string, index: number) => (
                <li key={index} className="flex items-start">
                  <span className="text-gray-500 mr-2">•</span>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wizard-step space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choisissez votre classe</h2>
        <p className="text-gray-400">Votre classe détermine vos capacités et votre rôle dans l'aventure</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
        {allClassesIncludingCustom.map((cls, index) => {
          const isSelected = selectedClass === cls.name;
          const isCustomCard = cls.isCustomPlaceholder;
          const isCustomClass = cls.isCustom === true;

          return (
            <Card
              key={`${cls.name}-${index}`}
              selected={isSelected && !isCustomCard}
              onClick={() => handleCardClick(index)}
              className={`h-full min-h-[200px] ${isCustomCard ? 'border-2 border-dashed border-amber-500/50 hover:border-amber-400/70' : ''}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${isCustomCard ? 'text-amber-300' : isCustomClass ? 'text-amber-200' : 'text-white'}`}>
                    {cls.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isCustomCard || isCustomClass ? (
                      <Settings className="w-5 h-5 text-amber-400" />
                    ) : (
                      getClassIcon(cls.name)
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isCustomCard ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <Settings className="w-10 h-10 text-amber-400 mb-3" />
                    <span className="text-amber-300 text-sm font-medium">Cliquez pour configurer</span>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-300 text-sm mb-3">{cls.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-gray-400">
                        <Heart className="w-4 h-4 mr-2 text-red-400" />
                        <span>Dé de vie: d{cls.hitDie}</span>
                      </div>
                      {cls.primaryAbility && cls.primaryAbility.length > 0 && (
                        <div className="flex items-center text-sm text-gray-400">
                          <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                          <span>Capacité principale: {cls.primaryAbility.join(', ')}</span>
                        </div>
                      )}
                      {cls.savingThrows && cls.savingThrows.length > 0 && (
                        <div className="flex items-center text-sm text-gray-400">
                          <Shield className="w-4 h-4 mr-2 text-blue-400" />
                          <span>Jets de sauvegarde: {cls.savingThrows.join(', ')}</span>
                        </div>
                      )}
                      {isCustomClass && (
                        <div className="flex items-center text-sm text-amber-400/80 mt-2">
                          <Settings className="w-4 h-4 mr-2" />
                          <span>Classe personnalisée</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-6">
        <Button
          onClick={onPrevious}
          variant="secondary"
          size="lg"
        >
          Précédent
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedClass}
          size="lg"
          className="min-w-[200px]"
        >
          Continuer
        </Button>
      </div>

      <CardDetailModal
        isOpen={modalCardIndex !== null}
        onClose={() => setModalCardIndex(null)}
        cards={allClassesIncludingCustom.filter(c => !c.isCustomPlaceholder)}
        currentIndex={modalCardIndex ?? 0}
        onNavigate={(direction) => {
          if (modalCardIndex === null) return;
          const filteredClasses = allClassesIncludingCustom.filter(c => !c.isCustomPlaceholder);
          const newIndex = direction === 'prev' ? modalCardIndex - 1 : modalCardIndex + 1;
          if (newIndex >= 0 && newIndex < filteredClasses.length) {
            const newClass = filteredClasses[newIndex];
            onClassSelect(newClass.name);
            setModalCardIndex(newIndex);
          }
        }}
        renderCardContent={renderClassCardContent}
        onConfirm={() => {
          setModalCardIndex(null);
          onNext();
        }}
        confirmLabel="Valider et continuer"
        confirmDisabled={!selectedClass}
        titleExtractor={(cls) => cls.name}
      />

      <CustomClassModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleSaveCustomClass}
      />
    </div>
  );
};

export default ClassSelection;