import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { appContextService } from '../services/appContextService';
import { Player } from '../types/dnd';
import {
  LogOut,
  Plus,
  User,
  Sword,
  Shield,
  Sparkles,
  Trash2,
  Dices,
  Crown,
  Scroll,
  Settings,
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { authService } from '../services/authService';
import { subscriptionService } from '../services/subscriptionService';
import { SubscriptionPage } from './SubscriptionPage';
import { GameMasterCampaignPage } from './GameMasterCampaignPage';
import { AccountPage } from './AccountPage';
import { UserSubscription } from '../types/subscription';

// Intégration Character Creator (wizard)
import { CharacterExportPayload } from '../types/characterCreator';
import { createCharacterFromCreatorPayload } from '../services/characterCreationIntegration';
import CharacterCreationWizard from '../features/character-creator/components/characterCreationWizard';

interface CharacterSelectionPageProps {
  session: any;
  onCharacterSelect: (player: Player) => void;
}

const LAST_SELECTED_CHARACTER_SNAPSHOT = 'lastSelectedCharacterSnapshot';
const PENDING_PLAN_KEY = 'pending_plan_selection'; // Clé utilisée dans la HomePage

const BG_URL =
  (import.meta as any)?.env?.VITE_SELECTION_BG_URL ||
  'https://yumzqyyogwzrmlcpvnky.supabase.co/storage/v1/object/public/static/tmpoofee5sh.png';

type CreatorModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (payload: CharacterExportPayload) => void;
  initialSnapshot?: any;
};

function CreatorModal({ open, onClose, onComplete, initialSnapshot }: CreatorModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
      style={{ display: open ? 'block' : 'none' }}
    >
      <div className="w-screen h-screen relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-gray-800/80 hover:bg-gray-700 text-white px-3 py-1 rounded"
          aria-label="Fermer"
        >
          Fermer
        </button>

        <div className="w-full h-full bg-gray-900 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CharacterCreationWizard
              onFinish={onComplete}
              onCancel={onClose}
              initialSnapshot={initialSnapshot}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type WelcomeModalProps = {
  open: boolean;
  characterName: string;
  onContinue: () => void;
};

function WelcomeModal({ open, characterName, onContinue }: WelcomeModalProps) {
  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ display: open ? 'flex' : 'none' }}
    >
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-purple-500/30 rounded-xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center">
            <Dices className="w-8 h-8 text-purple-400" />
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-red-400">Bienvenue {characterName}</h2>
            <div className="flex items-center justify-center gap-2">
              <p
                className="text-lg text-gray-200 font-medium"
                style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}
              >
                L'aventure commence ici
              </p>
              <Dices className="w-6 h-6 text-purple-400" />
            </div>
          </div>

          <button
            onClick={onContinue}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            Continuer
          </button>
        </div>
      </div>
    </div>
  );
}

