/*
  # Add walls column to vtt_scenes

  1. Changes
    - Adds `walls` JSONB column to `vtt_scenes` table
    - Defaults to an empty array
    - Stores an array of VTTWall objects (each with id and points array)
    - Walls are GM-only: used to block token movement, invisible to players

  2. Notes
    - No RLS changes needed (walls are part of scene data, same access as rest of scene)
    - Safe additive migration, no data loss possible
*/

ALTER TABLE vtt_scenes ADD COLUMN IF NOT EXISTS walls JSONB NOT NULL DEFAULT '[]'::jsonb;
