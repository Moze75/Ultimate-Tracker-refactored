import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { authService } from '../services/authService';

export function ClearCachePage() {
  const [status, setStatus] = useState<'idle' | 'clearing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleClearCache = async () => {
    setStatus('clearing');
    setMessage('Nettoyage en cours...');

    try {
      await authService.clearCacheAndSignOut();
      setStatus('success');
      setMessage('Cache nettoyé avec succès ! Redirection en cours...');

      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage('Erreur lors du nettoyage. Veuillez réessayer.');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Nettoyage du cache</h1>
          <p className="text-sm text-gray-400">
            Utilisez cette page pour résoudre les problèmes de connexion ou d'affichage
          </p>
        </div>

        {status === 'idle' && (
          <>
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-300 mb-2">⚠️ Cette action va :</p>
              <ul className="text-xs text-yellow-200 space-y-1 ml-4 list-disc">
                <li>Nettoyer tout le cache de l'application</li>
                <li>Supprimer les données locales</li>
                <li>Désinstaller le service worker</li>
                <li>Vous déconnecter</li>
                <li>Recharger l'application</li>
              </ul>
            </div>

            <button
              onClick={handleClearCache}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium"
            >
              <RefreshCw size={20} />
              Nettoyer le cache et redémarrer
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="w-full mt-3 px-6 py-2 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Annuler et retourner à l'accueil
            </button>
          </>
        )}

        {status === 'clearing' && (
          <div className="text-center py-8">
            <RefreshCw size={48} className="text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-white font-medium">{message}</p>
            <p className="text-sm text-gray-400 mt-2">Veuillez patienter...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center py-8">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <p className="text-white font-medium">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <p className="text-white font-medium">{message}</p>
            <button
              onClick={handleClearCache}
              className="mt-4 px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
