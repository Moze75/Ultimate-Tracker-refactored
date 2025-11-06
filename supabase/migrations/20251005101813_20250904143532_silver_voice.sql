/*
  # Suppression du système de favoris pour les sorts
  
  1. Modifications
    - Suppression de la colonne is_favorite de la table player_spells
    
  2. Sécurité
    - Maintien des politiques RLS existantes
*/

-- Supprimer la colonne is_favorite de la table player_spells
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_spells'
        AND column_name = 'is_favorite'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE player_spells DROP COLUMN is_favorite;
    END IF;
END $$;
