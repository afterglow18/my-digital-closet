/**
 * useCommunity — hooks for the Discover feed and public profiles.
 *
 * All queries are guarded by isSupabaseConfigured() and return empty data
 * gracefully when Supabase env vars are not yet set.
 *
 * Privacy model enforced at the DB level:
 *  • All profile data is fetched from safe_profiles, which nulls out
 *    handle/display_name/bio/avatar_url for anonymous users and excludes
 *    private users entirely.
 *  • Profile data is fetched as a SEPARATE query from posts so we never rely
 *    on PostgREST FK inference through the view. Posts load independently;
 *    if safe_profiles doesn't exist yet the feed still renders (no profile info).
 *  • usePublicProfile only returns public profiles (anonymous handles are null
 *    in safe_profiles, so .eq("handle", …) never matches them).
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Fetch safe_profiles for a list of user IDs and return a map of id → profile.
 * Does NOT throw — if safe_profiles doesn't exist yet (patch not run), returns {}.
 */
async function fetchSafeProfiles(
  sb: ReturnType<typeof getSupabase>,
  userIds: string[],
): Promise<Record<string, SafeProfile>> {
  if (!userIds.length) return {};
  const { data } = await sb
    .from("safe_profiles")
    .select("*")
    .in("id", userIds);
  if (!data) return {};
  return Object.fromEntries((data as SafeProfile[]).map((p) => [p.id, p]));
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
    queryFn: async ({ pageParam }): Promise<(PublicItem & { profiles?: SafeProfile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();

      // Step 1: fetch posts (no profile join — avoids PostgREST view FK inference)
      let q = sb
        .from("public_items")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam)        q = q.lt("created_at", pageParam as string);
      if (filters.category) q = q.eq("category", filters.category);
      if (filters.search)   q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityItems", error); throw new Error(error.message); }
      const posts = (data ?? []) as PublicItem[];

      // Step 2: fetch safe profiles for the returned user IDs
      const profileMap = await fetchSafeProfiles(
        sb,
        [...new Set(posts.map((p) => p.user_id))],
      );

      // Step 3: merge
      return posts.map((item) => ({ ...item, profiles: profileMap[item.user_id] }));
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
    queryFn: async ({ pageParam }): Promise<(PublicOutfit & { profiles?: SafeProfile })[]> => {
      if (!isSupabaseConfigured()) return [];
      const sb = getSupabase();

      let q = sb
        .from("public_outfits")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (pageParam)      q = q.lt("created_at", pageParam as string);
      if (filters.search) q = q.ilike("name", `%${filters.search}%`);
      const { data, error } = await q;
      if (error) { logSupabaseError("useCommunityOutfits", error); throw new Error(error.message); }
      const posts = (data ?? []) as PublicOutfit[];

      const userIds = [...new Set(posts.map((p) => p.user_id))];
      const allNames = [...new Set(posts.flatMap((p) => p.item_names ?? []))];

      // Fetch ALL active items for these users (no name filter — avoids case-mismatch)
      const [profileMap, itemsRes] = await Promise.all([
        fetchSafeProfiles(sb, userIds),
        userIds.length
          ? sb.from("public_items")
              .select("user_id, name, image_url, category")
              .in("user_id", userIds)
              .eq("status", "active")
          : Promise.resolve({ data: [] as { user_id: string; name: string; image_url: string | null }[] }),
      ]);

      type ItemRow = { user_id: string; name: string; image_url: string | null; category: string | null };
      const itemRows = ((itemsRes as { data: ItemRow[] }).data ?? []);

      // Lowercase-keyed lookups for image and category
      const imgMap = new Map<string, string>(
        itemRows.filter((r) => r.image_url).map((r) => [`${r.user_id}:${r.name.toLowerCase()}`, r.image_url!]),
      );
      const catMap = new Map<string, string>(
        itemRows.filter((r) => r.category).map((r) => [`${r.user_id}:${r.name.toLowerCase()}`, r.category!]),
      );

      return posts.map((outfit) => ({
        ...outfit,
        profiles:        profileMap[outfit.user_id],
        item_image_urls: (outfit.item_names ?? []).map((n) => imgMap.get(`${outfit.user_id}:${n.toLowerCase()}`) ?? null),
        item_categories: (outfit.item_names ?? []).map((n) => catMap.get(`${outfit.user_id}:${n.toLowerCase()}`) ?? null),
      }));
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPage[lastPage.length - 1].created_at,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Public profile ─────────────────────────────────────────────────────────────

/**
 * Fetches a public profile by handle from safe_profiles.
 * Anonymous users have null handles so .eq("handle", x) never matches them.
 * Cast as Profile — when this query finds a row it is always a public user.
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
  const { data: supabaseIds } = useMyFollowIds(userId);
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
        // Check which followed profiles still exist in safe_profiles
        // (private-mode users are excluded automatically)
        sb.from("safe_profiles").select("id").in("id", followIds),
        sb
          .from("public_items")
          .select("*")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
        sb
          .from("public_outfits")
          .select("*")
          .in("user_id", followIds)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      // Prune local follows whose profiles no longer appear in safe_profiles
      pruneStaleFollows((profilesRes.data ?? []).map((p) => p.id as string));

      const allUserIds = [
        ...(itemsRes.data   ?? []).map((i: { user_id: string }) => i.user_id),
        ...(outfitsRes.data ?? []).map((o: { user_id: string }) => o.user_id),
      ];
      const profileMap = await fetchSafeProfiles(sb, [...new Set(allUserIds)]);

      const items = ((itemsRes.data ?? []) as PublicItem[])
        .filter((i) => !blocked.has(i.user_id))
        .map((i) => ({ ...i, profiles: profileMap[i.user_id] }));

      const outfits = ((outfitsRes.data ?? []) as PublicOutfit[])
        .filter((o) => !blocked.has(o.user_id))
        .map((o) => ({ ...o, profiles: profileMap[o.user_id] }));

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
    enabled: userId ? supabaseIds !== undefined : true,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Discover Favorites ────────────────────────────────────────────────────────

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
          ? sb.from("public_items").select("*").in("id", itemIds).eq("status", "active")
          : Promise.resolve({ data: [] as PublicItem[], error: null }),
        outfitIds.length
          ? sb.from("public_outfits").select("*").in("id", outfitIds).eq("status", "active")
          : Promise.resolve({ data: [] as PublicOutfit[], error: null }),
      ]);

      const items   = (itemsRes.data   ?? []) as PublicItem[];
      const outfits = (outfitsRes.data ?? []) as PublicOutfit[];

      pruneStaleDiscoverFavorites(items.map((i) => i.id), outfits.map((o) => o.id));

      const allUserIds = [...items.map((i) => i.user_id), ...outfits.map((o) => o.user_id)];
      const profileMap = await fetchSafeProfiles(sb, [...new Set(allUserIds)]);

      return {
        items:   items.map((i) => ({ ...i, profiles: profileMap[i.user_id] })),
        outfits: outfits.map((o) => ({ ...o, profiles: profileMap[o.user_id] })),
      };
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
