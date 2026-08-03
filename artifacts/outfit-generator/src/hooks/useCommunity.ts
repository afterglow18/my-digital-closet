/**
 * useCommunity — hooks for the Discover feed and public profiles.
 *
 * All queries are guarded by isSupabaseConfigured() and return empty data
 * gracefully when Supabase env vars are not yet set.
 *
 * Unauthenticated users can call these hooks freely — SELECT queries only.
 *
 * Privacy model enforced at the DB level:
 *  • All profile joins use safe_profiles, which nulls out handle/display_name/
 *    bio/avatar_url for anonymous users and excludes private users entirely.
 *  • usePublicProfile only returns public profiles (anonymous handles are null
 *    in safe_profiles, so a .eq("handle", …) query never matches them).
 */

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  getSupabase,
  isSupabaseConfigured,
  type PublicItem,
  type PublicOutfit,
  type Profile,
  type SafeProfile,
} from "@/lib/supabase";
import { getDiscoverFavorites, pruneStaleDiscoverFavorites } from "@/lib/discoverFavorites";
import { getLocalFollows, pruneStaleFollows }                from "@/lib/localFollows";
import { getBlockedUsers }                                   from "@/lib/blockedUsers";
import { useMyFollowIds }                                    from "@/hooks/useFollows";

// ── Dev logging ───────────────────────────────────────────────────────────────

function logSupabaseError(
  context: string,
  error: { code?: string; message: string; details?: string; hint?: string },
) {
  if (import.meta.env.DEV) {
    console.error(
      `[Supabase error] ${context}\n` +
      `  code:    ${error.code    ?? "(none)"}\n` +
      `  message: ${error.message}\n` +
      `  details: ${error.details ?? "(none)"}\n` +
      `  hint:    ${error.hint    ?? "(none)"}`,
    );
  }
}

// ── Feed filters ──────────────────────────────────────────────────────────────

export interface FeedFilters {
  category?: string;
  search?: string;
}

const PAGE_SIZE = 20;

// ── Items feed ────────────────────────────────────────────────────────────────

export function useCommunityItems(filters: FeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["community", "items", filters],
    queryFn: async ({ pageParam }): Promise<(PublicItem & { profiles: SafeProfile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();
      let q = sb
        .from("public_items")
        // profiles:safe_profiles(*) — masks anonymous users at the DB level.
        // handle/display_name/bio/avatar_url are NULL for anonymous posters;
        // private-mode users are excluded from safe_profiles entirely.
        .select("*, profiles:safe_profiles(*)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam)        q = q.lt("created_at", pageParam as string);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.search)   q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityItems", error); throw new Error(error.message); }
      return (data ?? []) as (PublicItem & { profiles: SafeProfile })[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Outfits feed ──────────────────────────────────────────────────────────────

export function useCommunityOutfits(filters: FeedFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["community", "outfits", filters],
    queryFn: async ({ pageParam }): Promise<(PublicOutfit & { profiles: SafeProfile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();
      let q = sb
        .from("public_outfits")
        .select("*, profiles:safe_profiles(*)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam)      q = q.lt("created_at", pageParam as string);
      if (filters.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityOutfits", error); throw new Error(error.message); }
      return (data ?? []) as (PublicOutfit & { profiles: SafeProfile })[];
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Public profile ─────────────────────────────────────────────────────────────

/**
 * Fetches a public profile by handle.
 * Queries safe_profiles so anonymous users (null handle) are never matched.
 * Cast as Profile — when this query finds a row, it is always a public user.
 */
export function usePublicProfile(handle: string | undefined) {
  return useQuery({
    queryKey: ["community", "profile", handle],
    queryFn: async () => {
      if (!handle || !isSupabaseConfigured()) return null;
      const { data, error } = await getSupabase()
        .from("safe_profiles")
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
  | { type: "item";   data: PublicItem   & { profiles?: SafeProfile } }
  | { type: "outfit"; data: PublicOutfit & { profiles?: SafeProfile } };

/**
 * Fetches posts from followed profiles, merged and sorted newest-first.
 *
 * When userId is provided (authenticated), follow IDs come from Supabase.
 * When not authenticated, falls back to localStorage follows.
 *
 * Profile existence is checked against safe_profiles so that switching to
 * Private automatically prunes that user from the follow feed.
 */
export function useFollowingFeed(userId?: string) {
  // Supabase follow IDs when logged in
  const { data: supabaseIds } = useMyFollowIds(userId);

  // Resolve follow IDs: Supabase when authed, local when not
  const followIds = userId
    ? (supabaseIds ?? [])
    : getLocalFollows().map((f) => f.profileId);

  const blocked = new Set(getBlockedUsers());

  return useQuery({
    queryKey: ["following-feed", userId, ...followIds],
    queryFn: async (): Promise<FollowFeedEntry[]> => {
      if (!followIds.length || !isSupabaseConfigured()) return [];
      const sb = getSupabase();

      const [profilesRes, itemsRes, outfitsRes] = await Promise.all([
        // Use safe_profiles so users who switch to Private are pruned automatically
        sb.from("safe_profiles").select("id").in("id", followIds),
        sb
          .from("public_items")
          .select("*, profiles:safe_profiles(*)")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
        sb
          .from("public_outfits")
          .select("*, profiles:safe_profiles(*)")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      // Prune local follows whose profiles no longer appear in safe_profiles
      pruneStaleFollows((profilesRes.data ?? []).map((p) => p.id as string));

      const items = (
        (itemsRes.data ?? []) as (PublicItem & { profiles?: SafeProfile })[]
      ).filter((i) => !blocked.has(i.user_id));

      const outfits = (
        (outfitsRes.data ?? []) as (PublicOutfit & { profiles?: SafeProfile })[]
      ).filter((o) => !blocked.has(o.user_id));

      const feed: FollowFeedEntry[] = [
        ...items.map((d): FollowFeedEntry   => ({ type: "item",   data: d })),
        ...outfits.map((d): FollowFeedEntry => ({ type: "outfit", data: d })),
      ].sort(
        (a, b) =>
          new Date(b.data.created_at).getTime() -
          new Date(a.data.created_at).getTime(),
      );

      return feed;
    },
    // Only run when we have resolved IDs (wait for Supabase fetch when logged in)
    enabled: userId ? supabaseIds !== undefined : true,
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
      items:   (PublicItem   & { profiles?: SafeProfile })[];
      outfits: (PublicOutfit & { profiles?: SafeProfile })[];
    }> => {
      const favs = getDiscoverFavorites();
      if (!favs.length || !isSupabaseConfigured()) return { items: [], outfits: [] };

      const itemIds   = favs.filter((f) => f.postType === "item").map((f)   => f.postId);
      const outfitIds = favs.filter((f) => f.postType === "outfit").map((f) => f.postId);
      const sb        = getSupabase();

      const [itemsRes, outfitsRes] = await Promise.all([
        itemIds.length
          ? sb
              .from("public_items")
              .select("*, profiles:safe_profiles(*)")
              .in("id", itemIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
        outfitIds.length
          ? sb
              .from("public_outfits")
              .select("*, profiles:safe_profiles(*)")
              .in("id", outfitIds)
              .eq("status", "active")
          : Promise.resolve({ data: [], error: null }),
      ]);

      const items   = (itemsRes.data   ?? []) as (PublicItem   & { profiles?: SafeProfile })[];
      const outfits = (outfitsRes.data ?? []) as (PublicOutfit & { profiles?: SafeProfile })[];

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
