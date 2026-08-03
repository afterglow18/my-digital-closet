-- ═══════════════════════════════════════════════════════════════════════════════
-- My Digital Closet — profile-creation trigger patch
-- ───────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor if your schema was already applied before
-- this fix. It adds the on_auth_user_created trigger so profile rows are created
-- server-side (bypassing RLS) when a new auth.users row is inserted.
--
-- SAFE TO RERUN — all statements are idempotent.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_handle      text;
  clean_handle    text;
  new_display     text;
BEGIN
  -- Pull values from user metadata (set by the app at signUp / signInWithIdToken)
  raw_handle   := NEW.raw_user_meta_data->>'handle';
  new_display  := NEW.raw_user_meta_data->>'display_name';

  -- Fall back to email prefix when no handle was supplied (e.g. old clients)
  IF raw_handle IS NULL OR raw_handle = '' THEN
    raw_handle := split_part(NEW.email, '@', 1);
  END IF;

  -- Sanitise: keep only a-z 0-9 _ -
  clean_handle := lower(regexp_replace(raw_handle, '[^a-zA-Z0-9_\-]', '', 'g'));

  -- Last-resort fallback: use first 8 chars of the UUID
  IF clean_handle = '' THEN
    clean_handle := 'user' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Truncate to 30 characters
  clean_handle := substr(clean_handle, 1, 30);

  -- If the handle is already taken, append the first 4 chars of the UUID
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = clean_handle) THEN
    clean_handle := substr(clean_handle, 1, 25) || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, handle, display_name)
  VALUES (NEW.id, clean_handle, new_display)
  ON CONFLICT (id) DO NOTHING;   -- idempotent: no-op if row already exists

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
