import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './ui/Button';
import Input from './ui/Input';
import Card, { CardContent, CardHeader } from './ui/Card';
import {
  X,
  Sword,
  Heart,
  Shield,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Save,
  Flame,
  Music,
  Cross,
  Leaf,
  Wand2,
  Swords,
  HandHeart,
  Target,
  Skull,
  BookOpen,
  Zap,
  Moon,
  Sun,
  Star,
  Eye,
  Crown,
  Gem,
  Wind,
  Droplets,
  Mountain,
  Snowflake,
  Crosshair,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import type {
  CustomClassData,
  CustomClassSpellcasting,
  CustomClassResource,
  CustomClassAbility,
} from '../types/character';

interface CustomClassModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (classData: CustomClassData) => void;
  initialData?: CustomClassData | null; // ✅ Données pour l'édition
}

const ABILITY_OPTIONS = [
  'Force',
  'Dexterite',
  'Constitution',
  'Intelligence',
  'Sagesse',
  'Charisme',
];

const ABILITY_OPTIONS_DISPLAY = [
  'Force',
  'Dexterite',
  'Constitution',
  'Intelligence',
  'Sagesse',
  'Charisme',
];

const HIT_DIE_OPTIONS: Array<{ value: 6 | 8 | 10 | 12; label: string }> = [
  { value: 6, label: 'd6 (Magicien, Ensorceleur)' },
  { value: 8, label: 'd8 (Barde, Clerc, Druide, Moine, Roublard, Occultiste)' },
  { value: 10, label: 'd10 (Guerrier, Paladin, Rodeur)' },
  { value: 12, label: 'd12 (Barbare)' },
];

const SPELL_LIST_OPTIONS = [
  { value: 'Magicien', label: 'Liste du Magicien' },
  { value: 'Clerc', label: 'Liste du Clerc' },
  { value: 'Druide', label: 'Liste du Druide' },
  { value: 'Barde', label: 'Liste du Barde' },
  { value: 'Ensorceleur', label: 'Liste de l\'Ensorceleur' },
  { value: 'Occultiste', label: 'Liste de l\'Occultiste' },
  { value: 'Paladin', label: 'Liste du Paladin' },
  { value: 'Rodeur', label: 'Liste du Rodeur' },
];

const SPELLCASTING_ABILITY_OPTIONS: Array<{ value: CustomClassSpellcasting['spellcastingAbility']; label: string }> = [
  { value: 'Intelligence', label: 'Intelligence (Magicien)' },
  { value: 'Sagesse', label: 'Sagesse (Clerc, Druide, Rodeur)' },
  { value: 'Charisme', label: 'Charisme (Barde, Ensorceleur, Paladin, Occultiste)' },
];

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Flame', icon: Flame },
  { name: 'Music', icon: Music },
  { name: 'Cross', icon: Cross },
  { name: 'Leaf', icon: Leaf },
  { name: 'Wand2', icon: Wand2 },
  { name: 'Swords', icon: Swords },
  { name: 'HandHeart', icon: HandHeart },
  { name: 'Target', icon: Target },
  { name: 'Skull', icon: Skull },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Shield', icon: Shield },
  { name: 'Zap', icon: Zap },
  { name: 'Moon', icon: Moon },
  { name: 'Sun', icon: Sun },
  { name: 'Star', icon: Star },
  { name: 'Eye', icon: Eye },
  { name: 'Heart', icon: Heart },
  { name: 'Crown', icon: Crown },
  { name: 'Gem', icon: Gem },
  { name: 'Wind', icon: Wind },
  { name: 'Droplets', icon: Droplets },
  { name: 'Mountain', icon: Mountain },
  { name: 'Snowflake', icon: Snowflake },
  { name: 'Crosshair', icon: Crosshair },
];

