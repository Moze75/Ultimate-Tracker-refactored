/*
  # Add custom_class_data column to players table

  1. New Columns
    - `custom_class_data` (jsonb) - Stores custom class configuration including:
      - name: Custom class name
      - description: Class description
      - hitDie: Hit die type (6, 8, 10, or 12)
      - primaryAbility: Array of primary abilities
      - savingThrows: Array of saving throw proficiencies
      - isCustom: Boolean flag (always true for custom classes)
      - resources: Array of custom class resources
      - abilities: Array of class abilities by level

  2. Purpose
    - Allow players to create fully customizable classes
    - Store custom class resources and abilities per level
    - Enable the Settings button to appear in ClassesTab for custom classes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'custom_class_data'
  ) THEN
    ALTER TABLE players ADD COLUMN custom_class_data jsonb DEFAULT NULL;
  END IF;
END $$;

COMMENT ON COLUMN players.custom_class_data IS 'Stores custom class configuration including resources and abilities by level';

NOTIFY pgrst, 'reload schema';