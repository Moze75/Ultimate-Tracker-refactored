# 🚨 Déconnexion d'urgence

Si vous avez un **écran bleu** au démarrage et ne pouvez pas accéder à l'application, utilisez ces solutions :

---

## ⚡ SOLUTION RAPIDE #1 : URL d'urgence

Tapez directement dans votre navigateur mobile :

```
https://le-compagnon-dnd.fr/emergency-logout.html
```

Cette page :
- Se charge instantanément
- Supprime la reconnexion automatique
- Nettoie tout le cache
- Vous redirige vers la page de connexion

---

## ⚡ SOLUTION RAPIDE #2 : Console (1 ligne)

Si vous pouvez accéder à la console du navigateur :

```javascript
localStorage.removeItem('selectedCharacter');localStorage.clear();sessionStorage.clear();window.location.href='/';
```

Copier-coller cette ligne unique et appuyer sur Entrée.

---

## 🔧 SOLUTION COMPLÈTE : Nettoyage total

Pour un nettoyage complet avec cache PWA :

```
https://le-compagnon-dnd.fr/clear-cache.html
```

---

## 📱 Sur mobile Android/iOS

### Méthode 1 : Via le navigateur
1. Ouvrez Chrome/Safari
2. Tapez l'URL : `le-compagnon-dnd.fr/emergency-logout.html`
3. Attendez 3 secondes
4. Vous serez redirigé vers la page de connexion

### Méthode 2 : Via les paramètres du navigateur
1. Paramètres du navigateur → Confidentialité
2. Effacer les données de navigation
3. Cocher "Cookies et données de site"
4. Cocher "Images et fichiers en cache"
5. Confirmer

---

## 💡 Bookmarklet (favori intelligent)

Créez un favori avec cette URL pour une déconnexion en 1 clic :

```
javascript:(function(){localStorage.removeItem('selectedCharacter');localStorage.clear();sessionStorage.clear();window.location.href='/';})();
```

**Comment créer le bookmarklet :**
1. Créez un nouveau favori dans votre navigateur
2. Nom : "🚨 Logout Urgence"
3. URL : Collez le code javascript ci-dessus
4. Quand vous avez l'écran bleu, cliquez sur ce favori

---

## ❓ Pourquoi l'écran bleu ?

L'application reconnecte automatiquement le dernier personnage utilisé. Si ce personnage a des données corrompues (ex: mauvaises URLs d'images), l'app plante avant de charger l'interface.

La solution : supprimer la clé `selectedCharacter` du localStorage pour désactiver la reconnexion auto.

---

## ✅ Après la déconnexion d'urgence

1. L'application charge normalement
2. Vous voyez la page de connexion
3. Reconnectez-vous avec votre email/mot de passe
4. Sélectionnez votre personnage manuellement
5. Si le problème persiste sur un personnage spécifique, il faut le corriger depuis un autre appareil

---

## 🛠️ Pour les développeurs

Script console complet avec logs :

```javascript
(async function emergencyLogout() {
  console.log('🚨 Déconnexion d\'urgence...');

  // Étape 1: Désactiver l'auto-login
  localStorage.removeItem('selectedCharacter');
  sessionStorage.removeItem('selectedCharacter');
  console.log('✓ Auto-login désactivé');

  // Étape 2: Nettoyer tout
  localStorage.clear();
  sessionStorage.clear();
  console.log('✓ Storage nettoyé');

  // Étape 3: Nettoyer les caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('✓ Caches PWA nettoyés');
  }

  // Étape 4: Désenregistrer SW
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    console.log('✓ Service Workers supprimés');
  }

  console.log('✅ Nettoyage terminé - Redirection...');
  window.location.href = '/';
})();
```

---

## 🔐 Sécurité

Ces scripts ne font que nettoyer les données locales de votre navigateur. Ils ne :
- ❌ Ne suppriment PAS vos personnages dans la base de données
- ❌ Ne suppriment PAS votre compte
- ❌ Ne suppriment PAS vos campagnes
- ✅ Nettoient seulement le cache local de l'appareil
