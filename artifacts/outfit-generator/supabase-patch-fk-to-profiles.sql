-- ═══════════════════════════════════════════════════════════════════════════════
-- My Digital Closet — FK patch: re-point user_id to profiles(id)
-- ───────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor if your schema was already applied before
-- this fix.
--
-- WHY
-- ───
-- public_items.user_id and public_outfits.user_id originally referenced
-- auth.users(id). PostgREST (the Supabase query engine) only sees the public
-- schema, not the auth schema, so it could not resolve the
-- "*, profiles(...)" embedded join — causing every feed query to error.
--
-- This patch re-points both FKs to profiles(id), which is in the public schema.
-- profiles.id is a 1-to-1 mirror of auth.users.id, so semantics are unchanged.
-- ON DELETE CASCADE is preserved: deleting a profile removes their items/outfits.
--
-- SAFE TO RERUN — ADD CONSTRAINT IF NOT EXISTS is idempotent in PostgreSQL 9.5+.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── public_items ─────────────────────────────────────────────────────────────

ALTER TABLE public_items
  DROP CONSTRAINT IF EXISTS public_items_user_id_fkey;

ALTER TABLE public_items
  ADD CONSTRAINT public_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ── public_outfits ────────────────────────────────────────────────────────────

ALTER TABLE public_outfits
  DROP CONSTRAINT IF EXISTS public_outfits_user_id_fkey;

ALTER TABLE public_outfits
  ADD CONSTRAINT public_outfits_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
