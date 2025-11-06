/*
  # Add spells management tables
  
  1. New Tables
    - `spells`: Stores spell information
    - `player_spells`: Links players to their known/prepared spells
  
  2. Security
    - RLS enabled on both tables
    - Public read access to spells
    - Authenticated access for player_spells
*/

-- Create enum for magic schools
DO $$ BEGIN
  CREATE TYPE magic_school AS ENUM (
    'Abjuration',
    'Invocation',
    'Divination', 
    'Enchantement',
    'Évocation',
    'Illusion',
    'Nécromancie',
    'Transmutation'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create spells table
CREATE TABLE IF NOT EXISTS spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level integer NOT NULL CHECK (level >= 0 AND level <= 9),
  school magic_school NOT NULL,
  casting_time text NOT NULL,
  range text NOT NULL,
  components jsonb NOT NULL DEFAULT '{"V": false, "S": false, "M": null}'::jsonb,
  duration text NOT NULL,
  description text NOT NULL,
  higher_levels text,
  created_at timestamptz DEFAULT now()
);

-- Create player_spells table
CREATE TABLE IF NOT EXISTS player_spells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  spell_id uuid REFERENCES spells(id) ON DELETE CASCADE,
  is_prepared boolean DEFAULT false,
  is_favorite boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(player_id, spell_id)
);

-- Enable RLS
ALTER TABLE spells ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_spells ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Spells are readable by everyone" ON spells;
CREATE POLICY "Spells are readable by everyone"
  ON spells FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Players can manage their spells" ON player_spells;
CREATE POLICY "Players can manage their spells"
  ON player_spells FOR ALL 
  TO authenticated
  USING (player_id IN (
    SELECT id FROM players WHERE user_id = auth.uid()
  ))
  WITH CHECK (player_id IN (
    SELECT id FROM players WHERE user_id = auth.uid()
  ));

-- Create indexes
CREATE INDEX IF NOT EXISTS spells_name_idx ON spells(name);
CREATE INDEX IF NOT EXISTS spells_level_idx ON spells(level);
CREATE INDEX IF NOT EXISTS spells_school_idx ON spells(school);
CREATE INDEX IF NOT EXISTS player_spells_player_id_idx ON player_spells(player_id);
CREATE INDEX IF NOT EXISTS player_spells_spell_id_idx ON player_spells(spell_id);
