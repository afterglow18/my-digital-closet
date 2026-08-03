-- ⚠️  DO NOT RUN THIS PATCH  ⚠️
-- The app keeps "private" as a valid participation mode.
-- Running this file would break the Private mode feature in Settings and the
-- PrivateGateSheet flow. This file is kept for reference only.
-- ═══════════════════════════════════════════════════════════════════════
-- Remove "Private" sharing mode
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Run AFTER supabase-patch-privacy-mode.sql (privacy_mode column must exist).
--
-- What this does:
--   1. Migrates any existing accounts with privacy_mode = 'private' to
--      'anonymous' (the closest equivalent in the new 2-mode system).
--   2. Updates the column CHECK constraint to only allow 'anonymous' and
--      'public' going forward.
--   3. Updates the trigger default from 'public' to 'anonymous'
--      (safer default for new sign-ups).
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: migrate legacy private accounts to anonymous
UPDATE public.profiles
  SET privacy_mode = 'anonymous'
  WHERE privacy_mode = 'private';

-- Step 2: tighten the CHECK constraint (drop old, add new)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_privacy_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_privacy_mode_check
  CHECK (privacy_mode IN ('anonymous', 'public'));

-- Step 3: update the column default
ALTER TABLE public.profiles
  ALTER COLUMN privacy_mode SET DEFAULT 'anonymous';

-- Step 4: update the on_auth_user_created trigger function so new accounts
-- created via Apple Sign-In (which can't pass metadata) default to 'anonymous'.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  raw_handle   text;
  clean_handle text;
  new_display  text;
  new_privacy  text;
BEGIN
  raw_handle  := NEW.raw_user_meta_data->>'handle';
  new_display := NEW.raw_user_meta_data->>'display_name';
  new_privacy := COALESCE(NEW.raw_user_meta_data->>'privacy_mode', 'anonymous');

  -- Clamp to valid values
  IF new_privacy NOT IN ('anonymous', 'public') THEN
    new_privacy := 'anonymous';
  END IF;

  IF raw_handle IS NULL OR raw_handle = '' THEN
    raw_handle := split_part(NEW.email, '@', 1);
  END IF;

  clean_handle := lower(regexp_replace(raw_handle, '[^a-zA-Z0-9_\-]', '', 'g'));

  IF clean_handle = '' THEN
    clean_handle := 'user' || substr(NEW.id::text, 1, 8);
  END IF;

  clean_handle := substr(clean_handle, 1, 30);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = clean_handle) THEN
    clean_handle := substr(clean_handle, 1, 25) || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, handle, display_name, privacy_mode)
  VALUES (NEW.id, clean_handle, new_display, new_privacy)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
