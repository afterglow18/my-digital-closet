-- ─────────────────────────────────────────────────────────────────────────────
-- Server-backed blocks
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Blocks table
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  -- Prevent self-blocks
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Users can see their own blocks
CREATE POLICY "select own blocks" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id);

-- Users can create blocks
CREATE POLICY "insert own blocks" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can remove their own blocks
CREATE POLICY "delete own blocks" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- 2. RLS on public_items: hide posts from blocked/blocking users (bidirectional)
DROP POLICY IF EXISTS "hide blocked users items"   ON public_items;
CREATE POLICY "hide blocked users items" ON public_items
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = auth.uid() AND blocked_id  = public_items.user_id)
         OR (blocker_id = public_items.user_id AND blocked_id = auth.uid())
    )
  );

-- 3. RLS on public_outfits: same bidirectional block filter
DROP POLICY IF EXISTS "hide blocked users outfits" ON public_outfits;
CREATE POLICY "hide blocked users outfits" ON public_outfits
  FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = auth.uid() AND blocked_id  = public_outfits.user_id)
         OR (blocker_id = public_outfits.user_id AND blocked_id = auth.uid())
    )
  );

-- 4. Update delete_user() to also clean up blocks
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public_items   WHERE user_id = uid;
  DELETE FROM public_outfits WHERE user_id = uid;
  DELETE FROM notifications  WHERE user_id = uid;
  DELETE FROM follows        WHERE follower_id = uid OR followed_id = uid;
  DELETE FROM blocks         WHERE blocker_id  = uid OR blocked_id  = uid;
  DELETE FROM reports        WHERE reporter_id = uid;
  DELETE FROM profiles       WHERE id = uid;
  DELETE FROM auth.users     WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION delete_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION delete_user() TO authenticated;
