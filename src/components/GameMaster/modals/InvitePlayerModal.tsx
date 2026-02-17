import { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { campaignService } from '../../../services/campaignService';
import toast from 'react-hot-toast';

interface InvitePlayerModalProps {
  campaignId: string;
  onClose: () => void;
  onInvited: () => void;
}

export function InvitePlayerModal({ campaignId, onClose, onInvited }: InvitePlayerModalProps) {
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const handleInvite = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      toast.error('Email requis');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      toast.error('Email invalide');
      return;
    }

    try {
      setInviting(true);
      await campaignService.invitePlayerByEmail(campaignId, cleanEmail);
      toast.success(`Invitation envoyée à ${cleanEmail}`);
      setEmail('');
      onInvited();
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erreur lors de l\'invitation');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] frame-card frame-card--light frame-card--no-frame rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Inviter un joueur</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email du joueur
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-dark w-full px-4 py-2 rounded-lg"
              placeholder="joueur@exemple.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleInvite();
              }}
            />
            <p className="text-xs text-gray-500 mt-2">
              Le joueur recevra une invitation et devra sélectionner son personnage pour rejoindre la campagne.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={inviting}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleInvite}
            disabled={inviting || !email.trim()}
            className="btn-primary px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
          >
            {inviting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Envoi...
              </>
            ) : (
              <>
                <Mail size={18} />
                Inviter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
