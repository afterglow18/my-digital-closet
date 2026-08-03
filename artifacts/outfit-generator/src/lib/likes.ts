/**
 * likes.ts — server-side sync for Discover hearts.
 *
 * Call syncLike() fire-and-forget after toggling the local discoverFavorites.
 * Only fires for authenticated users; unauthenticated hearts stay local-only.
 *
 * The DB trigger automatically:
 *  • creates a notification for the post owner on INSERT
 *  • cascade-deletes the notification on DELETE (via like_id FK)
 */

import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Sync a heart toggle to Supabase.
 *
 * @param postId    ID of the public_items or public_outfits row
 * @param postType  "item" | "outfit"
 * @param hearted   true → insert like  /  false → delete like
 * @param userId    The authenticated user's profile id
 */
export async function syncLike(
  postId: string,
  postType: "item" | "outfit",
  hearted: boolean,
  userId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabase();
  try {
    if (hearted) {
      await sb
        .from("post_likes")
        .upsert(
          { liker_id: userId, post_id: postId, post_type: postType },
          { onConflict: "liker_id,post_id" },
        );
    } else {
      await sb
        .from("post_likes")
        .delete()
        .eq("liker_id", userId)
        .eq("post_id", postId);
    }
  } catch (e) {
    if (import.meta.env.DEV) console.error("[likes] syncLike error:", e);
  }
}
