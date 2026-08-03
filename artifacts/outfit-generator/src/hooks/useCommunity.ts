/**
 * useCommunity — hooks for the Discover feed and public profiles.
 *
 * All queries are guarded by isSupabaseConfigured() and return empty data
 * gracefully when Supabase env vars are not yet set.
 *
 * Unauthenticated users can call these hooks freely — SELECT queries only,
 * no private data sent. RLS enforces this at the DB level.
 */

import { useQuery } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured, type PublicItem, type PublicOutfit, type Profile } from "@/lib/supabase";
import { getDiscoverFavorites, pruneStaleDiscoverFavorites } from "@/lib/discoverFavorites";
import { getLocalFollows, pruneStaleFollows } from "@/lib/localFollows";
import { getBlockedUsers } from "@/lib/blockedUsers";

// ── Dev logging ───────────────────────────────────────────────────────────────

/** Logs the full Supabase error in development so the cause is always visible. */
function logSupabaseError(context: string, error: { code?: string; message: string; details?: string; hint?: string }) {
  if (import.meta.env.DEV) {
    console.error(
      `[Supabase error] ${context}\n` +
      `  code:    ${error.code ?? "(none)"}\n` +
      `  message: ${error.message}\n` +
      `  details: ${error.details ?? "(none)"}\n` +
      `  hint:    ${error.hint ?? "(none)"}`,
    );
  }
}

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
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.search)   q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityItems", error); throw new Error(error.message); }
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
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60);
      if (filters.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityOutfits", error); throw new Error(error.message); }
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
      if (error) { logSupabaseError("usePublicProfile", error); throw new Error(error.message); }
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
      if (error) { logSupabaseError("usePublicProfileItems", error); throw new Error(error.message); }
      return (data ?? []) as PublicItem[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}

// ── Following feed ────────────────────────────────────────────────────────────

type FollowFeedEntry =
  | { type: "item";   data: PublicItem   & { profiles?: Profile } }
  | { type: "outfit"; data: PublicOutfit & { profiles?: Profile } };

/**
 * Fetches public items + outfits from locally-followed profiles, merged and
 * sorted newest-first. Prunes stale follows (deleted / gone profiles).
 * No account required.
 */
export function useFollowingFeed() {
  const follows   = getLocalFollows();
  const followIds = follows.map((f) => f.profileId);

  return useQuery({
    queryKey: ["following-feed", ...followIds],
    queryFn: async (): Promise<FollowFeedEntry[]> => {
      if (!followIds.length || !isSupabaseConfigured()) return [];
      const sb      = getSupabase();
      const blocked = new Set(getBlockedUsers());

      const [profilesRes, itemsRes, outfitsRes] = await Promise.all([
        // Check which profiles still exist so we can prune stale follows
        sb.from("profiles").select("id").in("id", followIds),
        sb
          .from("public_items")
          .select("*, profiles(id, handle, display_name, avatar_url)")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
        sb
          .from("public_outfits")
          .select("*, profiles(id, handle, display_name, avatar_url)")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      // Prune follows whose profiles no longer exist
      pruneStaleFollows((profilesRes.data ?? []).map((p) => p.id as string));

      const items   = ((itemsRes.data   ?? []) as (PublicItem   & { profiles?: Profile })[])
        .filter((i) => !blocked.has(i.user_id));
      const outfits = ((outfitsRes.data ?? []) as (PublicOutfit & { profiles?: Profile })[])
        .filter((o) => !blocked.has(o.user_id));

      // Merge and sort by created_at descending
      const feed: FollowFeedEntry[] = [
        ...items.map((d): FollowFeedEntry   => ({ type: "item",   data: d })),
        ...outfits.map((d): FollowFeedEntry => ({ type: "outfit", data: d })),
      ].sort((a, b) =>
        new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime(),
      );

      return feed;
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Discover Favorites ────────────────────────────────────────────────────────

/**
 * Fetches the actual Supabase records for locally-hearted posts.
 * Prunes stale favorites (deleted / hidden) after each successful fetch.
 * No account required.
 */
export function useDiscoverFavoriteItems() {
  return useQuery({
    queryKey: ["discover-favorites"],
    queryFn: async (): Promise<{
      items: (PublicItem & { profiles?: Profile })[];
      outfits: (PublicOutfit & { profiles?: Profile })[];
    }> => {
      const favs = getDiscoverFavorites();
      if (!favs.length || !isSupabaseConfigured()) return { items: [], outfits: [] };

      const itemIds   = favs.filter((f) => f.postType === "item").map((f) => f.postId);
      const outfitIds = favs.filter((f) => f.postType === "outfit").map((f) => f.postId);
      const sb        = getSupabase();

      const [itemsRes, outfitsRes] = await Promise.all([
        itemIds.length
          ? sb
              .from("public_items")
              .select("*, profiles(id, handle, display_name, avatar_url)")
              .in("id", itemIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
        outfitIds.length
          ? sb
              .from("public_outfits")
              .select("*, profiles(id, handle, display_name, avatar_url)")
              .in("id", outfitIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      ]);

      const items   = (itemsRes.data   ?? []) as (PublicItem   & { profiles?: Profile })[];
      const outfits = (outfitsRes.data ?? []) as (PublicOutfit & { profiles?: Profile })[];

      // Remove stale local references automatically
      pruneStaleDiscoverFavorites(
        items.map((i) => i.id),
        outfits.map((o) => o.id),
      );

      return { items, outfits };
    },
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
      if (error) { logSupabaseError("usePublicProfileOutfits", error); throw new Error(error.message); }
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
      if (error) { logSupabaseError("useMyProfile", error); throw new Error(error.message); }
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
      if (error) { logSupabaseError("useMyPublishedItems", error); throw new Error(error.message); }
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
      if (error) { logSupabaseError("useMyPublishedOutfits", error); throw new Error(error.message); }
      return (data ?? []) as PublicOutfit[];
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 2,
  });
}
