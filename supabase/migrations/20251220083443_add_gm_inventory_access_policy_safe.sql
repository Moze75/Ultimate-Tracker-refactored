/*
  # Add GM access to player inventory (safe version)

  1. Security Changes
    - Add SELECT policy for Game Masters to view inventory of campaign members
    - GMs can view inventory_items for players who are in their campaigns

  2. Notes
    - Uses DO block to check if tables exist before creating policy
    - This allows the GM to see equipment when viewing player details
*/

DO $$
BEGIN
  -- Only create policy if campaign_members table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'campaign_members'
  ) THEN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "GM can view campaign members inventory" ON inventory_items;
    
    -- Create the new policy
    CREATE POLICY "GM can view campaign members inventory"
      ON inventory_items
      FOR SELECT
      TO authenticated
      USING (
        player_id IN (
          SELECT cm.player_id 
          FROM campaign_members cm
          JOIN campaigns c ON c.id = cm.campaign_id
          WHERE c.game_master_id = auth.uid()
            AND cm.is_active = true
            AND cm.player_id IS NOT NULL
        )
      );
      
    RAISE NOTICE 'Policy created successfully';
  ELSE
    RAISE NOTICE 'campaign_members table does not exist, skipping policy creation';
  END IF;
END $$;