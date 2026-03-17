import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, Loader2, X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { MonsterListItem, Monster } from '../../types/campaign';
import { monsterService } from '../../services/monsterService';
import { MonsterStatBlock } from '../Combat/MonsterStatBlock';
import toast from 'react-hot-toast';

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

interface VTTMonsterBestiaryProps {
  onAddAsToken?: (monster: MonsterListItem, detail: Monster | null) => void;
}

export function VTTMonsterBestiary({ onAddAsToken }: VTTMonsterBestiaryProps) {
  const [query, setQuery] = useState('');
  const [monsters, setMonsters] = useState<MonsterListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [crFilter, setCrFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [expandedMonster, setExpandedMonster] = useState<Monster | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(50);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await monsterService.fetchMonsterList();
        setMonsters(list);
      } catch {
        toast.error('Impossible de charger le bestiaire');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    let result = monsters;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(q));
    }
    if (crFilter) result = result.filter(m => m.cr === crFilter);
    if (typeFilter) result = result.filter(m => m.type.toLowerCase().includes(typeFilter.toLowerCase()));
    return result;
  }, [monsters, query, crFilter, typeFilter]);

  const displayed = useMemo(() => filtered.slice(0, displayLimit), [filtered, displayLimit]);
  const hasMore = displayed.length < filtered.length;

  useEffect(() => { setDisplayLimit(50); }, [query, crFilter, typeFilter]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const t = e.currentTarget;
    if (t.scrollHeight - t.scrollTop - t.clientHeight < 80 && hasMore) {
      setDisplayLimit(prev => Math.min(prev + 50, filtered.length));
    }
  }, [hasMore, filtered.length]);

  const handleExpand = async (m: MonsterListItem) => {
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
    } catch {
      toast.error('Impossible de charger les details');
      setExpandedSlug(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, m: MonsterListItem) => {
    // -------------------
    // Construction du token au drag
    // -------------------
    // On transmet toujours le monsterSlug dans le dataTransfer.
    // Si le detail est déjà chargé (monstre expand), on inclut
    // directement l'image_url. Sinon, VTTPage.tsx résoudra
    // l'image en arrière-plan via le monsterSlug après le drop,
    // et mettra à jour le token via vttService UPDATE_TOKEN.
    const imageUrl = (expandedSlug === m.slug && expandedMonster?.image_url)
      ? expandedMonster.image_url
      : null;

    const tokenData = {
      label: m.name,
      monsterSlug: m.slug || undefined,
      imageUrl,
      // -------------------
      // Résolution async demandée si image absente
      // -------------------
      // Ce flag signale à VTTPage qu'il doit résoudre l'image
      // depuis l'API si imageUrl est null.
      needsImageResolve: !imageUrl && !!m.slug,
      color: '#ef4444',
      hp: typeof m.hp === 'number' ? m.hp : parseInt(String(m.hp ?? '0')) || 10,
      maxHp: typeof m.hp === 'number' ? m.hp : parseInt(String(m.hp ?? '0')) || 10,
      size: 1,
    };
    e.dataTransfer.setData('application/vtt-new-token', JSON.stringify(tokenData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const hasActiveFilters = crFilter || typeFilter || query;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-2 pt-2 pb-1 space-y-1.5 shrink-0">
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-6 pr-6 py-1.5 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-200 placeholder-gray-500 focus:border-amber-600 focus:outline-none transition-colors"
              placeholder="Rechercher..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={11} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-0.5 px-2 py-1.5 rounded border text-[11px] transition-colors ${
              showFilters || crFilter || typeFilter
                ? 'bg-amber-900/30 border-amber-700 text-amber-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
            }`}
          >
            <Filter size={11} />
            <ChevronDown size={10} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-1">
            <select
              className="flex-1 px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-200 focus:border-amber-600 focus:outline-none [&>option]:bg-gray-800"
              value={crFilter}
              onChange={e => setCrFilter(e.target.value)}
            >
              <option value="">FP tous</option>
              {CR_OPTIONS.map(cr => <option key={cr} value={cr}>FP {cr}</option>)}
            </select>
            <select
              className="flex-1 px-1.5 py-1 bg-gray-800 border border-gray-700 rounded text-[11px] text-gray-200 focus:border-amber-600 focus:outline-none [&>option]:bg-gray-800"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="">Type tous</option>
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {hasActiveFilters && (
              <button
                onClick={() => { setQuery(''); setCrFilter(''); setTypeFilter(''); }}
                className="px-1.5 py-1 text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                <X size={10} />
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
          <Loader2 size={14} className="animate-spin" />
          Chargement...
        </div>
      ) : (
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        >
          {filtered.length === 0 ? (
            <p className="text-[11px] text-gray-500 text-center py-4">
              {monsters.length === 0 ? 'Aucun monstre' : 'Aucun resultat'}
            </p>
          ) : (
            <>
              {displayed.map(m => {
                const isExpanded = expandedSlug === m.slug;
                return (
                  <div
                    key={m.slug}
                    className="border-b border-gray-800/60 last:border-b-0"
                    draggable
                    onDragStart={e => handleDragStart(e, m)}
                  >
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors group ${
                        isExpanded ? 'bg-amber-900/20' : 'hover:bg-gray-800/50'
                      }`}
                      onClick={() => handleExpand(m)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[11px] font-medium text-gray-200 group-hover:text-amber-300 truncate transition-colors">
                            {m.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[9px] bg-amber-900/50 text-amber-300 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              FP {m.cr}
                            </span>
                            {isExpanded
                              ? <ChevronUp size={11} className="text-amber-400" />
                              : <ChevronDown size={11} className="text-gray-500" />
                            }
                          </div>
                        </div>
                        <div className="flex gap-2 text-[9px] text-gray-500 mt-0.5">
                          {m.type && <span>{m.type}</span>}
                          {m.hp && <span>PV {m.hp}</span>}
                          {m.ac && <span>CA {m.ac}</span>}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-2 pb-2 pt-1 bg-gray-900/40">
                        {loadingDetail ? (
                          <div className="flex items-center justify-center py-4 text-gray-400 text-xs gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            Chargement...
                          </div>
                        ) : expandedMonster ? (
                          <div>
                            {onAddAsToken && (
                              <button
                                onClick={e => { e.stopPropagation(); onAddAsToken(m, expandedMonster); }}
                                className="w-full mb-2 px-2 py-1.5 bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium rounded transition-colors"
                              >
                                + Ajouter comme token
                              </button>
                            )}
                            <MonsterStatBlock monster={expandedMonster} />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <p className="py-2 text-center text-[10px] text-gray-500">
                  Scrollez pour voir plus ({filtered.length - displayed.length} restants)
                </p>
              )}
            </>
          )}
        </div>
      )}

      {monsters.length > 0 && (
        <div className="px-2 py-1 text-[10px] text-gray-600 text-right shrink-0 border-t border-gray-800/50">
          {displayed.length === filtered.length
            ? `${filtered.length} monstres`
            : `${displayed.length} / ${filtered.length}`}
          {filtered.length < monsters.length && ` (${monsters.length} total)`}
        </div>
      )}
    </div>
  );
}
