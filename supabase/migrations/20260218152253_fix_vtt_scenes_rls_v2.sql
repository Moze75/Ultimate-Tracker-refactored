/*
  # Correction des politiques RLS pour vtt_scenes (v2)
  
  Supprime toutes les anciennes politiques et recrée des politiques propres.
*/

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'vtt_scenes' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON vtt_scenes', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anyone authenticated can read scenes"
  ON vtt_scenes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "GM inserts scenes for own rooms"
  ON vtt_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (SELECT id FROM vtt_rooms WHERE gm_user_id = auth.uid())
  );

CREATE POLICY "GM updates scenes for own rooms"
  ON vtt_scenes FOR UPDATE
  TO authenticated
  USING (room_id IN (SELECT id FROM vtt_rooms WHERE gm_user_id = auth.uid()))
  WITH CHECK (room_id IN (SELECT id FROM vtt_rooms WHERE gm_user_id = auth.uid()));

CREATE POLICY "GM deletes scenes for own rooms"
  ON vtt_scenes FOR DELETE
  TO authenticated
  USING (room_id IN (SELECT id FROM vtt_rooms WHERE gm_user_id = auth.uid()));
