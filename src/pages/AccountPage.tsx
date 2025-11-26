import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Lock, Calendar, Crown, User, Check, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { subscriptionService } from '../services/subscriptionService';
import { SUBSCRIPTION_PLANS, UserSubscription } from '../types/subscription';
import toast from 'react-hot-toast';

interface AccountPageProps {
  session: any;
  onBack: () => void;
}

const BG_URL = '/background/ddbground.png';

export function AccountPage({ session, onBack }: AccountPageProps) {
  const [loading, setLoading] = useState(true);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [remainingDays, setRemainingDays] = useState<number | null>(null);
  
  // États pour la modification de l'email
  const [newEmail, setNewEmail] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  
  // États pour la modification du mot de passe
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Informations du compte
  const [accountCreatedAt, setAccountCreatedAt] = useState<string>('');

  useEffect(() => {
    loadAccountData();
  }, [session]);

  const loadAccountData = async () => {
    try {
      setLoading(true);

      // Charger l'abonnement
      const sub = await subscriptionService.getCurrentSubscription(session.user.id);
      setCurrentSubscription(sub);

      // Charger les jours restants
      if (sub?.status === 'trial' && sub?.tier === 'free') {
        const days = await subscriptionService.getRemainingTrialDays(session.user.id);
        setRemainingDays(days);
      } else if (sub?.status === 'active') {
        const days = await subscriptionService.getRemainingSubscriptionDays(session.user.id);
        setRemainingDays(days);
      }

      // Récupérer la date de création du compte 
      const { data: userData, error } = await supabase
        .from('auth.users')
        .select('created_at')
        .eq('id', session.user.id)
        .single();

      if (!error && userData) {
        setAccountCreatedAt(userData.created_at);
      } else {
        // Fallback : utiliser session.user.created_at si disponible
        setAccountCreatedAt(session.user.created_at || '');
      }

      setNewEmail(session.user.email || '');
    } catch (error) {
      console.error('Erreur lors du chargement des données du compte:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === session.user.email) {
      toast.error('Veuillez entrer un nouvel email différent de l\'actuel');
      return;
    }

    // Validation simple de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error('Format d\'email invalide');
      return;
    }

    try {
      setSavingEmail(true);

      // Supabase envoie automatiquement 2 emails :
      // 1. À l'ancienne adresse : notification du changement
      // 2. À la nouvelle adresse : lien de confirmation
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) throw error;

      toast.success(
        `📧 Email de confirmation envoyé !\n\nVérifiez votre boîte de réception (${newEmail}) et cliquez sur le lien pour valider le changement.`,
        { duration: 8000 }
      );
      setEditingEmail(false);
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour de l\'email:', error);
      
      // Messages d'erreur plus explicites
      if (error.message?.includes('already registered')) {
        toast.error('Cette adresse email est déjà utilisée par un autre compte');
      } else if (error.message?.includes('rate limit')) {
        toast.error('Trop de tentatives. Veuillez réessayer dans quelques minutes.');
      } else {
        toast.error(error.message || 'Erreur lors de la mise à jour de l\'email');
      }
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setSavingPassword(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Mot de passe mis à jour avec succès !');
      setEditingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du mot de passe:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSavingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Inconnue';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getSubscriptionInfo = () => {
    if (!currentSubscription) return { name: 'Gratuit', color: 'text-gray-400', icon: User };

    const plan = SUBSCRIPTION_PLANS.find((p) => p.id === currentSubscription.tier);
    
    if (currentSubscription.status === 'expired') {
      return { name: 'Expiré', color: 'text-red-400', icon: X };
    }

    if (currentSubscription.status === 'trial') {
      return { name: 'Essai gratuit', color: 'text-yellow-400', icon: Clock };
    }

    return {
      name: plan?.name || 'Inconnu',
      color: plan?.color === 'blue' ? 'text-blue-400' : plan?.color === 'purple' ? 'text-purple-400' : plan?.color === 'gold' ? 'text-yellow-400' : 'text-gray-400',
      icon: Crown,
    };
  };

  const subscriptionInfo = getSubscriptionInfo();
  const SubscriptionIcon = subscriptionInfo.icon;

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

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft size={20} />
            Retour
          </button>

          <div className="text-center mb-8">
            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{
                textShadow:
                  '0 0 15px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.6), 0 0 30px rgba(255,255,255,0.4)',
              }}
            >
              Mon Compte
            </h1>
            <p className="text-lg text-gray-200">
              Gérez vos informations personnelles
            </p>
          </div>
        </div>

        {/* Sections du compte */}
        <div className="space-y-6">
          {/* Section : Informations générales */}
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <User className="w-6 h-6" />
              Informations générales
            </h2>

            <div className="space-y-4">
              {/* Date d'inscription */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-300">Date d'inscription</span>
                </div>
                <span className="text-white font-semibold">{formatDate(accountCreatedAt)}</span>
              </div>

              {/* Abonnement actuel */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SubscriptionIcon className={`w-5 h-5 ${subscriptionInfo.color}`} />
                  <span className="text-gray-300">Abonnement actuel</span>
                </div>
                <span className={`font-semibold ${subscriptionInfo.color}`}>
                  {subscriptionInfo.name}
                  {remainingDays !== null && remainingDays > 0 && (
                    <span className="ml-2 text-sm text-gray-400">
                      ({remainingDays} jour{remainingDays > 1 ? 's' : ''} restant{remainingDays > 1 ? 's' : ''})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Section : Email */}
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Adresse email
            </h2>

            {!editingEmail ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">{session.user.email}</span>
                <button
                  onClick={() => setEditingEmail(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Modifier
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nouvel email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    placeholder="nouveau@email.com"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUpdateEmail}
                    disabled={savingEmail}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {savingEmail ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Enregistrer
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingEmail(false);
                      setNewEmail(session.user.email || '');
                    }}
                    disabled={savingEmail}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <X size={18} />
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section : Mot de passe */}
          <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Lock className="w-6 h-6" />
              Mot de passe
            </h2>

            {!editingPassword ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-300">••••••••</span>
                <button
                  onClick={() => setEditingPassword(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Modifier
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Nouveau mot de passe */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 pr-10"
                      placeholder="Minimum 6 caractères"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Confirmer le nouveau mot de passe */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500 pr-10"
                      placeholder="Retapez le mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleUpdatePassword}
                    disabled={savingPassword}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {savingPassword ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Enregistrer
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={savingPassword}
                    className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <X size={18} />
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AccountPage;