/*
  # Rafraîchissement du cache du schéma PostgREST
  
  ## Description
  Cette migration force le rafraîchissement du cache du schéma PostgREST.
  Elle résout le problème PGRST204 où PostgREST ne trouve pas la colonne 'secondary_subclass'
  même si elle existe dans la base de données.
  
  ## Modifications
  1. Envoie une notification à PostgREST pour recharger le schéma
  2. Ajoute un commentaire à la table players pour forcer la mise à jour du cache
  
  ## Sécurité
  - Aucune modification de données
  - Aucun impact sur les permissions RLS existantes
  - Simple rafraîchissement du cache
*/

-- Forcer le rafraîchissement du cache PostgREST
NOTIFY pgrst, 'reload schema';

-- Ajouter un commentaire pour forcer la mise à jour du schéma dans le cache
COMMENT ON TABLE players IS 'Table principale des joueurs D&D 5e avec support du multiclassage';
