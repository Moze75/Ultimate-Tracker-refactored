import React, { useState } from 'react';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { BookOpen, Star, Wrench, Zap, CheckCircle2, Circle, Scroll } from 'lucide-react';
import CardDetailModal from '../ui/CardDetailModal';

interface BackgroundSelectionProps {
  selectedBackground: string;
  onBackgroundSelect: (background: string) => void;
  selectedEquipmentOption?: 'A' | 'B' | '';
  onEquipmentOptionChange?: (opt: 'A' | 'B' | '') => void;
  onNext: () => void;
  onPrevious: () => void;
}

const backgroundsData = [
  {
    name: "Acolyte",
    description: "Vous etiez au service d'un temple, accomplissant des rites religieux en l'honneur d'une divinite ou d'un pantheon.",
    abilityScores: ["Intelligence", "Sagesse", "Charisme"],
    feat: "Initie a la magie",
    skillProficiencies: ["Intuition", "Religion"],
    toolProficiencies: ["Materiel de calligraphie"],
    equipmentOptions: {
      optionA: [
        "Materiel de calligraphie",
        "Livre de prieres",
        "Symbole sacre",
        "Parchemin (10 feuilles)",
        "Robe",
        "8 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Artisan",
    description: "Vous avez appris a creer des objets artisanaux de base et a amadouer les clients difficiles.",
    abilityScores: ["Force", "Dexterite", "Intelligence"],
    feat: "Faconneur",
    skillProficiencies: ["Investigation", "Persuasion"],
    toolProficiencies: ["Outils d'artisan (au choix)"],
    equipmentOptions: {
      optionA: [
        "Outils d'artisan",
        "2 sacoches",
        "Tenue de voyage",
        "32 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Artiste",
    description: "Vous avez passe votre jeunesse avec des musiciens et acrobates, apprenant l'art de la scene.",
    abilityScores: ["Force", "Dexterite", "Charisme"],
    feat: "Musicien",
    skillProficiencies: ["Acrobaties", "Representation"],
    toolProficiencies: ["Instrument de musique (au choix)"],
    equipmentOptions: {
      optionA: [
        "Instrument de musique",
        "2 costumes",
        "Miroir",
        "Parfum",
        "Tenue de voyage",
        "11 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Charlatan",
    description: "Vous avez appris l'art de vendre du reve aux malheureux en quete d'un bobard reconfortant.",
    abilityScores: ["Dexterite", "Constitution", "Charisme"],
    feat: "Doue",
    skillProficiencies: ["Escamotage", "Tromperie"],
    toolProficiencies: ["Materiel de contrefacon"],
    equipmentOptions: {
      optionA: [
        "Materiel de contrefacon",
        "Beaux habits",
        "Costume",
        "15 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Criminel",
    description: "Vous gagniez votre pain dans les ruelles sombres, en coupant des bourses ou en cambriolant des echoppes.",
    abilityScores: ["Dexterite", "Constitution", "Intelligence"],
    feat: "Doue",
    skillProficiencies: ["Discretion", "Escamotage"],
    toolProficiencies: ["Outils de voleur"],
    equipmentOptions: {
      optionA: [
        "2 dagues",
        "Outils de voleur",
        "2 sacoches",
        "Pied-de-biche",
        "Tenue de voyage",
        "16 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Ermite",
    description: "Vous avez passe vos jeunes annees isole, reflechissant aux mysteres de la creation.",
    abilityScores: ["Constitution", "Sagesse", "Charisme"],
    feat: "Guerisseur",
    skillProficiencies: ["Medecine", "Religion"],
    toolProficiencies: ["Materiel d'herboriste"],
    equipmentOptions: {
      optionA: [
        "Baton de combat",
        "Materiel d'herboriste",
        "Huile (3 flasques)",
        "Lampe",
        "Livre (philosophie)",
        "Sac de couchage",
        "Tenue de voyage",
        "16 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Fermier",
    description: "Vous avez grandi pres de la terre, gagnant en patience et en robustesse au contact de la nature.",
    abilityScores: ["Force", "Constitution", "Sagesse"],
    feat: "Robuste",
    skillProficiencies: ["Dressage", "Nature"],
    toolProficiencies: ["Outils de charpentier"],
    equipmentOptions: {
      optionA: [
        "Serpe",
        "Outils de charpentier",
        "Trousse de soins",
        "Pelle",
        "Pot en fer",
        "Tenue de voyage",
        "30 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Garde",
    description: "Vous avez monte la garde, apprenant a surveiller les maraudeurs et les fauteurs de troubles.",
    abilityScores: ["Force", "Intelligence", "Sagesse"],
    feat: "Vigilant",
    skillProficiencies: ["Athletisme", "Perception"],
    toolProficiencies: ["Boite de jeux (au choix)"],
    equipmentOptions: {
      optionA: [
        "Arbalete legere + 20 carreaux",
        "Carquois",
        "Lance",
        "Boite de jeux",
        "Lanterne a capote",
        "Menottes",
        "Tenue de voyage",
        "12 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Guide",
    description: "Vous avez grandi en pleine nature sauvage, apprenant a explorer et canaliser la magie naturelle.",
    abilityScores: ["Dexterite", "Constitution", "Sagesse"],
    feat: "Initie a la magie",
    skillProficiencies: ["Discretion", "Survie"],
    toolProficiencies: ["Outils de cartographe"],
    equipmentOptions: {
      optionA: [
        "Arc court + 20 fleches",
        "Carquois",
        "Outils de cartographe",
        "Sac de couchage",
        "Tente",
        "Tenue de voyage",
        "3 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Marchand",
    description: "Apprenti aupres d'un negociant, vous avez appris les bases du commerce et du transport de marchandises.",
    abilityScores: ["Constitution", "Intelligence", "Charisme"],
    feat: "Chanceux",
    skillProficiencies: ["Dressage", "Persuasion"],
    toolProficiencies: ["Instruments de navigateur"],
    equipmentOptions: {
      optionA: [
        "Instruments de navigateur",
        "2 sacoches",
        "Tenue de voyage",
        "22 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Marin",
    description: "Vous avez vecu l'existence du grand large, echangeant recits avec le peuple de la mer.",
    abilityScores: ["Force", "Dexterite", "Sagesse"],
    feat: "Bagarreur de tavernes",
    skillProficiencies: ["Acrobaties", "Perception"],
    toolProficiencies: ["Instruments de navigateur"],
    equipmentOptions: {
      optionA: [
        "Dague",
        "Instruments de navigateur",
        "Corde",
        "Tenue de voyage",
        "20 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Noble",
    description: "Vous avez passe votre enfance dans un chateau, apprenant l'autorite au milieu de l'opulence.",
    abilityScores: ["Force", "Intelligence", "Charisme"],
    feat: "Doue",
    skillProficiencies: ["Histoire", "Persuasion"],
    toolProficiencies: ["Boite de jeux (au choix)"],
    equipmentOptions: {
      optionA: [
        "Boite de jeux",
        "Beaux habits",
        "Parfum",
        "29 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Sage",
    description: "Vos annees ont ete consacrees a l'etude, engrangeant le savoir du multivers et des rudiments de magie.",
    abilityScores: ["Constitution", "Intelligence", "Sagesse"],
    feat: "Initie a la magie",
    skillProficiencies: ["Arcanes", "Histoire"],
    toolProficiencies: ["Materiel de calligraphie"],
    equipmentOptions: {
      optionA: [
        "Baton de combat",
        "Materiel de calligraphie",
        "Livre (d'histoire)",
        "Parchemin (8 feuilles)",
        "Robe",
        "8 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Scribe",
    description: "Forme dans un scriptorium, vous avez appris a ecrire lisiblement et a produire des textes impeccables.",
    abilityScores: ["Dexterite", "Intelligence", "Sagesse"],
    feat: "Doue",
    skillProficiencies: ["Investigation", "Perception"],
    toolProficiencies: ["Materiel de calligraphie"],
    equipmentOptions: {
      optionA: [
        "Materiel de calligraphie",
        "Beaux habits",
        "Lampe",
        "Huile (3 flasques)",
        "Parchemin (12 feuilles)",
        "23 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Soldat",
    description: "Forme aux rudiments de la guerre, vous avez la bataille dans le sang et l'entrainement par reflexe.",
    abilityScores: ["Force", "Dexterite", "Constitution"],
    feat: "Sauvagerie martiale",
    skillProficiencies: ["Athletisme", "Intimidation"],
    toolProficiencies: ["Boite de jeux (au choix)"],
    equipmentOptions: {
      optionA: [
        "Arc court + 20 fleches",
        "Carquois",
        "Lance",
        "Boite de jeux",
        "Trousse de soins",
        "Tenue de voyage",
        "14 po"
      ],
      optionB: ["50 po"]
    }
  },
  {
    name: "Voyageur",
    description: "Vous avez grandi dans la rue parmi les marginaux, gardant votre fierte et votre espoir malgre les epreuves.",
    abilityScores: ["Dexterite", "Sagesse", "Charisme"],
    feat: "Chanceux",
    skillProficiencies: ["Discretion", "Intuition"],
    toolProficiencies: ["Outils de voleur"],
    equipmentOptions: {
      optionA: [
        "2 dagues",
        "Outils de voleur",
        "Boite de jeux (tout type)",
        "Sac de couchage",
        "2 sacoches",
        "Tenue de voyage",
        "16 po"
      ],
      optionB: ["50 po"]
    }
  }
];

export default function BackgroundSelection({
  selectedBackground,
  onBackgroundSelect,
  selectedEquipmentOption = '',
  onEquipmentOptionChange = () => {},
  onNext,
  onPrevious
}: BackgroundSelectionProps) {
  const [modalCardIndex, setModalCardIndex] = useState<number | null>(null);

  const handleCardClick = (index: number) => {
    const bg = backgroundsData[index];
    if (selectedBackground !== bg.name) {
      onEquipmentOptionChange('');
    }
    onBackgroundSelect(bg.name);
    setModalCardIndex(index);
  };

  const renderBackgroundCardContent = (bg: typeof backgroundsData[0], index: number) => {
    const isSelected = selectedBackground === bg.name;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <h3 className="text-2xl font-bold text-white">{bg.name}</h3>
        </div>

        <p className="text-gray-300 text-base">{bg.description}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div className="flex items-center text-sm text-gray-400">
            <Scroll className="w-5 h-5 mr-2 text-purple-400" />
            <span>Don: {bg.feat}</span>
          </div>
          <div className="flex items-center text-sm text-gray-400">
            <Star className="w-5 h-5 mr-2 text-yellow-400" />
            <span>Competences: {bg.skillProficiencies?.join(', ') || '-'}</span>
          </div>
          <div className="flex items-center text-sm text-gray-400">
            <Wrench className="w-5 h-5 mr-2 text-green-400" />
            <span>Outils: {bg.toolProficiencies?.join(', ') || '-'}</span>
          </div>
          {bg.abilityScores && (
            <div className="flex items-center text-sm text-gray-400">
              <Zap className="w-5 h-5 mr-2 text-red-400" />
              <span>Caracteristiques: {bg.abilityScores.join(', ')}</span>
            </div>
          )}
        </div>

        {bg.equipmentOptions && (
          <div className="space-y-3">
            <h4 className="font-medium text-white">Equipement de depart</h4>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                className={`text-left rounded-md border p-3 transition-colors ${
                  isSelected && selectedEquipmentOption === 'A'
                    ? 'border-red-500/70 bg-red-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                } ${!isSelected ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelected) onEquipmentOptionChange('A');
                }}
                disabled={!isSelected}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isSelected && selectedEquipmentOption === 'A' ? (
                    <CheckCircle2 className="w-4 h-4 text-red-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-200">Option A</span>
                </div>
                <ul className="text-gray-300 text-sm space-y-1">
                  {bg.equipmentOptions.optionA.map((item, i) => (
                    <li key={`A-${i}`}>- {item}</li>
                  ))}
                </ul>
              </button>

              <button
                type="button"
                className={`text-left rounded-md border p-3 transition-colors ${
                  isSelected && selectedEquipmentOption === 'B'
                    ? 'border-red-500/70 bg-red-900/20'
                    : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                } ${!isSelected ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelected) onEquipmentOptionChange('B');
                }}
                disabled={!isSelected}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isSelected && selectedEquipmentOption === 'B' ? (
                    <CheckCircle2 className="w-4 h-4 text-red-400" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-200">Option B</span>
                </div>
                <ul className="text-gray-300 text-sm space-y-1">
                  {bg.equipmentOptions.optionB.map((item, i) => (
                    <li key={`B-${i}`}>- {item}</li>
                  ))}
                </ul>
              </button>
            </div>
            {isSelected && !selectedEquipmentOption && (
              <div className="text-xs text-amber-400">
                Choisissez une option pour continuer.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wizard-step space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choisissez votre historique</h2>
        <p className="text-gray-400">Votre historique determine vos competences et votre equipement de depart</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {backgroundsData.map((bg, index) => {
          const isSelected = selectedBackground === bg.name;

          return (
            <Card
              key={bg.name}
              selected={isSelected}
              onClick={() => handleCardClick(index)}
              className="h-full"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{bg.name}</h3>
                  <BookOpen className="w-5 h-5 text-blue-400" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm mb-3">{bg.description}</p>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center">
                    <Scroll className="w-4 h-4 mr-2 text-purple-400" />
                    <span>Don: {bg.feat}</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="w-4 h-4 mr-2 text-yellow-400" />
                    <span>Competences: {bg.skillProficiencies?.join(', ') || '-'}</span>
                  </div>
                  <div className="flex items-center">
                    <Wrench className="w-4 h-4 mr-2 text-green-400" />
                    <span>Outils: {bg.toolProficiencies?.join(', ') || '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between pt-6">
        <Button onClick={onPrevious} variant="secondary" size="lg">
          Precedent
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedBackground || !selectedEquipmentOption}
          size="lg"
          className="min-w-[200px]"
        >
          Continuer
        </Button>
      </div>

      <CardDetailModal
        isOpen={modalCardIndex !== null}
        onClose={() => setModalCardIndex(null)}
        cards={backgroundsData}
        currentIndex={modalCardIndex ?? 0}
        onNavigate={(direction) => {
          if (modalCardIndex === null) return;
          const newIndex = direction === 'prev' ? modalCardIndex - 1 : modalCardIndex + 1;
          if (newIndex >= 0 && newIndex < backgroundsData.length) {
            const newBg = backgroundsData[newIndex];
            if (selectedBackground !== newBg.name) {
              onEquipmentOptionChange('');
            }
            onBackgroundSelect(newBg.name);
            setModalCardIndex(newIndex);
          }
        }}
        renderCardContent={renderBackgroundCardContent}
        onConfirm={() => {
          setModalCardIndex(null);
          onNext();
        }}
        confirmLabel="Valider et continuer"
        confirmDisabled={!selectedBackground || !selectedEquipmentOption}
      />
    </div>
  );
}
