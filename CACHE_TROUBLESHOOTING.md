# 🔧 Dépannage du cache

Si vous rencontrez des problèmes de connexion ou d'affichage (par exemple un écran bleu au démarrage), suivez ces étapes :

## Solutions disponibles

### Option 1 : Via l'application (si accessible)

1. Ouvrez les paramètres de l'application (icône d'engrenage)
2. Allez dans l'onglet "Dés 3D"
3. Faites défiler jusqu'à la section "Dépannage"
4. Cliquez sur "Nettoyer le cache et redémarrer"
5. Confirmez l'action

### Option 2 : Via URL directe (recommandé si l'app ne charge pas)

#### Sur mobile :
Tapez directement dans le navigateur :
```
https://le-compagnon-dnd.fr/clear-cache.html
```

#### En local (développement) :
```
http://localhost:5173/clear-cache.html
```

### Option 3 : Via la console du navigateur

Sur mobile, si vous pouvez accéder à la console (via un navigateur desktop connecté) :

```javascript
// Copier-coller ce code dans la console
(async () => {
  localStorage.clear();
  sessionStorage.clear();
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(reg => reg.unregister()));
  window.location.href = '/';
})();
```

## Que fait le nettoyage du cache ?

- ✅ Supprime tout le localStorage et sessionStorage
- ✅ Nettoie le cache PWA (Progressive Web App)
- ✅ Désenregistre tous les Service Workers
- ✅ Déconnecte l'utilisateur
- ✅ Redirige vers la page de connexion

## Problèmes courants résolus

- Écran bleu au démarrage
- Impossible de se connecter
- Images qui ne chargent pas
- Données obsolètes qui persistent
- Erreurs liées aux URLs d'assets

## Après le nettoyage

1. Vous serez automatiquement déconnecté
2. L'application sera rechargée
3. Vous devrez vous reconnecter avec vos identifiants
4. Tous vos personnages et données en ligne seront préservés

## Note importante

⚠️ Le nettoyage du cache ne supprime PAS :
- Vos personnages sauvegardés dans la base de données
- Votre compte utilisateur
- Les données de votre campagne

Il supprime uniquement les données temporaires stockées localement sur votre appareil.
