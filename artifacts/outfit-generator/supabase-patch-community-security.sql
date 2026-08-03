-- ═══════════════════════════════════════════════════════════════════════
-- Community security hardening
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE).
--
-- What this does:
--   1. safe_profiles view — masks handle, display_name, bio, avatar_url
--      for anonymous users at the DB level. Private users excluded entirely.
--      All community feed joins use this view instead of profiles(*).
--
--   2. follows table — persistent server-side follows replacing localStorage.
--      Unique per (follower, followed). Self-follow prevented by CHECK constraint.
--      Anonymous profile identities are protected: the SELECT policy only exposes
--      follows for public profiles or the follower themselves.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. safe_profiles view ──────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT
  id,
  privacy_mode,
  CASE WHEN privacy_mode = 'public' THEN handle       ELSE NULL END AS handle,
  CASE WHEN privacy_mode = 'public' THEN display_name ELSE NULL END AS display_name,
  CASE WHEN privacy_mode = 'public' THEN bio          ELSE NULL END AS bio,
  CASE WHEN privacy_mode = 'public' THEN avatar_url   ELSE NULL END AS avatar_url
FROM public.profiles
WHERE privacy_mode IN ('public', 'anonymous');

-- Grant SELECT to both anon (unauthenticated browsing) and authenticated users.
GRANT SELECT ON public.safe_profiles TO anon, authenticated;

-- ── PostgREST join note ────────────────────────────────────────────────────────
-- public_items.user_id and public_outfits.user_id are FK-constrained to
-- profiles.id. PostgREST 11+ (used by Supabase) traces FK relationships through
-- views via "view FK inferencing", so the alias syntax
--   .select("*, profiles:safe_profiles(*)")
-- resolves correctly.
--
-- If you receive a 400 "Could not find a relationship" error after running this
-- patch, reload the PostgREST schema cache:
--   Supabase Dashboard → API → Reload schema
-- Then retry. If it still fails, add this override comment and reload again:
--
--   COMMENT ON VIEW public.safe_profiles IS
--     'A safe view of profiles that masks anonymous user identity.';
-- ──────────────────────────────────────────────────────────────────────────────


-- ── 2. follows table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.follows (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- prevent self-following
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> followed_id),

  -- prevent duplicate follows
  CONSTRAINT follows_unique UNIQUE (follower_id, followed_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Authenticated users may follow others (only their own follower_id)
DROP POLICY IF EXISTS "Users can insert own follows" ON public.follows;
CREATE POLICY "Users can insert own follows" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

-- Authenticated users may unfollow (only their own rows)
DROP POLICY IF EXISTS "Users can delete own follows" ON public.follows;
CREATE POLICY "Users can delete own follows" ON public.follows
  FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Users can see their own follows; anyone can see follows for PUBLIC profiles
-- (anonymous profile identities are never exposed: followed_id is only visible
--  for public accounts or the follower themselves)
DROP POLICY IF EXISTS "Read follows" ON public.follows;
CREATE POLICY "Read follows" ON public.follows
  FOR SELECT
  USING (
    auth.uid() = follower_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = follows.followed_id
        AND p.privacy_mode = 'public'
    )
  );
