import { useState, useMemo } from 'react';
import { Plus, Search, Package, Send, Settings, Trash2 } from 'lucide-react';
import { CampaignMember, CampaignInventoryItem } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { META_PREFIX, parseMeta, getVisibleDescription } from '../utils/metaParser';
import { CustomItemModal } from '../../modals/CustomItemModal';
import { EquipmentListModal } from '../../modals/EquipmentListModal';
import { EditCampaignItemModal } from '../modals/EditCampaignItemModal';
import { QuickSendItemModal } from '../modals/QuickSendItemModal';
import toast from 'react-hot-toast';

interface InventoryTabProps {
  campaignId: string;
  inventory: CampaignInventoryItem[];
  members: CampaignMember[];
  onReload: () => void;
}

export function InventoryTab({ campaignId, inventory, members, onReload }: InventoryTabProps) {
  const [showList, setShowList] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [editingItem, setEditingItem] = useState<CampaignInventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickSendItem, setQuickSendItem] = useState<CampaignInventoryItem | null>(null);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q)
    );
  }, [inventory, searchQuery]);

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Supprimer cet objet de l\'inventaire de campagne ?')) return;
    try {
      await campaignService.deleteCampaignItem(itemId);
      toast.success('Objet supprimé');
      onReload();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-semibold text-white">Inventaire de la campagne</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowList(true)} className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={20} />
            Liste d'équipement
          </button>
          <button onClick={() => setShowCustom(true)} className="px-4 py-2 rounded-lg border border-gray-600 hover:bg-gray-700/40 text-gray-200 flex items-center gap-2">
            <Plus size={18} />
            Objet personnalisé
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Search className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher dans l'inventaire..."
          className="input-dark flex-1 px-4 py-2 rounded-lg"
        />
      </div>

      {filteredInventory.length === 0 ? (
        <div className="text-center py-12 bg-gray-900/30 rounded-lg border-2 border-dashed border-gray-700">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            {searchQuery ? 'Aucun résultat' : 'Inventaire vide'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? 'Aucun objet ne correspond à votre recherche' : 'Ajoutez des objets pour créer votre inventaire de campagne'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowList(true)} className="btn-primary px-6 py-3 rounded-lg inline-flex items-center gap-2">
              <Plus size={20} />
              Ajouter un objet
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInventory.map((item) => {
            const meta = parseMeta(item.description);
            return (
              <div key={item.id} className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-lg p-4 hover:bg-gray-800/60 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  {meta?.imageUrl && (
                    <img src={meta.imageUrl} alt={item.name} className="w-16 h-16 rounded object-cover border border-gray-600/50 mr-3 flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-white truncate">{item.name}</h3>
                      {meta?.type === 'armor' && <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">Armure</span>}
                      {meta?.type === 'shield' && <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">Bouclier</span>}
                      {meta?.type === 'weapon' && <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">Arme</span>}
                    </div>
                    {item.quantity > 1 && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300 mt-1 inline-block">x{item.quantity}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQuickSendItem(item)} className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/30 rounded" title="Envoyer aux joueurs"><Send size={16} /></button>
                    <button onClick={() => setEditingItem(item)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded" title="Modifier"><Settings size={16} /></button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/30 rounded" title="Supprimer"><Trash2 size={16} /></button>
                  </div>
                </div>

                {meta && (
                  <div className="mb-2 space-y-1 text-xs">
                    {meta.type === 'armor' && meta.armor && <div className="text-purple-300">CA: {meta.armor.label}</div>}
                    {meta.type === 'shield' && meta.shield && <div className="text-blue-300">Bonus: +{meta.shield.bonus}</div>}
                    {meta.type === 'weapon' && meta.weapon && (
                      <div className="text-red-300">{meta.weapon.damageDice} {meta.weapon.damageType}{meta.weapon.properties && ` - ${meta.weapon.properties}`}</div>
                    )}
                  </div>
                )}

                {getVisibleDescription(item.description) && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{getVisibleDescription(item.description)}</p>
                )}

                <div className="mt-3 text-xs text-gray-500">
                  Ajouté le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showList && (
        <EquipmentListModal
          onClose={() => { setShowList(false); onReload(); }}
          onAddItem={async (payload) => {
            try {
              const metaLine = `${META_PREFIX}${JSON.stringify(payload.meta)}`;
              const visibleDesc = (payload.description || '').trim();
              const fullDescription = visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
              await campaignService.addItemToCampaign(campaignId, payload.name, fullDescription, payload.meta.quantity || 1);
            } catch (error) {
              console.error(error);
              toast.error('Erreur lors de l\'ajout');
              throw error;
            }
          }}
          allowedKinds={null}
          multiAdd={true}
        />
      )}

      {showCustom && (
        <CustomItemModal
          onClose={() => setShowCustom(false)}
          onAdd={async (payload) => {
            try {
              const metaLine = `${META_PREFIX}${JSON.stringify(payload.meta)}`;
              const visibleDesc = (payload.description || '').trim();
              const fullDescription = visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
              await campaignService.addItemToCampaign(campaignId, payload.name, fullDescription, payload.meta.quantity || 1);
              toast.success('Objet personnalisé ajouté');
              onReload();
            } catch (error) {
              console.error(error);
              toast.error('Erreur lors de l\'ajout');
            } finally {
              setShowCustom(false);
            }
          }}
        />
      )}

      {editingItem && (
        <EditCampaignItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); onReload(); }}
        />
      )}

      {quickSendItem && (
        <QuickSendItemModal
          campaignId={campaignId}
          item={quickSendItem}
          members={members}
          onClose={() => setQuickSendItem(null)}
          onSent={() => { setQuickSendItem(null); onReload(); }}
        />
      )}
    </div>
  );
}
