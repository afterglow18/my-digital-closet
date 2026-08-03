/**
 * supabase.ts — lazy Supabase client (V1: browse-and-share only).
 *
 * PRIVACY GUARANTEE
 * ─────────────────
 * • Unauthenticated users: this module makes read-only SELECT queries to browse
 *   the public Discover feed. No personal data is sent. Supabase RLS enforces
 *   this at the database level — only rows explicitly marked 'public' are visible.
 *
 * • Private closet data (localStorage + Capacitor Filesystem) NEVER touches
 *   Supabase. Nothing is uploaded unless the user explicitly sets an item or
 *   outfit to Public AND is signed in.
 *
 * • The client is created lazily: getSupabase() is called only when code that
 *   needs Supabase runs. For non-community users the module is imported but the
 *   client is never instantiated — zero network connections.
 *
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are safe in the bundle.
 * Row Level Security is the enforcement layer.
 * NEVER reference the service_role key here.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

/** Returns the shared client, creating it on first call. Throws if unconfigured. */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** True if env vars are present (does NOT test connectivity). */
export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  privacy_mode: "private" | "anonymous" | "public";
  created_at: string;
  /** ISO timestamp of the last handle change. NULL = never changed. */
  handle_changed_at: string | null;
}

/**
 * Safe profile — returned by the `safe_profiles` DB view for community feeds.
 * handle, display_name, bio, and avatar_url are NULL for anonymous users.
 * Private users are excluded from the view entirely.
 */
export interface SafeProfile {
  id: string;
  privacy_mode: "anonymous" | "public";
  handle:       string | null;  // null → anonymous
  display_name: string | null;
  bio:          string | null;
  avatar_url:   string | null;
}

/** A clothing item published to the community (V1: visibility is always 'public'). */
export interface PublicItem {
  id: string;
  user_id: string;
  local_id: number;
  name: string;
  category: string;
  color: string | null;
  brand: string | null;
  size: string | null;
  season: string | null;
  occasion: string | null;
  image_url: string | null;
  // notes is intentionally absent — private, local-only, never stored in Supabase
  visibility: "public";    // V1 only
  status: "active" | "pending_review" | "removed";
  created_at: string;
  updated_at: string;
  profiles?: SafeProfile;
}

/** A saved outfit published to the community. */
export interface PublicOutfit {
  id: string;
  user_id: string;
  local_id: number;
  name: string | null;
  description: string | null;
  image_url: string | null;
  item_names: string[] | null; // denormalized item names for display
  status: "active" | "pending_review" | "removed";
  created_at: string;
  updated_at: string;
  profiles?: SafeProfile;
}

// ── Reporting ─────────────────────────────────────────────────────────────────

export type ReportReason = "nudity" | "harassment" | "spam" | "copyright" | "other";

export interface SubmitReportParams {
  postId: string;
  postType: "item" | "outfit";
  reason: ReportReason;
  reporterId: string;
}

/**
 * Insert a report row.
 * The DB trigger auto-hides the post when it reaches 3 distinct reporters.
 * Throws on error (including duplicate from same reporter).
 */
export async function submitReport({
  postId,
  postType,
  reason,
  reporterId,
}: SubmitReportParams): Promise<void> {
  const { error } = await getSupabase()
    .from("reports")
    .insert({ post_id: postId, post_type: postType, reason, reporter_id: reporterId });
  if (error) throw new Error(error.message);
}
