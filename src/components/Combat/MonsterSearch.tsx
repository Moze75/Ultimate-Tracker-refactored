import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Loader2, X, Filter, ChevronDown, Check, Plus, Minus, ChevronUp, Edit3, Trash2 } from 'lucide-react';
import { MonsterListItem, Monster } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import { MonsterStatBlock, DiceRollData } from './MonsterStatBlock';
import toast from 'react-hot-toast';

interface SelectedMonsterEntry {
  monster: MonsterListItem;
  quantity: number;
}

interface MonsterSearchProps {
  onSelect?: (item: MonsterListItem) => void;
  onAddToCombat?: (entries: SelectedMonsterEntry[]) => void;
  selectionMode?: boolean;
  savedMonsters?: Monster[];
  onEditMonster?: (monster: Monster) => void;
  onDeleteMonster?: (id: string) => void;
  onRollDice?: (data: DiceRollData) => void;
}

const CR_OPTIONS = [
  '0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23',
  '24', '25', '26', '27', '28', '29', '30',
];

const TYPE_OPTIONS = [
  'Aberration', 'Bete', 'Celeste', 'Construction', 'Dragon', 'Elementaire',
  'Fee', 'Fielin', 'Geant', 'Humanoide', 'Monstruosite', 'Mort-vivant',
  'Plante', 'Vase',
];

const SOURCE_OPTIONS = ['Tous', 'AideDD', 'Custom'];

