import { Edit2, Trash2 } from 'lucide-react';
import { deleteUserCustomRace } from '../../../../services/customTemplatesService';
import React, { useState, useEffect, useMemo } from 'react';
import { races } from '../../data/races';
import Card, { CardContent, CardHeader } from '../ui/Card';
import Button from '../ui/Button';
import { Users, Zap, Shield, Star, ChevronDown, Eye, Heart, Settings, MessageSquare, Sparkles } from 'lucide-react';
import CustomRaceModal from '../CustomRaceModal';
import CardDetailModal from '../ui/CardDetailModal';
import { ASSETS } from '../../../../config/assets';

interface RaceSelectionProps {
  selectedRace: string;
  onRaceSelect: (race: string) => void;
  onNext: () => void;
  // ✅ Pour stocker la race personnalisée
  customRaceData?: DndRace | null;
  onCustomRaceDataChange?: (race: DndRace | null) => void;
}

import { getUserCustomRaces, saveUserCustomRace } from '../../../../services/customTemplatesService';
import { DndRace } from '../../types/character';

export default function RaceSelection({
  selectedRace,
  onRaceSelect,
  onNext,
  customRaceData,
  onCustomRaceDataChange
}: RaceSelectionProps) {
  const [modalCardIndex, setModalCardIndex] = useState<number | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [savedCustomRaces, setSavedCustomRaces] = useState<DndRace[]>([]);
  const [loadingRaces, setLoadingRaces] = useState(true);

    // ✅ État pour l'édition d'une race existante
  const [editingRace, setEditingRace] = useState<DndRace | null>(null);

  // ✅ Fonction pour éditer une race personnalisée
  const handleEditCustomRace = (race: DndRace) => {
    setEditingRace(race);
    setShowCustomModal(true);
  };

  // ✅ Fonction pour supprimer une race personnalisée
  const handleDeleteCustomRace = async (raceName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la race "${raceName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const result = await deleteUserCustomRace(raceName);
      if (result.success) {
        // Retirer de la liste locale
        setSavedCustomRaces((prev) => prev.filter((r) => r.name !== raceName));
        
        // Si c'était la race sélectionnée, désélectionner
        if (selectedRace === raceName) {
          onRaceSelect('');
          if (onCustomRaceDataChange) {
            onCustomRaceDataChange(null);
          }
        }
        
        console.log('[RaceSelection] Race supprimée:', raceName);
      } else {
        alert('Erreur lors de la suppression de la race');
      }
    } catch (error) {
      console.error('[RaceSelection] Erreur suppression:', error);
      alert('Erreur lors de la suppression de la race');
    }
  };

  // ✅ Charger les races personnalisées sauvegardées au montage
  useEffect(() => {
    async function loadSavedRaces() {
      setLoadingRaces(true);
      try {
        const races = await getUserCustomRaces();
        setSavedCustomRaces(races);
      } catch (error) {
        console.error('Erreur chargement races sauvegardées:', error);
      } finally {
        setLoadingRaces(false);
      }
    }
    loadSavedRaces();
  }, []);

  const customRaceCard = {
    name: 'Espèce personnalisée',
    description: 'Créez votre propre espèce avec des traits uniques',
    speed: 0,
    size: '',
    traits: [],
    languages: [],
    isCustomPlaceholder: true,
  };

  // ✅ Combiner les races par défaut, les races sauvegardées et la race en cours de création
  const allRacesIncludingCustom = useMemo(() => {
    const customRacesFromDb = savedCustomRaces.filter(
      (r) => !races.some((base) => base.name === r.name)
    );
    const currentCustom = customRaceData && !customRacesFromDb.some((r) => r.name === customRaceData.name)
      ? [customRaceData]
      : [];
    return [...races, ...customRacesFromDb, ...currentCustom, customRaceCard];
  }, [savedCustomRaces, customRaceData]);

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
  const handleSaveCustomRace = async (race: DndRace) => {
    console.log('[RaceSelection] Race reçue:', race);
    
    // 1. Sauvegarder la race personnalisée dans l'état local
    if (onCustomRaceDataChange) {
      onCustomRaceDataChange(race);
    }
    
    // ✅ 2. Sauvegarder dans Supabase pour réutilisation future
    try {
      const result = await saveUserCustomRace(race);
      if (result.success) {
        // Ajouter à la liste locale si pas déjà présente
        setSavedCustomRaces((prev) => {
          const exists = prev.some((r) => r.name === race.name);
          if (exists) {
            return prev.map((r) => (r.name === race.name ? race : r));
          }
          return [...prev, race];
        });
        console.log('[RaceSelection] Race sauvegardée dans Supabase');
      } else {
        console.warn('[RaceSelection] Échec sauvegarde Supabase:', result.error);
      }
    } catch (error) {
      console.error('[RaceSelection] Erreur sauvegarde:', error);
    }
    
    // 3. Sélectionner la race
    onRaceSelect(race.name);
    console.log('[RaceSelection] Race sélectionnée:', race.name);
    
    // 4. Fermer le modal
    setShowCustomModal(false);
    
    // ✅ 5. Passer automatiquement au step suivant
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
      <div className="space-y-5">
        <p className="text-gray-300 text-base leading-relaxed">{race.description}</p>

        <RaceImage raceName={race.name} />

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Zap className="w-5 h-5 mb-1 text-yellow-400" />
            <span className="text-xs text-gray-400">Vitesse</span>
            <span className="text-sm font-medium text-white">{feetToMeters(race.speed)} m</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Shield className="w-5 h-5 mb-1 text-blue-400" />
            <span className="text-xs text-gray-400">Taille</span>
            <span className="text-sm font-medium text-white">{race.size}</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <Eye className="w-5 h-5 mb-1 text-purple-400" />
            <span className="text-xs text-gray-400">Vision</span>
            <span className="text-sm font-medium text-white">{hasVisionInDark(race.traits) ? 'Nyctalopie' : 'Normale'}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
            <h4 className="font-medium text-white mb-2 flex items-center text-sm">
              <MessageSquare className="w-4 h-4 mr-2 text-green-400" />
              Langues
            </h4>
            <p className="text-gray-300 text-sm">
              {race.languages && race.languages.length > 0 ? race.languages.join(', ') : '—'}
            </p>
          </div>

          {race.proficiencies && race.proficiencies.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <h4 className="font-medium text-white mb-2 flex items-center text-sm">
                <Star className="w-4 h-4 mr-2 text-yellow-400" />
                Maitrises
              </h4>
              <p className="text-gray-300 text-sm">
                {race.proficiencies.join(', ')}
              </p>
            </div>
          )}

          {race.traits && race.traits.length > 0 && (
            <div className="p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              <h4 className="font-medium text-white mb-2 flex items-center text-sm">
                <Sparkles className="w-4 h-4 mr-2 text-red-400" />
                Traits raciaux
              </h4>
              <ul className="text-gray-300 text-sm space-y-1.5">
                {race.traits.map((trait: string, idx: number) => (
                  <li key={idx} className="leading-relaxed flex items-start">
                    <span className="text-gray-500 mr-2">•</span>
                    <span>{trait}</span>
                  </li>
                ))}
              </ul>

              {(race.name === 'Elfe' || race.name === 'Gnome' || race.name === 'Tieffelin') && (
                <div className="mt-3 p-2.5 bg-gray-900/50 rounded-md border border-gray-600/30">
                  <h5 className="text-xs font-medium text-gray-300 mb-1">Variantes disponibles</h5>
                  <p className="text-xs text-gray-400">
                    {race.name === 'Elfe' && 'Haut-Elfe, Elfe Sylvestre, Drow'}
                    {race.name === 'Gnome' && 'Gnome des Forets, Gnome des Roches'}
                    {race.name === 'Tieffelin' && 'Heritage Infernal, Abyssal, Chtonien'}
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

  function RaceImage({ raceName }:  { raceName: string }) {
    // ✅ Utiliser l'URL depuis assets.ts (Cloudflare R2 - dossier static)
    const base = ASSETS.RACE_IMAGES_BASE;
    
    // ✅ Mapping explicite pour les races avec images spécifiques
    const RACE_IMAGE_MAPPING: Record<string, string> = {
      'Haut-Elfe': 'Haut-elfe.png',
      'Elfe sylvestre': 'Elfe-Sylvestre.png',
      'Drow': 'Drow.png',
    };
    
    // ✅ Vérifier d'abord le mapping
    const mappedImage = RACE_IMAGE_MAPPING[raceName];
    if (mappedImage) {
      return (
        <img
          src={`${base}/${mappedImage}`}
          alt={raceName}
          className="w-full h-auto object-contain rounded-md shadow-sm"
          loading="lazy"
        />
      );
    }

    // Sinon, utiliser la logique de fallback comme avant
    const toASCII = (s:  string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

    const src = `${base}/${candidates[idx]}`;
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
  {allRacesIncludingCustom.map((race, index) => {
  const isSelected = selectedRace === race.name;
  const isCustomCard = race.isCustomPlaceholder;
  const isCustomRace = race.isCustom === true; // ✅ Race personnalisée sauvegardée

  return (
    <Card
      key={`${race.name}-${index}`}
      selected={isSelected && !isCustomCard}
      onClick={() => handleCardClick(index)}
      className={`h-full min-h-[200px] ${isCustomCard ? 'border-2 border-dashed border-purple-500/50 hover:border-purple-400/70' : ''} ${isCustomRace ? 'border-purple-500/30' : ''}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${isCustomCard ? 'text-purple-300' : isCustomRace ? 'text-purple-200' : 'text-white'}`}>
            {race.name}
          </h3>
          <div className="flex items-center gap-2">
            {/* ✅ Boutons Modifier/Supprimer pour les races personnalisées */}
            {isCustomRace && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCustomRace(race);
                  }}
                  className="p-1 rounded hover:bg-purple-500/20 transition-colors"
                  title="Modifier cette race"
                >
                  <Edit2 className="w-4 h-4 text-purple-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustomRace(race.name);
                  }}
                  className="p-1 rounded hover:bg-red-500/20 transition-colors"
                  title="Supprimer cette race"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </>
            )}
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
        onConfirm={() => {
          setModalCardIndex(null);
          onNext();
        }}
        confirmLabel="Valider et continuer"
        confirmDisabled={!selectedRace}
        titleExtractor={(race) => race.isCustomPlaceholder ? 'Espèce personnalisée' : race.name}
      />

      <CustomRaceModal
        open={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleSaveCustomRace}
      />
    </div>
  );
}