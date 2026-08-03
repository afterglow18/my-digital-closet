-- ═══════════════════════════════════════════════════════════════════════
-- Handle change — add cooldown tracking column
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (uses IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
--
-- What this does:
--   1. Adds handle_changed_at timestamptz to profiles.
--      NULL = never changed (no cooldown restriction).
--   2. Drops the profiles_handle_length_check constraint if it exists.
--      The 15-char limit is enforced in the sign-up function instead.
--      A DB CHECK constraint using NOT VALID still fires on every future
--      UPDATE to the row, which breaks profile updates for users whose
--      existing handles are longer than the limit.
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: add the cooldown timestamp column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle_changed_at timestamptz;

-- Step 2: drop the length constraint if it was previously added
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_handle_length_check;
