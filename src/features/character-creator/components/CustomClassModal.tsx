import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Card, { CardContent, CardHeader } from './ui/Card';
import { X, Sword, Heart, Shield, Info } from 'lucide-react';
import type { CustomClassData } from '../types/character';

interface CustomClassModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (classData: CustomClassData) => void;
}

const ABILITY_OPTIONS = [
  'Force',
  'Dextérité',
  'Constitution',
  'Intelligence',
  'Sagesse',
  'Charisme',
];

const HIT_DIE_OPTIONS: Array<{ value: 6 | 8 | 10 | 12; label: string }> = [
  { value: 6, label: 'd6 (Magicien, Ensorceleur)' },
  { value: 8, label: 'd8 (Barde, Clerc, Druide, Moine, Roublard, Occultiste)' },
  { value: 10, label: 'd10 (Guerrier, Paladin, Rôdeur)' },
  { value: 12, label: 'd12 (Barbare)' },
];

export default function CustomClassModal({ open, onClose, onSave }: CustomClassModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hitDie, setHitDie] = useState<6 | 8 | 10 | 12>(8);
  const [primaryAbility, setPrimaryAbility] = useState<string[]>([]);
  const [savingThrow1, setSavingThrow1] = useState('');
  const [savingThrow2, setSavingThrow2] = useState('');

  if (!open) return null;

  const handleTogglePrimaryAbility = (ability: string) => {
    if (primaryAbility.includes(ability)) {
      setPrimaryAbility(primaryAbility.filter(a => a !== ability));
    } else if (primaryAbility.length < 2) {
      setPrimaryAbility([...primaryAbility, ability]);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Le nom de la classe est requis');
      return;
    }

    if (primaryAbility.length === 0) {
      alert('Sélectionnez au moins une caractéristique principale');
      return;
    }

    if (!savingThrow1 || !savingThrow2) {
      alert('Sélectionnez deux jets de sauvegarde');
      return;
    }

    if (savingThrow1 === savingThrow2) {
      alert('Les deux jets de sauvegarde doivent être différents');
      return;
    }

    const customClass: CustomClassData = {
      name: name.trim(),
      description: description.trim() || 'Classe personnalisée',
      hitDie,
      primaryAbility,
      savingThrows: [savingThrow1, savingThrow2],
      isCustom: true,
      resources: [],
      abilities: [],
    };

    onSave(customClass);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setName('');
    setDescription('');
    setHitDie(8);
    setPrimaryAbility([]);
    setSavingThrow1('');
    setSavingThrow2('');
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
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sword className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-white">Créer une classe personnalisée</h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold">Informations de base</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nom de la classe *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Chevalier des Arcanes"
              />

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Courte description de votre classe..."
                  className="input-dark w-full min-h-[80px] resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Dé de vie *
                </label>
                <select
                  value={hitDie}
                  onChange={(e) => setHitDie(Number(e.target.value) as 6 | 8 | 10 | 12)}
                  className="input-dark w-full"
                >
                  {HIT_DIE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold">Caractéristiques principales *</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                  {primaryAbility.length}/2
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-3">
                Sélectionnez 1 ou 2 caractéristiques principales pour cette classe.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ABILITY_OPTIONS.map((ability) => {
                  const isSelected = primaryAbility.includes(ability);
                  const isDisabled = !isSelected && primaryAbility.length >= 2;

                  return (
                    <button
                      key={ability}
                      type="button"
                      onClick={() => handleTogglePrimaryAbility(ability)}
                      disabled={isDisabled}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-amber-500/60 bg-amber-900/20 text-amber-200'
                          : isDisabled
                          ? 'border-gray-700/30 bg-gray-800/20 text-gray-500 cursor-not-allowed'
                          : 'border-gray-600/50 bg-gray-800/30 text-gray-300 hover:bg-gray-700/50'
                      }`}
                    >
                      {ability}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" />
                Jets de sauvegarde *
              </h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Choisissez deux caractéristiques pour les jets de sauvegarde maîtrisés.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Premier jet de sauvegarde
                  </label>
                  <select
                    value={savingThrow1}
                    onChange={(e) => setSavingThrow1(e.target.value)}
                    className="input-dark w-full"
                  >
                    <option value="">Sélectionner...</option>
                    {ABILITY_OPTIONS.map((ability) => (
                      <option key={ability} value={ability} disabled={ability === savingThrow2}>
                        {ability}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Second jet de sauvegarde
                  </label>
                  <select
                    value={savingThrow2}
                    onChange={(e) => setSavingThrow2(e.target.value)}
                    className="input-dark w-full"
                  >
                    <option value="">Sélectionner...</option>
                    {ABILITY_OPTIONS.map((ability) => (
                      <option key={ability} value={ability} disabled={ability === savingThrow1}>
                        {ability}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                Ressources et compétences
              </h4>
            </CardHeader>
            <CardContent>
              <div className="bg-sky-900/20 border border-sky-700/30 rounded-lg p-4">
                <p className="text-sm text-sky-200">
                  Les ressources de classe (points de ki, rages, etc.) et les compétences de classe
                  par niveau seront configurables <strong>directement dans l'interface de jeu</strong> via
                  le bouton de paramètres dans l'onglet Classe.
                </p>
                <p className="text-xs text-sky-300/70 mt-2">
                  Cela vous permet d'ajuster votre classe au fur et à mesure de votre progression.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-800 flex-shrink-0">
          <Button variant="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="min-w-[200px]">
            <Heart className="w-4 h-4 mr-2" />
            Créer la classe
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