const COLOR_OPTIONS: { name: string; value: CustomClassResource['color']; className: string }[] = [
  { name: 'Rouge', value: 'red', className: 'bg-red-500' },
  { name: 'Violet', value: 'purple', className: 'bg-purple-500' },
  { name: 'Jaune', value: 'yellow', className: 'bg-yellow-500' },
  { name: 'Vert', value: 'green', className: 'bg-green-500' },
  { name: 'Bleu', value: 'blue', className: 'bg-blue-500' },
];

const MAX_RESOURCES = 2;

function getIconComponent(iconName: string): LucideIcon {
  const found = ICON_OPTIONS.find(opt => opt.name === iconName);
  return found?.icon || Sparkles;
}

function IconPicker({ value, onChange }: { value: string; onChange: (iconName: string) => void }) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getIconComponent(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-md hover:bg-gray-700/50 transition-colors"
      >
        <SelectedIcon size={20} className="text-gray-300" />
        <ChevronDown size={16} className="text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
          {ICON_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.name}
                type="button"
                onClick={() => {
                  onChange(opt.name);
                  setOpen(false);
                }}
                className={`p-2 rounded-md hover:bg-gray-700/50 transition-colors ${
                  value === opt.name ? 'bg-gray-700 ring-1 ring-blue-500' : ''
                }`}
                title={opt.name}
              >
                <Icon size={20} className="text-gray-300" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ResourceEditorProps {
  resource?: CustomClassResource;
  onSave: (resource: CustomClassResource) => void;
  onCancel: () => void;
}

function ResourceEditor({ resource, onSave, onCancel }: ResourceEditorProps) {
  const [name, setName] = useState(resource?.name || '');
  const [maxType, setMaxType] = useState<'fixed' | 'level' | 'modifier'>(
    typeof resource?.maxValue === 'number' ? 'fixed' : (resource?.maxValue as 'level' | 'modifier') || 'fixed'
  );
  const [fixedValue, setFixedValue] = useState(
    typeof resource?.maxValue === 'number' ? resource.maxValue : 3
  );
  const [modifierAbility, setModifierAbility] = useState<CustomClassResource['modifierAbility']>(
    resource?.modifierAbility || 'Charisme'
  );
  const [color, setColor] = useState<CustomClassResource['color']>(resource?.color || 'purple');
  const [icon, setIcon] = useState(resource?.icon || 'Sparkles');
  const [shortRest, setShortRest] = useState(resource?.shortRest || false);
  const [longRest, setLongRest] = useState(resource?.longRest ?? true);

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Le nom de la ressource est requis');
      return;
    }

    const newResource: CustomClassResource = {
      id: resource?.id || crypto.randomUUID(),
      name: name.trim(),
      maxValue: maxType === 'fixed' ? fixedValue : maxType,
      modifierAbility: maxType === 'modifier' ? modifierAbility : undefined,
      color,
      icon,
      shortRest,
      longRest,
    };

    onSave(newResource);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Nom de la ressource</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md"
          placeholder="Ex: Points de magie"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Type de maximum</label>
          <select
            value={maxType}
            onChange={e => setMaxType(e.target.value as 'fixed' | 'level' | 'modifier')}
            className="input-dark w-full px-3 py-2 rounded-md"
          >
            <option value="fixed">Valeur fixe</option>
            <option value="level">= Niveau du personnage</option>
            <option value="modifier">= Modificateur de caracteristique</option>
          </select>
        </div>

        {maxType === 'fixed' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Valeur maximale</label>
            <input
              type="number"
              min={1}
              value={fixedValue}
              onChange={e => setFixedValue(Math.max(1, parseInt(e.target.value) || 1))}
              className="input-dark w-full px-3 py-2 rounded-md"
            />
          </div>
        )}

        {maxType === 'modifier' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Caracteristique</label>
            <select
              value={modifierAbility}
              onChange={e => setModifierAbility(e.target.value as CustomClassResource['modifierAbility'])}
              className="input-dark w-full px-3 py-2 rounded-md"
            >
              {ABILITY_OPTIONS.map(ability => (
                <option key={ability} value={ability}>{ability}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Icone</label>
          <IconPicker value={icon} onChange={setIcon} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Couleur</label>
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColor(opt.value)}
                className={`w-8 h-8 rounded-full ${opt.className} ${
                  color === opt.value ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                }`}
                title={opt.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300 mb-1">Regeneration</label>
        <div className="flex gap-3">
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors ${
            shortRest
              ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300'
              : 'bg-gray-800/50 border-gray-700 text-gray-400'
          }`}>
            <input
              type="checkbox"
              checked={shortRest}
              onChange={e => setShortRest(e.target.checked)}
              className="sr-only"
            />
            <Sun size={16} />
            <span className="text-sm">Repos court</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors ${
            longRest
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
              : 'bg-gray-800/50 border-gray-700 text-gray-400'
          }`}>
            <input
              type="checkbox"
              checked={longRest}
              onChange={e => setLongRest(e.target.checked)}
              className="sr-only"
            />
            <Moon size={16} />
            <span className="text-sm">Repos long</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {resource ? 'Modifier' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary px-4 py-2 rounded-lg"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

interface AbilityEditorProps {
  ability?: CustomClassAbility;
  onSave: (ability: CustomClassAbility) => void;
  onCancel: () => void;
}

function AbilityEditor({ ability, onSave, onCancel }: AbilityEditorProps) {
  const [name, setName] = useState(ability?.name || '');
  const [level, setLevel] = useState(ability?.level || 1);
  const [description, setDescription] = useState(ability?.description || '');

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('Le nom de la competence est requis');
      return;
    }

    const newAbility: CustomClassAbility = {
      id: ability?.id || crypto.randomUUID(),
      name: name.trim(),
      level,
      description: description.trim(),
    };

    onSave(newAbility);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nom de la competence</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="input-dark w-full px-3 py-2 rounded-md"
            placeholder="Ex: Souffle du dragon"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Niveau d'obtention</label>
          <input
            type="number"
            min={1}
            max={20}
            value={level}
            onChange={e => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            className="input-dark w-full px-3 py-2 rounded-md"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md min-h-[80px] resize-y"
          placeholder="Decrivez la competence..."
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="flex-1 btn-primary px-4 py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {ability ? 'Modifier' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary px-4 py-2 rounded-lg"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function CustomClassModal({ open, onClose, onSave }: CustomClassModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hitDie, setHitDie] = useState<6 | 8 | 10 | 12>(8);
  const [primaryAbility, setPrimaryAbility] = useState<string[]>([]);
  const [savingThrow1, setSavingThrow1] = useState('');
  const [savingThrow2, setSavingThrow2] = useState('');

  const [spellcastingEnabled, setSpellcastingEnabled] = useState(false);
  const [cantripsCount, setCantripsCount] = useState(2);
  const [spellsKnownCount, setSpellsKnownCount] = useState(4);
  const [spellcastingAbility, setSpellcastingAbility] = useState<CustomClassSpellcasting['spellcastingAbility']>('Intelligence');
  const [spellList, setSpellList] = useState('Magicien');

  const [resources, setResources] = useState<CustomClassResource[]>([]);
  const [addingResource, setAddingResource] = useState(false);
  const [editingResource, setEditingResource] = useState<CustomClassResource | null>(null);

  const [abilities, setAbilities] = useState<CustomClassAbility[]>([]);
  const [addingAbility, setAddingAbility] = useState(false);
  const [editingAbility, setEditingAbility] = useState<CustomClassAbility | null>(null);

  if (!open) return null;

  const handleTogglePrimaryAbility = (ability: string) => {
    if (primaryAbility.includes(ability)) {
      setPrimaryAbility(primaryAbility.filter(a => a !== ability));
    } else if (primaryAbility.length < 2) {
      setPrimaryAbility([...primaryAbility, ability]);
    }
  };

  const handleSaveResource = (resource: CustomClassResource) => {
    if (editingResource) {
      setResources(prev => prev.map(r => (r.id === resource.id ? resource : r)));
    } else {
      setResources(prev => [...prev, resource]);
    }
    setEditingResource(null);
    setAddingResource(false);
  };

  const handleDeleteResource = (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveAbility = (ability: CustomClassAbility) => {
    if (editingAbility) {
      setAbilities(prev => prev.map(a => (a.id === ability.id ? ability : a)));
    } else {
      setAbilities(prev => [...prev, ability]);
    }
    setEditingAbility(null);
    setAddingAbility(false);
  };

  const handleDeleteAbility = (id: string) => {
    setAbilities(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('Le nom de la classe est requis');
      return;
    }

    if (primaryAbility.length === 0) {
      alert('Selectionnez au moins une caracteristique principale');
      return;
    }

    if (!savingThrow1 || !savingThrow2) {
      alert('Selectionnez deux jets de sauvegarde');
      return;
    }

    if (savingThrow1 === savingThrow2) {
      alert('Les deux jets de sauvegarde doivent etre differents');
      return;
    }

    const customClass: CustomClassData = {
      name: name.trim(),
      description: description.trim() || 'Classe personnalisee',
      hitDie,
      primaryAbility,
      savingThrows: [savingThrow1, savingThrow2],
      isCustom: true,
      resources,
      abilities,
      spellcasting: spellcastingEnabled ? {
        enabled: true,
        cantrips: cantripsCount,
        spellsKnown: spellsKnownCount,
        spellcastingAbility,
        spellList,
      } : undefined,
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
    setSpellcastingEnabled(false);
    setCantripsCount(2);
    setSpellsKnownCount(4);
    setSpellcastingAbility('Intelligence');
    setSpellList('Magicien');
    setResources([]);
    setAddingResource(false);
    setEditingResource(null);
    setAbilities([]);
    setAddingAbility(false);
    setEditingAbility(null);
  };

  const handleCancel = () => {
    handleReset();
    onClose();
  };

  const canAddResource = resources.length < MAX_RESOURCES && !addingResource && !editingResource;

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
            <h3 className="text-lg font-semibold text-white">Creer une classe personnalisee</h3>
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
                  De de vie *
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
                <h4 className="text-white font-semibold">Caracteristiques principales *</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                  {primaryAbility.length}/2
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-3">
                Selectionnez 1 ou 2 caracteristiques principales pour cette classe.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ABILITY_OPTIONS_DISPLAY.map((ability) => {
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
                Choisissez deux caracteristiques pour les jets de sauvegarde maitrises.
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
                    <option value="">Selectionner...</option>
                    {ABILITY_OPTIONS_DISPLAY.map((ability) => (
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
                    <option value="">Selectionner...</option>
                    {ABILITY_OPTIONS_DISPLAY.map((ability) => (
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
                <Sparkles className="w-4 h-4 text-blue-400" />
                Magie
              </h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-200 font-medium">Cette classe peut lancer des sorts</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Activez pour configurer les options de magie
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSpellcastingEnabled(!spellcastingEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    spellcastingEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      spellcastingEnabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {spellcastingEnabled && (
                <div className="space-y-4 pt-3 border-t border-gray-700/50">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Liste de sorts a utiliser
                    </label>
                    <select
                      value={spellList}
                      onChange={(e) => setSpellList(e.target.value)}
                      className="input-dark w-full"
                    >
                      {SPELL_LIST_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Definit quels sorts seront disponibles pour cette classe
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Caracteristique d'incantation
                    </label>
                    <select
                      value={spellcastingAbility}
                      onChange={(e) => setSpellcastingAbility(e.target.value as CustomClassSpellcasting['spellcastingAbility'])}
                      className="input-dark w-full"
                    >
                      {SPELLCASTING_ABILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Tours de magie (niveau 1)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={cantripsCount}
                        onChange={(e) => setCantripsCount(Math.max(0, Math.min(6, parseInt(e.target.value) || 0)))}
                        className="input-dark w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Sorts connus (niveau 1)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={spellsKnownCount}
                        onChange={(e) => setSpellsKnownCount(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
                        className="input-dark w-full"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                    <p className="text-xs text-blue-200">
                      Au niveau 1, votre personnage connaitra <strong>{cantripsCount}</strong> tour(s) de magie
                      et <strong>{spellsKnownCount}</strong> sort(s) de niveau 1 de la liste du <strong>{spellList}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h4 className="text-white font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Ressources de classe
                </h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">
                  {resources.length}/{MAX_RESOURCES}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Ajoutez jusqu'a {MAX_RESOURCES} ressources de classe (points de magie, charges, etc.)
              </p>

              {resources.length === 0 && !addingResource && (
                <div className="text-center text-gray-500 py-4 border border-dashed border-gray-700 rounded-lg">
                  Aucune ressource definie
                </div>
              )}

              {resources.map(resource => {
                const Icon = getIconComponent(resource.icon);
                const colorClass = COLOR_OPTIONS.find(c => c.value === resource.color)?.className || 'bg-purple-500';

                if (editingResource?.id === resource.id) {
                  return (
                    <ResourceEditor
                      key={resource.id}
                      resource={resource}
                      onSave={handleSaveResource}
                      onCancel={() => setEditingResource(null)}
                    />
                  );
                }

                return (
                  <div
                    key={resource.id}
                    className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colorClass.replace('bg-', 'bg-opacity-20 text-')}`}>
                        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-200">{resource.name}</span>
                          <div className="flex items-center gap-1">
                            {resource.shortRest && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" title="Se regenere au repos court">
                                <Sun size={10} />
                              </span>
                            )}
                            {resource.longRest && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30" title="Se regenere au repos long">
                                <Moon size={10} />
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          Max:{' '}
                          {typeof resource.maxValue === 'number'
                            ? resource.maxValue
                            : resource.maxValue === 'level'
                            ? 'Niveau'
                            : `Mod. ${resource.modifierAbility}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingResource(resource)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded-md transition-colors"
                        title="Modifier"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteResource(resource.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-md transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {addingResource && (
                <ResourceEditor
                  onSave={handleSaveResource}
                  onCancel={() => setAddingResource(false)}
                />
              )}

              {canAddResource && (
                <button
                  type="button"
                  onClick={() => setAddingResource(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Ajouter une ressource
                </button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h4 className="text-white font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                Competences de classe
              </h4>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-400">
                Ajoutez les competences de classe obtenues a differents niveaux.
              </p>

              {abilities.length === 0 && !addingAbility && (
                <div className="text-center text-gray-500 py-4 border border-dashed border-gray-700 rounded-lg">
                  Aucune competence definie
                </div>
              )}

              {abilities
                .sort((a, b) => a.level - b.level)
                .map(ability => {
                  if (editingAbility?.id === ability.id) {
                    return (
                      <AbilityEditor
                        key={ability.id}
                        ability={ability}
                        onSave={handleSaveAbility}
                        onCancel={() => setEditingAbility(null)}
                      />
                    );
                  }

                  return (
                    <div
                      key={ability.id}
                      className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
                              Niv. {ability.level}
                            </span>
                            <span className="font-medium text-gray-200">{ability.name}</span>
                          </div>
                          {ability.description && (
                            <p className="mt-1 text-sm text-gray-400 line-clamp-2">
                              {ability.description}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 ml-2">
                          <button
                            type="button"
                            onClick={() => setEditingAbility(ability)}
                            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded-md transition-colors"
                            title="Modifier"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAbility(ability.id)}
                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-md transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

              {addingAbility && (
                <AbilityEditor
                  onSave={handleSaveAbility}
                  onCancel={() => setAddingAbility(false)}
                />
              )}

              {!addingAbility && !editingAbility && (
                <button
                  type="button"
                  onClick={() => setAddingAbility(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Ajouter une competence
                </button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-800 flex-shrink-0">
          <Button variant="secondary" onClick={handleCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="min-w-[200px]">
            <Heart className="w-4 h-4 mr-2" />
            Creer la classe
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
