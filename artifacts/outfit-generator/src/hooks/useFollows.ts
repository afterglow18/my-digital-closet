/**
 * useFollows — Supabase-backed follow hooks.
 *
 * When the user is authenticated, all follows are persisted in the `follows`
 * table with optimistic UI and server-side revert on failure.
 *
 * When the user is not authenticated, falls back to localStorage (localFollows).
 * On first sign-in, call migrateLocalFollowsToSupabase() to sync local data.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  toggleFollow as toggleLocalFollow,
  isFollowing  as isLocalFollowing,
  getLocalFollows,
} from "@/lib/localFollows";

// ── Read: list of followed profile IDs ────────────────────────────────────────

/**
 * Returns the IDs of all profiles the current user follows.
 * Uses Supabase when authenticated, localStorage when not.
 */
export function useMyFollowIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["follows", "my-ids", userId],
    queryFn: async (): Promise<string[]> => {
      if (!userId || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("follows")
        .select("followed_id")
        .eq("follower_id", userId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.followed_id as string);
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Read: check a single follow relationship ───────────────────────────────────

/**
 * Returns whether the current user follows a specific profile.
 * Prefers Supabase when authenticated; falls back to localStorage.
 */
export function useIsFollowing(
  followedId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey: ["follows", "check", userId, followedId],
    queryFn: async (): Promise<boolean> => {
      if (!followedId) return false;
      if (!userId || !isSupabaseConfigured()) return isLocalFollowing(followedId);
      const { data } = await getSupabase()
        .from("follows")
        .select("id")
        .eq("follower_id", userId)
        .eq("followed_id", followedId)
        .maybeSingle();
      return Boolean(data);
    },
    enabled: Boolean(followedId),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Mutation: toggle follow ────────────────────────────────────────────────────

interface ToggleFollowArgs {
  followedId:         string;
  handle:             string;
  userId:             string;
  currentlyFollowing: boolean;
}

/**
 * Mutation for toggling a follow.
 *
 * The caller should:
 *   1. Apply an optimistic UI update before calling mutateAsync.
 *   2. Catch errors and revert on failure.
 *
 * On success, invalidates the follow ID list, the single-follow check, and
 * the following feed so they all refresh automatically.
 */
export function useToggleFollowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      followedId,
      handle,
      userId,
      currentlyFollowing,
    }: ToggleFollowArgs) => {
      // No Supabase configured — stay local only
      if (!isSupabaseConfigured()) {
        toggleLocalFollow(followedId, handle);
        return;
      }

      const sb = getSupabase();

      if (!currentlyFollowing) {
        // Follow
        const { error } = await sb
          .from("follows")
          .insert({ follower_id: userId, followed_id: followedId });
        if (error) throw new Error(error.message);
        // Keep localStorage in sync for offline fallback
        if (!isLocalFollowing(followedId)) toggleLocalFollow(followedId, handle);
      } else {
        // Unfollow
        const { error } = await sb
          .from("follows")
          .delete()
          .eq("follower_id", userId)
          .eq("followed_id", followedId);
        if (error) throw new Error(error.message);
        if (isLocalFollowing(followedId)) toggleLocalFollow(followedId, handle);
      }
    },

    onSuccess: (_data, { userId, followedId }) => {
      queryClient.invalidateQueries({ queryKey: ["follows", "my-ids", userId] });
      queryClient.invalidateQueries({ queryKey: ["follows", "check", userId, followedId] });
      queryClient.invalidateQueries({ queryKey: ["following-feed"] });
    },
  });
}

// ── Hook: resolved following state with optimistic UI ─────────────────────────

/**
 * Returns current following state and a toggle handler with optimistic UI.
 * Used by FollowButton so it stays reactive to Supabase data.
 */
export function useFollowState(
  followedId: string,
  handle: string,
  userId: string | undefined,
) {
  const { data: serverFollowing } = useIsFollowing(followedId, userId);
  const [following,  setFollowing]  = useState(() => isLocalFollowing(followedId));
  const [syncing,    setSyncing]    = useState(false);
  const [syncError,  setSyncError]  = useState<string | null>(null);
  const toggleMutation = useToggleFollowMutation();

  // Sync local state when the server value arrives or changes
  useEffect(() => {
    if (serverFollowing !== undefined) setFollowing(serverFollowing);
  }, [serverFollowing]);

  const toggle = async (resolvedUserId: string) => {
    if (syncing) return;
    const prev = following;
    const next = !following;
    setFollowing(next); // optimistic
    setSyncError(null);
    setSyncing(true);

    try {
      await toggleMutation.mutateAsync({
        followedId,
        handle,
        userId: resolvedUserId,
        currentlyFollowing: prev,
      });
    } catch {
      setFollowing(prev); // revert
      setSyncError("Couldn't update. Try again.");
      setTimeout(() => setSyncError(null), 3000);
    } finally {
      setSyncing(false);
    }
  };

  return { following, syncing, syncError, toggle, setFollowing };
}

// ── Migration: local → Supabase ────────────────────────────────────────────────

/**
 * One-time migration: push localStorage follows to the `follows` table.
 * Called after sign-in. Only inserts; never deletes server-side rows.
 * Silently skips duplicates (upsert with ignoreDuplicates).
 * Returns the number of rows successfully migrated.
 */
export async function migrateLocalFollowsToSupabase(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const local = getLocalFollows();
  if (!local.length) return 0;

  const sb   = getSupabase();
  const rows = local.map((f) => ({
    follower_id: userId,
    followed_id: f.profileId,
  }));

  const { data, error } = await sb
    .from("follows")
    .upsert(rows, { onConflict: "follower_id,followed_id", ignoreDuplicates: true })
    .select("id");

  if (error) {
    console.error("[follows] migration error:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
