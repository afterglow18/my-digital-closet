/**
 * likes.ts — server-side sync for Discover hearts.
 *
 * syncLike() is awaited by the caller, which applies an optimistic UI update
 * before calling and reverts if this function returns { ok: false }.
 *
 * Only fires for authenticated users; unauthenticated hearts stay local-only.
 *
 * The DB trigger automatically:
 *  • creates a notification for the post owner on INSERT
 *  • cascade-deletes the notification on DELETE (via like_id FK)
 */

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export interface SyncLikeResult {
  ok:     boolean;
  error?: string;
}

/**
 * Sync a heart toggle to Supabase.
 *
 * @param postId    ID of the public_items or public_outfits row
 * @param postType  "item" | "outfit"
 * @param hearted   true → insert like  /  false → delete like
 * @param userId    The authenticated user's profile id
 *
 * Returns { ok: true } on success or { ok: false, error } on failure so the
 * caller can revert the optimistic UI update.
 */
export async function syncLike(
  postId:   string,
  postType: "item" | "outfit",
  hearted:  boolean,
  userId:   string,
): Promise<SyncLikeResult> {
  if (!isSupabaseConfigured()) return { ok: true };
  const sb = getSupabase();

  try {
    if (hearted) {
      const { error } = await sb
        .from("post_likes")
        .upsert(
          { liker_id: userId, post_id: postId, post_type: postType },
          { onConflict: "liker_id,post_id" },
        );
      if (error) throw error;
    } else {
      const { error } = await sb
        .from("post_likes")
        .delete()
        .eq("liker_id", userId)
        .eq("post_id", postId);
      if (error) throw error;
    }

    return { ok: true };
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? "Failed to sync heart";
    console.error("[likes] syncLike error:", e);
    return { ok: false, error: msg };
  }
}
