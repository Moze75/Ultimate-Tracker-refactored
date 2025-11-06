/**
 * Gestion PWA (enregistrement du Service Worker et updates).
 * Requiert: vite-plugin-pwa installé et configuré dans vite.config.ts
 *
 * Événements personnalisés émis:
 *  - 'pwa:offline-ready' : le cache est prêt (offline OK)
 *  - 'pwa:need-refresh' : une nouvelle version est disponible
 *
 * Tu peux écouter ces événements côté React pour afficher un toast.
 */

let registerSW: any = null;

// ✅ MODIFIÉ : Import dynamique avec gestion d'erreur
(async () => {
  try {
    const pwaModule = await import('virtual:pwa-register');
    registerSW = pwaModule.registerSW;
    console.log('[PWA] ✅ Module PWA chargé');
    
    // Lancer la configuration après chargement réussi
    if (registerSW) {
      setupPWA();
    }
  } catch (error) {
    console.warn('[PWA] ⚠️ Module virtual:pwa-register non disponible - PWA désactivée');
    console.warn('[PWA] Détails:', error);
  }
})();

interface PWAUpdateEventDetail {
  update: (reload?: boolean) => void;
}

declare global {
  interface Window {
    __PWA_LAST_CHECK__?: number;
    __PWA_SKIP_PROMPT__?: boolean;
  }
}

const ONE_HOUR = 60 * 60 * 1000;
const STARTUP_CHECK_DELAY = 3000; // 3 secondes après le démarrage

function emit<T>(name: string, detail?: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function setupPWA() {
  // ✅ NOUVEAU : Vérification de sécurité
  if (!registerSW) {
    console.log('[PWA] ⏭️ PWA non configurée - mode standard');
    return;
  }

  console.log('[PWA] 🚀 Initialisation...');

  try {
    const updateSW = registerSW({
      immediate: true, // ✅ Vérifier immédiatement
      onNeedRefresh() {
        console.log('[PWA] 🆕 Nouvelle version disponible');
        
        emit<PWAUpdateEventDetail>('pwa:need-refresh', {
          update: (reload = true) => updateSW(reload)
        });

        // ✅ MODIFIÉ : Mise à jour automatique au démarrage, sinon prompt
        const isStartup = performance.navigation && performance.navigation.type === 1;
        const skipPrompt = window.__PWA_SKIP_PROMPT__ === true;

        if (isStartup || skipPrompt) {
          console.log('[PWA] ⚡ Mise à jour automatique au démarrage');
          updateSW(true);
        } else {
          console.log('[PWA] 💬 Affichage du prompt de mise à jour');
          if (confirm('Une nouvelle version est disponible. Recharger maintenant ?')) {
            updateSW(true);
          } else {
            console.log('[PWA] ⏭️ Mise à jour différée');
          }
        }
      },
      onOfflineReady() {
        console.log('[PWA] 📴 Contenu disponible hors-ligne');
        emit('pwa:offline-ready');
      },
      onRegisterError(err) {
        console.error('[PWA] ❌ Erreur d'enregistrement SW:', err);
      },
      onRegistered(registration) {
        console.log('[PWA] ✅ Service Worker enregistré');
        
        // ✅ Vérifier les updates périodiquement sur le registration
        if (registration) {
          setInterval(() => {
            console.log('[PWA] 🔄 Vérification périodique...');
            registration.update().catch(err => {
              console.error('[PWA] ❌ Erreur vérification:', err);
            });
          }, ONE_HOUR);
        }
      }
    });

    // ✅ Vérification au démarrage (après chargement initial)
    setTimeout(() => {
      console.log('[PWA] 🔍 Vérification au démarrage...');
      window.__PWA_SKIP_PROMPT__ = true;
      updateSW(false).then(() => {
        console.log('[PWA] ✅ Vérification au démarrage terminée');
        setTimeout(() => {
          window.__PWA_SKIP_PROMPT__ = false;
        }, 5000);
      }).catch(err => {
        console.error('[PWA] ❌ Erreur vérification démarrage:', err);
        window.__PWA_SKIP_PROMPT__ = false;
      });
    }, STARTUP_CHECK_DELAY);

    // ✅ Vérification à chaque visibilité de la page
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        const lastCheck = window.__PWA_LAST_CHECK__ || 0;
        const now = Date.now();
        
        // Vérifier seulement si la dernière vérification remonte à plus de 5 minutes
        if (now - lastCheck > 5 * 60 * 1000) {
          console.log('[PWA] 🔍 Vérification au retour de l'app...');
          window.__PWA_SKIP_PROMPT__ = true;
          updateSW(false).then(() => {
            window.__PWA_LAST_CHECK__ = Date.now();
            setTimeout(() => {
              window.__PWA_SKIP_PROMPT__ = false;
            }, 5000);
          }).catch(err => {
            console.error('[PWA] ❌ Erreur vérification visibilité:', err);
            window.__PWA_SKIP_PROMPT__ = false;
          });
        }
      }
    });

    // Marquer l'heure de la dernière vérification
    window.__PWA_LAST_CHECK__ = Date.now();
    
    console.log('[PWA] ✅ Configuration terminée');
  } catch (error) {
    console.error('[PWA] ❌ Erreur lors de la configuration:', error);
  }
}