import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, User } from 'lucide-react';
import { CampaignMember } from '../../types/campaign';
import { InventoryItem } from '../../types/dnd';
import { campaignService } from '../../services/campaignService';

const META_PREFIX = '#meta:';

function parseMeta(description: string | null | undefined): any | null {
  if (!description) return null;
  const lines = (description || '').split('\n').map(l => l.trim());
  const metaLine = [...lines].reverse().find(l => l.startsWith(META_PREFIX));
  if (!metaLine) return null;
  try {
    return JSON.parse(metaLine.slice(META_PREFIX.length));
  } catch {
    return null;
  }
}

interface ShareItemToPlayerModalProps {
  item: InventoryItem;
  campaignId: string;
  members: CampaignMember[];
  currentUserId: string;
  onClose: () => void;
  onItemSent: () => void;
}

export function ShareItemToPlayerModal({
  item,
  campaignId,
  members,
  currentUserId,
  onClose,
  onItemSent
}: ShareItemToPlayerModalProps) {
  const [selectedMember, setSelectedMember] = useState<CampaignMember | null>(null);
  const [sending, setSending] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const meta = parseMeta(item.description);
  const maxQuantity = meta?.quantity || 1;
  const otherMembers = members.filter(m => m.user_id !== currentUserId);

  const handleSend = async () => {
    if (!selectedMember || sending) return;

    try {
      setSending(true);
      await campaignService.sendItemToPlayer(
        campaignId,
        item.id,
        item.name,
        item.description || '',
        quantity,
        selectedMember.user_id
      );
      onItemSent();
      onClose();
    } catch (error) {
      console.error('Erreur envoi item:', error);
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-[min(28rem,95vw)] max-h-[85vh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700 px-5 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Envoyer l'objet</h3>
                <p className="text-sm text-gray-400">{item.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {otherMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucun autre joueur dans la campagne</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Destinataire
                </label>
                <div className="space-y-2">
                  {otherMembers.map((member) => (
                    <label
                      key={member.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedMember?.id === member.id
                          ? 'bg-blue-900/30 border-blue-500/50'
                          : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="recipient"
                        checked={selectedMember?.id === member.id}
                        onChange={() => setSelectedMember(member)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {member.player_name || member.email}
                        </p>
                        {member.player_name && member.email && (
                          <p className="text-xs text-gray-500">{member.email}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {maxQuantity > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantite (max: {maxQuantity})
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={maxQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(maxQuantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="input-dark w-full px-3 py-2 rounded-lg"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {otherMembers.length > 0 && (
          <div className="sticky bottom-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 px-5 py-4">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedMember || sending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Envoi...
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
        )}
      </div>
    </div>,
    document.body
  );
}
