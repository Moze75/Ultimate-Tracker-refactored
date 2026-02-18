/*
  # Création de la table vtt_scenes

  ## Description
  Table pour les scènes du VTT. Chaque room peut avoir plusieurs scènes
  (cartes distinctes avec leurs propres tokens, brouillard et configuration).

  ## Nouvelles tables
  - `vtt_scenes`
    - `id` (uuid, primary key)
    - `room_id` (text) : référence la vtt_room parente
    - `name` (text) : nom de la scène (ex: "Donjon niveau 1")
    - `order_index` (integer) : ordre d'affichage dans la barre de scènes
    - `config` (jsonb) : configuration carte (mapImageUrl, gridSize, etc.)
    - `fog_state` (jsonb) : état du brouillard de cette scène
    - `tokens` (jsonb) : tokens présents dans cette scène
    - `created_at`, `updated_at` (timestamptz)

  ## Modifications
  - Ajout colonne `active_scene_id` sur vtt_rooms pour tracker la scène active

  ## Sécurité
  - RLS activé
  - Le GM peut gérer ses scènes
  - Les joueurs authentifiés peuvent lire les scènes de toute room (accès par ID connu)
*/

CREATE TABLE IF NOT EXISTS vtt_scenes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     text NOT NULL REFERENCES vtt_rooms(id) ON DELETE CASCADE,
  name        text NOT NULL DEFAULT 'Scène',
  order_index integer NOT NULL DEFAULT 0,
  config      jsonb NOT NULL DEFAULT '{}',
  fog_state   jsonb NOT NULL DEFAULT '{"revealedCells":[]}',
  tokens      jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vtt_scenes_room_id_idx ON vtt_scenes (room_id, order_index);

ALTER TABLE vtt_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage own scenes"
  ON vtt_scenes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vtt_rooms
      WHERE vtt_rooms.id = vtt_scenes.room_id
      AND vtt_rooms.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can insert own scenes"
  ON vtt_scenes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vtt_rooms
      WHERE vtt_rooms.id = vtt_scenes.room_id
      AND vtt_rooms.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can update own scenes"
  ON vtt_scenes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vtt_rooms
      WHERE vtt_rooms.id = vtt_scenes.room_id
      AND vtt_rooms.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vtt_rooms
      WHERE vtt_rooms.id = vtt_scenes.room_id
      AND vtt_rooms.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "GM can delete own scenes"
  ON vtt_scenes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vtt_rooms
      WHERE vtt_rooms.id = vtt_scenes.room_id
      AND vtt_rooms.gm_user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can read any scene"
  ON vtt_scenes FOR SELECT
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vtt_rooms' AND column_name = 'active_scene_id'
  ) THEN
    ALTER TABLE vtt_rooms ADD COLUMN active_scene_id uuid REFERENCES vtt_scenes(id) ON DELETE SET NULL;
  END IF;
END $$;
