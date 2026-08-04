/**
 * discoverFavorites.ts — local-only storage for Discover hearts.
 *
 * No account required. Nothing is synced to Supabase.
 * Stale entries (deleted / hidden posts) are pruned automatically
 * after each successful Supabase fetch in useDiscoverFavoriteItems.
 */

export type LocalDiscoverFavorite = {
  postId: string;
  postType: "item" | "outfit";
  savedAt: string; // ISO-8601
};

const KEY = "discover-favorites";

function load(): LocalDiscoverFavorite[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(favs: LocalDiscoverFavorite[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(favs));
  } catch {}
}

export function getDiscoverFavorites(): LocalDiscoverFavorite[] {
  return load();
}

export function isDiscoverFavorite(postId: string): boolean {
  return load().some((f) => f.postId === postId);
}

/**
 * Toggle a post's hearted state.
 * Returns `true` if it is now hearted, `false` if un-hearted.
 */
export function toggleDiscoverFavorite(
  postId: string,
  postType: "item" | "outfit",
): boolean {
  const favs = load();
  const idx  = favs.findIndex((f) => f.postId === postId);
  if (idx >= 0) {
    favs.splice(idx, 1);
    persist(favs);
  } else {
    favs.unshift({ postId, postType, savedAt: new Date().toISOString() });
    persist(favs);
  }
  window.dispatchEvent(new CustomEvent("discoverFavoritesChanged"));
  return idx < 0;
}

/**
 * Remove favorites whose IDs are no longer live (deleted / hidden / made private).
 * Called after a successful Supabase fetch so the set is always current.
 */
export function pruneStaleDiscoverFavorites(
  liveItemIds: string[],
  liveOutfitIds: string[],
) {
  const liveSet = new Set([...liveItemIds, ...liveOutfitIds]);
  const pruned = load().filter((f) => liveSet.has(f.postId));
  persist(pruned);
}
