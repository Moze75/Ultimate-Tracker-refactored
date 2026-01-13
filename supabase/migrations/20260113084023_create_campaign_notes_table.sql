/*
  # Create campaign_notes table for Game Master notes

  1. New Tables
    - `campaign_notes`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, foreign key to campaigns)
      - `title` (text, customizable note/session title)
      - `content` (text, note content with markdown support)
      - `note_order` (integer, for custom ordering/drag-drop)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `campaign_notes` table
    - Add policies for Game Masters to manage their campaign notes
    - Only the campaign owner (game_master_id) can CRUD notes

  3. Indexes
    - Index on campaign_id for fast lookups
    - Index on note_order for efficient sorting
*/

CREATE TABLE IF NOT EXISTS campaign_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle note',
  content text DEFAULT '',
  note_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_notes_campaign_id ON campaign_notes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_notes_order ON campaign_notes(campaign_id, note_order);

ALTER TABLE campaign_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can select own campaign notes"
  ON campaign_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_notes.campaign_id
      AND campaigns.game_master_id = auth.uid()
    )
  );

CREATE POLICY "GM can insert own campaign notes"
  ON campaign_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_notes.campaign_id
      AND campaigns.game_master_id = auth.uid()
    )
  );

CREATE POLICY "GM can update own campaign notes"
  ON campaign_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_notes.campaign_id
      AND campaigns.game_master_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_notes.campaign_id
      AND campaigns.game_master_id = auth.uid()
    )
  );

CREATE POLICY "GM can delete own campaign notes"
  ON campaign_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_notes.campaign_id
      AND campaigns.game_master_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION update_campaign_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_campaign_notes_updated_at ON campaign_notes;
CREATE TRIGGER trigger_campaign_notes_updated_at
  BEFORE UPDATE ON campaign_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_notes_updated_at();