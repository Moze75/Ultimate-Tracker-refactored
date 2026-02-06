import { useState } from 'react';
import { Package, Coins, Send, History, Trash2, Clock, Loader2, Check, X } from 'lucide-react';
import { Dices } from 'lucide-react';
import { CampaignMember, CampaignInventoryItem, CampaignGift, CampaignGiftClaim } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import { SendGiftModal } from '../modals/SendGiftModal';
import { RandomLootModal } from '../modals/RandomLootModal';
import toast from 'react-hot-toast';

interface GiftsTabProps {
  campaignId: string;
  members: CampaignMember[];
  inventory: CampaignInventoryItem[];
  gifts: (CampaignGift & { claims?: CampaignGiftClaim[] })[];
  giftsLoading: boolean;
  onRefresh: () => void;
}

export function GiftsTab({ campaignId, members, inventory, gifts, giftsLoading, onRefresh }: GiftsTabProps) {
  const [sendModalType, setSendModalType] = useState<'item' | 'currency' | null>(null);
  const [showRandomLootModal, setShowRandomLootModal] = useState(false);
  const [deletingGiftId, setDeletingGiftId] = useState<string | null>(null);
  const [confirmDeleteGift, setConfirmDeleteGift] = useState<string | null>(null);
  const [confirmClearDistributed, setConfirmClearDistributed] = useState(false);
  const [clearingDistributed, setClearingDistributed] = useState(false);

  const distributedCount = gifts.filter(g => g.status === 'distributed').length;

  const handleDeleteGift = async (giftId: string) => {
    try {
      setDeletingGiftId(giftId);
      await campaignService.deleteGift(giftId);
      toast.success('Element supprime de l\'historique');
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingGiftId(null);
      setConfirmDeleteGift(null);
    }
  };

  const handleClearDistributed = async () => {
    try {
      setClearingDistributed(true);
      const count = await campaignService.deleteDistributedGifts(campaignId);
      toast.success(`${count} element${count > 1 ? 's' : ''} supprime${count > 1 ? 's' : ''}`);
      onRefresh();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors du nettoyage');
    } finally {
      setClearingDistributed(false);
      setConfirmClearDistributed(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Envoyer aux joueurs</h2>

      <div className="flex gap-2">
        <button onClick={() => setSendModalType('item')} className="px-3 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
          <Package size={16} /> Objets
        </button>
        <button onClick={() => setSendModalType('currency')} className="px-3 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
          <Coins size={16} /> Argent
        </button>
        <button onClick={() => setShowRandomLootModal(true)} className="px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-1.5 transition-colors">
          <Dices size={16} /> Loot aléatoire
        </button>
      </div>

      <div className="bg-gray-900/30 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <History size={18} /> Historique des envois
          </h3>
          <div className="flex items-center gap-2">
            {distributedCount > 0 && (
              confirmClearDistributed ? (
                <div className="flex items-center gap-1">
                  <button onClick={handleClearDistributed} disabled={clearingDistributed} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1">
                    {clearingDistributed ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirmer
                  </button>
                  <button onClick={() => setConfirmClearDistributed(false)} disabled={clearingDistributed} className="px-2 py-1 rounded bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium transition-colors disabled:opacity-50">Annuler</button>
                </div>
              ) : (
                <button onClick={() => setConfirmClearDistributed(true)} className="px-2 py-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-900/30 text-xs transition-colors flex items-center gap-1" title="Nettoyer les elements distribues">
                  <Trash2 size={14} /> Nettoyer ({distributedCount})
                </button>
              )
            )}
            <button onClick={onRefresh} className="text-gray-400 hover:text-white transition-colors p-1" title="Rafraichir">
              <Loader2 size={16} className={giftsLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {giftsLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400" />
            <p className="text-gray-500 mt-2 text-sm">Chargement...</p>
          </div>
        ) : gifts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-800/60 rounded-full flex items-center justify-center">
              <Send className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm">Aucun envoi pour le moment</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50 max-h-96 overflow-y-auto">
            {gifts.map(gift => {
              const isItem = gift.gift_type === 'item';
              const hasClaims = gift.claims && gift.claims.length > 0;
              const claimedBy = hasClaims
                ? gift.claims!.map(c => {
                    const member = members.find(m => m.player_id === c.player_id);
                    return member?.player_name || 'Joueur inconnu';
                  }).join(', ')
                : null;
              const isDeleting = deletingGiftId === gift.id;

              return (
                <div key={gift.id} className="p-4 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isItem ? 'bg-purple-900/50' : 'bg-yellow-900/50'}`}>
                      {isItem ? <Package size={18} className="text-purple-400" /> : <Coins size={18} className="text-yellow-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-200">{isItem ? gift.item_name : 'Argent'}</span>
                        {isItem && gift.item_quantity && gift.item_quantity > 1 && (
                          <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">x{gift.item_quantity}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          gift.status === 'pending' ? 'bg-amber-900/50 text-amber-300' :
                          gift.status === 'distributed' ? 'bg-green-900/50 text-green-300' :
                          'bg-red-900/50 text-red-300'
                        }`}>
                          {gift.status === 'pending' ? 'En attente' : gift.status === 'distributed' ? 'Distribue' : 'Annule'}
                        </span>
                      </div>
                      {!isItem && (
                        <p className="text-sm text-yellow-400 mt-0.5">
                          {gift.gold > 0 && `${gift.gold} po`}
                          {gift.silver > 0 && ` ${gift.silver} pa`}
                          {gift.copper > 0 && ` ${gift.copper} pc`}
                        </p>
                      )}
                      {gift.message && <p className="text-sm text-gray-400 mt-1 italic">"{gift.message}"</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(gift.sent_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>{gift.distribution_mode === 'individual' ? 'Individuel' : 'Partage'}</span>
                      </div>
                      {claimedBy && <p className="text-xs text-green-400 mt-1">Recupere par : {claimedBy}</p>}
                    </div>

                    {confirmDeleteGift === gift.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleDeleteGift(gift.id)} disabled={isDeleting} className="p-1.5 rounded bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50" title="Confirmer">
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        </button>
                        <button onClick={() => setConfirmDeleteGift(null)} disabled={isDeleting} className="p-1.5 rounded bg-gray-600 hover:bg-gray-500 text-white transition-colors disabled:opacity-50" title="Annuler">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteGift(gift.id)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/30 transition-colors flex-shrink-0" title="Supprimer de l'historique">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sendModalType && (
        <SendGiftModal
          campaignId={campaignId}
          members={members}
          inventory={inventory}
          giftType={sendModalType}
          onClose={() => setSendModalType(null)}
          onSent={() => { setSendModalType(null); toast.success('Envoi effectue aux joueurs !'); onRefresh(); }}
        />
      )}

      {showRandomLootModal && (
        <RandomLootModal
          campaignId={campaignId}
          members={members}
          inventory={inventory}
          onClose={() => setShowRandomLootModal(false)}
          onSent={() => { setShowRandomLootModal(false); toast.success('Loot aleatoire distribue !'); onRefresh(); }}
        />
      )}
    </div>
  );
}
