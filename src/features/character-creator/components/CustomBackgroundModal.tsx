import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Card, { CardContent, CardHeader } from './ui/Card';
import { X, Plus, Trash2, BookOpen, Star, Wrench, Zap, Scroll, Package } from 'lucide-react';
import { CustomBackgroundData } from '../types/character';
import EquipmentCatalogPicker from './EquipmentCatalogPicker';
import { FEAT_SKILL_BONUSES, normalizeFeatName } from '../../../../data/featBonuses';

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
    const [featSkillPicks, setFeatSkillPicks] = useState<string[]>([]);
  const [equipmentA, setEquipmentA] = useState<string[]>([]);
  const [goldA, setGoldA] = useState<number>(0);
  const [goldB, setGoldB] = useState<number>(50);
  
  // États pour le picker d'équipement
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);

  useEffect(() => {
    if (initialData && open) {
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setAbilityScores(initialData.abilityScores || []);
      setFeat(initialData.feat || '');
      setSkillProficiencies(initialData.skillProficiencies || []);
      setToolProficiency(initialData.toolProficiencies?.[0] || '');
            setFeatSkillPicks(initialData.featSkillPicks || []);
      
      // Parser l'équipement existant
      const optA = initialData.equipmentOptions?.optionA || [];
      const nonGoldItems = optA.filter(item => !/^\d+\s*po$/i.test(item));
      const goldItem = optA.find(item => /^\d+\s*po$/i.test(item));
      const goldMatch = goldItem?.match(/^(\d+)\s*po$/i);
      
      setEquipmentA(nonGoldItems);
      setGoldA(goldMatch ? parseInt(goldMatch[1]) : 0);
      
      const optB = initialData.equipmentOptions?.optionB || ['50 po'];
      const goldBItem = optB.find(item => /^\d+\s*po$/i.test(item));
      const goldBMatch = goldBItem?.match(/^(\d+)\s*po$/i);
      setGoldB(goldBMatch ? parseInt(goldBMatch[1]) : 50);
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

  const handleRemoveEquipment = (index: number) => {
    setEquipmentA(equipmentA.filter((_, i) => i !== index));
  };

  const handleEquipmentSelect = (items: string[]) => {
    setEquipmentA(items);
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
    if (equipmentA.length === 0 && goldA <= 0) {
      alert('L\'option A doit contenir au moins un équipement ou de l\'or');
      return;
    }

    // Construire l'option A avec l'or
    const optionAWithGold = [...equipmentA];
    if (goldA > 0) {
      optionAWithGold.push(`${goldA} po`);
    }

    const customBackground: CustomBackgroundData = {
      name: name.trim(),
      description: description.trim() || 'Historique personnalisé',
      abilityScores,
      feat,
      skillProficiencies,
      toolProficiencies: [toolProficiency],
      equipmentOptions: {
        optionA: optionAWithGold,
        optionB: [`${goldB} po`],
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
        setFeatSkillPicks([]);
    setEquipmentA([]);
    setGoldA(0);
    setGoldB(50);
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
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h4 className="text-white font-semibold">Équipement de départ *</h4>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Option A */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Option A - Équipements</span>
                  <Button 
                    onClick={() => setShowEquipmentPicker(true)} 
                    variant="secondary" 
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Sélectionner du catalogue
                  </Button>
                </div>
                
                {equipmentA.length > 0 ? (
                  <div className="space-y-2">
                    {equipmentA.map((item, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-800/50 rounded-md px-3 py-2">
                        <span className="text-gray-200 text-sm">{item}</span>
                        <button
                          onClick={() => handleRemoveEquipment(index)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm py-4 text-center bg-gray-800/30 rounded-md">
                    Aucun équipement sélectionné. Cliquez sur "Sélectionner du catalogue".
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-400">Or (po) inclus dans l'option A:</label>
                  <input
                    type="number"
                    value={goldA}
                    onChange={(e) => setGoldA(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="input-dark w-24 px-2 py-1 rounded"
                  />
                </div>
              </div>

              {/* Option B */}
              <div className="pt-3 border-t border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-300">Option B - Or uniquement:</span>
                  <input
                    type="number"
                    value={goldB}
                    onChange={(e) => setGoldB(Math.max(0, parseInt(e.target.value) || 0))}
                    min={0}
                    className="input-dark w-24 px-2 py-1 rounded"
                  />
                  <span className="text-gray-400 text-sm">po</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  L'option B est généralement 50 po pour tous les historiques standards.
                </p>
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

      {/* Picker d'équipement */}
      <EquipmentCatalogPicker
        open={showEquipmentPicker}
        onClose={() => setShowEquipmentPicker(false)}
        onSelect={handleEquipmentSelect}
        selectedItems={equipmentA}
        title="Sélectionner l'équipement de départ"
      />
    </div>
  );

  return createPortal(modalContent, document.body);
}