-- ═══════════════════════════════════════════════════════════════════════
-- Handle change — add cooldown tracking column
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (uses IF NOT EXISTS).
--
-- What this does:
--   1. Adds handle_changed_at timestamptz to profiles.
--      NULL = never changed (no cooldown restriction).
--   2. Adds a CHECK constraint so handles are max 15 characters going forward.
--      Uses NOT VALID so existing rows are not checked retroactively;
--      only new INSERTs and UPDATEs are validated.
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: add the cooldown timestamp column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle_changed_at timestamptz;

-- Step 2: add a max-length constraint for new/updated handles
--         (skips if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_handle_length_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_handle_length_check
      CHECK (char_length(handle) <= 15) NOT VALID;
  END IF;
END$$;
