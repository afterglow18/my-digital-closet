-- ═══════════════════════════════════════════════════════════════════════
-- Sign-up Privacy Mode — trigger update
-- Run AFTER supabase-patch-privacy-mode.sql (privacy_mode column must exist).
-- Run in Supabase Dashboard → SQL Editor → New Query
--
-- What this does:
--   Updates the on_auth_user_created trigger so new accounts are created
--   with the privacy_mode the user chose during sign-up (passed in metadata).
--   Existing accounts are unaffected (ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════════════

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
  new_privacy := COALESCE(NEW.raw_user_meta_data->>'privacy_mode', 'public');

  -- Clamp to valid values (guard against bad clients)
  IF new_privacy NOT IN ('private', 'anonymous', 'public') THEN
    new_privacy := 'public';
  END IF;

  -- Fall back to email prefix when no handle was supplied
  IF raw_handle IS NULL OR raw_handle = '' THEN
    raw_handle := split_part(NEW.email, '@', 1);
  END IF;

  -- Sanitize: lowercase, strip disallowed chars
  clean_handle := lower(regexp_replace(raw_handle, '[^a-zA-Z0-9_\-]', '', 'g'));

  -- Final fallback: use UUID prefix
  IF clean_handle = '' THEN
    clean_handle := 'user' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Truncate to 15 chars
  clean_handle := substr(clean_handle, 1, 15);

  -- Uniqueness collision: append first 4 chars of UUID (total stays ≤ 15)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = clean_handle) THEN
    clean_handle := substr(clean_handle, 1, 11) || substr(NEW.id::text, 1, 4);
  END IF;

  INSERT INTO public.profiles (id, handle, display_name, privacy_mode)
  VALUES (NEW.id, clean_handle, new_display, new_privacy)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
