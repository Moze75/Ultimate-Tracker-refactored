/*
  # Création de la table vtt_rooms

  ## Description
  Table pour stocker les rooms du module VTT (Virtual Tabletop).
  Chaque room représente une session de jeu avec sa carte, ses tokens et son brouillard de guerre.

  ## Nouvelles tables
  - `vtt_rooms`
    - `id` (text, primary key) : identifiant court généré côté serveur (ex: "A3F9B2")
    - `name` (text) : nom de la room affiché dans le lobby
    - `gm_user_id` (uuid) : identifiant du Maître du Jeu propriétaire
    - `state_json` (jsonb) : snapshot complet de l'état (config, tokens, fogState)
    - `created_at` (timestamptz) : date de création
    - `updated_at` (timestamptz) : dernière mise à jour du snapshot

  ## Sécurité
  - RLS activé
  - Le GM peut tout faire sur ses propres rooms
  - Les joueurs peuvent lire une room s'ils en connaissent l'ID (accès par lien/ID)
  - Aucun accès anonyme
*/

CREATE TABLE IF NOT EXISTS vtt_rooms (
  id          text PRIMARY KEY,
  name        text NOT NULL DEFAULT '',
  gm_user_id  uuid NOT NULL,
  state_json  jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vtt_rooms_gm_user_id_idx ON vtt_rooms (gm_user_id);

ALTER TABLE vtt_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GM can manage own rooms"
  ON vtt_rooms FOR SELECT
  TO authenticated
  USING (gm_user_id = auth.uid());

CREATE POLICY "GM can insert own rooms"
  ON vtt_rooms FOR INSERT
  TO authenticated
  WITH CHECK (gm_user_id = auth.uid());

CREATE POLICY "GM can update own rooms"
  ON vtt_rooms FOR UPDATE
  TO authenticated
  USING (gm_user_id = auth.uid())
  WITH CHECK (gm_user_id = auth.uid());

CREATE POLICY "GM can delete own rooms"
  ON vtt_rooms FOR DELETE
  TO authenticated
  USING (gm_user_id = auth.uid());

CREATE POLICY "Authenticated users can read any room by id"
  ON vtt_rooms FOR SELECT
  TO authenticated
  USING (true);
