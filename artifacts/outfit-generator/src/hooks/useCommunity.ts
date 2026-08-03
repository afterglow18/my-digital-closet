/**
 * useCommunity — hooks for querying the community feed and public profiles.
 *
 * These read from Supabase public_items directly. RLS ensures only
 * public/for_sale items are visible to anonymous callers.
 */

import { useQuery } from "@tanstack/react-query";
import { getSupabase, type PublicItem, type Profile } from "@/lib/supabase";

// ── Community feed ────────────────────────────────────────────────────────────

export interface FeedFilters {
  category?: string;
  forSaleOnly?: boolean;
  search?: string;
}

export function useCommunityFeed(filters: FeedFilters = {}) {
  return useQuery({
    queryKey: ["community", "feed", filters],
    queryFn: async (): Promise<(PublicItem & { profiles: Profile })[]> => {
      const sb = getSupabase();
      let query = sb
        .from("public_items")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(60);

      if (filters.forSaleOnly) {
        query = query.eq("visibility", "for_sale");
      }
      if (filters.category) {
        query = query.eq("category", filters.category);
      }
      if (filters.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as (PublicItem & { profiles: Profile })[];
    },
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

// ── Public profile ─────────────────────────────────────────────────────────────

export function usePublicProfile(handle: string | undefined) {
  return useQuery({
    queryKey: ["community", "profile", handle],
    queryFn: async () => {
      if (!handle) return null;
      const sb = getSupabase();
      const { data, error } = await sb
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
      if (!userId) return [];
      const sb = getSupabase();
      const { data, error } = await sb
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

// ── Own profile ────────────────────────────────────────────────────────────────

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["community", "my-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const sb = getSupabase();
      const { data, error } = await sb
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
      if (!userId) return [];
      const sb = getSupabase();
      const { data, error } = await sb
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
