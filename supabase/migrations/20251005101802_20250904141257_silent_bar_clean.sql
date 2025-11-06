/*
  # Correction des politiques RLS pour la table spells
  
  1. Solution
    - Ajout de politiques d'insertion/update pour les utilisateurs authentifiés
    - Maintien de la lecture publique
    
  2. Sécurité
    - Lecture publique maintenue
    - Insertion/update autorisée pour les utilisateurs authentifiés
*/

-- Supprimer toutes les anciennes politiques sur la table spells
DROP POLICY IF EXISTS "Spells are readable by everyone" ON spells;
DROP POLICY IF EXISTS "Public can read spells" ON spells;
DROP POLICY IF EXISTS "Authenticated users can insert spells" ON spells;
DROP POLICY IF EXISTS "Accès public aux sorts" ON spells;
DROP POLICY IF EXISTS "spells_public_read" ON spells;
DROP POLICY IF EXISTS "spells_authenticated_insert" ON spells;
DROP POLICY IF EXISTS "spells_authenticated_update" ON spells;

-- Créer une politique de lecture publique claire
CREATE POLICY "spells_public_read"
  ON spells FOR SELECT
  TO public
  USING (true);

-- Créer une politique d'insertion pour les utilisateurs authentifiés
CREATE POLICY "spells_authenticated_insert"
  ON spells FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Créer une politique de mise à jour pour les utilisateurs authentifiés
CREATE POLICY "spells_authenticated_update"
  ON spells FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
