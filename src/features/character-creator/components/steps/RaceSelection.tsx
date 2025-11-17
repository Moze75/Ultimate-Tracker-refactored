import React, { useState, useEffect } from 'react';
import { races } from '../../data/races';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { Users, Zap, Shield, Star, ChevronDown, Eye, Heart, Settings } from 'lucide-react';
import CustomRaceModal from '../CustomRaceModal';

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);

  // ✅ Combiner les races standards et la race personnalisée
  const allRaces = customRaceData 
    ? [...races, customRaceData] 
    : races;

  useEffect(() => {
    console.log('[RaceSelection] customRaceData mis à jour:', customRaceData);
    console.log('[RaceSelection] allRaces:', allRaces);
  }, [customRaceData]);
  
  // Conversion pieds -> mètres (les données sont en pieds)
  const feetToMeters = (ft?: number) => {
    if (!ft && ft !== 0) return '';
    return Math.round(ft * 0.3048 * 2) / 2;
  };

  const handleClick = (raceName: string) => {
    onRaceSelect(raceName);
    setExpanded((prev) => (prev === raceName ? null : raceName));
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
    if (raceName === 'Aasimar') {
      return <Star className="w-5 h-5 text-blue-300" />;
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

  // Image de race (public/Races/...) avec fallback de noms
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
        {allRaces.map((race) => {
          const isSelected = selectedRace === race.name;
          const isExpanded = expanded === race.name;

          return (
            <Card
              key={race.name}
              selected={isSelected}
              onClick={() => handleClick(race.name)}
              className="h-full"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">{race.name}</h3>
                  <div className="flex items-center gap-2">
                    {getRaceIcon(race.name)}
                    <ChevronDown
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-sm mb-3">{race.description}</p>
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

                {/* Image et détails supplémentaires uniquement quand la carte est dépliée */}
                {isExpanded && (
                  <div className="mt-4 border-t border-gray-700/50 pt-4 animate-fade-in">
                    {/* Image de la race (pleine largeur, non rognée) */}
                    <RaceImage raceName={race.name} />

                    {/* Détails étendus */}
                    <div className="grid grid-cols-1 gap-4 mt-4">
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
                              {race.traits.map((trait, index) => (
                                <li key={index} className="leading-relaxed">• {trait}</li>
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
                )}
              </CardContent>
            </Card>
          );
        })} 

        
        {/* ✅ Carte pour créer une race personnalisée */}
        <Card 
          className="h-full border-2 border-dashed border-purple-500/50 hover:border-purple-400/70 transition-colors cursor-pointer"
          onClick={() => setShowCustomModal(true)}
        >
          <CardHeader>
            <div className="flex items-center justify-center">
              <Settings className="w-6 h-6 text-purple-400 mr-2" />
              <h3 className="text-lg font-semibold text-purple-300">Espèce personnalisée</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-4">
                Créez votre propre espèce avec des traits uniques
              </p>
              <Button variant="secondary" size="sm" onClick={() => setShowCustomModal(true)}>
                <Settings className="w-4 h-4 mr-2" />
                Configurer
              </Button>
            </div>
          </CardContent>
        </Card>
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

      {/* ✅ Modal de configuration */}
      <CustomRaceModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleSaveCustomRace}
      />
    </div>
  );
}