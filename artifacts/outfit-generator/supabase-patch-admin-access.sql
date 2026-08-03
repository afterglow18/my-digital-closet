-- ─────────────────────────────────────────────────────────────────────────────
-- Grant admin access to your account
--
-- Run this in Supabase SQL Editor.
-- Replace YOUR_EMAIL_HERE with the email you signed up with.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ensure the column exists (safe to run even if already added)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Grant admin to your account by email
UPDATE profiles
SET is_admin = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'afterglowtanning18@gmail.com'
);
