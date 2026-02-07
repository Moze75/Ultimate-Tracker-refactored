/*
  # Add temporary_hp column to encounter_participants

  1. Changes
    - Add `temporary_hp` column to `encounter_participants` table
    - Default value is 0 for existing rows

  2. Purpose
    - Allow tracking of temporary hit points for player participants
    - Enables bidirectional sync of temporary HP between player sheets and GM combat view
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encounter_participants' AND column_name = 'temporary_hp'
  ) THEN
    ALTER TABLE encounter_participants ADD COLUMN temporary_hp integer DEFAULT 0 NOT NULL;
  END IF;
END $$;