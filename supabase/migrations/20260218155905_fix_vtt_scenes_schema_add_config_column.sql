/*
  # Fix vtt_scenes schema — add config jsonb column

  The code inserts/reads scenes with a `config` jsonb blob (containing
  mapImageUrl, gridSize, snapToGrid, fogEnabled, mapWidth, mapHeight)
  but the table only had individual flat columns.

  This migration adds the missing `config` jsonb column and ensures
  `fog_state` and `tokens` columns exist as jsonb with safe defaults.
  Existing flat columns are kept to avoid data loss.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vtt_scenes' AND column_name = 'config'
  ) THEN
    ALTER TABLE vtt_scenes ADD COLUMN config jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vtt_scenes' AND column_name = 'fog_state'
  ) THEN
    ALTER TABLE vtt_scenes ADD COLUMN fog_state jsonb NOT NULL DEFAULT '{"revealedCells":[]}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vtt_scenes' AND column_name = 'tokens'
  ) THEN
    ALTER TABLE vtt_scenes ADD COLUMN tokens jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
