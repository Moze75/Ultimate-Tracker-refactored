/*
  # Add saved flag to encounters

  1. Changes
    - Add `saved` boolean column to `campaign_encounters` table
    - Default value is `false`
    - Only saved encounters will appear in the load encounter modal
  
  2. Notes
    - This allows distinguishing between completed encounters and those explicitly saved by the GM
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_encounters' AND column_name = 'saved'
  ) THEN
    ALTER TABLE campaign_encounters ADD COLUMN saved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_encounters_saved ON campaign_encounters(campaign_id, saved) WHERE saved = true;
