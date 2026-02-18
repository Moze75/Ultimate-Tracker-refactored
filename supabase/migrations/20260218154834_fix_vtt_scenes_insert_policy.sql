/*
  # Fix vtt_scenes INSERT policy

  The INSERT policy was missing a WITH CHECK clause, so scene creation was silently failing.
  This drops the broken INSERT policy and recreates it with the correct WITH CHECK.
*/

DROP POLICY IF EXISTS "GM inserts scenes for own rooms" ON vtt_scenes;

CREATE POLICY "GM inserts scenes for own rooms"
  ON vtt_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    (room_id)::text IN (
      SELECT id FROM vtt_rooms WHERE gm_user_id = auth.uid()
    )
  );
