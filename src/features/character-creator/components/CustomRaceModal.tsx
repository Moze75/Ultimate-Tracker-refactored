import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Card, { CardContent, CardHeader } from './ui/Card';
import { X, Plus, Trash2, Users } from 'lucide-react';
import { DndRace } from '../types/character';

interface CustomRaceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (race: DndRace) => void;
  initialData?: DndRace | null; // ✅ Données pour l'édition
}

export default function CustomRaceModal({ open, onClose, onSave, initialData }: CustomRaceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('Moyen');
  const [speed, setSpeed] = useState(9);
  const [darkvision, setDarkvision] = useState(0);
  const [traits, setTraits] = useState<string[]>(['']);

  if (!open) return null;

  const handleAddTrait = () => {
    setTraits([...traits, '']);
  };

  const handleRemoveTrait = (index: number) => {
    setTraits(traits.filter((_, i) => i !== index));
  };

  const handleTraitChange = (index: number, value: string) => {
    const newTraits = [...traits];
    newTraits[index] = value;
    setTraits(newTraits);
  };

const handleSave = () => {
  if (!name.trim()) {
    alert('Le nom de la race est requis');
    return;
  }

  const validTraits = traits.filter(t => t.trim() !== '');
  if (validTraits.length === 0) {
    alert('Au moins un trait racial est requis');
    return;
  }

  // Construction de la description vision
  let visionTrait = '';
  if (darkvision > 0) {
    visionTrait = `Vision dans le noir (${darkvision} m)`;
  }

  const finalTraits = visionTrait ? [visionTrait, ...validTraits] : validTraits;

  // Convertir mètres en pieds pour la compatibilité avec le système
  const speedInFeet = Math.round(speed / 0.3048);

  const customRace: DndRace = {
    name: name.trim(),
    description: description.trim() || 'Race personnalisée',
    abilityScoreIncrease: {}, // Pas de bonus en 2024
    size,
    speed: speedInFeet, // Stocké en pieds pour compatibilité
    languages: ['Commun', 'Au choix'], // Langues par défaut
    proficiencies: [],
    traits: finalTraits,
  };

  console.log('[CustomRaceModal] Race créée:', customRace); // ✅ DEBUG
  
  onSave(customRace); // ✅ Appeler le callback
  handleReset(); // ✅ Réinitialiser le formulaire
  onClose(); // ✅ IMPORTANT: Fermer le modal après sauvegarde
};

  const handleReset = () => {
    setName('');
    setDescription('');
    setSize('Moyen');
    setSpeed(9);
    setDarkvision(0);
    setTraits(['']);
  };

  const handleCancel = () => {
    handleReset();
    onClose();
  };

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={handleCancel}
    >
      <div 
        className="w-full max-w-4xl max-h-[85vh] overflow-hidden bg-gray-900 border border-gray-800 rounded-xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - FIXE */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Créer une espèce personnalisée</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu - SCROLLABLE */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Informations de base */}
          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold">Informations de base</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nom de l'espèce *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Elfe des étoiles"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Courte description de votre espèce..."
                  className="input-dark w-full min-h-[80px] resize-y"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Taille
                  </label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="input-dark w-full"
                  >
                    <option value="Très petit">Très petit (TP)</option>
                    <option value="Petit">Petit (P)</option>
                    <option value="Moyen">Moyen (M)</option>
                    <option value="Grand">Grand (G)</option>
                    <option value="Moyen ou Petit">Moyen ou Petit</option>
                  </select>
                </div>

                <Input
                  label="Vitesse (mètres)"
                  type="number"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  min={0}
                  step={1.5}
                  placeholder="Ex: 9"
                />

                <Input
                  label="Vision dans le noir (m)"
                  type="number"
                  value={darkvision}
                  onChange={(e) => setDarkvision(Number(e.target.value))}
                  min={0}
                  step={9}
                  placeholder="0 = pas de vision"
                />
              </div>
            </CardContent>
          </Card>

          {/* Traits raciaux */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">Traits raciaux *</h4>
                <Button onClick={handleAddTrait} variant="secondary" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter un trait
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {traits.map((trait, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    value={trait}
                    onChange={(e) => handleTraitChange(index, e.target.value)}
                    placeholder="Décrivez le trait racial..."
                    className="input-dark w-full min-h-[60px] resize-y"
                  />
                  {traits.length > 1 && (
                    <button
                      onClick={() => handleRemoveTrait(index)}
                      className="text-red-400 hover:text-red-300 p-2"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Footer - FIXE */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-800 flex-shrink-0">
          <Button variant="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="min-w-[200px]">
            Créer l'espèce
          </Button>
        </div>
      </div>
    </div>
  );

  // ✅ RENDER DANS LE BODY, PAS DANS LE WIZARD
  return createPortal(modalContent, document.body);
}