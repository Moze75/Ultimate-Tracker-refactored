# Guide du système de Multiclassage

## Vue d'ensemble

Le système de multiclassage permet aux personnages d'avoir deux classes simultanément, conformément aux règles de D&D 5e. Chaque classe progresse indépendamment avec ses propres niveaux, ressources et aptitudes.

## Fonctionnalités implémentées

### 1. Ajout d'une classe secondaire

- Utilisez le modal `MulticlassSelectionModal` pour choisir une classe secondaire
- Le système vérifie automatiquement les prérequis (score de 13+ dans les caractéristiques principales)
- Les prérequis sont informatifs mais ne bloquent pas le choix (avertissement seulement)

### 2. Gestion des niveaux

- **Classe principale** : Niveau géré via le bouton "Passer au niveau suivant"
- **Classe secondaire** : Niveau géré via le bouton "Passer au niveau X de [Classe]" dans les paramètres
- Les PV et dés de vie sont ajoutés automatiquement selon la classe qui monte de niveau
- Les dés de vie sont stockés par type (d6, d8, d10, d12) dans `hit_dice_by_type`

### 3. Ressources de classe

Les ressources sont séparées pour chaque classe :
- **Classe principale** : Stockées dans `class_resources`
- **Classe secondaire** : Stockées dans `secondary_class_resources`

Exemples de ressources :
- Rage (Barbare)
- Points de sorcellerie (Ensorceleur)
- Conduit divin (Clerc/Paladin)
- Inspiration bardique (Barde)
- Points de crédo/ki (Moine)
- Forme sauvage (Druide)
- etc.

### 4. Emplacements de sorts

Le système gère automatiquement les emplacements de sorts en multiclassage :

#### Pour les lanceurs de sorts classiques
Les emplacements sont calculés selon la table de multiclassage D&D 5e :
- **Lanceurs complets** (Barde, Clerc, Druide, Ensorceleur, Magicien) : niveau complet
- **Semi-lanceurs** (Paladin, Rôdeur) : niveau / 2 (arrondi inf.)
- **Niveau effectif** = somme des niveaux pondérés

Exemple : Clerc 3 / Paladin 2 = 3 + 1 = niveau 4 effectif
→ Emplacements : 4× niv.1, 3× niv.2

#### Pour les Occultistes
Les emplacements de pacte restent séparés et ne se combinent pas avec les autres classes.

### 5. Affichage des classes

#### ClassesTab
- Affiche deux sections distinctes si le personnage a une classe secondaire
- Chaque section montre les aptitudes et ressources de sa classe
- Les aptitudes sont filtrées selon le niveau de chaque classe

#### Avatar
- Badge en bas à droite affichant la classe secondaire et son niveau
- Style : dégradé violet/rose pour se distinguer visuellement

#### KnownSpellsSection
- Affiche les emplacements de sorts combinés
- Permet d'ajouter des sorts des deux classes
- Les sorts sont accessibles quel que soit leur origine

### 6. Suppression de classe secondaire

Dans les paramètres du profil :
- Bouton "Supprimer la classe secondaire"
- Confirmation requise
- Supprime tous les niveaux, ressources et emplacements de sorts de la classe secondaire
- Retire les dés de vie correspondants

## Structure des données

### Colonnes de base de données

```sql
- secondary_class: text (nullable)
- secondary_level: integer (nullable, default: null)
- secondary_class_resources: jsonb (nullable)
- secondary_spell_slots: jsonb (nullable)
- hit_dice_by_type: jsonb (structure: { "d8": { total: 5, used: 2 }, ... })
```

### Exemple de personnage multiclassé

```json
{
  "class": "Guerrier",
  "level": 5,
  "secondary_class": "Clerc",
  "secondary_level": 3,
  "hit_dice_by_type": {
    "d10": { "total": 5, "used": 1 },
    "d8": { "total": 3, "used": 0 }
  },
  "class_resources": {
    "action_surge": 2,
    "used_action_surge": 0
  },
  "secondary_class_resources": {
    "channel_divinity": 1,
    "used_channel_divinity": 0
  },
  "spell_slots": { "level1": 3, "used1": 1 },
  "secondary_spell_slots": { "level1": 4, "level2": 2, "used1": 0, "used2": 0 }
}
```

## Fonctions utilitaires

### `multiclassUtils.ts`

- **`getTotalLevel(player)`** : Calcule le niveau total (primaire + secondaire)
- **`getProficiencyBonusForPlayer(player)`** : Bonus de maîtrise basé sur le niveau total
- **`getHitDieForClass(class)`** : Retourne le dé de vie pour une classe
- **`formatHitDiceDisplay(hitDiceByType)`** : Formate l'affichage des dés de vie (ex: "3d10 + 2d8")
- **`validateMulticlassPrerequisites(player, newClass)`** : Vérifie les prérequis
- **`calculateMulticlassSpellSlots(player)`** : Calcule les emplacements selon la table
- **`combineSpellSlots(player)`** : Combine les emplacements des deux classes

## Composants modifiés

1. **LevelUpModal** : Gère la montée de niveau avec support du `classType` (primary/secondary)
2. **PlayerProfileSettingsModal** : Ajout de la section de suppression de classe secondaire
3. **ClassesTab** : Séparé via `ClassesTabWrapper` pour afficher les deux classes
4. **KnownSpellsSection** : Utilise `combineSpellSlots` pour afficher les emplacements combinés
5. **Avatar** : Affiche un badge pour la classe secondaire
6. **MulticlassSelectionModal** : Modal de sélection avec validation des prérequis

## Règles D&D 5e respectées

✅ Prérequis de caractéristiques (13+ dans les stats principales)
✅ Dés de vie séparés par type
✅ Table de progression des lanceurs de sorts multiclassés
✅ Ressources de classe indépendantes
✅ Niveau de maîtrise basé sur le niveau total
✅ Emplacements de pacte séparés pour les Occultistes

## Limitations et notes

- Le niveau maximum total n'est pas limité (à implémenter si souhaité : limite de 20)
- Les sous-classes secondaires ne sont pas gérées (à implémenter si souhaité)
- La suppression de classe secondaire ne retire pas les PV gagnés
- Les sorts connus ne sont pas filtrés par classe (tous accessibles)

## Tests recommandés

1. Créer un personnage mono-classe, ajouter une classe secondaire
2. Monter de niveau chaque classe indépendamment
3. Vérifier les emplacements de sorts combinés
4. Tester avec un Occultiste (emplacements séparés)
5. Supprimer la classe secondaire et vérifier le retour à la normale
6. Tester les ressources de classe spécifiques à chaque classe
7. Vérifier l'affichage du badge sur l'avatar
8. Tester avec différentes combinaisons de classes (full/half casters)
