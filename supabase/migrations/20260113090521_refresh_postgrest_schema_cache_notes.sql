/*
  # Refresh PostgREST schema cache for campaign_notes table
  
  This migration notifies PostgREST to reload its schema cache
  so that the newly created campaign_notes table becomes accessible via the API.
*/

NOTIFY pgrst, 'reload schema';