/*
  # Add Electrum and Platinum currency columns

  1. Modified Tables
    - `players`
      - `electrum` (integer, default 0) - Electrum coins
      - `platinum` (integer, default 0) - Platinum coins

  2. Notes
    - Adds two new currency types to complement existing gold, silver, copper
    - Default value of 0 ensures backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'electrum'
  ) THEN
    ALTER TABLE players ADD COLUMN electrum integer DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'platinum'
  ) THEN
    ALTER TABLE players ADD COLUMN platinum integer DEFAULT 0 NOT NULL;
  END IF;
END $$;