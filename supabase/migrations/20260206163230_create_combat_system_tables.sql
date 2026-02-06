/*
  # Create Combat System Tables

  1. New Tables
    - `campaign_monsters` - Monsters saved to a campaign (AideDD or custom)
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `source` (text: 'aidedd' or 'custom')
      - `slug` (text, AideDD slug for fetched monsters)
      - `name` (text, monster name)
      - `size` (text)
      - `type` (text, creature type)
      - `alignment` (text)
      - `armor_class` (integer)
      - `armor_desc` (text, e.g. "armure naturelle")
      - `hit_points` (integer)
      - `hit_points_formula` (text, e.g. "18d10+36")
      - `speed` (jsonb, e.g. {"walk":"12 m","swim":"12 m"})
      - `abilities` (jsonb, {str,dex,con,int,wis,cha} scores)
      - `saving_throws` (text)
      - `skills` (text)
      - `vulnerabilities` (text)
      - `resistances` (text)
      - `damage_immunities` (text)
      - `condition_immunities` (text)
      - `senses` (text)
      - `languages` (text)
      - `challenge_rating` (text)
      - `xp` (integer)
      - `traits` (jsonb array, [{name, description}])
      - `actions` (jsonb array, [{name, description}])
      - `bonus_actions` (jsonb array)
      - `reactions` (jsonb array)
      - `legendary_actions` (jsonb array)
      - `legendary_description` (text)
      - `image_url` (text)
      - `created_at`, `updated_at` (timestamps)

    - `campaign_encounters` - Active or completed combat encounters
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references campaigns)
      - `name` (text)
      - `status` (text: 'active', 'completed')
      - `round_number` (integer)
      - `current_turn_index` (integer)
      - `created_at`, `updated_at` (timestamps)

    - `encounter_participants` - Participants in a combat encounter
      - `id` (uuid, primary key)
      - `encounter_id` (uuid, references campaign_encounters)
      - `participant_type` (text: 'player', 'monster')
      - `monster_id` (uuid, nullable, references campaign_monsters)
      - `player_member_id` (uuid, nullable, references campaign_members)
      - `display_name` (text)
      - `initiative_roll` (integer)
      - `current_hp` (integer)
      - `max_hp` (integer)
      - `armor_class` (integer)
      - `conditions` (jsonb array)
      - `sort_order` (integer)
      - `is_active` (boolean)
      - `notes` (text)
      - `created_at` (timestamp)

  2. Security
    - RLS enabled on all three tables
    - GM of the campaign has full CRUD
    - Campaign members can SELECT
*/

-- Campaign Monsters table
CREATE TABLE IF NOT EXISTS campaign_monsters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'custom' CHECK (source IN ('aidedd', 'custom')),
  slug text,
  name text NOT NULL,
  size text DEFAULT '',
  type text DEFAULT '',
  alignment text DEFAULT '',
  armor_class integer DEFAULT 10,
  armor_desc text DEFAULT '',
  hit_points integer DEFAULT 1,
  hit_points_formula text DEFAULT '',
  speed jsonb DEFAULT '{}',
  abilities jsonb DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  saving_throws text DEFAULT '',
  skills text DEFAULT '',
  vulnerabilities text DEFAULT '',
  resistances text DEFAULT '',
  damage_immunities text DEFAULT '',
  condition_immunities text DEFAULT '',
  senses text DEFAULT '',
  languages text DEFAULT '',
  challenge_rating text DEFAULT '0',
  xp integer DEFAULT 0,
  traits jsonb DEFAULT '[]',
  actions jsonb DEFAULT '[]',
  bonus_actions jsonb DEFAULT '[]',
  reactions jsonb DEFAULT '[]',
  legendary_actions jsonb DEFAULT '[]',
  legendary_description text DEFAULT '',
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_monsters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can select campaign monsters"
  ON campaign_monsters FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_monsters.campaign_id AND game_master_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaign_monsters.campaign_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "GM can insert campaign monsters"
  ON campaign_monsters FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_monsters.campaign_id AND game_master_id = auth.uid())
  );

CREATE POLICY "GM can update campaign monsters"
  ON campaign_monsters FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_monsters.campaign_id AND game_master_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_monsters.campaign_id AND game_master_id = auth.uid())
  );

CREATE POLICY "GM can delete campaign monsters"
  ON campaign_monsters FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_monsters.campaign_id AND game_master_id = auth.uid())
  );

-- Campaign Encounters table
CREATE TABLE IF NOT EXISTS campaign_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Combat',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  round_number integer NOT NULL DEFAULT 1,
  current_turn_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can select encounters"
  ON campaign_encounters FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_encounters.campaign_id AND game_master_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM campaign_members
      WHERE campaign_id = campaign_encounters.campaign_id
      AND user_id = auth.uid()
      AND is_active = true
    )
  );

CREATE POLICY "GM can insert encounters"
  ON campaign_encounters FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_encounters.campaign_id AND game_master_id = auth.uid())
  );

CREATE POLICY "GM can update encounters"
  ON campaign_encounters FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_encounters.campaign_id AND game_master_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_encounters.campaign_id AND game_master_id = auth.uid())
  );

CREATE POLICY "GM can delete encounters"
  ON campaign_encounters FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_encounters.campaign_id AND game_master_id = auth.uid())
  );

-- Encounter Participants table
CREATE TABLE IF NOT EXISTS encounter_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES campaign_encounters(id) ON DELETE CASCADE,
  participant_type text NOT NULL DEFAULT 'monster' CHECK (participant_type IN ('player', 'monster')),
  monster_id uuid REFERENCES campaign_monsters(id) ON DELETE SET NULL,
  player_member_id uuid REFERENCES campaign_members(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  initiative_roll integer NOT NULL DEFAULT 0,
  current_hp integer NOT NULL DEFAULT 0,
  max_hp integer NOT NULL DEFAULT 0,
  armor_class integer NOT NULL DEFAULT 10,
  conditions jsonb DEFAULT '[]',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE encounter_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can select encounter participants"
  ON encounter_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_encounters e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.id = encounter_participants.encounter_id
      AND (c.game_master_id = auth.uid() OR EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_id = c.id AND user_id = auth.uid() AND is_active = true
      ))
    )
  );

CREATE POLICY "GM can insert encounter participants"
  ON encounter_participants FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_encounters e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.id = encounter_participants.encounter_id
      AND c.game_master_id = auth.uid()
    )
  );

CREATE POLICY "GM can update encounter participants"
  ON encounter_participants FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_encounters e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.id = encounter_participants.encounter_id
      AND c.game_master_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_encounters e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.id = encounter_participants.encounter_id
      AND c.game_master_id = auth.uid()
    )
  );

CREATE POLICY "GM can delete encounter participants"
  ON encounter_participants FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM campaign_encounters e
      JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.id = encounter_participants.encounter_id
      AND c.game_master_id = auth.uid()
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_campaign_monsters_campaign ON campaign_monsters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_monsters_slug ON campaign_monsters(slug);
CREATE INDEX IF NOT EXISTS idx_campaign_encounters_campaign ON campaign_encounters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_encounters_status ON campaign_encounters(status);
CREATE INDEX IF NOT EXISTS idx_encounter_participants_encounter ON encounter_participants(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_participants_sort ON encounter_participants(encounter_id, sort_order);
