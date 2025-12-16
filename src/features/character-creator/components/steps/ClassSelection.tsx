import React, { useState, useMemo } from 'react';
import { classes } from '../../data/classes';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { Sword, Heart, Shield, Zap, BookOpen, CheckSquare, Square, Package, Wrench } from 'lucide-react';
import { DndClass } from '../../types/character';
import { normalizeSkill } from '../../data/skills';
import { getClassImageUrl } from '../../utils/classImages';
import CardDetailModal from '../ui/CardDetailModal';

interface ClassSelectionProps {
  selectedClass: DndClass | '';
  onClassSelect: (dndClass: DndClass) => void;
  onNext: () => void;
  onPrevious: () => void;

  // Compétences sélectionnées
  selectedSkills?: string[];
  onSelectedSkillsChange?: (skills: string[]) => void;

  // Nouvelle prop pour l'équipement sélectionné
  selectedEquipmentOption?: string; // "A", "B", "C" ou ""
  onSelectedEquipmentOptionChange?: (option: string) => void;
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
}) => {
  const [modalCardIndex, setModalCardIndex] = useState<number | null>(null);

  const selectedClassData = useMemo(
    () => classes.find((c) => c.name === selectedClass),
    [selectedClass]
  );

  const handleCardClick = (index: number) => {
    const cls = classes[index];
    onClassSelect(cls.name);
    setModalCardIndex(index);
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
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {getClassIcon(cls.name)}
          <h3 className="text-2xl font-bold text-white">{cls.name}</h3>
        </div>

        <p className="text-gray-300 text-base">{cls.description}</p>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="flex items-center text-sm text-gray-400">
            <Heart className="w-5 h-5 mr-2 text-red-400" />
            <span>Dé de vie: d{cls.hitDie}</span>
          </div>
          <div className="flex items-center text-sm text-gray-400">
            <Zap className="w-5 h-5 mr-2 text-yellow-400" />
            <span>Capacité principale: {cls.primaryAbility.join(', ')}</span>
          </div>
          <div className="flex items-center text-sm text-gray-400">
            <Shield className="w-5 h-5 mr-2 text-blue-400" />
            <span>Jets de sauvegarde: {cls.savingThrows.join(', ')}</span>
          </div>
        </div>

        {imageSrc && (
          <div className="mb-4">
            <img
              src={imageSrc}
              alt={cls.name}
              className="block w-full h-auto rounded-md border border-gray-700/60"
              loading="lazy"
            />
          </div>
        )}

        <div className="mb-4">
          <h4 className="font-medium text-white mb-2 flex items-center">
            <Sword className="w-4 h-4 mr-1 text-red-400" />
            Maîtrises d'arme
          </h4>
          <div className="text-sm text-gray-300">
            {cls.weaponProficiencies.length > 0 ? (
              <ul className="space-y-1">
                {cls.weaponProficiencies.map((weapon: string, idx: number) => (
                  <li key={idx}>• {weapon}</li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-500">Aucune</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-white mb-2 flex items-center">
            <Shield className="w-4 h-4 mr-1 text-blue-400" />
            Formation aux armures
          </h4>
          <div className="text-sm text-gray-300">
            {cls.armorProficiencies.length > 0 ? (
              <ul className="space-y-1">
                {cls.armorProficiencies.map((armor: string, idx: number) => (
                  <li key={idx}>• {armor}</li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-500">Aucune</span>
            )}
          </div>
        </div>

        {cls.toolProficiencies && cls.toolProficiencies.length > 0 && (
          <div className="mb-4">
            <h4 className="font-medium text-white mb-2 flex items-center">
              <Wrench className="w-4 h-4 mr-1 text-yellow-400" />
              Maîtrises d'outils
            </h4>
            <div className="text-sm text-gray-300">
              <ul className="space-y-1">
                {cls.toolProficiencies.map((tool: string, idx: number) => (
                  <li key={idx}>• {tool}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {availableSkillsForClass.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-white">Compétences disponibles</h4>
              <span className="text-xs text-gray-400">
                {isSelected ? chosenCount : 0}/{limit} sélectionnées
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
                    className={`flex items-center justify-start gap-2 px-3 py-2 rounded-md border text-left ${
                      isChecked
                        ? 'border-red-500/60 bg-red-900/20 text-gray-100'
                        : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                    } ${disableCheck ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!disableCheck) toggleSkill(raw, limit);
                    }}
                    aria-disabled={disableCheck}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-red-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 shrink-0" />
                    )}
                    <span className="text-sm">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-white flex items-center">
              <Package className="w-4 h-4 mr-1 text-yellow-400" />
              Équipement de départ
            </h4>
            {isSelected && selectedEquipmentOption && (
              <span className="text-xs text-gray-400">
                Option {selectedEquipmentOption} sélectionnée
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {cls.equipmentOptions.map((option: any, idx: number) => {
              const canToggle = isSelected;
              const isChecked = isSelected && selectedEquipmentOption === option.label;

              return (
                <button
                  type="button"
                  key={`${option.label}-${idx}`}
                  className={`flex items-start justify-start gap-3 px-3 py-3 rounded-md border text-left ${
                    isChecked
                      ? 'border-yellow-500/60 bg-yellow-900/20 text-gray-100'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                  } ${!canToggle ? 'opacity-60 cursor-not-allowed' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canToggle) toggleEquipment(option.label);
                  }}
                  aria-disabled={!canToggle}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-sm mb-1">Option {option.label}</div>
                    <ul className="text-xs space-y-1">
                      {option.items.map((item: string, itemIdx: number) => (
                        <li key={itemIdx}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {Array.isArray(cls.features) && cls.features.length > 0 && (
          <div>
            <h4 className="font-medium text-white mb-2">Capacités de classe (niveau 1)</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              {cls.features.map((feat: string, index: number) => (
                <li key={index}>• {feat}</li>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls, index) => {
          const isSelected = selectedClass === cls.name;

          return (
            <Card
              key={cls.name}
              selected={isSelected}
              onClick={() => handleCardClick(index)}
              className="h-full"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{cls.name}</h3>
                  <div className="flex items-center gap-2">
                    {getClassIcon(cls.name)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm mb-3">{cls.description}</p>
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-gray-400">
                    <Heart className="w-4 h-4 mr-2 text-red-400" />
                    <span>Dé de vie: d{cls.hitDie}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                    <span>Capacité principale: {cls.primaryAbility.join(', ')}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <Shield className="w-4 h-4 mr-2 text-blue-400" />
                    <span>Jets de sauvegarde: {cls.savingThrows.join(', ')}</span>
                  </div>
                </div>
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
        cards={classes}
        currentIndex={modalCardIndex ?? 0}
        onNavigate={(direction) => {
          if (modalCardIndex === null) return;
          const newIndex = direction === 'prev' ? modalCardIndex - 1 : modalCardIndex + 1;
          if (newIndex >= 0 && newIndex < classes.length) {
            const newClass = classes[newIndex];
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
      />
    </div>
  );
};

export default ClassSelection;