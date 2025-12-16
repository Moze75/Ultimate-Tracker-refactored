import React, { useState, useEffect } from 'react';
import { races } from '../../data/races';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { Users, Zap, Shield, Star, ChevronDown, Eye, Heart, Settings } from 'lucide-react';
import CustomRaceModal from '../CustomRaceModal';
import CardDetailModal from '../ui/CardDetailModal';

interface RaceSelectionProps {
  selectedRace: string;
  onRaceSelect: (race: string) => void;
  onNext: () => void;
  // ✅ Pour stocker la race personnalisée
  customRaceData?: DndRace | null;
  onCustomRaceDataChange?: (race: DndRace | null) => void;
}

export default function RaceSelection({
  selectedRace,
  onRaceSelect,
  onNext,
  customRaceData,
  onCustomRaceDataChange
}: RaceSelectionProps) {
  const [modalCardIndex, setModalCardIndex] = useState<number | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const customRaceCard = {
    name: 'Espèce personnalisée',
    description: 'Créez votre propre espèce avec des traits uniques',
    speed: 0,
    size: '',
    traits: [],
    languages: [],
    isCustomPlaceholder: true,
  };

  const allRacesIncludingCustom = customRaceData
    ? [...races, customRaceData, customRaceCard]
    : [...races, customRaceCard];

  useEffect(() => {
    console.log('[RaceSelection] customRaceData mis à jour:', customRaceData);
    console.log('[RaceSelection] allRacesIncludingCustom:', allRacesIncludingCustom);
  }, [customRaceData, allRacesIncludingCustom]);
  
  // Conversion pieds -> mètres (les données sont en pieds)
  const feetToMeters = (ft?: number) => {
    if (!ft && ft !== 0) return '';
    return Math.round(ft * 0.3048 * 2) / 2;
  };

  const handleCardClick = (index: number) => {
    const race = allRacesIncludingCustom[index];

    if (race.isCustomPlaceholder) {
      setShowCustomModal(true);
    } else {
      setModalCardIndex(index);
      onRaceSelect(race.name);
    }
  };

  // ✅ Gérer la sauvegarde de la race personnalisée
  const handleSaveCustomRace = (race: DndRace) => {
    console.log('[RaceSelection] Race reçue:', race);
    
    // 1. Sauvegarder la race personnalisée
    if (onCustomRaceDataChange) {
      onCustomRaceDataChange(race);
    }
    
    // 2. Sélectionner la race
    onRaceSelect(race.name);
    console.log('[RaceSelection] Race sélectionnée:', race.name);
    
    // 3. Fermer le modal
    setShowCustomModal(false);
    
    // ✅ 4. Passer automatiquement au step suivant
    setTimeout(() => {
      onNext();
      console.log('[RaceSelection] Passage au step suivant');
    }, 100);
  };

  const getRaceIcon = (raceName: string) => {
    if (raceName === 'Elfe' || raceName === 'Demi-Elfe') {
      return <Star className="w-5 h-5 text-green-400" />;
    }
    if (raceName === 'Nain') {
      return <Shield className="w-5 h-5 text-orange-400" />;
    }
    if (raceName === 'Halfelin') {
      return <Heart className="w-5 h-5 text-yellow-400" />;
    }
    if (raceName === 'Drakéide') {
      return <Zap className="w-5 h-5 text-red-400" />;
    }
    if (raceName === 'Gnome') {
      return <Star className="w-5 h-5 text-purple-400" />;
    }
    if (raceName.includes('Orc')) {
      return <Shield className="w-5 h-5 text-red-500" />;
    }
    if (raceName === 'Tieffelin') {
      return <Zap className="w-5 h-5 text-purple-500" />;

    } 
    if (raceName === 'Goliath') {
      return <Shield className="w-5 h-5 text-gray-400" />;
    }
    if (raceName === 'Humain') {
      return <Users className="w-5 h-5 text-blue-400" />;
    }
    return <Users className="w-5 h-5 text-gray-400" />;
  };

  const hasVisionInDark = (traits: string[]) => {
    return traits.some(trait => trait.includes('Vision dans le noir'));
  };

  const renderRaceCardContent = (race: any, index: number) => {
    if (race.isCustomPlaceholder) {
      return (
        <div className="text-center py-8">
          <Settings className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-purple-300 mb-4">Espèce personnalisée</h3>
          <p className="text-gray-400 text-sm mb-6">
            Créez votre propre espèce avec des traits uniques
          </p>
          <Button variant="secondary" size="sm" onClick={() => setShowCustomModal(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configurer
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {getRaceIcon(race.name)}
          <h3 className="text-2xl font-bold text-white">{race.name}</h3>
        </div>

        <p className="text-gray-300 text-base">{race.description}</p>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="flex items-center text-sm text-gray-400">
            <Zap className="w-5 h-5 mr-2 text-yellow-400" />
            <span>Vitesse: {feetToMeters(race.speed)} m</span>
          </div>
          <div className="flex items-center text-sm text-gray-400">
            <Shield className="w-5 h-5 mr-2 text-blue-400" />
            <span>Taille: {race.size}</span>
          </div>
          {hasVisionInDark(race.traits) && (
            <div className="flex items-center text-sm text-gray-400">
              <Eye className="w-5 h-5 mr-2 text-purple-400" />
              <span>Vision dans le noir</span>
            </div>
          )}
        </div>

        <RaceImage raceName={race.name} />

        <div className="space-y-4 mt-6">
          <div>
            <h4 className="font-medium text-white mb-2">Langues</h4>
            <p className="text-gray-300 text-sm">
              {race.languages && race.languages.length > 0 ? race.languages.join(', ') : '—'}
            </p>
          </div>

          {race.proficiencies && race.proficiencies.length > 0 && (
            <div>
              <h4 className="font-medium text-white mb-2">Compétences</h4>
              <p className="text-gray-300 text-sm">
                {race.proficiencies.join(', ')}
              </p>
            </div>
          )}

          {race.traits && race.traits.length > 0 && (
            <div>
              <h4 className="font-medium text-white mb-2">Traits raciaux</h4>
              <div>
                <ul className="text-gray-300 text-sm space-y-1">
                  {race.traits.map((trait: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">• {trait}</li>
                  ))}
                </ul>
              </div>

              {(race.name === 'Elfe' || race.name === 'Gnome' || race.name === 'Tieffelin') && (
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600/30">
                  <h5 className="text-xs font-medium text-gray-300 mb-2">Variantes disponibles :</h5>
                  <p className="text-xs text-gray-400">
                    {race.name === 'Elfe' && 'Haut-Elfe, Elfe Sylvestre, Drow'}
                    {race.name === 'Gnome' && 'Gnome des Forêts, Gnome des Roches'}
                    {race.name === 'Tieffelin' && 'Héritage Infernal, Abyssal, Chtonien'}
                  </p>
                  <p className="text-xs text-gray-500 italic mt-1">
                    Le choix de variante se fera dans l'interface du personnage
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  function RaceImage({ raceName }: { raceName: string }) {
    // ✅ Mapping explicite pour les races avec images spécifiques
    const RACE_IMAGE_MAPPING: Record<string, string> = {
      'Haut-Elfe': 'Haut-elfe.png',
      'Elfe sylvestre': 'Elfe-Sylvestre.png',
      'Drow': 'Drow.png',
    };

    const base = '/Races/';
    
    // ✅ Vérifier d'abord le mapping
    const mappedImage = RACE_IMAGE_MAPPING[raceName];
    if (mappedImage) {
      return (
        <img
          src={base + mappedImage}
          alt={raceName}
          className="w-full h-auto object-contain rounded-md shadow-sm"
          loading="lazy"
        />
      );
    }

    // Sinon, utiliser la logique de fallback comme avant
    const toASCII = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slug = (s: string) =>
      toASCII(s)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const ascii = toASCII(raceName);
    const noSpaces = ascii.replace(/\s+/g, '');

    const candidates = [
      `${raceName}.png`,
      `${raceName}.jpg`,
      `${ascii}.png`,
      `${ascii}.jpg`,
      `${slug(raceName)}.png`,
      `${slug(raceName)}.jpg`,
      `${slug(raceName)}.webp`,
      `${noSpaces}.png`,
      `${noSpaces}.jpg`,
      `${noSpaces}.webp`,
    ];

    const [idx, setIdx] = useState(0);
    if (idx >= candidates.length) return null;

    const src = base + candidates[idx];
    return (
      <img
        src={src}
        alt={raceName}
        className="w-full h-auto object-contain rounded-md shadow-sm"
        loading="lazy"
        onError={() => setIdx((i) => i + 1)}
      />
    );
  }

  return (
    <div className="wizard-step space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choisissez votre espèce</h2>
        <p className="text-gray-400">Votre race détermine vos capacités innées et votre héritage</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allRacesIncludingCustom.map((race, index) => {
          const isSelected = selectedRace === race.name;
          const isCustomCard = race.isCustomPlaceholder;

          return (
            <Card
              key={`${race.name}-${index}`}
              selected={isSelected && !isCustomCard}
              onClick={() => handleCardClick(index)}
              className={`h-full ${isCustomCard ? 'border-2 border-dashed border-purple-500/50 hover:border-purple-400/70' : ''}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${isCustomCard ? 'text-purple-300' : 'text-white'}`}>
                    {race.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isCustomCard ? (
                      <Settings className="w-5 h-5 text-purple-400" />
                    ) : (
                      getRaceIcon(race.name)
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm mb-3">{race.description}</p>
                {isCustomCard ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <Settings className="w-10 h-10 text-purple-400 mb-3" />
                    <span className="text-purple-300 text-sm font-medium">Cliquez pour configurer</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-400">
                      <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                      <span>Vitesse: {feetToMeters(race.speed)} m</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-400">
                      <Shield className="w-4 h-4 mr-2 text-blue-400" />
                      <span>Taille: {race.size}</span>
                    </div>
                    {hasVisionInDark(race.traits) && (
                      <div className="flex items-center text-sm text-gray-400">
                        <Eye className="w-4 h-4 mr-2 text-purple-400" />
                        <span>Vision dans le noir</span>
                      </div>
                    )}
                    {race.languages && race.languages.length > 0 && (
                      <div className="flex items-center text-sm text-gray-400">
                        <Star className="w-4 h-4 mr-2 text-green-400" />
                        <span>
                          Langues: {race.languages.slice(0, 2).join(', ')}
                          {race.languages.length > 2 ? '...' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-6">
        <Button
          onClick={onNext}
          disabled={!selectedRace}
          size="lg"
          className="min-w-[200px]"
        >
          Continuer
        </Button>
      </div>

      <CardDetailModal
        isOpen={modalCardIndex !== null}
        onClose={() => setModalCardIndex(null)}
        cards={allRacesIncludingCustom}
        currentIndex={modalCardIndex ?? 0}
        onNavigate={(direction) => {
          if (modalCardIndex === null) return;
          const newIndex = direction === 'prev' ? modalCardIndex - 1 : modalCardIndex + 1;
          if (newIndex >= 0 && newIndex < allRacesIncludingCustom.length) {
            const newRace = allRacesIncludingCustom[newIndex];
            if (!newRace.isCustomPlaceholder) {
              onRaceSelect(newRace.name);
            }
            setModalCardIndex(newIndex);
          }
        }}
        renderCardContent={renderRaceCardContent}
      />

      <CustomRaceModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleSaveCustomRace}
      />
    </div>
  );
}