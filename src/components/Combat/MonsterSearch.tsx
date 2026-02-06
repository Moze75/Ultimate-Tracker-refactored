import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Loader2, X, Filter, ChevronDown, Check, Plus, Minus } from 'lucide-react';
import { MonsterListItem } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import toast from 'react-hot-toast';

interface SelectedMonsterEntry {
  monster: MonsterListItem;
  quantity: number;
}

interface MonsterSearchProps {
  onSelect?: (item: MonsterListItem) => void;
  onAddToCombat?: (entries: SelectedMonsterEntry[]) => void;
  selectionMode?: boolean;
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

export function MonsterSearch({ onSelect, onAddToCombat, selectionMode = false }: MonsterSearchProps) {
  const [query, setQuery] = useState('');
  const [allMonsters, setAllMonsters] = useState<MonsterListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [crFilter, setCrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    try {
      setLoading(true);
      const list = await monsterService.fetchMonsterList();
      setAllMonsters(list);
    } catch (err) {
      console.error(err);
      toast.error('Impossible de charger le bestiaire AideDD');
    } finally {
      setLoading(false);
    }
  };

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

    return result.slice(0, 50);
  }, [allMonsters, query, crFilter, typeFilter]);

  const clearFilters = () => {
    setQuery('');
    setCrFilter('');
    setTypeFilter('');
  };

  const hasActiveFilters = crFilter || typeFilter || query;

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
            showFilters || crFilter || typeFilter
              ? 'bg-amber-900/30 border-amber-700 text-amber-300'
              : 'bg-black/40 border-gray-700 text-gray-400 hover:text-gray-300'
          }`}
        >
          <Filter size={14} />
          <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-gray-500 mb-1">FP</label>
            <select
              className="w-full px-2 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
              value={crFilter}
              onChange={(e) => setCrFilter(e.target.value)}
            >
              <option value="">Tous</option>
              {CR_OPTIONS.map((cr) => (
                <option key={cr} value={cr}>FP {cr}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              className="w-full px-2 py-2 bg-black/40 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-amber-600 focus:outline-none"
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
        <div className="flex items-center gap-3 px-3 py-2.5 bg-red-900/20 border border-red-800/40 rounded-lg">
          <span className="text-sm text-red-300 font-medium flex-1">
            {selected.size} monstre{selected.size > 1 ? 's' : ''} ({totalSelected} au total)
          </span>
          <button
            onClick={() => setSelected(new Map())}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Tout deselectionner
          </button>
          <button
            onClick={handleAddToCombat}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
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
        <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-800 divide-y divide-gray-800/50">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              {allMonsters.length === 0
                ? 'Aucun monstre charge'
                : 'Aucun resultat'}
            </div>
          ) : (
            filtered.map((m) => {
              const isSelected = selected.has(m.slug);
              const qty = selected.get(m.slug) || 1;

              return (
                <div
                  key={m.slug}
                  className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                    isSelected
                      ? 'bg-red-900/15 hover:bg-red-900/25'
                      : 'hover:bg-amber-900/15'
                  }`}
                >
                  {selectionMode && (
                    <button
                      onClick={() => toggleSelect(m.slug)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'bg-red-600 border-red-500 text-white'
                          : 'border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {isSelected && <Check size={12} />}
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelect(m.slug);
                      } else if (onSelect) {
                        onSelect(m);
                      }
                    }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {m.name}
                      </span>
                      <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full shrink-0 ml-2">
                        FP {m.cr}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                      <span>{m.type}</span>
                      <span>{m.size}</span>
                      {m.ac && <span>CA {m.ac}</span>}
                      {m.hp && <span>PV {m.hp}</span>}
                    </div>
                  </button>

                  {selectionMode && isSelected && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => updateQuantity(m.slug, qty - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-red-300">{qty}</span>
                      <button
                        onClick={() => updateQuantity(m.slug, qty + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="text-xs text-gray-600 text-right">
        {allMonsters.length > 0 && (
          <span>{filtered.length} / {allMonsters.length} monstres</span>
        )}
      </div>
    </div>
  );
}

export type { SelectedMonsterEntry };