export function MonsterSearch({
  onSelect,
  onAddToCombat,
  selectionMode = false,
  savedMonsters = [],
  onEditMonster,
  onDeleteMonster,
  onRollDice,
}: MonsterSearchProps) {
  const [query, setQuery] = useState('');
  const [aideDDMonsters, setAideDDMonsters] = useState<MonsterListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [crFilter, setCrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Tous');
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [expandedMonster, setExpandedMonster] = useState<Monster | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      setLoading(true);
      const list = await monsterService.fetchMonsterList();
      setAideDDMonsters(list);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger le bestiaire AideDD');
    } finally {
      setLoading(false);
    }
  };

  const allMonsters = useMemo(() => {
    const customListItems: MonsterListItem[] = savedMonsters
      .filter(m => m.source === 'custom')
      .map(m => ({
        slug: m.slug || `custom-${m.id}`,
        name: m.name,
        type: m.type || '',
        size: m.size || '',
        cr: m.challenge_rating || '0',
        ac: m.armor_class,
        hp: m.hit_points,
        source: 'custom' as const,
        id: m.id,
      }));

    return [...aideDDMonsters, ...customListItems];
  }, [aideDDMonsters, savedMonsters]);

  const filtered = useMemo(() => {
    let result = allMonsters;

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter((m) => m.name.toLowerCase().includes(q));
    }

    if (crFilter) {
      result = result.filter((m) => m.cr === crFilter);
    }

    if (typeFilter) {
      const t = typeFilter.toLowerCase();
      result = result.filter((m) => m.type.toLowerCase().includes(t));
    }

    if (sourceFilter !== 'Tous') {
      if (sourceFilter === 'Custom') {
        result = result.filter((m) => m.source === 'custom');
      } else if (sourceFilter === 'AideDD') {
        result = result.filter((m) => !m.source || m.source === 'aidedd');
      }
    }

    return result;
  }, [allMonsters, query, crFilter, typeFilter, sourceFilter]);

  const displayedMonsters = useMemo(() => {
    return filtered.slice(0, displayLimit);
  }, [filtered, displayLimit]);

  const hasMore = displayedMonsters.length < filtered.length;

  useEffect(() => {
    setDisplayLimit(50);
  }, [query, crFilter, typeFilter, sourceFilter]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (scrollBottom < 100 && hasMore) {
      setDisplayLimit(prev => Math.min(prev + 50, filtered.length));
    }
  }, [hasMore, filtered.length]);

  const clearFilters = () => {
    setQuery('');
    setCrFilter('');
    setTypeFilter('');
    setSourceFilter('Tous');
  };

  const hasActiveFilters = crFilter || typeFilter || query || sourceFilter !== 'Tous';

  const toggleSelect = (slug: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.set(slug, 1);
      }
      return next;
    });
  };

  const updateQuantity = (slug: string, qty: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(slug, Math.max(1, Math.min(20, qty)));
      return next;
    });
  };

  const handleAddToCombat = () => {
    if (!onAddToCombat || selected.size === 0) return;
    const entries: SelectedMonsterEntry[] = [];
    selected.forEach((quantity, slug) => {
      const monster = allMonsters.find((m) => m.slug === slug);
      if (monster) entries.push({ monster, quantity });
    });
    onAddToCombat(entries);
    setSelected(new Map());
  };

  const handleExpandMonster = async (m: MonsterListItem) => {
    const identifier = m.slug || `custom-${m.id}`;

    if (expandedSlug === identifier) {
      setExpandedSlug(null);
      setExpandedMonster(null);
      return;
    }

    setExpandedSlug(identifier);
    setExpandedMonster(null);
    setLoadingDetail(true);

    try {
      if (m.source === 'custom' && m.id) {
        const customMonster = savedMonsters.find(sm => sm.id === m.id);
        if (customMonster) {
          setExpandedMonster(customMonster);
        } else {
          throw new Error('Monstre custom introuvable');
        }
      } else {
        const detail = await monsterService.fetchMonsterDetail(m.slug);
        setExpandedMonster(detail);
      }
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger les details');
      setExpandedSlug(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const totalSelected = Array.from(selected.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            ref={inputRef}
            className="w-full pl-9 pr-8 py-2.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none transition-colors"
            placeholder="Rechercher un monstre..."
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
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
            showFilters || crFilter || typeFilter || sourceFilter !== 'Tous'
              ? 'bg-amber-900/30 border-amber-700 text-amber-300'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-gray-300'
          }`}
        >
          <Filter size={14} />
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs text-gray-500 mb-1">Source</label>
            <select
              className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              {SOURCE_OPTIONS.map((src) => (
                <option key={src} value={src}>{src}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs text-gray-500 mb-1">FP</label>
            <select
              className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
              value={crFilter}
              onChange={(e) => setCrFilter(e.target.value)}
            >
              <option value="">Tous</option>
              {CR_OPTIONS.map((cr) => (
                <option key={cr} value={cr}>FP {cr}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              className="w-full px-2 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Tous</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Effacer filtres
            </button>
          )}
        </div>
      )}

      {selectionMode && selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-900/40 border border-red-800/50 rounded-lg">
          <button
            onClick={() => setSelected(new Map())}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          > 
            Tout deselectionner
          </button>
          <button
            onClick={handleAddToCombat}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} /> Ajouter au combat
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Chargement du bestiaire...
        </div>
      ) : (
        <div
          ref={listContainerRef}
          onScroll={handleScroll}
                     className="max-h-[500px] overflow-y-auto rounded-lg border border-[rgba(212,170,96,0.45)] bg-[rgba(20,16,12,0.35)]"
        >
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              {allMonsters.length === 0
                ? 'Aucun monstre charge'
                : 'Aucun resultat'}
            </div>
          ) : (
            <>
            {displayedMonsters.map((m) => {
              const identifier = m.slug || `custom-${m.id}`;
              const isSelected = selected.has(identifier);
              const isExpanded = expandedSlug === identifier;
              const qty = selected.get(identifier) || 1;
              const isCustom = m.source === 'custom';

              return (
                <div key={identifier} className="border-b border-gray-800 last:border-b-0 group">
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      isSelected
                        ? 'bg-red-900/30'
                        : isExpanded
                        ? 'bg-amber-900/20'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    {selectionMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(identifier); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'bg-red-600 border-red-500 text-white'
                            : 'border-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {isSelected && <Check size={12} />}
                      </button>
                    )}

                    <button
                      onClick={() => handleExpandMonster(m)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200 hover:text-amber-300 truncate transition-colors">
                          {m.name}
                          {isCustom && (
                            <span className="ml-2 text-[10px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded">
                              Custom
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded-full">
                            FP {m.cr}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={14} className="text-amber-400" />
                          ) : (
                            <ChevronDown size={14} className="text-gray-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                        <span>{m.type}</span>
                        <span>{m.size}</span>
                        {m.ac && <span>CA {m.ac}</span>}
                        {m.hp && <span>PV {m.hp}</span>}
                      </div>
                    </button>

                    {isCustom && onEditMonster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const fullMonster = savedMonsters.find(sm => sm.id === m.id);
                          if (fullMonster) onEditMonster(fullMonster);
                        }}
                        className="p-1.5 text-gray-400 hover:text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Editer"
                      >
                        <Edit3 size={12} />
                      </button>
                    )}

                    {isCustom && onDeleteMonster && m.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Supprimer ${m.name} ?`)) {
                            onDeleteMonster(m.id!);
                          }
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {selectionMode && isSelected && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(identifier, qty - 1); }}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-red-300">{qty}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); updateQuantity(identifier, qty + 1); }}
                          className="w-6 h-6 flex items-center justify-center rounded bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 transition-colors"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1">
                      {loadingDetail ? (
                        <div className="flex items-center justify-center py-6 text-gray-400">
                          <Loader2 size={18} className="animate-spin mr-2" />
                          Chargement...
                        </div>
                      ) : expandedMonster ? (
                        <MonsterStatBlock monster={expandedMonster} onRollDice={onRollDice} />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <div className="py-3 text-center text-gray-500 text-xs">
                Scrollez pour voir plus ({filtered.length - displayedMonsters.length} restants)
              </div>
            )}
            </>
          )}
        </div>
      )}

      <div className="text-xs text-gray-600 text-right">
        {allMonsters.length > 0 && (
          <span>
            {displayedMonsters.length === filtered.length
              ? `${filtered.length} monstres`
              : `${displayedMonsters.length} / ${filtered.length} monstres affiches`
            }
            {filtered.length < allMonsters.length && ` (${allMonsters.length} total)`}
          </span>
        )}
      </div>
    </div>
  );
}

export type { SelectedMonsterEntry };
