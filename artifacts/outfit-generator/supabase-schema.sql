-- ═══════════════════════════════════════════════════════════════════════════════
-- My Digital Closet — initial Supabase schema
-- ───────────────────────────────────────────────────────────────────────────────
-- Run this FIRST, before supabase-schema-update.sql.
--
-- How to run:
--   Supabase dashboard → SQL Editor → New query → paste → Run
--
-- SAFE TO RERUN: every statement is idempotent.
--   • Tables:    CREATE TABLE IF NOT EXISTS
--   • Indexes:   CREATE INDEX IF NOT EXISTS
--   • Function:  CREATE OR REPLACE FUNCTION
--   • Triggers:  DROP TRIGGER IF EXISTS → CREATE TRIGGER
--   • Policies:  DROP POLICY IF EXISTS  → CREATE POLICY
--   No user data is deleted by rerunning this file.
--
-- Prerequisites (dashboard only — cannot be done in SQL):
--   • Authentication → Providers → Email: enable "Email/Password"
--   • Authentication → Providers → Apple: enable if using Apple Sign-In
--   • Storage → New bucket → Name: public-items → Public bucket: YES
--     (public bucket = image URLs accessible without a signed token)
--
-- After this file runs successfully, run supabase-schema-update.sql.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- Utility: updated_at auto-stamp
-- Used by public_items and public_outfits triggers below.
-- CREATE OR REPLACE means this is safe to rerun at any time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles
--    One row per auth user, keyed to auth.users.id.
--    Created by the app client immediately after sign-up (or Apple sign-in).
--    NOTE: is_admin column is added by supabase-schema-update.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle        text        UNIQUE NOT NULL,
  display_name  text,
  avatar_url    text,
  bio           text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles (handle);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable"  ON profiles;
DROP POLICY IF EXISTS "Users can create own profile"    ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"    ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile"    ON profiles;

-- Anyone can browse public profiles (handle, display name, avatar, bio).
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  USING (true);

-- A user may only create their own profile row.
CREATE POLICY "Users can create own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- A user may only edit their own profile row.
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- A user may delete their own profile (used in account-deletion flow).
CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE
  USING (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. public_items
--    Clothing items voluntarily published to the Discover feed.
--    Only created when the user explicitly sets an item to Public.
--    NOTE: status column is added by supabase-schema-update.sql.
--    Private item notes (the notes field in localStorage) are intentionally
--    excluded. They are local-only and must not be stored in or readable from
--    the public Supabase API.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id    integer     NOT NULL,          -- device-local item ID (links back to localStorage)
  name        text        NOT NULL,
  category    text        NOT NULL,
  color       text,
  brand       text,
  size        text,
  season      text,
  occasion    text,
  -- notes column intentionally omitted — private item notes are local-only and
  -- must never be stored in or exposed through the public Supabase API.
  image_url   text,                          -- public URL in the public-items storage bucket
  visibility  text        NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)                 -- upsert key used by sync.ts
);

CREATE INDEX IF NOT EXISTS idx_public_items_user_id    ON public_items (user_id);
CREATE INDEX IF NOT EXISTS idx_public_items_category   ON public_items (category);
CREATE INDEX IF NOT EXISTS idx_public_items_created_at ON public_items (created_at DESC);

DROP TRIGGER IF EXISTS trg_public_items_updated_at ON public_items;
CREATE TRIGGER trg_public_items_updated_at
  BEFORE UPDATE ON public_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public items are readable by anyone" ON public_items;
DROP POLICY IF EXISTS "Users can publish own items"         ON public_items;
DROP POLICY IF EXISTS "Users can update own items"          ON public_items;
DROP POLICY IF EXISTS "Users can delete own items"          ON public_items;

-- Anyone can read all public items.
-- NOTE: supabase-schema-update.sql drops this policy and replaces it with a
-- status-aware version ("Active public items are readable by anyone").
-- The policy name below matches the DROP POLICY statement in that file exactly.
CREATE POLICY "Public items are readable by anyone"
  ON public_items FOR SELECT
  USING (visibility = 'public');

-- Only the owning user may insert a row.
CREATE POLICY "Users can publish own items"
  ON public_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owning user may edit their published item.
CREATE POLICY "Users can update own items"
  ON public_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Only the owning user may unpublish/delete their item.
-- NOTE: supabase-schema-update.sql extends this to also allow admin deletes.
CREATE POLICY "Users can delete own items"
  ON public_items FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. public_outfits
--    Saved outfits voluntarily published to the Discover feed.
--    item_names is a denormalized text array of the outfit's item names,
--    stored at publish time to avoid joins on read.
--    NOTE: status column is added by supabase-schema-update.sql.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_outfits (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id    integer     NOT NULL,          -- device-local outfit ID
  name        text,
  description text,
  image_url   text,
  item_names  text[],                        -- denormalized item name list for display
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)                 -- upsert key used by sync.ts
);

CREATE INDEX IF NOT EXISTS idx_public_outfits_user_id    ON public_outfits (user_id);
CREATE INDEX IF NOT EXISTS idx_public_outfits_created_at ON public_outfits (created_at DESC);

DROP TRIGGER IF EXISTS trg_public_outfits_updated_at ON public_outfits;
CREATE TRIGGER trg_public_outfits_updated_at
  BEFORE UPDATE ON public_outfits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public_outfits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public outfits are readable by anyone" ON public_outfits;
DROP POLICY IF EXISTS "Users can publish own outfits"         ON public_outfits;
DROP POLICY IF EXISTS "Users can update own outfits"          ON public_outfits;
DROP POLICY IF EXISTS "Users can delete own outfits"          ON public_outfits;

-- Anyone can read all public outfits.
-- NOTE: supabase-schema-update.sql drops this policy and replaces it with a
-- status-aware version ("Active public outfits are readable by anyone").
CREATE POLICY "Public outfits are readable by anyone"
  ON public_outfits FOR SELECT
  USING (true);

-- Only the owning user may insert a row.
CREATE POLICY "Users can publish own outfits"
  ON public_outfits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owning user may edit their published outfit.
CREATE POLICY "Users can update own outfits"
  ON public_outfits FOR UPDATE
  USING (auth.uid() = user_id);

-- Only the owning user may unpublish/delete their outfit.
-- NOTE: supabase-schema-update.sql extends this to also allow admin deletes.
CREATE POLICY "Users can delete own outfits"
  ON public_outfits FOR DELETE
  USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Storage policies — public-items bucket
--    PREREQUISITE: create the bucket in the dashboard BEFORE running this block.
--      Dashboard → Storage → New bucket
--      Name: public-items
--      Public bucket: YES
--
--    File layout inside the bucket: {user_id}/{local_id}.jpg
--    sync.ts uses storage.foldername(name)[1] = user_id to scope access.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public item images are readable by anyone" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own item images"          ON storage.objects;
DROP POLICY IF EXISTS "Users can update own item images"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own item images"          ON storage.objects;

CREATE POLICY "Public item images are readable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-items');

CREATE POLICY "Users can upload own item images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public-items'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own item images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'public-items'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own item images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'public-items'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- Done. Run supabase-schema-update.sql next.
-- ─────────────────────────────────────────────────────────────────────────────
