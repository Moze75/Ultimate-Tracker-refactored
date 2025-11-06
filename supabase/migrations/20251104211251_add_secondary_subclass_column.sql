/*
  # Add secondary_subclass column to players table

  1. New Columns
    - `secondary_subclass` (text, nullable) - Stores the subclass choice for the secondary class
  
  2. Changes
    - Add secondary_subclass column to players table
    - This allows characters with multiclass to have a subclass for their secondary class
  
  3. Notes
    - Column is nullable since not all characters have a secondary class
    - No default value since subclass selection is optional until level 3
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'secondary_subclass'
  ) THEN
    ALTER TABLE players ADD COLUMN secondary_subclass text;
  END IF;
END $$;
