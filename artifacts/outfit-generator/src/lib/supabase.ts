/**
 * supabase.ts — lazy Supabase client.
 *
 * The client is created only when getSupabase() is first called.
 * If the user never signs in, this module is imported but getSupabase()
 * is never called, so zero network connections are made.
 *
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are safe to ship in the
 * app bundle — Row Level Security is the enforcement layer.
 * NEVER use or reference the service_role key here.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client, creating it on first call.
 * Throws if the env vars are not configured.
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Persist session in localStorage so it survives app restarts
      persistSession: true,
      // Do not auto-refresh in the background on web; Capacitor app handles
      // foreground resume separately
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}

/** True if Supabase env vars are present (does NOT test connectivity). */
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
  created_at: string;
}

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
  notes: string | null;
  price: number | null;
  currency: string | null;
  visibility: "public" | "for_sale";
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];
