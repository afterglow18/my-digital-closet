-- ─────────────────────────────────────────────────────────────────────────────
-- delete_user() RPC
--
-- Called by the client (supabase.rpc('delete_user')) when a user taps
-- "Delete Account" in Settings.
--
-- Deletes, in order:
--   1. All published posts (items + outfits)
--   2. Notifications sent to this user
--   3. Follow relationships (both sides)
--   4. Reports filed by this user
--   5. Profile row
--   6. Auth user record  ← the entry Apple requires us to remove
--
-- SECURITY DEFINER runs as the function owner (postgres) so it has
-- permission to DELETE from auth.users.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Guard: must be called by an authenticated user
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Published posts
  DELETE FROM public_items   WHERE user_id = uid;
  DELETE FROM public_outfits WHERE user_id = uid;

  -- 2. Notifications
  DELETE FROM notifications WHERE user_id = uid;

  -- 3. Follow relationships
  DELETE FROM follows WHERE follower_id = uid OR followed_id = uid;

  -- 4. Reports filed by this user
  DELETE FROM reports WHERE reporter_id = uid;

  -- 5. Profile row (may already be cascaded by auth.users FK — belt + braces)
  DELETE FROM profiles WHERE id = uid;

  -- 6. Auth user — this is what Apple requires
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION delete_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION delete_user() TO authenticated;
