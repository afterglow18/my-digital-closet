/**
 * localFollows.ts — local-only storage for followed Discover profiles.
 *
 * No account required. Nothing is synced to Supabase.
 * Stale entries (deleted / suspended profiles) are pruned after each
 * successful Supabase fetch in useFollowingFeed.
 */

export type LocalFollow = {
  profileId: string;
  handle: string;
  followedAt: string; // ISO-8601
};

const KEY = "local-follows";

function load(): LocalFollow[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function persist(follows: LocalFollow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(follows));
  } catch {}
}

export function getLocalFollows(): LocalFollow[] {
  return load();
}

export function isFollowing(profileId: string): boolean {
  return load().some((f) => f.profileId === profileId);
}

/**
 * Toggle follow state for a profile.
 * Returns `true` if now following, `false` if unfollowed.
 */
export function toggleFollow(profileId: string, handle: string): boolean {
  const follows = load();
  const idx = follows.findIndex((f) => f.profileId === profileId);
  if (idx >= 0) {
    follows.splice(idx, 1);
    persist(follows);
    return false;
  }
  follows.unshift({ profileId, handle, followedAt: new Date().toISOString() });
  persist(follows);
  return true;
}

/**
 * Remove follows whose profile IDs are no longer live
 * (profile deleted, suspended, or otherwise gone from the public feed).
 * Called after a successful Supabase profiles fetch in useFollowingFeed.
 */
export function pruneStaleFollows(liveProfileIds: string[]): void {
  const liveSet = new Set(liveProfileIds);
  persist(load().filter((f) => liveSet.has(f.profileId)));
}

/** How many profiles the user currently follows. */
export function getFollowCount(): number {
  return load().length;
}
