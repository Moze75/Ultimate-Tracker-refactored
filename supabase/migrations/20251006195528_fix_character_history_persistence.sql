/*
  # Fix character_history persistence

  1. Changes
    - Ensure character_history column exists with correct type (TEXT)
    - Verify and update RLS policies to allow character_history updates
    - Add diagnostic queries to verify data persistence

  2. Security
    - Maintain existing RLS policies
    - Ensure authenticated users can update their own character_history
*/

-- Ensure character_history column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'players'
        AND column_name = 'character_history'
    ) THEN
        ALTER TABLE players ADD COLUMN character_history TEXT DEFAULT NULL;
        RAISE NOTICE 'Column character_history added';
    ELSE
        RAISE NOTICE 'Column character_history already exists';
    END IF;
END $$;

-- Verify current RLS policies
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'players'
    AND (policyname LIKE '%update%' OR policyname LIKE '%all%');

    RAISE NOTICE 'Found % UPDATE/ALL policies on players table', policy_count;

    -- List all policies for debugging
    FOR policy_count IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'players'
    LOOP
        RAISE NOTICE 'Policy exists: %', policy_count;
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Verify that existing policies allow character_history updates
-- The existing "players_all_access" policy should handle this, but let's verify
DO $$
BEGIN
    -- Check if we have an appropriate UPDATE or ALL policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'players'
        AND (cmd = 'UPDATE' OR cmd = 'ALL')
        AND qual LIKE '%auth.uid()%user_id%'
    ) THEN
        RAISE WARNING 'No proper UPDATE policy found. This may cause issues.';
        RAISE NOTICE 'Creating backup UPDATE policy...';

        -- Drop old policies that might conflict
        DROP POLICY IF EXISTS "players_update_character_history" ON players;

        -- Create a specific policy for updating own data
        CREATE POLICY "players_update_character_history"
        ON players FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);

        RAISE NOTICE 'Created players_update_character_history policy';
    ELSE
        RAISE NOTICE 'Existing UPDATE/ALL policy should allow character_history updates';
    END IF;
END $$;

-- Add a diagnostic function to test character_history persistence
CREATE OR REPLACE FUNCTION test_character_history_update(
    p_player_id UUID,
    p_test_value TEXT
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    current_value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_updated_value TEXT;
BEGIN
    -- Get the player's user_id
    SELECT user_id INTO v_user_id
    FROM players
    WHERE id = p_player_id;

    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Player not found', NULL::TEXT;
        RETURN;
    END IF;

    -- Try to update
    UPDATE players
    SET character_history = p_test_value
    WHERE id = p_player_id;

    -- Read back the value
    SELECT character_history INTO v_updated_value
    FROM players
    WHERE id = p_player_id;

    -- Check if update succeeded
    IF v_updated_value = p_test_value THEN
        RETURN QUERY SELECT TRUE, 'Update successful', v_updated_value;
    ELSE
        RETURN QUERY SELECT FALSE, 'Update failed - value mismatch', v_updated_value;
    END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION test_character_history_update(UUID, TEXT) TO authenticated;

-- Final verification
DO $$
BEGIN
    RAISE NOTICE '=== CHARACTER HISTORY PERSISTENCE FIX COMPLETE ===';
    RAISE NOTICE 'Column character_history is ready for use';
    RAISE NOTICE 'RLS policies verified and updated if needed';
    RAISE NOTICE 'Diagnostic function test_character_history_update() available';
END $$;
