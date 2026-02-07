/*
  # Set REPLICA IDENTITY FULL for players table

  This migration sets REPLICA IDENTITY FULL on the players table to ensure
  Supabase Realtime can properly send all column values in change events.
  
  This is required for:
  - Realtime filters (e.g., filter by id) to work correctly
  - Old values to be available in UPDATE payloads
  - Proper HP sync between GM and player views
  
  ## Changes
  - Sets REPLICA IDENTITY FULL on the players table
*/

ALTER TABLE players REPLICA IDENTITY FULL;
