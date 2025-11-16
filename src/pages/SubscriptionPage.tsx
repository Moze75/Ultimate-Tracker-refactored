import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Crown, Shield, Sparkles, Users, Coins, Zap, Clock, Calendar, Star } from 'lucide-react';
import { subscriptionService } from '../services/subscriptionService';
import { SUBSCRIPTION_PLANS, UserSubscription } from '../types/subscription';
import toast from 'react-hot-toast';

interface SubscriptionPageProps {
  session: any;
  onBack: () => void;
}

const BG_URL = '/background/ddbground.png';

export function SubscriptionPage({ session, onBack }: SubscriptionPageProps) {
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [remainingTrialDays, setRemainingTrialDays] = useState<number | null>(null);
  const [remainingSubscriptionDays, setRemainingSubscriptionDays] = useState<number | null>(null);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
    const [isSubscriptionExpiringSoon, setIsSubscriptionExpiringSoon] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, [session]);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const sub = await subscriptionService.getCurrentSubscription(session.user.id);
      setCurrentSubscription(sub);

      // Vérifier les jours restants de l'essai
      const trialDays = await subscriptionService.getRemainingTrialDays(session.user.id);
      setRemainingTrialDays(trialDays);

      // Vérifier les jours restants de l'abonnement
      const subDays = await subscriptionService.getRemainingSubscriptionDays(session.user.id);
      setRemainingSubscriptionDays(subDays);

      // Vérifier si l'essai a expiré
      const expired = await subscriptionService.isTrialExpired(session.user.id);
      setIsTrialExpired(expired);

      // Vérifier si l'abonnement expire bientôt (< 7 jours)
      const expiringSoon = await subscriptionService.isSubscriptionExpiringSoon(session.user.id);
      setIsSubscriptionExpiringSoon(expiringSoon);
    } catch (error) {
      
      console.error('Erreur lors du chargement de l\'abonnement:', error);
      toast.error('Erreur lors du chargement de l\'abonnement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier: string) => {
    if (tier === 'free') {
      toast.error('Vous êtes en période d\'essai gratuit');
      return;
    }

    if (currentSubscription?.tier === tier && currentSubscription?.status === 'active') {
      toast.success('Vous possédez déjà cet abonnement !');
      return;
    }

    try {
      setProcessingPayment(true);
      
      // TODO: Intégrer Mollie ici
      toast.loading('Redirection vers le paiement...', { duration: 2000 });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === tier);
      toast.error(
        `Le paiement Mollie n'est pas encore configuré.\nMontant : ${plan?.priceLabel}\nCette fonctionnalité sera bientôt disponible !`,
        { duration: 5000 }
      );

      // Exemple à implémenter :
      // const paymentUrl = await subscriptionService.createMolliePayment(session.user.id, tier);
      // window.location.href = paymentUrl;
      
    } catch (error: any) {
      console.error('Erreur lors de la souscription:', error);
      toast.error('Erreur lors de la création du paiement');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getPlanIcon = (planId: string) => {
  switch (planId) {
    case 'free':
      return <Clock className="w-8 h-8" />;
    case 'hero':
      return <Sparkles className="w-8 h-8" />;
    case 'game_master':
      return <Crown className="w-8 h-8" />;
    case 'celestial':
      return <Star className="w-8 h-8" />; // ✅ Nouveau
    default:
      return <Shield className="w-8 h-8" />;
  }
};

const getPlanColor = (color: string) => {
  switch (color) {
    case 'gray':
      return {
        border: 'border-gray-500/30',
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        button: 'bg-gray-600 hover:bg-gray-700',
        iconBg: 'bg-gray-500/20',
      };
    case 'blue':
      return {
        border: 'border-blue-500/50',
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-700',
        iconBg: 'bg-blue-500/20',
      };
    case 'purple':
      return {
        border: 'border-purple-500/50',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        button: 'bg-purple-600 hover:bg-purple-700',
        iconBg: 'bg-purple-500/20',
      };
    case 'gold': // ✅ Nouveau
      return {
        border: 'border-yellow-500/50',
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        button: 'bg-yellow-600 hover:bg-yellow-700',
        iconBg: 'bg-yellow-500/20',
      };
    default:
      return {
        border: 'border-gray-500/30',
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        button: 'bg-gray-600 hover:bg-gray-700',
        iconBg: 'bg-gray-500/20',
      };
  }
};

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: `url(${BG_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="text-center">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Chargement..." 
            className="animate-spin h-12 w-12 mx-auto mb-4 object-contain"
            style={{ backgroundColor: 'transparent' }}
          />
          <p className="text-gray-200">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen py-8 relative"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{
                textShadow:
                  '0 0 15px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6), 0 0 30px rgba(255,255,255,0.4)',
              }}
            >
              Choisissez votre abonnement
            </h1>
            <p className="text-lg text-gray-200 max-w-2xl mx-auto mb-2">
              Abonnement annuel 
            </p>
  

            {/* Badge du plan actuel */}
            {currentSubscription && (
              <div className="mt-6 inline-block">
                <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
                  {currentSubscription.status === 'trial' && remainingTrialDays !== null ? (
                    <p className="text-sm text-gray-400">
                      Essai gratuit :{' '}
                      <span className={`font-bold ${remainingTrialDays <= 3 ? 'text-red-400' : 'text-white'}`}>
                        {remainingTrialDays} jour{remainingTrialDays > 1 ? 's' : ''} restant{remainingTrialDays > 1 ? 's' : ''}
                      </span>
                    </p>
                  ) : currentSubscription.status === 'expired' ? (
                    <p className="text-sm text-red-400">
                      ⚠️ Abonnement expiré - Choisissez un plan pour continuer
                    </p>
                  ) : currentSubscription.status === 'active' && remainingSubscriptionDays !== null ? (
                    <p className="text-sm text-gray-400">
                      Plan actuel :{' '}
                      <span className="font-bold text-white">
                        {SUBSCRIPTION_PLANS.find(p => p.id === currentSubscription.tier)?.name || 'Gratuit'}
                      </span>
                      <span className="ml-2 text-green-400">
                        • Renouvellement dans {remainingSubscriptionDays} jour{remainingSubscriptionDays > 1 ? 's' : ''}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Plan actuel :{' '}
                      <span className="font-bold text-white">
                        {SUBSCRIPTION_PLANS.find(p => p.id === currentSubscription.tier)?.name || 'Gratuit'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Alerte si essai expiré */}
            {isTrialExpired && (
              <div className="mt-4 max-w-2xl mx-auto">
                <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-300 font-semibold">
                    🔒 Votre période d'essai de 15 jours est terminée
                  </p>
                  <p className="text-red-200 text-sm mt-1">
                    Pour continuer à utiliser D&D Compagnon App, choisissez un plan ci-dessous
                  </p>
                </div>
              </div>    
            )}

            {/* ✨ NOUVEAU : Alerte si abonnement expire bientôt */}
            {isSubscriptionExpiringSoon && !isTrialExpired && (
              <div className="mt-4 max-w-2xl mx-auto">
                <div className="bg-orange-900/40 border border-orange-500/50 rounded-lg p-4">
                  <p className="text-orange-300 font-semibold">
                    ⏰ Votre abonnement expire dans moins de 7 jours
                  </p>
                  <p className="text-orange-200 text-sm mt-1">
                    Pensez à renouveler votre abonnement pour continuer à profiter de l'app !
                  </p>
                </div>
              </div>
            )}
            
          </div>
        </div>

     {/* Plans d'abonnement */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
  {SUBSCRIPTION_PLANS.map((plan) => {
            const colors = getPlanColor(plan.color);
            const isCurrentPlan = currentSubscription?.tier === plan.id && currentSubscription?.status === 'active';
            const isExpiredTrial = plan.id === 'free' && isTrialExpired;

            return (
              <div
                key={plan.id}
                className={`relative bg-gray-900/80 backdrop-blur-sm border-2 ${colors.border} rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 ${
                  plan.popular ? 'ring-2 ring-yellow-500/50' : ''
                } ${isExpiredTrial ? 'opacity-60' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-4 right-4 bg-yellow-500 text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
                    ⭐ POPULAIRE
                  </div>
                )}

                <div className="p-8">
                  <div className={`w-16 h-16 ${colors.iconBg} rounded-full flex items-center justify-center mb-6 ${colors.text}`}>
                    {getPlanIcon(plan.id)}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <>
                        <span className="text-4xl font-bold text-white">Gratuit</span>
                        <span className="text-gray-400 ml-2 text-sm">15 jours</span>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-white">{plan.price}€</span>
                        <span className="text-gray-400 ml-2 text-sm">/an</span>
                      </>
                    )}
                  </div>

