import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Plus, Check, Package, Sword, Shield, Shirt, Wrench } from 'lucide-react';
import { loadEquipmentCatalogs } from '../../../services/equipmentLookupService';

type CatalogKind = 'armors' | 'shields' | 'weapons' | 'adventuring_gear' | 'tools';

interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  description?: string;
}

interface EquipmentCatalogPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (items: string[]) => void;
  selectedItems: string[];
  title?: string;
}

const KIND_LABELS: Record<CatalogKind, { label: string; icon: React.ReactNode; color: string }> = {
  armors: { label: 'Armures', icon: <Shirt size={14} />, color: 'bg-purple-900/30 text-purple-300' },
  shields: { label: 'Boucliers', icon: <Shield size={14} />, color: 'bg-blue-900/30 text-blue-300' },
  weapons: { label: 'Armes', icon: <Sword size={14} />, color: 'bg-red-900/30 text-red-300' },
  adventuring_gear: { label: 'Équipement', icon: <Package size={14} />, color: 'bg-gray-800/60 text-gray-300' },
  tools: { label: 'Outils', icon: <Wrench size={14} />, color: 'bg-teal-900/30 text-teal-300' },
};

export default function EquipmentCatalogPicker({
  open,
  onClose,
  onSelect,
  selectedItems,
  title = "Sélectionner des équipements"
}: EquipmentCatalogPickerProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<CatalogKind | 'all'>('all');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedItems);

  // Charger le catalogue au montage
  useEffect(() => {
    if (!open) return;
    
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const items = await loadEquipmentCatalogs();
        setCatalog(items as CatalogItem[]);
      } catch (e) {
        console.error('Erreur chargement catalogue:', e);
        setError('Impossible de charger le catalogue d\'équipements');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [open]);

  // Synchroniser avec les items sélectionnés externes
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedItems);
    }
  }, [open, selectedItems]);

  // Filtrer le catalogue
  const filteredCatalog = useMemo(() => {
    let items = catalog;
    
    // Filtre par type
    if (kindFilter !== 'all') {
      items = items.filter(item => item.kind === kindFilter);
    }
    
    // Filtre par recherche
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item => 
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    }
    
    return items;
  }, [catalog, kindFilter, searchQuery]);

  // Toggle un item
  const toggleItem = (itemName: string) => {
    setLocalSelected(prev => {
      if (prev.includes(itemName)) {
        return prev.filter(n => n !== itemName);
      } else {
        return [...prev, itemName];
      }
    });
  };

  // Valider la sélection
  const handleConfirm = () => {
    onSelect(localSelected);
    onClose();
  };

  if (!open) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 10000 }}
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden bg-gray-900 border border-gray-800 rounded-xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-green-400" />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {localSelected.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/30 text-green-300">
                {localSelected.length} sélectionné{localSelected.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barre de recherche et filtres */}
        <div className="px-5 py-3 border-b border-gray-800 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un équipement..."
              className="input-dark w-full px-3 py-2 rounded-md"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                kindFilter === 'all'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Tout
            </button>
            {(Object.keys(KIND_LABELS) as CatalogKind[]).map(kind => (
              <button
                key={kind}
                onClick={() => setKindFilter(kind)}
                className={`px-3 py-1 rounded-md text-sm transition-colors flex items-center gap-1 ${
                  kindFilter === kind
                    ? KIND_LABELS[kind].color + ' border border-current'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {KIND_LABELS[kind].icon}
                {KIND_LABELS[kind].label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste des équipements */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-2 border-gray-600 border-t-green-500 rounded-full mx-auto mb-3" />
              <p className="text-gray-400">Chargement du catalogue...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400">{error}</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? `Aucun résultat pour "${searchQuery}"` : 'Aucun équipement disponible'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredCatalog.map(item => {
                const isSelected = localSelected.includes(item.name);
                const kindInfo = KIND_LABELS[item.kind];
                
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.name)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-green-500/50 bg-green-900/20'
                        : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-100 font-medium truncate">
                            {item.name}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${kindInfo.color} flex items-center gap-1`}>
                            {kindInfo.icon}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-600'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-800 flex-shrink-0">
          <div className="text-sm text-gray-400">
            {localSelected.length} équipement{localSelected.length > 1 ? 's' : ''} sélectionné{localSelected.length > 1 ? 's' : ''}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Valider ({localSelected.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}