/*
  # Schéma initial pour le gestionnaire D&D

  1. Tables
    - `players` : Informations des joueurs
    - `inventory_items` : Objets dans l'inventaire
    - `group_treasury` : Trésor du groupe

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques pour que les joueurs ne voient que leurs données
*/

-- Table des joueurs
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  gold integer DEFAULT 0,
  silver integer DEFAULT 0,
  copper integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Table des objets d'inventaire
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES players NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Table du trésor du groupe
CREATE TABLE IF NOT EXISTS group_treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gold integer DEFAULT 0,
  silver integer DEFAULT 0,
  copper integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Insertion d'un trésor de groupe initial
INSERT INTO group_treasury (id, gold, silver, copper)
SELECT gen_random_uuid(), 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM group_treasury LIMIT 1);

-- Activation de la sécurité niveau ligne
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_treasury ENABLE ROW LEVEL SECURITY;

-- Politiques pour les joueurs
DROP POLICY IF EXISTS "Les joueurs peuvent voir leur profil" ON players;
CREATE POLICY "Les joueurs peuvent voir leur profil"
  ON players FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les joueurs peuvent modifier leur profil" ON players;
CREATE POLICY "Les joueurs peuvent modifier leur profil"
  ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Politiques pour l'inventaire
DROP POLICY IF EXISTS "Les joueurs peuvent voir leurs objets" ON inventory_items;
CREATE POLICY "Les joueurs peuvent voir leurs objets"
  ON inventory_items FOR SELECT
  TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Les joueurs peuvent ajouter des objets" ON inventory_items;
CREATE POLICY "Les joueurs peuvent ajouter des objets"
  ON inventory_items FOR INSERT
  TO authenticated
  WITH CHECK (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Les joueurs peuvent supprimer leurs objets" ON inventory_items;
CREATE POLICY "Les joueurs peuvent supprimer leurs objets"
  ON inventory_items FOR DELETE
  TO authenticated
  USING (player_id IN (SELECT id FROM players WHERE user_id = auth.uid()));

-- Politiques pour le trésor du groupe
DROP POLICY IF EXISTS "Tout le monde peut voir le trésor du groupe" ON group_treasury;
CREATE POLICY "Tout le monde peut voir le trésor du groupe"
  ON group_treasury FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tout le monde peut modifier le trésor du groupe" ON group_treasury;
CREATE POLICY "Tout le monde peut modifier le trésor du groupe"
  ON group_treasury FOR UPDATE
  TO authenticated
  USING (true);
