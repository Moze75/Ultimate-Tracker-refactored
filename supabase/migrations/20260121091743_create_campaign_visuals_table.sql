/*
  # Create campaign visuals table

  1. New Tables
    - `campaign_visuals`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `image_url` (text)
      - `description` (text, optional)
      - `category` (text, check constraint)
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS on campaign_visuals table
    - Campaign members can view visuals
    - Campaign members can add visuals
    - Users can update their own visuals
    - Users or GM can delete visuals

  3. Performance
    - Indexes on campaign_id, user_id, and category
*/

-- Campaign visuals table for storing images/artwork related to campaigns
CREATE TABLE IF NOT EXISTS campaign_visuals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  image_url text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('character', 'location', 'item', 'npc', 'general')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE campaign_visuals ENABLE ROW LEVEL SECURITY;

-- GM and campaign members can view visuals
CREATE POLICY "Campaign members can view visuals"
  ON campaign_visuals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE id = campaign_visuals.campaign_id 
      AND game_master_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM campaign_members 
      WHERE campaign_id = campaign_visuals.campaign_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

-- GM and campaign members can insert visuals
CREATE POLICY "Campaign members can add visuals"
  ON campaign_visuals FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM campaigns 
        WHERE id = campaign_visuals.campaign_id 
        AND game_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM campaign_members 
        WHERE campaign_id = campaign_visuals.campaign_id 
        AND user_id = auth.uid() 
        AND is_active = true
      )
    )
  );

-- Users can update their own visuals
CREATE POLICY "Users can update their own visuals"
  ON campaign_visuals FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own visuals or GM can delete any
CREATE POLICY "Users can delete their own visuals"
  ON campaign_visuals FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaigns 
      WHERE id = campaign_visuals.campaign_id 
      AND game_master_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_visuals_campaign ON campaign_visuals(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visuals_user ON campaign_visuals(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visuals_category ON campaign_visuals(category);