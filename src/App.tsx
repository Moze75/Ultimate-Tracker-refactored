import React, { useEffect, useState, useRef } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import type { Player } from './types/dnd';
import { InstallPrompt } from './components/InstallPrompt';
import { appContextService } from './services/appContextService';
import { HomePage } from './pages/HomePage';
import { DiceHistoryProvider } from './hooks/useDiceHistoryContext';
import { DiceSettingsProvider } from './hooks/useDiceSettings'; // ✅ AJOUT
import { flushHPQueue } from './services/hpSyncQueue';
import { getPlayerSnapshot } from './services/playerLocalStore'; 
import PaymentSuccessPage from './pages/PaymentSuccessPage';

const LAST_SELECTED_CHARACTER_SNAPSHOT = 'selectedCharacter';
const SKIP_AUTO_RESUME_ONCE = 'ut:skipAutoResumeOnce';
const MAX_RETRIES = 1; // ✅ MODIFIÉ : 1 seul essai au lieu de 3
const RETRY_DELAY = 1000; // ✅ 1 seconde au lieu de 1.5

// ✅ Helper pour le cache player avec TTL
const PLAYER_CACHE_KEY = (id: string) => `ut:player:${id}`;
const PLAYER_CACHE_TS_KEY = (id: string) => `ut:player:ts:${id}`;
const PLAYER_CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const getCachedPlayer = (playerId: string): Player | null => {
  try {
    const cached = localStorage.getItem(PLAYER_CACHE_KEY(playerId));
    const ts = localStorage.getItem(PLAYER_CACHE_TS_KEY(playerId));
    
    if (cached && ts) {
      const age = Date.now() - parseInt(ts, 10);
      if (age < PLAYER_CACHE_TTL) {
        return JSON.parse(cached);
      }
    }
  } catch {}
  return null;
};

const setCachedPlayer = (player: Player) => {
  try {
    localStorage. setItem(PLAYER_CACHE_KEY(player.id), JSON.stringify(player));
    localStorage. setItem(PLAYER_CACHE_TS_KEY(player.id), Date.now().toString());
  } catch {}
};

const invalidatePlayerCache = (playerId: string) => {
  localStorage. removeItem(PLAYER_CACHE_TS_KEY(playerId));
};

function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<Player | null>(null);

  const [componentLoadError, setComponentLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [LoginPage, setLoginPage] = useState<React.ComponentType<any> | null>(null);
  const [CharacterSelectionPage, setCharacterSelectionPage] = useState<React.ComponentType<any> | null>(null);
  const [GamePage, setGamePage] = useState<React.ComponentType<any> | null>(null);
  const [hardLoggedOut, setHardLoggedOut] = useState(false);
  const [showHomePage, setShowHomePage] = useState(true); // ✅ NOUVEAU : État pour afficher la homepage

  // Refs pour le handler "back"
  const backPressRef = useRef<number>(0);
  const sessionRef = useRef<any>(null);
  const selectedCharacterRef = useRef<Player | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    selectedCharacterRef.current = selectedCharacter;
  }, [selectedCharacter]);

