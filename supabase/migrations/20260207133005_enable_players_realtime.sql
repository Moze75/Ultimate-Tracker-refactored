/*
  # Enable Realtime on players table

  1. Changes
    - Adds `players` table to the `supabase_realtime` publication
    - Enables real-time sync for HP, temporary HP, and conditions changes
    - GM can now push HP changes that instantly reflect on player screens

  2. Purpose
    - Allow Game Masters to apply damage/healing that syncs in real-time to players
    - No more page refresh needed for players to see HP changes
*/

ALTER PUBLICATION supabase_realtime ADD TABLE players;