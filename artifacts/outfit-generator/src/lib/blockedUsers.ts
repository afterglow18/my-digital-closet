/**
 * blockedUsers.ts — block management for Discover creators.
 *
 * localStorage is the source of truth for offline / logged-out operation.
 * When a user is authenticated, blocks are synced to/from Supabase so they
 * survive reinstalls and protect both sides (bidirectional RLS on the DB).
 *
 * All callers (PublicItemCard, PublicOutfitCard) continue to call blockUser(id)
 * unchanged — Supabase sync happens internally, fire-and-forget.
 */

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const KEY = "blocked-creators";

function load(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
}

// ── Read helpers ──────────────────────────────────────────────────────────────

export function getBlockedUsers(): string[] {
  return load();
}

export function isBlocked(userId: string): boolean {
  return load().includes(userId);
}

// ── Write helpers ─────────────────────────────────────────────────────────────

/** Block a user. Writes locally immediately; syncs to Supabase in the background. */
export function blockUser(userId: string): void {
  const blocked = load();
  if (!blocked.includes(userId)) {
    save([...blocked, userId]);
  }
  // Fire-and-forget server sync — does not throw
  syncBlockToServer(userId).catch(() => {});
}

/** Unblock a user. Removes locally; syncs removal to Supabase in the background. */
export function unblockUser(userId: string): void {
  save(load().filter((id) => id !== userId));
  syncUnblockFromServer(userId).catch(() => {});
}

// ── Supabase sync ─────────────────────────────────────────────────────────────

async function getMyUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await getSupabase().auth.getUser();
  return user?.id ?? null;
}

async function syncBlockToServer(blockedId: string): Promise<void> {
  const myId = await getMyUserId();
  if (!myId) return;
  await getSupabase()
    .from("blocks")
    .upsert({ blocker_id: myId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
}

async function syncUnblockFromServer(blockedId: string): Promise<void> {
  const myId = await getMyUserId();
  if (!myId) return;
  await getSupabase()
    .from("blocks")
    .delete()
    .eq("blocker_id", myId)
    .eq("blocked_id", blockedId);
}

/**
 * Called once on sign-in.
 * - Pushes any localStorage blocks to the server.
 * - Pulls server blocks back and merges with localStorage.
 * This ensures blocks survive reinstalls and cross-device.
 */
export async function migrateLocalBlocksToSupabase(myUserId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  const local = load();

  // Push local → server
  if (local.length > 0) {
    await sb.from("blocks").upsert(
      local.map((id) => ({ blocker_id: myUserId, blocked_id: id })),
      { onConflict: "blocker_id,blocked_id" },
    );
  }

  // Pull server → local (merge)
  const { data } = await sb
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", myUserId);

  if (data) {
    const serverIds = (data as { blocked_id: string }[]).map((r) => r.blocked_id);
    save([...new Set([...local, ...serverIds])]);
  }
}