// ✅ MODIFIÉ : Charger dynamiquement les pages avec retry limité
useEffect(() => {
  let currentRetry = 0;
  let isCancelled = false;

  const loadComponents = async () => {
    if (isCancelled) return;

    try {
      console.log(`[App] 🔄 Tentative de chargement des composants (${currentRetry + 1}/${MAX_RETRIES})...`);
      
      const [loginModule, characterSelectionModule, gamePageModule] = await Promise.all([
        import('./pages/LoginPage'),
        import('./pages/CharacterSelectionPage'),
        import('./pages/GamePage')
      ]);

      if (isCancelled) return;

      setLoginPage(() => (loginModule as any).LoginPage ?? (loginModule as any).default);
      setCharacterSelectionPage(
        () => (characterSelectionModule as any).CharacterSelectionPage ?? (characterSelectionModule as any).default
      );
      setGamePage(() => (gamePageModule as any).GamePage ?? (gamePageModule as any).default);
      
      console.log('[App] ✅ Composants chargés avec succès');
      setComponentLoadError(false);
      setRetryCount(0);
    } catch (error) {
      console.error(`[App] ❌ Erreur chargement composants (tentative ${currentRetry + 1}/${MAX_RETRIES}):`, error);
      
      if (currentRetry < MAX_RETRIES - 1 && !isCancelled) {
        currentRetry++;
        setRetryCount(currentRetry);
        console.log(`[App] ⏱️ Nouvelle tentative dans ${RETRY_DELAY}ms...`);
        setTimeout(loadComponents, RETRY_DELAY);
      } else if (!isCancelled) {
        console.error('[App] 💥 Échec définitif après', MAX_RETRIES, 'tentatives');
        console.error('[App] 🔄 Rechargement forcé de la page...');
        
        // ✅ NOUVEAU : Au lieu d'afficher l'erreur, recharger la page
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }
  };

  loadComponents();

  return () => {
    isCancelled = true;
  };
}, []);

  // Initialisation session + restauration du personnage si session présente
  useEffect(() => {
    const initSession = async () => {
      try {
        console.log('=== [App] 🔑 INITIALISATION SESSION ===');
        
        // ✅ NOUVEAU :  Traiter les confirmations via /auth/confirm? token_hash=... 
        const urlParams = new URLSearchParams(window.location.search);
        const tokenHash = urlParams.get('token_hash');
        const type = urlParams.get('type');

        if (tokenHash && (type === 'signup' || type === 'email' || type === 'recovery')) {
          console.log('[App] 📧 Token hash détecté - type:', type);
          
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash:  tokenHash,
              type: type === 'recovery' ? 'recovery' : 'email'
            });
            
            if (error) {
              console.error('[App] ❌ Erreur vérification token:', error);
              toast.error('Le lien de confirmation a expiré ou est invalide.  Veuillez réessayer.');
            } else {
              console.log('[App] ✅ Email confirmé avec succès - user:', data. user?.email);
              sessionStorage.removeItem('ut: explicit-logout');
              setShowHomePage(false);
              
              if (type === 'signup') {
                toast.success('Email confirmé !  Bienvenue sur Le Compagnon D&D 🎉');
              } else if (type === 'recovery') {
                toast.success('Connexion réussie ! Vous pouvez maintenant changer votre mot de passe.');
              }
            }
          } catch (e) {
            console.error('[App] ❌ Exception vérification:', e);
            toast.error('Erreur lors de la confirmation. Veuillez réessayer.');
          }
          
          // Nettoyer l'URL (supprimer les paramètres)
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // ✅ NOUVEAU : Traiter les tokens de confirmation/récupération dans l'URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && refreshToken) {
          console.log('[App] 📧 Token détecté dans URL - type:', type);
          
          try {
            // Laisser Supabase traiter le token
            const { data, error } = await supabase. auth.setSession({
              access_token: accessToken,
              refresh_token:  refreshToken
            });
            
            if (error) {
              console. error('[App] ❌ Erreur traitement token:', error);
              toast.error('Erreur lors de la confirmation.  Veuillez réessayer.');
            } else {
              console. log('[App] ✅ Token traité avec succès - user:', data.user?. email);
              
              // Nettoyer le flag de logout et afficher un message
              sessionStorage. removeItem('ut: explicit-logout');
              
              if (type === 'signup') {
                toast.success('Email confirmé !  Bienvenue sur Le Compagnon D&D 🎉');
              } else if (type === 'recovery') {
                toast.success('Connexion réussie !  Vous pouvez maintenant changer votre mot de passe.');
              }
            }
          } catch (e) {
            console.error('[App] ❌ Exception traitement token:', e);
          }
          
          // Nettoyer l'URL (supprimer le hash)
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        console.log('[App] hardLoggedOut actuel:', hardLoggedOut);
        console.log('[App] sessionStorage ut:explicit-logout:', sessionStorage. getItem('ut: explicit-logout'));
        console.log('[App] localStorage selectedCharacter:', localStorage.getItem('selectedCharacter') ? 'PRÉSENT' : 'ABSENT');
        
            // ✅ NOUVEAU : Vérifier si on vient d'une confirmation d'email (lien Supabase)
        const urlHash = window.location. hash;
        const urlParams = new URLSearchParams(window.location.search);
        const isEmailConfirmation = urlHash. includes('access_token') || 
                                     urlHash.includes('type=signup') ||
                                     urlHash.includes('type=recovery') ||
                                     urlParams.get('type') === 'signup' ||
                                     urlParams.get('type') === 'recovery';
        
        if (isEmailConfirmation) {
          console.log('[App] 📧 Confirmation email détectée - nettoyage du flag explicit-logout');
          sessionStorage.removeItem('ut:explicit-logout');
          // Nettoyer l'URL pour éviter les problèmes de refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // ✅ Vérifier si on vient d'un logout explicite (SEULEMENT si pas de confirmation email)
        const explicitLogout = sessionStorage.getItem('ut:explicit-logout');
        console.log('[App] Vérification explicit-logout:', explicitLogout);
        
        if (explicitLogout === 'true' && !isEmailConfirmation) {
          console.log('[App] 🚪 LOGOUT EXPLICITE DÉTECTÉ - forcer déconnexion');
          sessionStorage.removeItem('ut:explicit-logout');
          
          // Vérifier s'il y a une session active
          const { data: preCheck } = await supabase.auth.getSession();
          console.log('[App] Session avant force-logout:', preCheck.session ? 'ACTIVE' : 'NULLE');
          
          // Forcer la déconnexion côté Supabase
          try {
            await supabase.auth. signOut({ scope:  'local' });
            console.log('[App] ✅ Force signOut réussi');
          } catch (e) {
            console.warn('[App] ⚠️ Erreur force signOut:', e);
          }
          
          // Nettoyer les données locales
          localStorage. removeItem('selectedCharacter');
          localStorage.removeItem('lastSelectedCharacterSnapshot');
          
          // Supprimer aussi les clés Supabase résiduelles
          const supabaseKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('sb-') || key.includes('supabase')
          );
          console.log('[App] Suppression de', supabaseKeys. length, 'clés Supabase résiduelles');
          supabaseKeys.forEach(key => localStorage.removeItem(key));
          
          setSession(null);
          setSelectedCharacter(null);
          setHardLoggedOut(true);
          setLoading(false);
          console.log('[App] ✅ État réinitialisé, retour early');
          return;
        }
        
        // ✅ NOUVEAU :  Vérifier si on vient directement sur /login ou /app
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/app' || currentPath.startsWith('/app/')) {
          setShowHomePage(false);
          console.log('[App] 🏠 Navigation directe vers', currentPath, '- skip homepage');
        }
        const { data } = await supabase.auth.getSession();
        const current = data?.session ?? null;
        setSession(current);

        if (current) {
          const context = appContextService.getContext();
          console.log('[App] 📍 Contexte détecté:', context);

          // ✅ Important : si cette instance a fait un hard logout,
          // ne pas auto-reprendre de personnage même si une session existe encore.
          if (hardLoggedOut) {
            console.log('[App] 🚫 hardLoggedOut=true -> pas d\'auto-resume malgré session présente');
          } else if (context === 'wizard') {
            console.log('[App] 🧙 Contexte wizard - pas de restauration de personnage');
          } else {
            if (sessionStorage.getItem(SKIP_AUTO_RESUME_ONCE) === '1') {
              console.log('[App] ⏭️ Skip auto-resume activé');
              sessionStorage.removeItem(SKIP_AUTO_RESUME_ONCE);
            } else {
              const savedChar = localStorage.getItem(LAST_SELECTED_CHARACTER_SNAPSHOT);
              if (savedChar) {
                try {
                  const parsed = JSON.parse(savedChar);
                  appContextService.setContext('game');
                  setShowHomePage(false); // ✅ AJOUT : On force le masquage de la home page
                  console.log('[App] 🎮 Personnage restauré:', parsed.name);
                } catch (e) {
                  console.error('[App] ❌ Erreur parsing personnage:', e);
                }
              }
            }
          }
        } else {
          console.log('[App] 🔓 Pas de session - purge mémoire');
          setSelectedCharacter(null);
          appContextService.clearContext();
          appContextService.clearWizardSnapshot();
        }
      } catch (error) {
        console.error('[App] ❌ Erreur initialisation session:', error);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [hardLoggedOut]);

    // Écoute des changements d'état d'authentification
  useEffect(() => {
      const { data: sub } = supabase.auth. onAuthStateChange((event, newSession) => {
      console.log('=== [App] 🔄 AUTH STATE CHANGE ===');
      console.log('[App] Event:', event);
      console.log('[App] New session:', newSession ?  'PRÉSENTE - user:  ' + newSession. user?. email : 'NULLE');
      console.log('[App] hardLoggedOut:', hardLoggedOut);
      console.log('[App] sessionStorage ut:explicit-logout:', sessionStorage.getItem('ut:explicit-logout'));
      
      // ✅ NOUVEAU : Si c'est une confirmation d'email ou un nouveau login, nettoyer le flag
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        console. log('[App] 📧 Event de connexion/confirmation - nettoyage du flag explicit-logout');
        sessionStorage.removeItem('ut:explicit-logout');
      }

      if (!newSession) {
        console.log('[App] 🔓 Déconnexion - purge');
        setSelectedCharacter(null);
        localStorage.removeItem(LAST_SELECTED_CHARACTER_SNAPSHOT);
        appContextService.clearContext();
        appContextService.clearWizardSnapshot();
        setHardLoggedOut(true); // ✅ Cette instance considère qu'on est vraiment sorti
      } else {
        // Nouvelle session non nulle : on peut à nouveau autoriser l'auto-resume
        setHardLoggedOut(false);

        if (!selectedCharacter) {
          const context = appContextService.getContext();
          
          if (context === 'wizard') {
            console.log('[App] 🧙 Auth change: wizard actif');
          } else {
            if (sessionStorage.getItem(SKIP_AUTO_RESUME_ONCE) === '1') {
              sessionStorage.removeItem(SKIP_AUTO_RESUME_ONCE);
             } else {
              const savedChar = localStorage.getItem(LAST_SELECTED_CHARACTER_SNAPSHOT);
              if (savedChar) {
                try {
                  const parsed = JSON.parse(savedChar);
                  setSelectedCharacter(parsed); // ✅ FIX : Restaurer le personnage ! 
                  appContextService.setContext('game');
                  setShowHomePage(false);
                  console.log('[App] 🎮 Personnage restauré:', parsed.name);
                } catch (e) {
                  console.error('[App] ❌ Erreur parsing (auth change):', e);
                }
              }
            }
          }
        }
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('[App] 🔄 Token rafraîchi silencieusement');
        // Reconnexion silencieuse - pas de bandeau
      }
    });

    return () => {
      try {
        sub.subscription.unsubscribe();
      } catch {
        // no-op
      }
    };
  }, [selectedCharacter]);

  // ✅ HP offline : appliquer snapshot local + flush de la queue quand un perso est sélectionné / restauré
  useEffect(() => {
    if (!selectedCharacter) return;

    try {
      const localSnapshot = getPlayerSnapshot(selectedCharacter.id);
      if (localSnapshot) {
        const merged: Player = {
          ...selectedCharacter,
          current_hp: localSnapshot.current_hp,
          temporary_hp: localSnapshot.temporary_hp,
          max_hp: (localSnapshot as any).max_hp ?? selectedCharacter.max_hp,
        };
        setSelectedCharacter(merged);
        console.log('[App] 💾 HP restaurés depuis snapshot local pour', merged.name);
      }
    } catch (e) {
      console.warn('[App] Erreur application snapshot HP local:', e);
    }

    const sync = async () => {
      try {
        if (navigator.onLine) {
          await flushHPQueue();
        }
      } catch (e) {
        console.warn('[App] Erreur flushHPQueue init:', e);
      }
    };
    sync();
  }, [selectedCharacter?.id]);
  
  // Sauvegarder le personnage sélectionné
  useEffect(() => {
    if (selectedCharacter) {
      try {
        localStorage.setItem(LAST_SELECTED_CHARACTER_SNAPSHOT, JSON.stringify(selectedCharacter));
        appContextService.setContext('game');
        console.log('[App] 💾 Personnage sauvegardé:', selectedCharacter.name);
      } catch (e) {
        console.error('[App] ❌ Erreur sauvegarde personnage:', e);
      }
    }
  }, [selectedCharacter]);

  // Gestion du bouton "retour"
  useEffect(() => {
    try {
      window.history.pushState({ ut: 'keepalive' }, '');
    } catch {
      // no-op
    }

    const onPopState = (_ev: PopStateEvent) => {
      if (sessionRef.current && selectedCharacterRef.current) {
        console.log('[App] ⬅️ Retour: jeu → sélection');
        try {
          sessionStorage.setItem(SKIP_AUTO_RESUME_ONCE, '1');
          appContextService.setContext('selection');
        } catch {
          // no-op
        }
        setSelectedCharacter(null);
        try {
          window.history.pushState({ ut: 'keepalive' }, '');
        } catch {
          // no-op
        }
        return;
      }

      const now = Date.now();
      if (now - (backPressRef.current ?? 0) < 1500) {
        console.log('[App] ⬅️ Double appui: quitter');
        window.removeEventListener('popstate', onPopState);
        window.history.back();
      } else {
        backPressRef.current = now;
        toast('Appuyez à nouveau pour quitter', { icon: '↩️' });
        try {
          window.history.pushState({ ut: 'keepalive' }, '');
        } catch {
          // no-op
        }
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

    // ✅ HP offline : flush de la queue HP quand le réseau revient
  useEffect(() => {
    const handleOnline = () => {
      flushHPQueue().catch((e) => {
        console.warn('[App] Erreur flushHPQueue (online event):', e);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // ✅ MODIFIÉ : Écran d'erreur de chargement
  if (componentLoadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
        <div className="text-center space-y-6 max-w-md">
          <div className="text-red-400 text-7xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white">Erreur de chargement</h2>
          <p className="text-gray-400 text-lg">
            Impossible de charger l'application après {MAX_RETRIES} tentatives.
          </p>
          <div className="space-y-2 text-sm text-gray-500">
            <p>Causes possibles :</p>
            <ul className="list-disc list-inside text-left">
              <li>Cache du Service Worker corrompu</li>
              <li>Problème de connexion internet</li>
              <li>Fichiers manquants sur le serveur</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                console.log('[App] 🔄 Rechargement forcé');
                window.location.reload();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              🔄 Recharger l'application
            </button>
            <button
              onClick={() => {
                console.log('[App] 🗑️ Nettoyage cache + rechargement');
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (const registration of registrations) {
                      registration.unregister();
                    }
                    caches.keys().then(names => {
                      for (const name of names) {
                        caches.delete(name);
                      }
                      window.location.reload();
                    });
                  });
                } else {
                  window.location.reload();
                }
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              🗑️ Vider le cache et recharger
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ MODIFIÉ : Écran de chargement des composants avec indicateur de retry
  if (!LoginPage || ! CharacterSelectionPage || !GamePage) {
    return (
      <>
        <Toaster position="top-right" />
        <InstallPrompt />
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center space-y-4">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Chargement..." 
              className="animate-spin rounded-full h-12 w-12 mx-auto object-cover" 
            />
            <p className="text-gray-400">Chargement des composants...</p>
            {retryCount > 0 && (
              <p className="text-yellow-400 text-sm">
                Tentative {retryCount + 1}/{MAX_RETRIES}
              </p>
            )}
          </div>
        </div>
      </>
    );
  }

  // Écran de chargement initial (session)
  if (loading) {
    return (
      <>
        <Toaster position="top-right" />
        <InstallPrompt />
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center space-y-4">
            <img 
              src="/icons/wmremove-transformed.png" 
              alt="Chargement..." 
              className="animate-spin rounded-full h-12 w-12 mx-auto object-cover" 
            />
            <p className="text-gray-400">Initialisation...</p>
          </div>
        </div>
      </>
    );
  }

  // Rendu principal
  return (
    <DiceSettingsProvider> {/* ✅ AJOUT DU PROVIDER ICI */}
      <DiceHistoryProvider>
        <Toaster position="top-right" />
        <InstallPrompt />

         {/* ✅ NOUVEAU : Afficher la HomePage si showHomePage est true et pas de session */}
      {(() => {
      // Détecter si on est sur /payment-success
      const urlParams = new URLSearchParams(window.location.search);
      const isPaymentSuccess = urlParams.has('userId') && urlParams.has('tier');

      if (isPaymentSuccess && session) {
        return (
          <PaymentSuccessPage
            onBackToDashboard={() => {
              setShowHomePage(false);
              // L'utilisateur revient au dashboard (sélection de personnage)
            }}
          />
        );
      }

      if (showHomePage) {
        return <HomePage onGetStarted={() => setShowHomePage(false)} />;
      }

      if (!session) {
        return <LoginPage onBackToHome={() => setShowHomePage(true)} />;
      }

      if (! selectedCharacter) {
      return (
          <CharacterSelectionPage
            session={session}
            onCharacterSelect={(p: Player) => {
              try {
                sessionStorage.removeItem(SKIP_AUTO_RESUME_ONCE);
              } catch {
                // no-op
              }
              setSelectedCharacter(p);
            }}
            onBackToHome={() => setShowHomePage(true)}
          />
        );
      }

      return (
        <GamePage
          session={session}
          selectedCharacter={selectedCharacter}
          onBackToSelection={() => {
            try {
              sessionStorage.setItem(SKIP_AUTO_RESUME_ONCE, '1');
              appContextService.setContext('selection');
            } catch {
              // no-op
            }
            setSelectedCharacter(null);
          }}
          onUpdateCharacter={(p: Player) => {
            setSelectedCharacter(p);
            try {
              localStorage.setItem(LAST_SELECTED_CHARACTER_SNAPSHOT, JSON.stringify(p));
              appContextService.setContext('game');
            } catch {
              // no-op
            }
          }}
        />
      );
    })()}
      </DiceHistoryProvider>
    </DiceSettingsProvider>
  );
  
}

export default App;