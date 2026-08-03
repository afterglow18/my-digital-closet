-- ═══════════════════════════════════════════════════════════════════════
-- Likes + Notifications
-- Run in Supabase Dashboard → SQL Editor → New Query
-- Requires: profiles, public_items, public_outfits tables to already exist.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. post_likes ──────────────────────────────────────────────────────
--   One row per (liker, post). Inserting triggers a notification;
--   deleting cascade-removes the matching notification automatically.

CREATE TABLE IF NOT EXISTS post_likes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    uuid        NOT NULL,
  post_type  text        NOT NULL CHECK (post_type IN ('item', 'outfit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liker_id, post_id)
);

CREATE INDEX IF NOT EXISTS post_likes_post_idx ON post_likes (post_id);

-- ── 2. notifications ───────────────────────────────────────────────────
--   Received by post owners when someone hearts their post.
--   We intentionally store NO liker identity — anonymous by design.
--   like_id → ON DELETE CASCADE removes the notification when un-hearted.

CREATE TABLE IF NOT EXISTS notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type           text        NOT NULL CHECK (type IN ('heart_item', 'heart_outfit')),
  post_id        uuid        NOT NULL,
  post_type      text        NOT NULL CHECK (post_type IN ('item', 'outfit')),
  post_name      text,          -- denormalised at like-time (avoids extra joins)
  post_image_url text,          -- denormalised thumbnail
  like_id        uuid        REFERENCES post_likes(id) ON DELETE CASCADE,
  read           boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, read, created_at DESC);

-- ── 3. Row-Level Security ─────────────────────────────────────────────

ALTER TABLE post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- post_likes
CREATE POLICY "likes: insert own"
  ON post_likes FOR INSERT TO authenticated
  WITH CHECK (liker_id = auth.uid());

CREATE POLICY "likes: delete own"
  ON post_likes FOR DELETE TO authenticated
  USING (liker_id = auth.uid());

CREATE POLICY "likes: select own"
  ON post_likes FOR SELECT TO authenticated
  USING (liker_id = auth.uid());

-- notifications
CREATE POLICY "notifs: select own"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifs: mark read"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── 4. Trigger: auto-create notification on INSERT into post_likes ─────

CREATE OR REPLACE FUNCTION create_heart_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id     uuid;
  v_post_name    text;
  v_image_url    text;
  v_notif_type   text;
BEGIN
  IF NEW.post_type = 'item' THEN
    SELECT user_id, name, image_url
      INTO v_owner_id, v_post_name, v_image_url
      FROM public_items WHERE id = NEW.post_id;
    v_notif_type := 'heart_item';
  ELSE
    SELECT user_id, name, image_url
      INTO v_owner_id, v_post_name, v_image_url
      FROM public_outfits WHERE id = NEW.post_id;
    v_notif_type := 'heart_outfit';
  END IF;

  -- Skip if post not found or user is liking their own post
  IF v_owner_id IS NULL OR v_owner_id = NEW.liker_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications
    (user_id, type, post_id, post_type, post_name, post_image_url, like_id)
  VALUES
    (v_owner_id, v_notif_type, NEW.post_id, NEW.post_type,
     v_post_name, v_image_url, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_heart_notification ON post_likes;
CREATE TRIGGER trg_heart_notification
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION create_heart_notification();
