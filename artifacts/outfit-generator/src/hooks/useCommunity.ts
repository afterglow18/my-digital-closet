/**
 * useCommunity — hooks for the Discover feed and public profiles.
 *
 * All queries are guarded by isSupabaseConfigured() and return empty data
 * gracefully when Supabase env vars are not yet set.
 *
 * Unauthenticated users can call these hooks freely — SELECT queries only,
 * no private data sent. RLS enforces this at the DB level.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured, type PublicItem, type PublicOutfit, type Profile } from "@/lib/supabase";

// ── Feed filters ──────────────────────────────────────────────────────────────

export interface FeedFilters {
  category?: string;
  search?: string;
}

// ── Items feed ────────────────────────────────────────────────────────────────

export function useCommunityItems(filters: FeedFilters = {}) {
  return useQuery({
    queryKey: ["community", "items", filters],
    queryFn: async (): Promise<(PublicItem & { profiles: Profile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();
      let q = sb
        .from("public_items")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.search)   q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as (PublicItem & { profiles: Profile })[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Outfits feed ──────────────────────────────────────────────────────────────

export function useCommunityOutfits(filters: FeedFilters = {}) {
  return useQuery({
    queryKey: ["community", "outfits", filters],
    queryFn: async (): Promise<(PublicOutfit & { profiles: Profile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();
      let q = sb
        .from("public_outfits")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filters.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as (PublicOutfit & { profiles: Profile })[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Public profile ─────────────────────────────────────────────────────────────

export function usePublicProfile(handle: string | undefined) {
  return useQuery({
    queryKey: ["community", "profile", handle],
    queryFn: async () => {
      if (!handle || !isSupabaseConfigured()) return null;
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("handle", handle.toLowerCase())
        .single();
      if (error) throw new Error(error.message);
      return data as Profile;
    },
    enabled: Boolean(handle),
    staleTime: 1000 * 60 * 5,
  });
}

export function usePublicProfileItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "profile-items", userId],
    queryFn: async () => {
      if (!userId || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicItem[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}

export function usePublicProfileOutfits(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "profile-outfits", userId],
    queryFn: async () => {
      if (!userId || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_outfits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicOutfit[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}

// ── Own profile ────────────────────────────────────────────────────────────────

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "my-profile", userId],
    queryFn: async () => {
      if (!userId || !isSupabaseConfigured()) return null;
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (error) throw new Error(error.message);
      return data as Profile;
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });
}

export function useMyPublishedItems(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "my-items", userId],
    queryFn: async () => {
      if (!userId || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_items")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicItem[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}

export function useMyPublishedOutfits(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "my-outfits", userId],
    queryFn: async () => {
      if (!userId || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_outfits")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PublicOutfit[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}
