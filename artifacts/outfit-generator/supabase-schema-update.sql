-- ═══════════════════════════════════════════════════════════════════════
-- Discover V1 — schema additions
-- Run these in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Add status column to public_items ────────────────────────────────
ALTER TABLE public_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pending_review', 'removed'));

CREATE INDEX IF NOT EXISTS idx_public_items_status ON public_items (status);

-- ── 2. Add status column to public_outfits ──────────────────────────────
ALTER TABLE public_outfits
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pending_review', 'removed'));

CREATE INDEX IF NOT EXISTS idx_public_outfits_status ON public_outfits (status);

-- ── 3. Add is_admin flag to profiles ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Grant yourself admin rights (replace with your actual user UUID):
-- UPDATE profiles SET is_admin = true WHERE id = '<your-user-id>';

-- ── 4. Reports table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id     uuid        NOT NULL,
  post_type   text        NOT NULL CHECK (post_type IN ('item', 'outfit')),
  reason      text        NOT NULL CHECK (reason IN ('nudity','harassment','spam','copyright','other')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, post_id, post_type)   -- no duplicate reports per user
);

-- ── 5. RLS for reports ──────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can insert (but only for their own reporter_id — enforced by USING)
CREATE POLICY "Users can submit reports" ON reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can see their own reports (to prevent duplicates client-side if needed)
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admin can see all reports
CREATE POLICY "Admin can view all reports" ON reports
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ── 6. Auto-hide trigger: hide posts with 3+ distinct reporters ─────────
CREATE OR REPLACE FUNCTION auto_hide_reported_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  distinct_reporters INTEGER;
BEGIN
  SELECT COUNT(DISTINCT reporter_id)
  INTO   distinct_reporters
  FROM   reports
  WHERE  post_id = NEW.post_id
    AND  post_type = NEW.post_type;

  IF distinct_reporters >= 3 THEN
    IF NEW.post_type = 'item' THEN
      UPDATE public_items SET status = 'pending_review' WHERE id = NEW.post_id;
    ELSIF NEW.post_type = 'outfit' THEN
      UPDATE public_outfits SET status = 'pending_review' WHERE id = NEW.post_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_hide_reported_post ON reports;
CREATE TRIGGER trg_auto_hide_reported_post
  AFTER INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION auto_hide_reported_post();

-- ── 7. Update RLS on public_items to filter status ──────────────────────
-- Drop old open-read policy and replace with status-aware version.
-- (Adjust policy name if yours is different — check Dashboard → Auth → Policies)
DROP POLICY IF EXISTS "Public items are readable by anyone" ON public_items;
DROP POLICY IF EXISTS "Anyone can read public items"        ON public_items;

-- Regular readers: only active + public
CREATE POLICY "Active public items are readable by anyone" ON public_items
  FOR SELECT
  USING (
    visibility = 'public' AND status = 'active'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Owner can always read their own rows
CREATE POLICY "Owners can read own items" ON public_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin update (restore / change status)
DROP POLICY IF EXISTS "Admin can update items" ON public_items;
CREATE POLICY "Admin can update items" ON public_items
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Admin delete
DROP POLICY IF EXISTS "Admin can delete items" ON public_items;
CREATE POLICY "Admin can delete items" ON public_items
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ── 8. Same RLS updates for public_outfits ──────────────────────────────
DROP POLICY IF EXISTS "Public outfits are readable by anyone" ON public_outfits;
DROP POLICY IF EXISTS "Anyone can read public outfits"        ON public_outfits;

CREATE POLICY "Active public outfits are readable by anyone" ON public_outfits
  FOR SELECT
  USING (
    status = 'active'
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Owners can read own outfits" ON public_outfits
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update outfits" ON public_outfits;
CREATE POLICY "Admin can update outfits" ON public_outfits
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admin can delete outfits" ON public_outfits;
CREATE POLICY "Admin can delete outfits" ON public_outfits
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
