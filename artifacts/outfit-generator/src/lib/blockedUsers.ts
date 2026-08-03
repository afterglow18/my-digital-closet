/**
 * blockedUsers.ts — local-only storage for blocked Discover creators.
 *
 * Blocked user IDs are stored in localStorage.
 * Blocked creators' posts are hidden client-side in the feed and favorites.
 * No account required to block.
 */

const KEY = "blocked-creators";

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getBlockedUsers(): string[] {
  return load();
}

export function isBlocked(userId: string): boolean {
  return load().includes(userId);
}

export function blockUser(userId: string): void {
  const blocked = load();
  if (!blocked.includes(userId)) {
    blocked.push(userId);
    try {
      localStorage.setItem(KEY, JSON.stringify(blocked));
    } catch {}
  }
}

export function unblockUser(userId: string): void {
  const blocked = load().filter((id) => id !== userId);
  try {
    localStorage.setItem(KEY, JSON.stringify(blocked));
  } catch {}
}
