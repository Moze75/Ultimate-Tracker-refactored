import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  Plus,
  Minus,
  Heart,
  Shield,
  Loader2,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Monster, MonsterListItem, MonsterAbilities, MonsterEntry } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import { MonsterStatBlock } from '../Combat/MonsterStatBlock';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

/* ── Types ── */

export interface FamiliarData {
  name: string;
  slug?: string;
  source?: string;
  type: string;
  size: string;
  armor_class: number;
  hit_points: number;
  max_hp: number;
  current_hp: number;
  speed: Record<string, string>;
  abilities: MonsterAbilities;
  senses: string;
  languages: string;
  challenge_rating: string;
  traits: MonsterEntry[];
  actions: MonsterEntry[];
  [key: string]: any;
}

interface FamiliarModalProps {
  playerId: string;
  familiar: FamiliarData | null;
  onClose: () => void;
  onSave: (familiar: FamiliarData | null) => void;
}

/* ── Helpers ── */

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function DynamicEntryList({
  label,
  entries,
  onChange,
}: {
  label: string;
  entries: MonsterEntry[];
  onChange: (entries: MonsterEntry[]) => void;
}) {
  const add = () => onChange([...entries, { name: '', description: '' }]);
  const remove = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof MonsterEntry, value: string) => {
    const copy = [...entries];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-2 items-start">
          <div className="flex-1 space-y-1">
            <input
              className="w-full px-3 py-1.5 bg-black/40 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-600 focus:outline-none"
              placeholder="Nom"
              value={entry.name}
              onChange={(e) => update(i, 'name', e.target.value)}
            />
            <textarea
              className="w-full px-3 py-1.5 bg-black/40 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-600 focus:outline-none resize-none"
              placeholder="Description"
              rows={2}
              value={entry.description}
              onChange={(e) => update(i, 'description', e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors mt-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Sub-views ── */

type ViewMode = 'manage' | 'search' | 'create';

/* ── Main Component ── */

export function FamiliarModal({ playerId, familiar, onClose, onSave }: FamiliarModalProps) {
  const [view, setView] = useState<ViewMode>(familiar ? 'manage' : 'search');
  const [currentFamiliar, setCurrentFamiliar] = useState<FamiliarData | null>(familiar);
  const [hpDelta, setHpDelta] = useState('');
  const [saving, setSaving] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [monsterList, setMonsterList] = useState<MonsterListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [expandedMonster, setExpandedMonster] = useState<Monster | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create state
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('Bête');
  const [createSize, setCreateSize] = useState('TP');
  const [createAc, setCreateAc] = useState(12);
  const [createHp, setCreateHp] = useState(5);
  const [createSpeed, setCreateSpeed] = useState('9 m');
  const [createAbilities, setCreateAbilities] = useState<MonsterAbilities>({
    str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7,
  });
  const [createSenses, setCreateSenses] = useState('');
  const [createLanguages, setCreateLanguages] = useState('');
  const [createCr, setCreateCr] = useState('0');
  const [createTraits, setCreateTraits] = useState<MonsterEntry[]>([]);
  const [createActions, setCreateActions] = useState<MonsterEntry[]>([{ name: '', description: '' }]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Load monster list on search view
  useEffect(() => {
    if (view === 'search' && monsterList.length === 0) {
      loadMonsterList();
    }
  }, [view]);

  const loadMonsterList = async () => {
    try {
      setLoadingList(true);
      const list = await monsterService.fetchMonsterList();
      setMonsterList(list);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger le bestiaire');
    } finally {
      setLoadingList(false);
    }
  };

  const filteredMonsters = monsterList.filter((m) => {
    if (!query.trim()) return true;
    return m.name.toLowerCase().includes(query.toLowerCase().trim());
  }).slice(0, 50);

  const handleExpandMonster = async (m: MonsterListItem) => {
    if (expandedSlug === m.slug) {
      setExpandedSlug(null);
      setExpandedMonster(null);
      return;
    }
    setExpandedSlug(m.slug);
    setExpandedMonster(null);
    setLoadingDetail(true);
    try {
      const detail = await monsterService.fetchMonsterDetail(m.slug);
      setExpandedMonster(detail);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger les détails');
      setExpandedSlug(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const selectMonsterAsFamiliar = (monster: Monster) => {
    const fam: FamiliarData = {
      name: monster.name,
      slug: monster.slug,
      source: monster.source || 'aidedd',
      type: monster.type,
      size: monster.size,
      armor_class: monster.armor_class,
      hit_points: monster.hit_points,
      max_hp: monster.hit_points,
      current_hp: monster.hit_points,
      speed: monster.speed,
      abilities: monster.abilities,
      senses: monster.senses,
      languages: monster.languages,
      challenge_rating: monster.challenge_rating,
      traits: monster.traits || [],
      actions: monster.actions || [],
      saving_throws: monster.saving_throws,
      skills: monster.skills,
    };
    setCurrentFamiliar(fam);
    setView('manage');
    toast.success(`${monster.name} sélectionné comme familier`);
  };

  const handleCreateFamiliar = () => {
    if (!createName.trim()) return;
    const parseSpeed = (): Record<string, string> => {
      const speed: Record<string, string> = {};
      const parts = createSpeed.split(',').map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const named = part.match(/^(nage|vol|fouissement|escalade|creusement)\s+(.+)$/i);
        if (named) {
          speed[named[1].toLowerCase()] = named[2];
        } else if (!speed['marche']) {
          speed['marche'] = part;
        }
      }
      return speed;
    };

    const fam: FamiliarData = {
      name: createName.trim(),
      slug: createName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      source: 'custom',
      type: createType,
      size: createSize,
      armor_class: createAc,
      hit_points: createHp,
      max_hp: createHp,
      current_hp: createHp,
      speed: parseSpeed(),
      abilities: createAbilities,
      senses: createSenses,
      languages: createLanguages,
      challenge_rating: createCr,
      traits: createTraits.filter((t) => t.name.trim()),
      actions: createActions.filter((a) => a.name.trim()),
    };
    setCurrentFamiliar(fam);
    setView('manage');
    toast.success(`Familier "${createName}" créé`);
  };

  const applyHpChange = (mode: 'damage' | 'heal') => {
    if (!currentFamiliar) return;
    const val = parseInt(hpDelta || '0', 10);
    if (!val || val <= 0) return;
    const newHp = mode === 'damage'
      ? Math.max(0, currentFamiliar.current_hp - val)
      : Math.min(currentFamiliar.max_hp, currentFamiliar.current_hp + val);
    setCurrentFamiliar({ ...currentFamiliar, current_hp: newHp });
    setHpDelta('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await supabase
        .from('players')
        .update({ familiar: currentFamiliar })
        .eq('id', playerId);
      onSave(currentFamiliar);
      toast.success('Familier sauvegardé');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur sauvegarde familier');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFamiliar = async () => {
    try {
      setSaving(true);
      await supabase
        .from('players')
        .update({ familiar: null })
        .eq('id', playerId);
      onSave(null);
      toast.success('Familier retiré');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erreur suppression familier');
    } finally {
      setSaving(false);
    }
  };

  const abilityFields: Array<{ key: keyof MonsterAbilities; label: string }> = [
    { key: 'str', label: 'FOR' },
    { key: 'dex', label: 'DEX' },
    { key: 'con', label: 'CON' },
    { key: 'int', label: 'INT' },
    { key: 'wis', label: 'SAG' },
    { key: 'cha', label: 'CHA' },
  ];

  const sizes = [
    { value: 'TP', label: 'Très petit' },
    { value: 'P', label: 'Petit' },
    { value: 'M', label: 'Moyen' },
  ];

  const hpPct = currentFamiliar && currentFamiliar.max_hp > 0
    ? Math.max(0, Math.min(100, (currentFamiliar.current_hp / currentFamiliar.max_hp) * 100))
    : 0;
  let hpColor = 'bg-emerald-500';
  if (hpPct <= 25) hpColor = 'bg-red-500';
  else if (hpPct <= 50) hpColor = 'bg-amber-500';

  const FAMILIAR_ICON = 'https://pub-34f7ade8969e4687945b58e1d1b80dd8.r2.dev/static/icons/familier.png';

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 10000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
       <div
         className="frame-card--light frame-card--no-frame w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl shadow-xl flex flex-col"
         onClick={(e) => e.stopPropagation()}
       >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <img src={FAMILIAR_ICON} alt="Familier" className="w-7 h-7" />
            <h3 className="text-lg font-semibold text-white">
              {view === 'manage' && currentFamiliar ? currentFamiliar.name : view === 'create' ? 'Créer un familier' : 'Choisir un familier'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 p-2 rounded hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 px-5 shrink-0">
          {currentFamiliar && (
            <button
              onClick={() => setView('manage')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                view === 'manage' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Gérer
            </button>
          )}
          <button
            onClick={() => setView('search')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              view === 'search' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search size={12} className="inline mr-1" /> Rechercher
          </button>
          <button
            onClick={() => setView('create')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              view === 'create' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Plus size={12} className="inline mr-1" /> Créer un familier
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── MANAGE VIEW ── */}
          {view === 'manage' && currentFamiliar && (
            <div className="space-y-4">
              {/* HP management */}
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart size={16} className={currentFamiliar.current_hp <= 0 ? 'text-gray-600' : 'text-red-500'} />
                    <span className="text-white font-semibold">
                      {currentFamiliar.current_hp} / {currentFamiliar.max_hp} PV
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Shield size={14} className="text-gray-400" />
                    <span className="text-gray-300 text-sm">CA {currentFamiliar.armor_class}</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${hpColor} transition-all duration-300`} style={{ width: `${hpPct}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-20 px-2 py-1.5 bg-black/40 border border-gray-700 rounded text-sm text-center text-gray-200 focus:border-emerald-600 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                    value={hpDelta}
                    onChange={(e) => setHpDelta(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyHpChange('damage'); }}
                  />
                  <button
                    onClick={() => applyHpChange('damage')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs font-medium rounded-lg border border-red-800/50 transition-colors"
                  >
                    <Minus size={12} /> Dégâts
                  </button>
                  <button
                    onClick={() => applyHpChange('heal')}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-900/40 hover:bg-green-900/60 text-green-300 text-xs font-medium rounded-lg border border-green-800/50 transition-colors"
                  >
                    <Plus size={12} /> Soins
                  </button>
                </div>
              </div>

              {/* Stat block */}
              <MonsterStatBlock
                monster={{
                  name: currentFamiliar.name,
                  slug: currentFamiliar.slug || '',
                  type: currentFamiliar.type,
                  size: currentFamiliar.size,
                  alignment: '',
                  armor_class: currentFamiliar.armor_class,
                  armor_desc: '',
                  hit_points: currentFamiliar.max_hp,
                  hit_points_formula: '',
                  speed: currentFamiliar.speed,
                  abilities: currentFamiliar.abilities,
                  saving_throws: currentFamiliar.saving_throws || '',
                  skills: currentFamiliar.skills || '',
                  vulnerabilities: '',
                  resistances: '',
                  damage_immunities: '',
                  condition_immunities: '',
                  senses: currentFamiliar.senses,
                  languages: currentFamiliar.languages,
                  challenge_rating: currentFamiliar.challenge_rating,
                  xp: 0,
                  traits: currentFamiliar.traits,
                  actions: currentFamiliar.actions,
                  bonus_actions: [],
                  reactions: [],
                  legendary_actions: [],
                  legendary_description: '',
                  source: currentFamiliar.source,
                }}
              />

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Sauvegarder
                </button>
                <button
                  onClick={handleRemoveFamiliar}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 text-red-300 font-medium rounded-lg border border-red-800/50 transition-colors"
                >
                  <Trash2 size={14} /> Retirer
                </button>
              </div>
            </div>
          )}

          {/* ── SEARCH VIEW ── */}
          {view === 'search' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="w-full pl-9 pr-8 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-600 focus:outline-none transition-colors"
                  placeholder="Rechercher un monstre pour familier..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {loadingList ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  Chargement du bestiaire...
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900">
                  {filteredMonsters.length === 0 ? (
                    <div className="py-6 text-center text-gray-500 text-sm">Aucun résultat</div>
                  ) : (
                    filteredMonsters.map((m) => {
                      const isExpanded = expandedSlug === m.slug;
                      return (
                        <div key={m.slug} className="border-b border-gray-800 last:border-b-0">
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer ${
                              isExpanded ? 'bg-emerald-900/20' : 'hover:bg-gray-800'
                            }`}
                            onClick={() => handleExpandMonster(m)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-200 truncate">{m.name}</span>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-xs bg-emerald-900/50 text-emerald-300 px-2 py-0.5 rounded-full">
                                    FP {m.cr}
                                  </span>
                                  {isExpanded ? <ChevronUp size={14} className="text-emerald-400" /> : <ChevronDown size={14} className="text-gray-500" />}
                                </div>
                              </div>
                              <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                                <span>{m.type}</span>
                                <span>{m.size}</span>
                                {m.ac && <span>CA {m.ac}</span>}
                                {m.hp && <span>PV {m.hp}</span>}
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 space-y-3">
                              {loadingDetail ? (
                                <div className="flex items-center justify-center py-6 text-gray-400">
                                  <Loader2 size={18} className="animate-spin mr-2" />
                                </div>
                              ) : expandedMonster ? (
                                <>
                                  <MonsterStatBlock monster={expandedMonster} />
                                  <button
                                    onClick={() => selectMonsterAsFamiliar(expandedMonster)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
                                  >
                                    <img src={FAMILIAR_ICON} alt="" className="w-4 h-4" />
                                    Choisir comme familier
                                  </button>
                                </>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── CREATE VIEW ── */}
          {view === 'create' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nom du familier *</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Ex: Hibou, Chat, Serpent..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Type</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    placeholder="Ex: Bête, Fée, Céleste..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Taille</label>
                  <select
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createSize}
                    onChange={(e) => setCreateSize(e.target.value)}
                  >
                    {sizes.map((s) => (
                      <option key={s.value} value={s.value}>{s.label} ({s.value})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">FP</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createCr}
                    onChange={(e) => setCreateCr(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">CA</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createAc}
                    onChange={(e) => setCreateAc(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">PV</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createHp}
                    onChange={(e) => setCreateHp(parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Vitesse</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createSpeed}
                    onChange={(e) => setCreateSpeed(e.target.value)}
                    placeholder="9 m, vol 18 m"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Caractéristiques</label>
                <div className="grid grid-cols-6 gap-2">
                  {abilityFields.map(({ key, label }) => (
                    <div key={key} className="text-center">
                      <div className="text-xs text-emerald-400 font-bold mb-1">{label}</div>
                      <input
                        type="number"
                        className="w-full px-1 py-2 bg-black/40 border border-gray-700 rounded text-center text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                        value={createAbilities[key]}
                        onChange={(e) => setCreateAbilities((prev) => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                      />
                      <div className="text-xs text-gray-500 mt-0.5">{mod(createAbilities[key])}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sens</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createSenses}
                    onChange={(e) => setCreateSenses(e.target.value)}
                    placeholder="vision dans le noir 36 m"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Langues</label>
                  <input
                    className="w-full px-3 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-emerald-600 focus:outline-none"
                    value={createLanguages}
                    onChange={(e) => setCreateLanguages(e.target.value)}
                    placeholder="comprend le commun"
                  />
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4 space-y-4">
                <DynamicEntryList label="Traits" entries={createTraits} onChange={setCreateTraits} />
                <DynamicEntryList label="Actions" entries={createActions} onChange={setCreateActions} />
              </div>

              <button
                onClick={handleCreateFamiliar}
                disabled={!createName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Créer le familier
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}