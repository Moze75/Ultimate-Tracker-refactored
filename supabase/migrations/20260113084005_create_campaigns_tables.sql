/*
  # Create campaigns and related tables

  1. New Tables
    - `campaigns` - Main campaign table
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, optional)
      - `game_master_id` (uuid, references auth.users)
      - `created_at`, `updated_at` (timestamps)
      - `is_active` (boolean)

    - `campaign_members` - Campaign membership
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `user_id` (uuid, references auth.users)
      - `player_id` (uuid, optional, references players)
      - `player_email` (text)
      - `joined_at` (timestamp)
      - `is_active` (boolean)

    - `campaign_invitations` - Pending invitations
      - `id` (uuid, primary key)
      - `campaign_id` (uuid)
      - `player_email` (text)
      - `player_id` (uuid, optional)
      - `status` (text: pending/accepted/declined)
      - `invitation_code` (text)
      - `invited_at`, `responded_at` (timestamps)

    - `campaign_inventory` - Shared campaign inventory
    - `campaign_gifts` - Gifts from GM to players
    - `campaign_gift_claims` - Claims on gifts

  2. Security
    - RLS enabled on all tables
    - Policies for GM and members access
*/

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  game_master_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns they own or are members of"
  ON campaigns FOR SELECT TO authenticated
  USING (game_master_id = auth.uid());

CREATE POLICY "GMs can insert their own campaigns"
  ON campaigns FOR INSERT TO authenticated
  WITH CHECK (game_master_id = auth.uid());

CREATE POLICY "GMs can update their own campaigns"
  ON campaigns FOR UPDATE TO authenticated
  USING (game_master_id = auth.uid())
  WITH CHECK (game_master_id = auth.uid());

CREATE POLICY "GMs can delete their own campaigns"
  ON campaigns FOR DELETE TO authenticated
  USING (game_master_id = auth.uid());

-- Campaign members table
CREATE TABLE IF NOT EXISTS campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  player_email text,
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(campaign_id, player_id)
);

ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage campaign members"
  ON campaign_members FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_members.campaign_id AND game_master_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Campaign invitations table
CREATE TABLE IF NOT EXISTS campaign_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  player_email text NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invitation_code text DEFAULT gen_random_uuid()::text,
  invited_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage invitations"
  ON campaign_invitations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_invitations.campaign_id AND game_master_id = auth.uid())
    OR player_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Campaign inventory table
CREATE TABLE IF NOT EXISTS campaign_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage campaign inventory"
  ON campaign_inventory FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_inventory.campaign_id AND game_master_id = auth.uid())
  );

-- Campaign gifts table
CREATE TABLE IF NOT EXISTS campaign_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  gift_type text NOT NULL CHECK (gift_type IN ('item', 'currency')),
  item_name text,
  item_description text,
  item_quantity integer,
  gold integer DEFAULT 0,
  silver integer DEFAULT 0,
  copper integer DEFAULT 0,
  distribution_mode text NOT NULL CHECK (distribution_mode IN ('individual', 'shared')),
  recipient_ids uuid[],
  message text,
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'distributed', 'cancelled')),
  claimed_by uuid REFERENCES auth.users(id),
  claimed_at timestamptz,
  inventory_item_id uuid
);

ALTER TABLE campaign_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage gifts"
  ON campaign_gifts FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_gifts.campaign_id AND game_master_id = auth.uid())
    OR auth.uid() = ANY(recipient_ids)
    OR EXISTS (
      SELECT 1 FROM campaign_members 
      WHERE campaign_id = campaign_gifts.campaign_id 
      AND user_id = auth.uid() 
      AND is_active = true
    )
  );

-- Campaign gift claims table
CREATE TABLE IF NOT EXISTS campaign_gift_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id uuid NOT NULL REFERENCES campaign_gifts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  player_id uuid REFERENCES players(id),
  claimed_quantity integer,
  claimed_gold integer DEFAULT 0,
  claimed_silver integer DEFAULT 0,
  claimed_copper integer DEFAULT 0,
  claimed_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_gift_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their gift claims"
  ON campaign_gift_claims FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM campaign_gifts g
      JOIN campaigns c ON c.id = g.campaign_id
      WHERE g.id = campaign_gift_claims.gift_id
      AND c.game_master_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_gm ON campaigns(game_master_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user ON campaign_members(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invitations_campaign ON campaign_invitations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_invitations_email ON campaign_invitations(player_email);
CREATE INDEX IF NOT EXISTS idx_campaign_inventory_campaign ON campaign_inventory(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_gifts_campaign ON campaign_gifts(campaign_id);