export function CharacterSelectionPage({ session, onCharacterSelect }: CharacterSelectionPageProps) {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [creating, setCreating] = useState(false);
  const [deletingCharacter, setDeletingCharacter] = useState<Player | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [newCharacter, setNewCharacter] = useState<Player | null>(null);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [remainingTrialDays, setRemainingTrialDays] = useState<number | null>(null);

  // ✅ Protection contre les rechargements multiples
  const hasInitializedRef = useRef(false);
  const playersLoadedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    // ✅ GESTION DE LA REDIRECTION APRÈS LOGIN
    // On vérifie si l'utilisateur avait cliqué sur un plan avant de se loguer
    const pendingPlan = localStorage.getItem(PENDING_PLAN_KEY);
    if (pendingPlan) {
      console.log('[CharacterSelection] 🎯 Intention de souscription détectée:', pendingPlan);
      localStorage.removeItem(PENDING_PLAN_KEY); // On nettoie pour ne pas rouvrir à chaque fois
      setShowSubscription(true);
      // Optionnel : On pourrait aussi passer 'pendingPlan' à SubscriptionPage pour scroller/highlighter
      toast('Veuillez confirmer votre choix d\'abonnement', { icon: '👋' });
    }

    // Check context wizard
    const context = appContextService.getContext();
    const wizardSnapshot = appContextService.getWizardSnapshot();
    
    if (wizardSnapshot) {
      if (context === 'wizard') {
        // Logique wizard existante...
      } else {
        appContextService.clearWizardSnapshot();
      }
    }

    appContextService.setContext('selection');

    fetchPlayers();
    loadSubscription();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubscription = async () => {
    try {
      const sub = await subscriptionService.getCurrentSubscription(session.user.id);
      setCurrentSubscription(sub);

      if (sub?.tier === 'free' && sub?.status === 'trial') {
        const days = await subscriptionService.getRemainingTrialDays(session.user.id);
        setRemainingTrialDays(days);
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'abonnement:', error);
    }
  };

  const fetchPlayers = async () => {
    if (playersLoadedRef.current) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setPlayers(data || []);
      playersLoadedRef.current = true;
    } catch (error: any) {
      console.error('Erreur lors de la récupération des personnages:', error);
      toast.error('Erreur lors de la récupération des personnages');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatorComplete = async (payload: CharacterExportPayload) => {
    if (creating) return;

    try {
      const { stopWizardMusic } = await import('../features/character-creator/components/ui/musicControl');
      stopWizardMusic();
    } catch (e) {
      console.warn('[CharacterSelection] Impossible d\'arrêter la musique:', e);
    }

    const canCreate = await subscriptionService.canCreateCharacter(session.user.id, players.length);
    if (!canCreate) {
      const limit = await subscriptionService.getCharacterLimit(session.user.id);
      const isExpired = await subscriptionService.isTrialExpired(session.user.id);
      
      if (isExpired) {
        toast.error(
          'Votre période d\'essai de 15 jours est terminée. Choisissez un plan pour continuer.',
          { duration: 5000 }
        );
      } else {
        toast.error(
          `Vous avez atteint la limite de ${limit} personnage${limit > 1 ? 's' : ''}. Mettez à niveau votre abonnement pour en créer plus.`,
          { duration: 5000 }
        );
      }
      
      setShowCreator(false);
      setShowSubscription(true);
      return;
    }

    try {
      setCreating(true);
      const newPlayer = await createCharacterFromCreatorPayload(session, payload);
      setPlayers((prev) => [...prev, newPlayer]);
      toast.success('Nouveau personnage créé !');

      appContextService.clearWizardSnapshot();
      appContextService.setContext('game');

      setNewCharacter(newPlayer);
      setShowWelcome(true);

    } catch (error: any) {
      console.error('Erreur création via assistant:', error);
      if (error.message?.includes('Session invalide') || error.message?.includes('non authentifié')) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        await supabase.auth.signOut();
      } else {
        toast.error("Impossible de créer le personnage depuis l'assistant.");
      }
    } finally {
      setCreating(false);
      setShowCreator(false);
    }
  }; 

  const handleWelcomeContinue = () => {
    setShowWelcome(false);
    if (newCharacter) {
      onCharacterSelect(newCharacter);
      setNewCharacter(null);
    }
  };

  const clearServiceWorkerCache = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
        }
      }
      
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          if (name.includes('js-cache') || name.includes('workbox')) {
            await caches.delete(name);
          }
        }
      }
    } catch (error) {
      console.error('[CharacterSelection] ❌ Erreur nettoyage cache:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await clearServiceWorkerCache();
      
      const { error } = await authService.signOut();
      if (error) throw error;

      toast.success('Déconnexion réussie');

      appContextService.clearContext();
      appContextService.clearWizardSnapshot();
      
      try {
        localStorage.removeItem(LAST_SELECTED_CHARACTER_SNAPSHOT);
        localStorage.removeItem(PENDING_PLAN_KEY); // Nettoyage de sécurité
        sessionStorage.clear();
      } catch {}

      window.location.href = window.location.origin;
      
    } catch (error: any) {
      console.error('❌ Erreur de déconnexion:', error);
      toast.error('Erreur lors de la déconnexion');
      
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 1000);
    }
  };

  const handleDeleteCharacter = async (character: Player) => {
    if (deleteConfirmation !== 'Supprime') {
      toast.error('Veuillez taper exactement "Supprime" pour confirmer');
      return;
    }

    try {
      let deleted = false;
      try {
        await supabase.rpc('delete_character_safely', { character_id: character.id });
        deleted = true;
      } catch {
        deleted = false;
      }

      if (!deleted) {
        const { error } = await supabase.from('players').delete().eq('id', character.id);
        if (error) throw error;
      }

      setPlayers((prev) => prev.filter((p) => p.id !== character.id));
      setDeletingCharacter(null);
      setDeleteConfirmation('');

      toast.success(`Personnage "${character.adventurer_name || character.name}" supprimé`);
    } catch (error: any) {
      console.error('Erreur lors de la suppression du personnage:', error);
      toast.error('Erreur lors de la suppression du personnage');
    }
  };

  const getClassIcon = (playerClass: string | null | undefined) => {
    switch (playerClass) {
      case 'Guerrier':
      case 'Paladin':
        return <Sword className="w-5 h-5 text-red-500" />;
      case 'Magicien':
      case 'Ensorceleur':
      case 'Occultiste':
        return <Sparkles className="w-5 h-5 text-purple-500" />;
      case 'Clerc':
      case 'Druide':
        return <Shield className="w-5 h-5 text-yellow-500" />;
      default:
        return <User className="w-5 h-5 text-gray-500" />;
    }
  };

  const displayClassName = (cls?: string | null) => (cls === 'Sorcier' ? 'Occultiste' : cls || '');

  const getSubscriptionText = () => {
    if (!currentSubscription) return null;

    if (currentSubscription.tier === 'free' && currentSubscription.status === 'trial') {
      const daysLeft = remainingTrialDays ?? 0;
      return `Essai gratuit : ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`;
    }

    if (currentSubscription.status === 'expired') {
      return 'Essai expiré';
    }

    if (currentSubscription.tier === 'hero') {
      return 'Plan Héro';
    }

    if (currentSubscription.tier === 'game_master') {
      return 'Plan Maître du Jeu';
    }

    return null;
  };

   if (showCampaigns) {
    return <GameMasterCampaignPage session={session} onBack={() => setShowCampaigns(false)} />;
  }

  // Si showSubscription est activé (via le bouton ou via la redirection auto), on affiche la page
  if (showSubscription) {
    return <SubscriptionPage session={session} onBack={() => setShowSubscription(false)} />;
  }

  if (showAccount) {
    return <AccountPage session={session} onBack={() => setShowAccount(false)} />;
  }

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
        <div className="text-center space-y-4">
          <img 
            src="/icons/wmremove-transformed.png" 
            alt="Chargement..." 
            className="animate-spin h-12 w-12 mx-auto object-contain"
            style={{ backgroundColor: 'transparent' }}
          />
          <p className="text-gray-200">Chargement des personnages...</p>
        </div>
      </div>
    );
  }
 
  return (
    <div
      className="character-selection-page min-h-screen flex flex-col"
      style={{
        backgroundImage: `url(${BG_URL})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundColor: 'transparent',
      }}
      >
      
      {/* --- 1. NAVBAR (RECTANGLE FULL WIDTH) --- */}
      <div className="w-full bg-black/80 backdrop-blur-xl border-b border-white/10 z-50">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
           
           {/* GAUCHE : Communauté */}
           <div className="flex items-center gap-6">
              <a 
                 href="https://discord.gg/7zVKwtTe" 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="group flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-blue-400 transition-colors"
               >
                  <span>Un bug, une question ?</span>
                  <img 
                    src="https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/Discord%20Logo%20png%20-%20641x220.png" 
                    alt="Discord" 
                    className="h-4 w-auto brightness-0 invert opacity-60 group-hover:opacity-100 transition-all" 
                  />
               </a>
               
               <div className="h-4 w-px bg-white/10 hidden md:block"></div>

               <a
                href="https://buymeacoffee.com/mewan44"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-90 transition-opacity"
                title="Offrir un café au développeur"
              >
                <img
                  src="https://raw.githubusercontent.com/Moze75/Ultimate_Tracker/main/Visuels_HomePage/bmc-button.png"
                  alt="Buy Me a Coffee"
                  className="h-8 w-auto" 
                />
              </a>
           </div>

           {/* DROITE : Actions Admin */}
           <div className="flex items-center gap-3">
               {currentSubscription && (
                   <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border opacity-70 mr-2 ${
                     currentSubscription.status === 'active' 
                     ? 'bg-green-500/5 border-green-500/20 text-green-400' 
                     : 'bg-gray-800/40 border-gray-600/20 text-gray-400'
                   }`}>
                    {getSubscriptionText()}
                  </span>
               )}

               <button
                  onClick={() => setShowSubscription(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 text-gray-200 text-xs font-medium transition-all"
                >
                  <Crown size={14} className="text-purple-400" />
                  <span className="hidden sm:inline">
                    {currentSubscription?.status === 'expired' || currentSubscription?.status === 'trial' 
                      ? 'Passer Premium'
                      : 'Abonnement'
                    }
                  </span>
               </button>

               <button
                onClick={() => setShowAccount(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 text-gray-200 text-xs font-medium transition-all"
              >
                <Settings size={14} className="text-gray-400" />
                <span className="hidden sm:inline">Compte</span>
              </button>
           </div>
        </div>
      </div>

      {/* --- 2. CONTENU PRINCIPAL --- */}
      <div className="flex-1 py-12 bg-transparent">
        <div className="w-full max-w-7xl mx-auto px-4"> 
         
          {/* Titre & Contexte */}
          <div className="text-center mb-12">
            
            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight"
              style={{
                textShadow: '0 0 30px rgba(255,255,255,0.2)',
              }}
            >
              Mes Personnages
            </h1>
            
            <p className="text-lg text-gray-300 font-light">
              {players.length > 0
                ? `${players.length} personnage${players.length > 1 ? 's' : ''} prêt${players.length > 1 ? 's' : ''} pour l'aventure`
                : 'Aucun personnage pour le moment'}
            </p>

            {/* Action MJ */}
            {currentSubscription?.tier === 'game_master' && (
               <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                  <button
                    onClick={() => setShowCampaigns(true)}
                    className="group relative inline-flex items-center justify-center gap-3 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-700 to-orange-800 text-white font-semibold text-lg shadow-xl shadow-orange-900/20 border border-orange-500/20 overflow-hidden transition-all hover:scale-105 hover:shadow-orange-900/40"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <Scroll size={20} />
                    <span>Gérer mes Campagnes</span>
                  </button>
               </div>
            )}
          </div>

          {deletingCharacter && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-red-500/20">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-100">Supprimer le personnage</h3>
                    <p className="text-sm text-gray-400">
                      {deletingCharacter.adventurer_name || deletingCharacter.name}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm font-medium mb-2">
                      ⚠️ Attention : Cette action est irréversible !
                    </p>
                    <p className="text-gray-300 text-sm">
                      Toutes les données du personnage (inventaire, attaques, statistiques) seront
                      définitivement supprimées.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pour confirmer, tapez exactement:{' '}
                      <span className="text-red-400 font-bold">Supprime</span>
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="input-dark w-full px-3 py-2 rounded-md"
                      placeholder="Tapez 'Supprime' pour confirmer"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => handleDeleteCharacter(deletingCharacter)}
                      disabled={deleteConfirmation !== 'Supprime'}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex-1 transition-colors"
                    >
                      Supprimer définitivement
                    </button>
                    <button
                      onClick={() => {
                        setDeletingCharacter(null);
                        setDeleteConfirmation('');
                      }}
                      className="btn-secondary px-4 py-2 rounded-lg"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center mb-8 sm:mb-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
              {players.map((player) => {
                const maxHp = Math.max(0, Number(player.max_hp || 0));
                const currHp = Math.max(0, Number(player.current_hp || 0));
                const tempHp = Math.max(0, Number(player.temporary_hp || 0));
                const ratio =
                  maxHp > 0 ? Math.min(100, Math.max(0, ((currHp + tempHp) / maxHp) * 100)) : 0;

                return (
                  <div
                    key={player.id}
                    className="w-full max-w-sm relative group bg-slate-800/60 backdrop-blur-sm border border-slate-600/40 rounded-xl shadow-lg overflow-hidden hover:bg-slate-700/70 transition-all duration-200"
                  >
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingCharacter(player);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 bg-red-600/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-20"
                      title="Supprimer le personnage"
                      aria-label="Supprimer le personnage"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div
                      className="p-6 cursor-pointer hover:scale-[1.02] transition-all duration-200 relative z-10"
                      onClick={() => onCharacterSelect(player)}
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-white/10">
                          <Avatar
                            url={player.avatar_url}
                            playerId={player.id}
                            size="md"
                            editable={false}
                            onAvatarUpdate={() => {}}
                            secondaryClass={player.secondary_class}
                            secondaryLevel={player.secondary_level}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="mb-3">
                            <h3 className="text-lg font-bold text-gray-100 mb-1 truncate">
                              {player.adventurer_name || player.name}
                            </h3>

                            {player.class ? (
                              <div className="flex items-center gap-2 mb-2">
                                {getClassIcon(player.class)}
                                <span className="text-sm text-slate-200">
                                  {displayClassName(player.class)} niveau {player.level}
                                </span>
                              </div>
                            ) : (
                              <p className="text-sm text-slate-300 mb-2">Personnage non configuré</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="w-full bg-slate-700/50 rounded-full h-3">
                              <div
                                className="bg-gradient-to-r from-red-500 to-red-400 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${ratio}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-200">
                              {currHp} / {maxHp} PV
                              {tempHp > 0 && <span className="text-blue-300 ml-1">(+{tempHp})</span>}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div
                onClick={() => setShowCreator(true)}
                className="w-full max-w-sm cursor-pointer hover:scale-[1.02] transition-all duration-200 bg-slate-800/40 backdrop-blur-sm border-dashed border-2 border-slate-600/50 hover:border-green-500/50 group rounded-xl overflow-hidden"
              >
                <div className="p-6 flex items-center justify-center gap-6 min-h-[140px]">
                  <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center">
                    <Plus className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-100 mb-2">Nouveau Personnage</h3>
                    <p className="text-sm text-slate-200">
                      Créez un nouveau personnage pour vos aventures
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="w-full max-w-md mx-auto px-4">
          <button
            onClick={handleSignOut}
            className="w-full btn-secondary px-4 py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
          >
            <LogOut size={20} />
            Déconnexion
          </button>
        </div>
      </div>

      <CreatorModal
        open={showCreator}
        onClose={() => {
          console.log('[CharacterSelection] 🚪 Fermeture du wizard');
          import('../features/character-creator/components/ui/musicControl').then(({ stopWizardMusic }) => {
            stopWizardMusic();
          });
          
          setShowCreator(false);
          appContextService.clearWizardSnapshot();
          appContextService.setContext('selection');
        }}
        onComplete={handleCreatorComplete}
        initialSnapshot={appContextService.getWizardSnapshot()}
      />

      {creating && (
        <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center max-w-md">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Chargement..." 
              className="animate-spin h-16 w-16 mx-auto mb-6 object-contain"
              style={{ backgroundColor: 'transparent' }}
            />
            <p className="text-xl text-gray-200 mb-2">Création du personnage...</p>
            <p className="text-sm text-gray-400">Veuillez patienter</p>
          </div>
        </div>
      )}

      <WelcomeModal
        open={showWelcome}
        characterName={newCharacter?.adventurer_name || newCharacter?.name || 'Aventurier'}
        onContinue={handleWelcomeContinue}
      />
    </div>
  );
}

export default CharacterSelectionPage;