{/* Limite de personnages */}
{plan.maxCharacters === Infinity ? (
  <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 mb-6`}>
    <p className="text-center">
      <span className="text-4xl font-bold text-yellow-300">∞</span>
      <div className="text-gray-300 mt-2 text-sm">
        Personnages illimités
      </div>
    </p>
  </div>
) : (
  <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 mb-6`}>
    <p className="text-center">
      <span className="text-2xl font-bold text-white">{plan.maxCharacters}</span>
      <span className="text-gray-300 ml-2">
        personnage{plan.maxCharacters > 1 ? 's' : ''} max
      </span>
    </p>
  </div>
)}
                  

{/* Fonctionnalités */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
                        <span className="text-gray-300 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

{/* ✅ COLLEZ ICI LE BLOC "Message personnalisé pour Céleste" */}
{plan.id === 'celestial' && (
  <div className="mb-6 p-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-lg">
    <p className="text-sm text-yellow-200 text-center leading-relaxed">
      <span className="font-semibold">✨ En choisissant Céleste</span>, vous soutenez directement le développement de D&D Compagnon App. 
      Votre contribution permet d'ajouter de nouvelles fonctionnalités, d'améliorer l'expérience utilisateur et de maintenir l'application à jour. 
      <span className="block mt-2 font-semibold text-yellow-100">Merci de faire partie de cette aventure ! 🙏</span>
    </p>
  </div>
)}
                  
                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full bg-green-700 text-white py-3 px-6 rounded-lg font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Check size={20} />
                      Abonnement actif
                    </button>
                  ) : isExpiredTrial ? (
                    <button
                      disabled
                      className="w-full bg-gray-700 text-gray-400 py-3 px-6 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Essai expiré
                    </button>
                  ) : plan.id === 'free' ? (
                    <button
                      disabled
                      className="w-full bg-gray-700 text-gray-400 py-3 px-6 rounded-lg font-semibold cursor-not-allowed"
                    >
                      Plan actuel
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={processingPayment}
                      className={`w-full ${colors.button} text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                    >
                      {processingPayment ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                          Traitement...
                        </>
                      ) : (
                        <>
                          <Calendar size={20} />
                          S'abonner ({plan.priceLabel})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>



        
{/* Note de paiement sécurisé */}
<div className="mt-8 text-center">
  <p className="text-sm text-gray-400">
    🔒 Paiements sécurisés via <span className="font-semibold text-white">Mollie</span>
  </p>
  <p className="text-xs text-gray-500 mt-2">
    Abonnement annuel • Annulation possible à tout moment
  </p>
</div>
      </div>
    </div>
  );
}

export default SubscriptionPage;