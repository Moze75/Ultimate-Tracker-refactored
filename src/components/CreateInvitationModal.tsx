import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { campaignService } from '../services/campaignService';
import toast from 'react-hot-toast';

interface CreateInvitationModalProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignName: string;
}

export function CreateInvitationModal({
  open,
  onClose,
  campaignId,
  campaignName,
}: CreateInvitationModalProps) {
  const [playerName, setPlayerName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      toast.error('Entrez le nom du joueur');
      return;
    }

    try {
      setCreating(true);
      const code = await campaignService.createPlayerInvitation(
        campaignId,
        playerName.trim(),
        expiresInDays
      );
      setGeneratedCode(code);
      toast.success('Code d\'invitation généré !');
    } catch (error: any) {
      console.error(error);
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success('Code copié !');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setPlayerName('');
    setGeneratedCode(null);
    setCopied(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[12000]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,95vw)] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="bg-gray-800/60 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Créer une invitation</h3>
              <p className="text-sm text-gray-400 mt-1">Pour {campaignName}</p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-700 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!generatedCode ? (
            <>
              {/* Formulaire */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du joueur invité
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="input-dark w-full px-4 py-2 rounded-lg"
                  placeholder="Ex: Jean Dupont"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Pour identification uniquement (n'a pas besoin de correspondre à un compte)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Expiration
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  className="input-dark w-full px-4 py-2 rounded-lg"
                >
                  <option value={1}>1 jour</option>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                </select>
              </div>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm text-blue-200">
                ℹ️ <strong>Fonctionnement :</strong>
                <ul className="mt-2 space-y-1 ml-4 list-disc">
                  <li>Un code unique sera généré pour ce joueur</li>
                  <li>Il devra entrer ce code ET choisir son personnage</li>
                  <li>Le code ne peut être utilisé qu'une seule fois</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Code généré */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 mb-4">
                  <Check className="w-6 h-6 text-green-400" />
                  <span className="text-lg font-semibold text-white">Code généré !</span>
                </div>
                
                <div className="bg-gray-800 border-2 border-purple-500/50 rounded-lg p-6 mb-4">
                  <p className="text-sm text-gray-400 mb-2">Code d'invitation</p>
                  <div className="flex items-center justify-center gap-3">
                    <code className="text-3xl font-mono font-bold text-purple-400 tracking-wider">
                      {generatedCode}
                    </code>
                    <button
                      onClick={handleCopy}
                      className={`p-2 rounded-lg transition-colors ${
                        copied
                          ? 'bg-green-600 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {copied ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800/40 rounded-lg p-4 text-left space-y-2 text-sm">
                  <p className="text-gray-300">
                    <strong>Pour :</strong> {playerName}
                  </p>
                  <p className="text-gray-300">
                    <strong>Expire dans :</strong> {expiresInDays} jour{expiresInDays > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-200">
                  ⚠️ Envoyez ce code au joueur par message privé. Il ne pourra l'utiliser qu'une seule fois.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-800/60 border-t border-gray-700 px-6 py-4 flex justify-end gap-3">
          {!generatedCode ? (
            <>
              <button
                onClick={onClose}
                disabled={creating}
                className="btn-secondary px-6 py-2 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !playerName.trim()}
                className="btn-primary px-6 py-2 rounded-lg disabled:opacity-50"
              >
                {creating ? 'Génération...' : 'Générer le code'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="btn-secondary px-6 py-2 rounded-lg"
              >
                Créer un autre code
              </button>
              <button
                onClick={onClose}
                className="btn-primary px-6 py-2 rounded-lg"
              >
                Fermer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}