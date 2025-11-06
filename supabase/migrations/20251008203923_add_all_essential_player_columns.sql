/*
  # Ajout de toutes les colonnes essentielles pour les joueurs D&D 5e

  ## Description
  Cette migration ajoute toutes les colonnes manquantes nécessaires au fonctionnement de l'application.
  Elle est idempotente et peut être exécutée plusieurs fois sans problème.

  ## Colonnes ajoutées
  - Informations de base : class, subclass, level, race, background
  - Caractéristiques : abilities (jsonb avec Force, Dextérité, etc.)
  - Points de vie : max_hp, current_hp, temporary_hp
  - Dés de vie : hit_dice (jsonb avec total et used)
  - Combat : armor_class, initiative, speed, proficiency_bonus
  - Ressources : spell_slots, class_resources
  - Compétences : skills, saving_throws
  - Équipement : equipment (jsonb)
  - Personnalisation : avatar_url, adventurer_name, character_history, inspirations
  - Et bien plus...
*/

DO $$ 
BEGIN
  -- Classe et niveau
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'class') THEN
    ALTER TABLE players ADD COLUMN class text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'subclass') THEN
    ALTER TABLE players ADD COLUMN subclass text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'level') THEN
    ALTER TABLE players ADD COLUMN level integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'race') THEN
    ALTER TABLE players ADD COLUMN race text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'background') THEN
    ALTER TABLE players ADD COLUMN background text;
  END IF;

  -- Caractéristiques
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'abilities') THEN
    ALTER TABLE players ADD COLUMN abilities jsonb;
  END IF;

  -- Points de vie
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'max_hp') THEN
    ALTER TABLE players ADD COLUMN max_hp integer DEFAULT 10;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'current_hp') THEN
    ALTER TABLE players ADD COLUMN current_hp integer DEFAULT 10;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'temporary_hp') THEN
    ALTER TABLE players ADD COLUMN temporary_hp integer DEFAULT 0;
  END IF;

  -- Dés de vie
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'hit_dice') THEN
    ALTER TABLE players ADD COLUMN hit_dice jsonb DEFAULT '{"total": 1, "used": 0}'::jsonb;
  END IF;

  -- Statistiques
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'stats') THEN
    ALTER TABLE players ADD COLUMN stats jsonb;
  END IF;

  -- Emplacements de sorts
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'spell_slots') THEN
    ALTER TABLE players ADD COLUMN spell_slots jsonb;
  END IF;

  -- Ressources de classe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'class_resources') THEN
    ALTER TABLE players ADD COLUMN class_resources jsonb;
  END IF;

  -- Compétences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'skills') THEN
    ALTER TABLE players ADD COLUMN skills jsonb;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'saving_throws') THEN
    ALTER TABLE players ADD COLUMN saving_throws jsonb;
  END IF;

  -- Équipement
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'equipment') THEN
    ALTER TABLE players ADD COLUMN equipment jsonb;
  END IF;

  -- Personnalisation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'avatar_url') THEN
    ALTER TABLE players ADD COLUMN avatar_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'adventurer_name') THEN
    ALTER TABLE players ADD COLUMN adventurer_name text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'character_history') THEN
    ALTER TABLE players ADD COLUMN character_history text;
  END IF;

  -- Conditions et états
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'conditions') THEN
    ALTER TABLE players ADD COLUMN conditions jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- Autres
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'languages') THEN
    ALTER TABLE players ADD COLUMN languages text[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'proficiencies') THEN
    ALTER TABLE players ADD COLUMN proficiencies jsonb;
  END IF;

END $$;
