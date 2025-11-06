/*
  # Create character wizard drafts table for persistence

  1. New Tables
    - `character_wizard_drafts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `current_step` (integer, stores the current step index)
      - `draft_data` (jsonb, stores all wizard state)
      - `created_at` (timestamptz, when draft was first created)
      - `updated_at` (timestamptz, when draft was last modified)

  2. Security
    - Enable RLS on `character_wizard_drafts` table
    - Add policy for authenticated users to read their own drafts
    - Add policy for authenticated users to insert their own drafts
    - Add policy for authenticated users to update their own drafts
    - Add policy for authenticated users to delete their own drafts

  3. Indexes
    - Add index on `user_id` for fast lookups
    - Add index on `updated_at` for cleanup queries

  4. Constraints
    - Add UNIQUE constraint on `user_id` (one draft per user)
    - Add CHECK constraint to ensure current_step is non-negative

  5. Notes
    - Drafts older than 1 hour will be cleaned up automatically
    - The draft_data JSONB field stores all wizard state including:
      * characterName, selectedRace, selectedClass, selectedBackground
      * abilities, effectiveAbilities
      * selectedClassSkills, selectedEquipmentOption, backgroundEquipmentOption
      * selectedCantrips, selectedLevel1Spells
*/

-- Create the character_wizard_drafts table
CREATE TABLE IF NOT EXISTS character_wizard_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0 CHECK (current_step >= 0),
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT character_wizard_drafts_user_id_unique UNIQUE (user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS character_wizard_drafts_user_id_idx
  ON character_wizard_drafts(user_id);

CREATE INDEX IF NOT EXISTS character_wizard_drafts_updated_at_idx
  ON character_wizard_drafts(updated_at);

-- Enable RLS
ALTER TABLE character_wizard_drafts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own drafts
CREATE POLICY "Users can read own wizard drafts"
  ON character_wizard_drafts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own drafts
CREATE POLICY "Users can insert own wizard drafts"
  ON character_wizard_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own drafts
CREATE POLICY "Users can update own wizard drafts"
  ON character_wizard_drafts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own drafts
CREATE POLICY "Users can delete own wizard drafts"
  ON character_wizard_drafts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_character_wizard_draft_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
DROP TRIGGER IF EXISTS update_character_wizard_drafts_updated_at ON character_wizard_drafts;
CREATE TRIGGER update_character_wizard_drafts_updated_at
  BEFORE UPDATE ON character_wizard_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_character_wizard_draft_timestamp();

-- Function to clean up old drafts (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_wizard_drafts()
RETURNS void AS $$
BEGIN
  DELETE FROM character_wizard_drafts
  WHERE updated_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
