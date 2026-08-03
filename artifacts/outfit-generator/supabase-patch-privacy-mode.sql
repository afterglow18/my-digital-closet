-- ═══════════════════════════════════════════════════════════════════════
-- Privacy Mode — schema patch
-- Run in Supabase Dashboard → SQL Editor → New Query
--
-- What this does:
--  1. Adds privacy_mode column to profiles (private | anonymous | public)
--  2. Updates RLS on public_items so private-mode users' posts are never
--     returned by any query (server-enforced, not just client-filtered).
--  3. Same for public_outfits.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Add privacy_mode to profiles ─────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_mode text NOT NULL DEFAULT 'public'
  CHECK (privacy_mode IN ('private', 'anonymous', 'public'));

CREATE INDEX IF NOT EXISTS idx_profiles_privacy_mode ON profiles (privacy_mode);

-- ── 2. Update public_items RLS — exclude private-mode users ─────────────
-- Drop both the original and status-aware versions (whichever is installed).
DROP POLICY IF EXISTS "Public items are readable by anyone"        ON public_items;
DROP POLICY IF EXISTS "Active public items are readable by anyone" ON public_items;

-- New policy: active posts whose owner is NOT in private mode.
CREATE POLICY "Active public items are readable by anyone"
  ON public_items FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE  profiles.id            = public_items.user_id
      AND    profiles.privacy_mode != 'private'
    )
  );

-- ── 3. Update public_outfits RLS — exclude private-mode users ───────────
DROP POLICY IF EXISTS "Public outfits are readable by anyone"        ON public_outfits;
DROP POLICY IF EXISTS "Active public outfits are readable by anyone" ON public_outfits;

CREATE POLICY "Active public outfits are readable by anyone"
  ON public_outfits FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE  profiles.id            = public_outfits.user_id
      AND    profiles.privacy_mode != 'private'
    )
  );
