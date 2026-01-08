import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Save,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
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
  Shield,
  Zap,
  Moon,
  Sun,
  Star,
  Eye,
  Heart,
  Crown,
  Gem,
  Wind,
  Droplets,
  Mountain,
  Snowflake,
  Crosshair,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { Player, CustomClassData, CustomClassResource, CustomClassAbility } from '../types/dnd';

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

const ABILITY_OPTIONS = ['Force', 'Dexterite', 'Constitution', 'Intelligence', 'Sagesse', 'Charisme'] as const;

export function getIconComponent(iconName: string): LucideIcon {
  const found = ICON_OPTIONS.find(opt => opt.name === iconName);
  return found?.icon || Sparkles;
}

function CollapsibleCard({
  title,
  defaultCollapsed = false,
  children,
}: {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="stat-card">
      <div className="stat-header">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          <ChevronDown
            className={`w-5 h-5 text-gray-300 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>
      </div>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iconName: string) => void;
}) {
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

function ResourceEditor({
  resource,
  onSave,
  onCancel,
}: {
  resource?: CustomClassResource;
  onSave: (resource: CustomClassResource) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(resource?.name || '');
  const [maxType, setMaxType] = useState<'fixed' | 'level' | 'modifier'>(
    typeof resource?.maxValue === 'number' ? 'fixed' : resource?.maxValue || 'fixed'
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
  const [longRest, setLongRest] = useState(resource?.longRest || true);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom de la ressource est requis');
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

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={shortRest}
            onChange={e => setShortRest(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Repos court</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={longRest}
            onChange={e => setLongRest(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">Repos long</span>
        </label>
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

function AbilityEditor({
  ability,
  onSave,
  onCancel,
}: {
  ability?: CustomClassAbility;
  onSave: (ability: CustomClassAbility) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(ability?.name || '');
  const [level, setLevel] = useState(ability?.level || 1);
  const [description, setDescription] = useState(ability?.description || '');

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom de la competence est requis');
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
        <label className="block text-sm font-medium text-gray-300 mb-1">Description (Markdown supporte)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="input-dark w-full px-3 py-2 rounded-md min-h-[120px] resize-y"
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

export interface CustomClassSettingsModalProps {
  open: boolean;
  onClose: () => void;
  player: Player;
  onUpdate: (player: Player) => void;
}

export function CustomClassSettingsModal({
  open,
  onClose,
  player,
  onUpdate,
}: CustomClassSettingsModalProps) {
  const customClass = player.custom_class_data;

  const [className, setClassName] = useState(customClass?.name || '');
  const [description, setDescription] = useState(customClass?.description || '');
  const [hitDie, setHitDie] = useState<6 | 8 | 10 | 12>(customClass?.hitDie || 8);
  const [primaryAbility, setPrimaryAbility] = useState<string[]>(customClass?.primaryAbility || []);
  const [savingThrows, setSavingThrows] = useState<string[]>(customClass?.savingThrows || []);
  const [resources, setResources] = useState<CustomClassResource[]>(customClass?.resources || []);
  const [abilities, setAbilities] = useState<CustomClassAbility[]>(customClass?.abilities || []);

  const [editingResource, setEditingResource] = useState<CustomClassResource | null>(null);
  const [addingResource, setAddingResource] = useState(false);
  const [editingAbility, setEditingAbility] = useState<CustomClassAbility | null>(null);
  const [addingAbility, setAddingAbility] = useState(false);

  const [isDirty, setDirty] = useState(false);
  const [enter, setEnter] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirty(false);

    const cc = player.custom_class_data;
    setClassName(cc?.name || '');
    setDescription(cc?.description || '');
    setHitDie(cc?.hitDie || 8);
    setPrimaryAbility(cc?.primaryAbility || []);
    setSavingThrows(cc?.savingThrows || []);
    setResources(cc?.resources || []);
    setAbilities(cc?.abilities || []);
  }, [open, player.custom_class_data]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setEnter(true), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(id);
      setEnter(false);
      document.body.style.overflow = prev || '';
    };
  }, [open]);

  const smoothClose = useCallback(() => {
    setEnter(false);
    window.setTimeout(() => onClose(), 300);
  }, [onClose]);

  const handleSave = async () => {
    if (!className.trim()) {
      toast.error('Le nom de la classe est requis');
      return;
    }

    try {
      const newCustomClass: CustomClassData = {
        name: className.trim(),
        description: description.trim(),
        hitDie,
        primaryAbility,
        savingThrows,
        isCustom: true,
        resources,
        abilities,
      };

      const { error } = await supabase
        .from('players')
        .update({
          custom_class_data: newCustomClass,
          class: className.trim() as any,
        })
        .eq('id', player.id);

      if (error) throw error;

      onUpdate({
        ...player,
        custom_class_data: newCustomClass,
        class: className.trim() as any,
      });

      toast.success('Classe personnalisee mise a jour');
      setDirty(false);
      smoothClose();
    } catch (error) {
      console.error('Erreur lors de la mise a jour de la classe:', error);
      toast.error('Erreur lors de la sauvegarde');
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
    setDirty(true);
  };

  const handleDeleteResource = (id: string) => {
    if (!window.confirm('Supprimer cette ressource ?')) return;
    setResources(prev => prev.filter(r => r.id !== id));
    setDirty(true);
  };

  const handleSaveAbility = (ability: CustomClassAbility) => {
    if (editingAbility) {
      setAbilities(prev => prev.map(a => (a.id === ability.id ? ability : a)));
    } else {
      setAbilities(prev => [...prev, ability]);
    }
    setEditingAbility(null);
    setAddingAbility(false);
    setDirty(true);
  };

  const handleDeleteAbility = (id: string) => {
    if (!window.confirm('Supprimer cette competence ?')) return;
    setAbilities(prev => prev.filter(a => a.id !== id));
    setDirty(true);
  };

  const togglePrimaryAbility = (ability: string) => {
    setPrimaryAbility(prev =>
      prev.includes(ability) ? prev.filter(a => a !== ability) : [...prev, ability]
    );
    setDirty(true);
  };

  const toggleSavingThrow = (ability: string) => {
    setSavingThrows(prev =>
      prev.includes(ability) ? prev.filter(a => a !== ability) : [...prev, ability]
    );
    setDirty(true);
  };

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const gestureRef = useRef<'undetermined' | 'horizontal' | 'vertical'>('undetermined');

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    gestureRef.current = 'undetermined';
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (startXRef.current == null || startYRef.current == null) return;
    const t = e.touches[0];
    const dx = t.clientX - startXRef.current;
    const dy = t.clientY - startYRef.current;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    if (gestureRef.current === 'undetermined') {
      if (adx >= 14 || ady >= 14) {
        gestureRef.current = adx > ady * 1.15 ? 'horizontal' : 'vertical';
      } else {
        return;
      }
    }
    if (gestureRef.current !== 'horizontal') return;

    const threshold = 50;
    if (dx > threshold) {
      e.preventDefault();
      smoothClose();
    }
  };

  const handleTouchEnd = () => {
    startXRef.current = null;
    startYRef.current = null;
    gestureRef.current = 'undetermined';
  };

  if (!open) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 bg-gray-900 overflow-y-auto
        transform transition-transform duration-300 ease-out
        ${enter ? 'translate-x-0' : 'translate-x-full'}
      `}
      role="dialog"
      aria-modal="true"
      aria-label="Parametres de la classe personnalisee"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-100">Classe personnalisee</h2>
          <button
            onClick={smoothClose}
            className="p-2 text-gray-400 hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <CollapsibleCard title="Informations de base">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Nom de la classe</label>
              <input
                type="text"
                value={className}
                onChange={e => {
                  setClassName(e.target.value);
                  setDirty(true);
                }}
                className="input-dark w-full px-3 py-2 rounded-md"
                placeholder="Ex: Chevalier de la flamme"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => {
                  setDescription(e.target.value);
                  setDirty(true);
                }}
                className="input-dark w-full px-3 py-2 rounded-md min-h-[80px] resize-y"
                placeholder="Decrivez votre classe..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">De de vie</label>
              <select
                value={hitDie}
                onChange={e => {
                  setHitDie(parseInt(e.target.value) as 6 | 8 | 10 | 12);
                  setDirty(true);
                }}
                className="input-dark w-full px-3 py-2 rounded-md"
              >
                <option value={6}>d6</option>
                <option value={8}>d8</option>
                <option value={10}>d10</option>
                <option value={12}>d12</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Caracteristiques principales</label>
              <div className="flex flex-wrap gap-2">
                {ABILITY_OPTIONS.map(ability => (
                  <button
                    key={ability}
                    type="button"
                    onClick={() => togglePrimaryAbility(ability)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      primaryAbility.includes(ability)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {ability}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Jets de sauvegarde</label>
              <div className="flex flex-wrap gap-2">
                {ABILITY_OPTIONS.map(ability => (
                  <button
                    key={ability}
                    type="button"
                    onClick={() => toggleSavingThrow(ability)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      savingThrows.includes(ability)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {ability}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Ressources de classe">
          <div className="space-y-4">
            {resources.length === 0 && !addingResource && (
              <p className="text-gray-400 text-sm text-center py-4">
                Aucune ressource definie. Ajoutez des ressources comme des points de magie, charges, etc.
              </p>
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
                      <span className="font-medium text-gray-200">{resource.name}</span>
                      <div className="text-xs text-gray-400">
                        Max:{' '}
                        {typeof resource.maxValue === 'number'
                          ? resource.maxValue
                          : resource.maxValue === 'level'
                          ? 'Niveau'
                          : `Mod. ${resource.modifierAbility}`}
                        {resource.shortRest && ' | Repos court'}
                        {resource.longRest && ' | Repos long'}
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

            {!addingResource && !editingResource && (
              <button
                type="button"
                onClick={() => setAddingResource(true)}
                className="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-400 hover:border-gray-600 hover:text-gray-300 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Ajouter une ressource
              </button>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard title="Competences de classe">
          <div className="space-y-4">
            {abilities.length === 0 && !addingAbility && (
              <p className="text-gray-400 text-sm text-center py-4">
                Aucune competence definie. Ajoutez des competences obtenues a differents niveaux.
              </p>
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
          </div>
        </CollapsibleCard>

        <div className="mt-4">
          <div className="flex gap-3 justify-end border-t border-gray-700/50 pt-4">
            {isDirty && (
              <button
                onClick={handleSave}
                className="btn-primary px-4 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
              >
                <Save size={20} />
                Sauvegarder
              </button>
            )}
            <button
              onClick={smoothClose}
              className="btn-secondary px-4 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
            >
              <X size={18} />
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
