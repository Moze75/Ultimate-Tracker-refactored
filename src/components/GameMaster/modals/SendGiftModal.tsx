import { useState, useEffect } from 'react';
import { X, Send, Package, Coins } from 'lucide-react';
import { CampaignMember, CampaignInventoryItem } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { META_PREFIX, parseMeta, getVisibleDescription } from '../utils/metaParser';
import { useRecipientSelection } from '../hooks/useRecipientSelection';
import toast from 'react-hot-toast';

interface SendGiftModalProps {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
  giftType: 'item' | 'currency';
  onClose: () => void;
  onSent: () => void;
}

export function SendGiftModal({ campaignId, members, inventory, giftType, onClose, onSent }: SendGiftModalProps) {
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [gold, setGold] = useState(0);
  const [silver, setSilver] = useState(0);
  const [copper, setCopper] = useState(0);
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('individual');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [removeFromInventory, setRemoveFromInventory] = useState(true);

  const {
    selectedRecipients,
    setSelectedRecipients,
    selectAllRecipients,
    setSelectAllRecipients,
    toggleRecipient,
  } = useRecipientSelection(members);

  const getFullDescription = (item: CampaignInventoryItem) => {
    if (!item) return '';
    const existingMeta = parseMeta(item.description);
    if (!existingMeta) return item.description || '';
    const visibleDesc = getVisibleDescription(item.description);
    const metaLine = `${META_PREFIX}${JSON.stringify(existingMeta)}`;
    return visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
  };

  const toggleItem = (itemId: string) => {
    const newMap = new Map(selectedItems);
    if (newMap.has(itemId)) {
      newMap.delete(itemId);
    } else {
      newMap.set(itemId, 1);
    }
    setSelectedItems(newMap);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;
    const maxQty = item.quantity;
    const clampedQty = Math.max(1, Math.min(quantity, maxQty));
    const newMap = new Map(selectedItems);
    newMap.set(itemId, clampedQty);
    setSelectedItems(newMap);
  };

  const handleSend = async () => {
    if (distributionMode === 'individual' && selectedRecipients.length === 0) {
      toast.error('Sélectionnez au moins un destinataire');
      return;
    }

    if (giftType === 'item') {
      if (selectedItems.size === 0) {
        toast.error('Sélectionnez au moins un objet');
        return;
      }
    } else {
      if (gold <= 0 && silver <= 0 && copper <= 0) {
        toast.error('Entrez un montant');
        return;
      }
    }

    try {
      setSending(true);
      const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

      if (giftType === 'item') {
        for (const [itemId, quantity] of selectedItems.entries()) {
          const item = inventory.find(i => i.id === itemId);
          if (!item) continue;

          await campaignService.sendGift(campaignId, 'item', {
            itemName: item.name,
            itemDescription: getFullDescription(item),
            itemQuantity: quantity,
            gold: 0,
            silver: 0,
            copper: 0,
            distributionMode,
            message: message.trim() || undefined,
            recipientIds: recipientIds || undefined,
            ...(removeFromInventory ? { inventoryItemId: item.id } : {}),
          });

          if (removeFromInventory) {
            const newQuantity = item.quantity - quantity;
            if (newQuantity > 0) {
              await campaignService.updateCampaignItem(item.id, { quantity: newQuantity });
            } else {
              await campaignService.deleteCampaignItem(item.id);
            }
          }
        }

        const action = removeFromInventory ? 'envoyé' : 'dupliqué et envoyé';
        toast.success(`${selectedItems.size} objet${selectedItems.size > 1 ? 's' : ''} ${action}${selectedItems.size > 1 ? 's' : ''} !`);
      } else {
        await campaignService.sendGift(campaignId, 'currency', {
          gold,
          silver,
          copper,
          distributionMode,
          message: message.trim() || undefined,
          recipientIds: recipientIds || undefined,
        });
      }

      onSent();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {giftType === 'item' ? 'Envoyer des objets' : 'Envoyer de l\'argent'}
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {giftType === 'item' ? (
            <>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">
                    Objets à envoyer ({selectedItems.size} sélectionné{selectedItems.size > 1 ? 's' : ''})
                  </label>
                  {selectedItems.size > 0 && (
                    <button onClick={() => setSelectedItems(new Map())} className="text-xs text-red-400 hover:text-red-300">
                      Tout désélectionner
                    </button>
                  )}
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 bg-gray-800/30 rounded-lg p-3">
                  {inventory.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const selectedQty = selectedItems.get(item.id) || 1;
                    const meta = parseMeta(item.description);

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'bg-purple-900/30 border-purple-500/50'
                            : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-700/40'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {meta?.imageUrl && (
                            <img
                              src={meta.imageUrl}
                              alt={item.name}
                              className="w-12 h-12 rounded object-cover border border-gray-600/50 flex-shrink-0"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          )}

                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleItem(item.id)}
                            className="mt-1 w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-white truncate">{item.name}</h4>
                              {meta?.type === 'armor' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30">Armure</span>
                              )}
                              {meta?.type === 'shield' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-500/30">Bouclier</span>
                              )}
                              {meta?.type === 'weapon' && (
                                <span className="text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-300 border border-red-500/30">Arme</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{item.quantity} disponible{item.quantity > 1 ? 's' : ''}</p>
                            {isSelected && (
                              <div className="mt-2 flex items-center gap-2">
                                <label className="text-xs text-gray-400">Quantité:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={selectedQty}
                                  onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                  className="input-dark w-20 px-2 py-1 text-sm rounded"
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs text-gray-500">/ {item.quantity}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {inventory.length === 0 && (
                    <div className="text-center py-8 text-gray-500">Aucun objet dans l'inventaire</div>
                  )}
                </div>
              </div>

              {selectedItems.size > 0 && (
                <div className="bg-gray-800/30 rounded-lg p-3">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={removeFromInventory}
                      onChange={(e) => setRemoveFromInventory(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                        Supprimer de l'inventaire
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {removeFromInventory
                          ? "Les objets seront retirés de votre inventaire après l'envoi"
                          : "Les objets seront dupliqués et resteront dans votre inventaire"
                        }
                      </div>
                    </div>
                    {!removeFromInventory && (
                      <div className="flex-shrink-0 text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-500/30">
                        Duplication
                      </div>
                    )}
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-yellow-400 mb-2">Or</label>
                  <input type="number" min="0" value={gold} onChange={(e) => setGold(parseInt(e.target.value) || 0)} className="input-dark w-full px-4 py-2 rounded-lg text-center" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Argent</label>
                  <input type="number" min="0" value={silver} onChange={(e) => setSilver(parseInt(e.target.value) || 0)} className="input-dark w-full px-4 py-2 rounded-lg text-center" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-orange-400 mb-2">Cuivre</label>
                  <input type="number" min="0" value={copper} onChange={(e) => setCopper(parseInt(e.target.value) || 0)} className="input-dark w-full px-4 py-2 rounded-lg text-center" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Mode de distribution</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setDistributionMode('individual'); setSelectAllRecipients(false); setSelectedRecipients([]); }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  distributionMode === 'individual'
                    ? 'border-purple-500 bg-purple-900/20 text-white'
                    : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                }`}
              >
                <div className="font-semibold mb-1">Individuel</div>
                <div className="text-xs opacity-80">Envoyer à des destinataires spécifiques</div>
              </button>
              <button
                onClick={() => { setDistributionMode('shared'); setSelectAllRecipients(false); setSelectedRecipients([]); }}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  distributionMode === 'shared'
                    ? 'border-purple-500 bg-purple-900/20 text-white'
                    : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-700/40'
                }`}
              >
                <div className="font-semibold mb-1">Partagé</div>
                <div className="text-xs opacity-80">Visible à tous</div>
              </button>
            </div>
          </div>

          {distributionMode === 'individual' && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-300">Destinataires</div>
                <label className="text-xs text-gray-400 inline-flex items-center gap-2">
                  <input type="checkbox" checked={selectAllRecipients} onChange={(e) => setSelectAllRecipients(e.target.checked)} />
                  <span>Tous</span>
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {members.map((m) => {
                  const uid = m.user_id;
                  if (!uid) return null;
                  return (
                    <label key={uid} className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selectedRecipients.includes(uid)} onChange={() => toggleRecipient(uid)} />
                      <span className="ml-1">{m.player_name || m.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Message (optionnel)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              rows={3}
              placeholder="Ajoutez un message pour les joueurs..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={sending} className="btn-secondary px-6 py-3 rounded-lg">Annuler</button>
          <button
            onClick={handleSend}
            disabled={sending || (giftType === 'item' ? selectedItems.size === 0 : false) || (distributionMode === 'individual' && selectedRecipients.length === 0)}
            className="btn-primary px-6 py-3 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Envoi...
              </>
            ) : (
              <>
                <Send size={18} />
                {giftType === 'item' && selectedItems.size > 0
                  ? `${removeFromInventory ? 'Envoyer' : 'Dupliquer'} ${selectedItems.size} objet${selectedItems.size > 1 ? 's' : ''}`
                  : 'Envoyer'
                }
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
