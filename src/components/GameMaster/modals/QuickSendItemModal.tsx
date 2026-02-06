import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { CampaignMember, CampaignInventoryItem } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { META_PREFIX, parseMeta, getVisibleDescription } from '../utils/metaParser';
import { useRecipientSelection } from '../hooks/useRecipientSelection';
import toast from 'react-hot-toast';

interface QuickSendItemModalProps {
  campaignId: string;
  item: CampaignInventoryItem;
  members: CampaignMember[];
  onClose: () => void;
  onSent: () => void;
}

export function QuickSendItemModal({ campaignId, item, members, onClose, onSent }: QuickSendItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [distributionMode, setDistributionMode] = useState<'individual' | 'shared'>('individual');
  const [removeFromInventory, setRemoveFromInventory] = useState(true);
  const [sending, setSending] = useState(false);

  const {
    selectedRecipients,
    selectAllRecipients,
    setSelectAllRecipients,
    toggleRecipient,
  } = useRecipientSelection(members);

  const meta = parseMeta(item.description);

  const getFullDescription = () => {
    const existingMeta = parseMeta(item.description);
    if (!existingMeta) return item.description || '';
    const visibleDesc = getVisibleDescription(item.description);
    const metaLine = `${META_PREFIX}${JSON.stringify(existingMeta)}`;
    return visibleDesc ? `${visibleDesc}\n${metaLine}` : metaLine;
  };

  const handleSend = async () => {
    if (distributionMode === 'individual' && selectedRecipients.length === 0) {
      toast.error('Selectionnez au moins un destinataire');
      return;
    }

    try {
      setSending(true);
      const recipientIds = distributionMode === 'individual' ? selectedRecipients : null;

      await campaignService.sendGift(campaignId, 'item', {
        itemName: item.name,
        itemDescription: getFullDescription(),
        itemQuantity: quantity,
        gold: 0,
        silver: 0,
        copper: 0,
        distributionMode,
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

      const action = removeFromInventory ? 'envoye' : 'duplique et envoye';
      toast.success(`Objet ${action} !`);
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] max-h-[90vh] overflow-y-auto bg-gray-900/95 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Send size={20} className="text-blue-400" />
            Envoyer aux joueurs
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <div className="flex items-start gap-3">
              {meta?.imageUrl && (
                <img
                  src={meta.imageUrl}
                  alt={item.name}
                  className="w-14 h-14 rounded object-cover border border-gray-600/50 flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-semibold text-white">{item.name}</h4>
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
                <p className="text-sm text-gray-400">{item.quantity} disponible{item.quantity > 1 ? 's' : ''}</p>
              </div>
            </div>

            {item.quantity > 1 && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-sm text-gray-400">Quantite:</label>
                <input
                  type="number"
                  min="1"
                  max={item.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, item.quantity)))}
                  className="input-dark w-20 px-2 py-1 text-sm rounded"
                />
                <span className="text-xs text-gray-500">/ {item.quantity}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Mode de distribution</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDistributionMode('individual')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  distributionMode === 'individual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Individuel
              </button>
              <button
                onClick={() => setDistributionMode('shared')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  distributionMode === 'shared' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Partage
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {distributionMode === 'individual'
                ? 'Chaque destinataire recoit l\'objet individuellement'
                : 'L\'objet sera partage entre tous les membres'}
            </p>
          </div>

          {distributionMode === 'individual' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Destinataires</label>
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAllRecipients}
                    onChange={(e) => setSelectAllRecipients(e.target.checked)}
                    className="w-3 h-3 rounded border-gray-600 text-blue-600"
                  />
                  Tous
                </label>
              </div>
              <div className="max-h-[150px] overflow-y-auto space-y-1 bg-gray-800/30 rounded-lg p-2">
                {members.map((member) => {
                  const recipientId = member.user_id || member.player_id || member.id;
                  if (!recipientId) return null;
                  const isSelected = selectedRecipients.includes(recipientId);
                  return (
                    <label
                      key={recipientId}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-900/30' : 'hover:bg-gray-700/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRecipient(recipientId)}
                        className="w-4 h-4 rounded border-gray-600 text-blue-600"
                      />
                      <span className="text-sm text-gray-200">{member.player_name || member.character_name || 'Joueur'}</span>
                    </label>
                  );
                })}
                {members.length === 0 && (
                  <p className="text-center py-4 text-gray-500 text-sm">Aucun membre dans la campagne</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-800/30 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={removeFromInventory}
                onChange={(e) => setRemoveFromInventory(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">
                  Supprimer de l'inventaire
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {removeFromInventory
                    ? "L'objet sera retire de votre inventaire apres l'envoi"
                    : "L'objet sera duplique et restera dans votre inventaire"}
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || (distributionMode === 'individual' && selectedRecipients.length === 0)}
            className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send size={18} />
                Envoyer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
