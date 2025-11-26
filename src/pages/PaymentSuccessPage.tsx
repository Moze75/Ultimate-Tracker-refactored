import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = searchParams.get('userId');
  const tier = searchParams.get('tier');

  useEffect(() => {
    async function checkSubscription() {
      if (!userId) {
        setError('Paramètres manquants');
        setLoading(false);
        return;
      }

      try {
        // Attendre 2 secondes pour laisser le webhook traiter le paiement
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Vérifier le statut de l'abonnement
        const { data, error: dbError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (dbError || !data) {
          console.error('Erreur vérification abonnement:', dbError);
          setError('Le paiement est en cours de traitement.  Veuillez patienter quelques instants.');
          // Réessayer après 3 secondes
          setTimeout(() => checkSubscription(), 3000);
          return;
        }

        setLoading(false);

        // Rediriger vers le dashboard après 3 secondes
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);

      } catch (err) {
        console.error('Erreur:', err);
        setError('Une erreur est survenue');
        setLoading(false);
      }
    }

    checkSubscription();
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold mb-2">Confirmation du paiement... </h1>
          <p className="text-gray-300">Veuillez patienter</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-white max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">{error}</h1>
          <button
            onClick={() => navigate('/subscription')}
            className="bg-white text-purple-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Retour aux abonnements
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center text-white max-w-md mx-auto p-8">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-4xl font-bold mb-4">Paiement réussi !</h1>
        <p className="text-xl text-gray-300 mb-2">
          Votre abonnement <span className="font-semibold capitalize">{tier}</span> est maintenant actif. 
        </p>
        <p className="text-gray-400 mb-6">Merci pour votre confiance ! </p>
        <div className="animate-pulse text-gray-500">
          Redirection vers votre dashboard...
        </div>
      </div>
    </div>
  );
}