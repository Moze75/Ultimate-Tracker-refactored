import { useState } from 'react';
import { X, Check, Trash2, AlertCircle } from 'lucide-react';
import { Campaign } from '../../../types/campaign';
import { campaignService } from '../../../services/campaignService';
import toast from 'react-hot-toast';

interface EditCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditCampaignModal({ campaign, onClose, onUpdated }: EditCampaignModalProps) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleUpdate = async () => {
    if (!name.trim()) {
      toast.error('Le nom est requis');
      return;
    }

    try {
      setUpdating(true);
      await campaignService.updateCampaign(campaign.id, {
        name: name.trim(),
        description: description.trim(),
      });
      toast.success('Campagne mise à jour !');
      onUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (confirmText !== campaign.name) {
      toast.error('Le nom ne correspond pas');
      return;
    }

    try {
      setDeleting(true);
      await campaignService.deleteCampaign(campaign.id);
      toast.success('Campagne supprimée');
      onUpdated();
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(40rem,95vw)] max-w-full bg-gray-900/95 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Modifier la campagne</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-800 rounded-lg">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom de la campagne *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                placeholder="ex: Les Mines de Phandelver"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                rows={4}
                placeholder="Décrivez votre campagne..."
              />
            </div>
          </div>

          <div className="space-y-3 mt-6">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={updating || deleting}
                className="btn-secondary px-6 py-2 rounded-lg whitespace-nowrap flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                disabled={updating || deleting || !name.trim()}
                className="btn-primary px-6 py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap flex-1"
              >
                {updating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Sauvegarder
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={updating || deleting}
              className="w-full px-6 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Trash2 size={16} />
              Supprimer la campagne
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10001]" onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteConfirm(false); setConfirmText(''); } }}>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,90vw)] max-w-full bg-gray-900/95 border-2 border-red-500/50 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Confirmer la suppression</h3>
                <p className="text-sm text-gray-400">Cette action est irréversible</p>
              </div>
            </div>

            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-sm text-red-200 font-medium">
                La suppression de "{campaign.name}" entraînera :
              </p>
              <ul className="text-sm text-red-300 space-y-1 ml-4">
                <li>Suppression de tous les joueurs de la campagne</li>
                <li>Suppression de l'inventaire de campagne</li>
                <li>Suppression des loots envoyés</li>
                <li>Perte définitive de toutes les données</li>
              </ul>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Pour confirmer, tapez le nom de la campagne :
              </label>
              <div className="bg-gray-800/40 rounded-lg p-3 mb-2">
                <code className="text-purple-400 font-mono text-sm">{campaign.name}</code>
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="input-dark w-full px-4 py-2 rounded-lg"
                placeholder="Tapez le nom exact..."
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setConfirmText('');
                }}
                disabled={deleting}
                className="btn-secondary px-6 py-2 rounded-lg whitespace-nowrap flex-1"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting || confirmText !== campaign.name}
                className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap flex-1"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Suppression...
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Supprimer définitivement
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
