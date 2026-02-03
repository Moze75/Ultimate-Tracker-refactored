import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Card, { CardContent, CardHeader } from './ui/Card';
import { X, Plus, Trash2, BookOpen, Star, Wrench, Zap, Scroll } from 'lucide-react';
import { CustomBackgroundData } from '../types/character';

interface CustomBackgroundModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (background: CustomBackgroundData) => void;
  initialData?: CustomBackgroundData | null;
}

const ORIGIN_FEATS = [
  'Bagarreur de tavernes',
  'Chanceux',
  'Doué',
  'Façonneur',
  'Guérisseur',
  'Initié à la magie',
  'Musicien',
  'Robuste',
  'Sauvagerie martiale',
  'Vigilant',
];

const ALL_SKILLS = [
  'Acrobaties', 'Arcanes', 'Athlétisme', 'Discrétion', 'Dressage',
  'Escamotage', 'Histoire', 'Intimidation', 'Investigation', 'Intuition',
  'Médecine', 'Nature', 'Perception', 'Persuasion', 'Religion',
  'Représentation', 'Survie', 'Tromperie'
];

const ALL_ABILITIES = ['Force', 'Dextérité', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'];

const TOOL_OPTIONS = [
  'Matériel de calligraphie',
  'Outils d\'artisan (au choix)',
  'Instrument de musique (au choix)',
  'Matériel de contrefaçon',
  'Outils de voleur',
  'Matériel d\'herboriste',
  'Outils de charpentier',
  'Boîte de jeux (au choix)',
  'Outils de cartographe',
  'Instruments de navigateur',
];

export default function CustomBackgroundModal({ open, onClose, onSave, initialData }: CustomBackgroundModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [abilityScores, setAbilityScores] = useState<string[]>([]);
  const [feat, setFeat] = useState('');
  const [skillProficiencies, setSkillProficiencies] = useState<string[]>([]);
  const [toolProficiency, setToolProficiency] = useState('');
  const [equipmentA, setEquipmentA] = useState<string[]>(['']);
  const [equipmentB, setEquipmentB] = useState<string[]>(['50 po']);

  useEffect(() => {
    if (initialData && open) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setAbilityScores(initialData.abilityScores || []);
      setFeat(initialData.feat || '');
      setSkillProficiencies(initialData.skillProficiencies || []);
      setToolProficiency(initialData.toolProficiencies?.[0] || '');
      setEquipmentA(initialData.equipmentOptions?.optionA?.length ? initialData.equipmentOptions.optionA : ['']);
      setEquipmentB(initialData.equipmentOptions?.optionB?.length ? initialData.equipmentOptions.optionB : ['50 po']);
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleToggleAbility = (ability: string) => {
    if (abilityScores.includes(ability)) {
      setAbilityScores(abilityScores.filter(a => a !== ability));
    } else if (abilityScores.length < 3) {
      setAbilityScores([...abilityScores, ability]);
    }
  };

  const handleToggleSkill = (skill: string) => {
    if (skillProficiencies.includes(skill)) {
      setSkillProficiencies(skillProficiencies.filter(s => s !== skill));
    } else if (skillProficiencies.length < 2) {
      setSkillProficiencies([...skillProficiencies, skill]);
    }
  };

  const handleAddEquipmentA = () => setEquipmentA([...equipmentA, '']);
  const handleRemoveEquipmentA = (index: number) => setEquipmentA(equipmentA.filter((_, i) => i !== index));
  const handleEquipmentAChange = (index: number, value: string) => {
    const newItems = [...equipmentA];
    newItems[index] = value;
    setEquipmentA(newItems);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Le nom de l\'historique est requis');
      return;
    }
    if (abilityScores.length !== 3) {
      alert('Vous devez sélectionner exactement 3 caractéristiques');
      return;
    }
    if (!feat) {
      alert('Le don d\'origine est requis');
      return;
    }
    if (skillProficiencies.length !== 2) {
      alert('Vous devez sélectionner exactement 2 compétences');
      return;
    }
    if (!toolProficiency) {
      alert('La maîtrise d\'outil est requise');
      return;
    }

    const validEquipmentA = equipmentA.filter(e => e.trim() !== '');
    if (validEquipmentA.length === 0) {
      alert('L\'option d\'équipement A doit contenir au moins un élément');
      return;
    }

    const customBackground: CustomBackgroundData = {
      name: name.trim(),
      description: description.trim() || 'Historique personnalisé',
      abilityScores,
      feat,
      skillProficiencies,
      toolProficiencies: [toolProficiency],
      equipmentOptions: {
        optionA: validEquipmentA,
        optionB: equipmentB.filter(e => e.trim() !== ''),
      },
      isCustom: true,
    };

    console.log('[CustomBackgroundModal] Historique créé:', customBackground);
    onSave(customBackground);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setName('');
    setDescription('');
    setAbilityScores([]);
    setFeat('');
    setSkillProficiencies([]);
    setToolProficiency('');
    setEquipmentA(['']);
    setEquipmentB(['50 po']);
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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">
              {initialData ? 'Modifier l\'historique personnalisé' : 'Créer un historique personnalisé'}
            </h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Informations de base */}
          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold">Informations de base</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nom de l'historique *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Aventurier des mers"
              />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Courte description de votre historique..."
                  className="input-dark w-full min-h-[80px] resize-y"
                />
              </div>
            </CardContent>
          </Card>

          {/* Caractéristiques (3 au choix) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-400" />
                <h4 className="text-white font-semibold">Caractéristiques * (3 au choix)</h4>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ALL_ABILITIES.map((ability) => (
                  <button
                    key={ability}
                    type="button"
                    onClick={() => handleToggleAbility(ability)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      abilityScores.includes(ability)
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } ${abilityScores.length >= 3 && !abilityScores.includes(ability) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={abilityScores.length >= 3 && !abilityScores.includes(ability)}
                  >
                    {ability}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Sélectionné: {abilityScores.length}/3</p>
            </CardContent>
          </Card>

          {/* Don d'origine */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scroll className="w-5 h-5 text-purple-400" />
                <h4 className="text-white font-semibold">Don d'origine *</h4>
              </div>
            </CardHeader>
            <CardContent>
              <select
                value={feat}
                onChange={(e) => setFeat(e.target.value)}
                className="input-dark w-full"
              >
                <option value="">Sélectionnez un don...</option>
                {ORIGIN_FEATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Compétences (2 au choix) */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                <h4 className="text-white font-semibold">Compétences * (2 au choix)</h4>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {ALL_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleToggleSkill(skill)}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${
                      skillProficiencies.includes(skill)
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    } ${skillProficiencies.length >= 2 && !skillProficiencies.includes(skill) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={skillProficiencies.length >= 2 && !skillProficiencies.includes(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Sélectionné: {skillProficiencies.length}/2</p>
            </CardContent>
          </Card>

          {/* Maîtrise d'outil */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-green-400" />
                <h4 className="text-white font-semibold">Maîtrise d'outil *</h4>
              </div>
            </CardHeader>
            <CardContent>
              <select
                value={toolProficiency}
                onChange={(e) => setToolProficiency(e.target.value)}
                className="input-dark w-full"
              >
                <option value="">Sélectionnez un outil...</option>
                {TOOL_OPTIONS.map((tool) => (
                  <option key={tool} value={tool}>{tool}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Équipement de départ */}
          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold">Équipement de départ *</h4>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Option A */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-300">Option A</span>
                  <Button onClick={handleAddEquipmentA} variant="secondary" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-2">
                  {equipmentA.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={item}
                        onChange={(e) => handleEquipmentAChange(index, e.target.value)}
                        placeholder="Ex: Épée longue, 10 po..."
                        className="flex-1"
                      />
                      {equipmentA.length > 1 && (
                        <button
                          onClick={() => handleRemoveEquipmentA(index)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Option B */}
              <div>
                <span className="text-sm text-gray-300 block mb-2">Option B (généralement 50 po)</span>
                <Input
                  value={equipmentB[0] || ''}
                  onChange={(e) => setEquipmentB([e.target.value])}
                  placeholder="Ex: 50 po"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-800 flex-shrink-0">
          <Button variant="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="min-w-[200px]">
            {initialData ? 'Enregistrer les modifications' : 'Créer l\'historique'}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}