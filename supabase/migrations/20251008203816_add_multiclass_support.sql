/*
  # Ajout du support du multiclassage D&D 5e

  ## Description
  Cette migration ajoute toutes les colonnes nécessaires pour supporter le multiclassage dans D&D 5e.
  Permet aux personnages d'avoir jusqu'à 2 classes avec gestion indépendante des niveaux, ressources et sorts.

  ## Nouvelles colonnes ajoutées
  
  ### Classe secondaire
  - `secondary_class` (text) : Nom de la classe secondaire
  - `secondary_level` (integer) : Niveau dans la classe secondaire (par défaut 0)
  - `secondary_subclass` (text) : Sous-classe de la classe secondaire
  - `secondary_class_resources` (jsonb) : Ressources de la classe secondaire
  - `secondary_spell_slots` (jsonb) : Emplacements de sorts de la classe secondaire
  
  ### Dés de vie par type
  - `hit_dice_by_type` (jsonb) : Gestion des dés de vie par type (d6, d8, d10, d12)
    Format: {"d8": {"total": 3, "used": 1}, "d10": {"total": 2, "used": 0}}
  
  ### Sorts multiclassés
  - `class_type` (text) dans player_spells : Identifie si le sort appartient à la classe primaire ou secondaire

  ## Sécurité
  - Toutes les colonnes sont NULLABLE pour compatibilité avec personnages existants
  - Les valeurs par défaut permettent une transition en douceur
  - RLS maintenu sur toutes les tables
*/

-- Ajout des colonnes de multiclassage si elles n'existent pas déjà
DO $$ 
BEGIN
  -- Colonnes pour la classe secondaire
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'secondary_class'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_class text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'secondary_level'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_level integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'secondary_subclass'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_subclass text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'secondary_class_resources'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_class_resources jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'secondary_spell_slots'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_spell_slots jsonb;
  END IF;

  -- Colonne pour les dés de vie par type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'hit_dice_by_type'
  ) THEN
    ALTER TABLE players ADD COLUMN hit_dice_by_type jsonb;
  END IF;

  -- Colonne pour identifier la classe d'origine des sorts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_spells' AND column_name = 'class_type'
  ) THEN
    ALTER TABLE player_spells ADD COLUMN class_type text DEFAULT 'primary';
  END IF;
END $$;
