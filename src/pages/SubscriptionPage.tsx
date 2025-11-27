import React, { useEffect, useState } from 'react';
import { ArrowLeft, Crown, Shield, Sparkles, Star, CheckCircle2, Calendar, Loader2 } from 'lucide-react';
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

    const [promoCode, setPromoCode] = useState(''); 

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
      
      toast.loading('Redirection vers la page de paiement sécurisée...', { duration: 2000 });

      const checkoutUrl = await subscriptionService.createMolliePayment(
        session.user.id, 
        tier, 
        session.user.email || ''
      );

      if (!checkoutUrl) {
        toast.error('Impossible de créer le paiement. Veuillez réessayer.');
        return;
      }

      // Redirection vers Mollie
      window.location.href = checkoutUrl;
      
    } catch (error: any) {
      console.error('Erreur lors de la souscription:', error);
      toast.error(error?.message || 'Erreur lors de la création du paiement');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'hero': return <Sparkles className="w-10 h-10" />;
      case 'game_master': return <Crown className="w-10 h-10" />;
      case 'celestial': return <Star className="w-10 h-10" />;
      default: return <Shield className="w-10 h-10" />;
    }
  };

  // Helper pour rendre le contenu spécifique (features) selon le plan pour correspondre au wording HomePage
  const renderPlanFeatures = (planId: string) => {
    switch (planId) {
      case 'free':
        return (
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> 1 personnage max</li>
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> Toutes les fonctionnalités disponibles</li>
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-gray-500 mt-0.5 shrink-0"/> Test complet sans CB</li>
          </ul>
        );
      case 'hero':
        return (
          <ul className="space-y-3 mb-8">
             <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Jusqu’à 5 personnages</li>
             <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Création d’objets personnalisés</li>
             <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Suivi de l’état, de la concentration</li>
             <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Dice Roller & Character Wizard</li>
             <li className="flex items-start gap-3 text-gray-300 italic text-sm"><CheckCircle2 size={18} className="text-blue-500 mt-0.5 shrink-0"/> Tous les outils pour le joueur régulier</li>
          </ul>
        );
      case 'game_master':
        return (
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Jusqu’à 15 personnages</li>
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> <strong>Accès complet outils MJ</strong></li>
            <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Campagnes, Envois d'objets, Gestion Joueurs</li>
            <li className="flex items-start gap-3 text-gray-300 italic text-sm"><CheckCircle2 size={18} className="text-purple-500 mt-0.5 shrink-0"/> Toutes les fonctionnalités Héros incluses</li>
          </ul>
        );
      case 'celestial':
        return (
          <>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> <strong>Personnages illimités</strong></li>
              <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Support ultra-prioritaire</li>
              <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Accès anticipé aux nouveautés</li>
              <li className="flex items-start gap-3 text-gray-300"><CheckCircle2 size={18} className="text-yellow-500 mt-0.5 shrink-0"/> Toutes fonctionnalités Héros + MJ</li>
            </ul>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6">
              <p className="text-xs text-yellow-200 italic leading-relaxed">
                En choisissant Céleste, vous devenez un pilier du projet. Votre soutien nous aide à maintenir l’app et à la faire évoluer. Merci de faire partie de cette aventure.
              </p>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  // Helper pour le style des cartes
  const getCardStyle = (planId: string) => {
     switch(planId) {
        case 'free': 
           return "bg-gray-900/80 border-gray-700 hover:scale-[1.02]";
        case 'hero': 
           return "bg-blue-900/20 border-blue-500/30 hover:scale-[1.02]";
        case 'game_master': 
           return "bg-purple-900/20 border-purple-500/30 hover:scale-[1.02]";
        case 'celestial': 
           return "bg-yellow-900/10 border-yellow-500/50 ring-1 ring-yellow-500/20 hover:scale-[1.02]";
        default: 
           return "bg-gray-900 border-gray-700";
     }
  };

  // Helper pour le header des cartes
  const getHeaderStyle = (planId: string) => {
    switch(planId) {
       case 'free': return "bg-gray-800/50 border-gray-700 text-gray-400";
       case 'hero': return "bg-blue-900/30 border-blue-500/30 text-blue-400";
       case 'game_master': return "bg-purple-900/30 border-purple-500/30 text-purple-400";
       case 'celestial': return "bg-yellow-900/20 border-yellow-500/30 text-yellow-400";
       default: return "bg-gray-800 text-gray-400";
    }
  };

  // Helper pour le texte du bouton
  const getButtonLabel = (planId: string) => {
     switch(planId) {
        case 'free': return "→ Je teste gratuitement";
        case 'hero': return "→ Je deviens Héros";
        case 'game_master': return "→ Je prends le contrôle";
        case 'celestial': return "→ Je rejoins les Célestes";
        default: return "Choisir";
     }
  };

  // Helper pour le style du bouton
  const getButtonStyle = (planId: string) => {
    switch(planId) {
       case 'free': return "border border-gray-500 text-gray-300 hover:bg-gray-700";
       case 'hero': return "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20";
       case 'game_master': return "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-900/20";
       case 'celestial': return "bg-gradient-to-r from-yellow-600 to-yellow-700 text-white hover:from-yellow-500 hover:to-yellow-600 shadow-lg shadow-yellow-900/20 border border-yellow-400/20";
       default: return "bg-gray-700";
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
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
              Choisissez votre équipement avant d’entrer dans l’arène
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
               Quel que soit votre niveau, il y a un plan pour vous accompagner dans vos aventures.
            </p>

            {/* STATUS DU COMPTE ACTUEL */}
            {currentSubscription && (
              <div className="inline-block animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="bg-gray-900/90 backdrop-blur border border-gray-600 rounded-xl px-6 py-4 shadow-2xl">
                  {currentSubscription.status === 'trial' && remainingTrialDays !== null ? (
                    <p className="text-base text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                      Essai gratuit en cours :{' '}
                      <span className={`font-bold ${remainingTrialDays <= 3 ? 'text-red-400' : 'text-white'}`}>
                        {remainingTrialDays} jour{remainingTrialDays > 1 ? 's' : ''} restant{remainingTrialDays > 1 ? 's' : ''}
                      </span>
                    </p>
                  ) : currentSubscription.status === 'expired' ? (
                    <p className="text-base text-red-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"/>
                      ⚠️ Abonnement expiré - Choisissez un plan pour continuer
                    </p>
                  ) : currentSubscription.status === 'active' && remainingSubscriptionDays !== null ? (
                    <p className="text-base text-gray-300 flex items-center gap-2">
                      <CheckCircle2 className="text-green-400 w-5 h-5"/>
                      Plan actuel :{' '}
                      <span className="font-bold text-white uppercase tracking-wider">
                        {SUBSCRIPTION_PLANS.find(p => p.id === currentSubscription.tier)?.name || 'Gratuit'}
                      </span>
                      <span className="text-gray-400 text-sm ml-2">
                         (Renouvellement dans {remainingSubscriptionDays} jours)
                      </span>
                    </p>
                  ) : (
                    <p className="text-base text-gray-400">
                      Plan actuel :{' '}
                      <span className="font-bold text-white">
                        {SUBSCRIPTION_PLANS.find(p => p.id === currentSubscription.tier)?.name || 'Gratuit'}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ALERTES */}
            {isTrialExpired && (
               <div className="mt-6 max-w-xl mx-auto bg-red-950/50 border border-red-500/50 rounded-lg p-4 animate-pulse">
                 <p className="text-red-200 font-semibold">🔒 Votre période d'essai est terminée</p>
               </div>    
            )}

            {isSubscriptionExpiringSoon && !isTrialExpired && (
               <div className="mt-6 max-w-xl mx-auto bg-orange-950/50 border border-orange-500/50 rounded-lg p-4">
                  <p className="text-orange-200 font-semibold">⏰ Votre abonnement expire bientôt</p>
               </div>
            )}
          </div>
        </div>

        {/* Plans d'abonnement */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrentPlan = currentSubscription?.tier === plan.id && currentSubscription?.status === 'active';
            const isExpiredTrial = plan.id === 'free' && isTrialExpired;
            
            return (
              <div
                key={plan.id}
                className={`relative backdrop-blur-sm border rounded-xl overflow-hidden flex flex-col transition-all duration-300 ${getCardStyle(plan.id)} ${isExpiredTrial ? 'opacity-60 grayscale' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                    POPULAIRE
                  </div>
                )}

                <div className={`p-6 border-b ${getHeaderStyle(plan.id).split(' ')[1]} ${getHeaderStyle(plan.id).split(' ')[0]}`}>
                  <div className={`${getHeaderStyle(plan.id).split(' ')[2]} mb-4`}>
                    {getPlanIcon(plan.id)}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="mt-2">
                     <span className="text-3xl font-bold text-white">{plan.price}€</span>
                     <span className="text-gray-300 text-sm ml-1">{plan.price === 0 ? "/ 15 jours" : "/ an"}</span>
                  </div>
                </div>

                <div className="p-6 flex-grow">
                   {/* Rendu des features spécifiques */}
                   {renderPlanFeatures(plan.id)}
                </div>

                <div className="p-6 pt-0 mt-auto">
                   {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full bg-green-800/50 text-green-200 border border-green-500/50 py-3 px-6 rounded-lg font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={20} />
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
                      className="w-full bg-gray-700 text-gray-400 py-3 px-6 rounded-lg font-semibold cursor-not-allowed border border-gray-600"
                    >
                      {/* On masque le bouton free si on est déjà loggé/inscrit (ce qui est le cas ici) sauf si c'est pour info */}
                      Plan de démarrage
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={processingPayment}
                      className={`w-full py-3 px-6 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${getButtonStyle(plan.id)}`}
                    >
                      {processingPayment ? (
                        <>
                          <Loader2 className="animate-spin" size={20}/>
                          Traitement...
                        </>
                      ) : (
                         getButtonLabel(plan.id)
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-12 text-center pb-8">
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
             <Shield size={14} /> Paiements sécurisés via <span className="font-semibold text-white">Mollie</span>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Annulation possible à tout moment depuis votre compte.
          </p>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionPage;