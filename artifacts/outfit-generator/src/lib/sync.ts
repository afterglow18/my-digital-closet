/**
 * sync.ts — Supabase community sync helpers (V1: browse-and-share only).
 *
 * PRIVACY RULES
 * ─────────────
 * • These functions are called ONLY when the user is signed in AND has
 *   explicitly changed an item or outfit visibility to 'public'.
 * • Private items and outfits are NEVER touched by any function here.
 * • All functions are fire-and-forget safe: failures are caught and logged,
 *   they never throw to the caller. Local data is always the source of truth.
 *
 * V1 SCOPE: clothing items + saved outfits. No prices, no marketplace.
 */

import { getSupabase } from "./supabase";
import type { ClothingItem, Outfit } from "./db";
import { Capacitor } from "@capacitor/core";

const ITEMS_BUCKET = "public-items";

// ── Image upload ──────────────────────────────────────────────────────────────

async function readLocalImageBlob(filename: string): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { data } = await Filesystem.readFile({
      path: `wardrobe-images/${filename}`,
      directory: Directory.Documents,
    });
    const base64   = data as string;
    const byteChars = atob(base64);
    const bytes    = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch {
    return null;
  }
}

async function uploadItemImage(uid: string, localId: number, filename: string): Promise<string | null> {
  const blob = await readLocalImageBlob(filename);
  if (!blob) return null;
  const sb   = getSupabase();
  const path = `${uid}/${localId}.jpg`;
  const { error } = await sb.storage.from(ITEMS_BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) { console.error("[sync] image upload failed:", error.message); return null; }
  const { data } = sb.storage.from(ITEMS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ── Avatar upload ─────────────────────────────────────────────────────────────

/**
 * Compress a File/Blob to a JPEG at most 400×400, upload to Storage,
 * and update profiles.avatar_url. Returns the public URL or null on error.
 */
export async function uploadAvatar(uid: string, file: File | Blob): Promise<string | null> {
  try {
    // Compress via canvas → max 400px, quality 0.85
    const bitmap = await createImageBitmap(file);
    const size   = 400;
    const scale  = Math.min(size / bitmap.width, size / bitmap.height, 1);
    const w = Math.round(bitmap.width  * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.85),
    );

    const sb   = getSupabase();
    const path = `avatars/${uid}.jpg`;
    const { error: upErr } = await sb.storage.from(ITEMS_BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) { console.error("[sync] avatar upload failed:", upErr.message); return null; }

    // Add cache-bust so the new image shows immediately
    const { data } = sb.storage.from(ITEMS_BUCKET).getPublicUrl(path);
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: dbErr } = await sb
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", uid);
    if (dbErr) { console.error("[sync] avatar profile update failed:", dbErr.message); return null; }

    return avatarUrl;
  } catch (e) {
    console.error("[sync] uploadAvatar error:", e);
    return null;
  }
}

async function deleteItemImage(uid: string, localId: number): Promise<void> {
  try {
    await getSupabase().storage.from(ITEMS_BUCKET).remove([`${uid}/${localId}.jpg`]);
  } catch { /* non-critical */ }
}

// ── Clothing item sync ────────────────────────────────────────────────────────

/**
 * Publish (or re-publish) an item. Uploads image best-effort.
 * Safe to call multiple times — upserts on (user_id, local_id).
 *
 * Returns { ok: true } on success or { ok: false, error } on failure so the
 * caller can surface the problem to the user.
 */
export async function publishItem(
  item: ClothingItem,
  uid: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!item.visibility || item.visibility === "private") return { ok: true };
  try {
    const sb = getSupabase();
    let imageUrl: string | null = null;
    if (item.imageObjectPath) {
      imageUrl = await uploadItemImage(uid, item.id, item.imageObjectPath);
    }
    const { error } = await sb.from("public_items").upsert(
      {
        user_id:    uid,
        local_id:   item.id,
        name:       item.name,
        category:   item.category,
        color:      item.color    ?? null,
        brand:      item.brand    ?? null,
        size:       item.size     ?? null,
        season:     item.season   ?? null,
        occasion:   item.occasion ?? null,
        // notes intentionally omitted — private, local-only, never sent to Supabase
        image_url:  imageUrl,
        visibility: "public",
        // Always (re-)set status to active so re-publishing a previously
        // reported row makes it visible again, and so the row passes the
        // feed query's `.eq("status", "active")` filter.
        status:     "active",
      },
      { onConflict: "user_id,local_id" },
    );
    if (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[sync] publishItem failed\n" +
          `  code:    ${error.code ?? "(none)"}\n` +
          `  message: ${error.message}\n` +
          `  details: ${error.details ?? "(none)"}\n` +
          `  hint:    ${error.hint    ?? "(none)"}`,
        );
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync] publishItem error:", e);
    return { ok: false, error: msg };
  }
}

/**
 * Remove an item from public_items and delete its storage image.
 * Called when visibility is changed back to 'private' or item is deleted.
 */
export async function unpublishItem(localId: number, uid: string): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.from("public_items").delete().eq("user_id", uid).eq("local_id", localId);
    await deleteItemImage(uid, localId);
  } catch (e) {
    console.error("[sync] unpublishItem error:", e);
  }
}

/**
 * Update metadata for an already-public item (name, notes, etc. changed).
 * Does NOT re-upload the image.
 */
export async function syncItemEdit(item: ClothingItem, uid: string): Promise<void> {
  if (!item.visibility || item.visibility === "private") return;
  try {
    const { error } = await getSupabase()
      .from("public_items")
      .update({
        name:     item.name,
        category: item.category,
        color:    item.color    ?? null,
        brand:    item.brand    ?? null,
        size:     item.size     ?? null,
        season:   item.season   ?? null,
        occasion: item.occasion ?? null,
        // notes intentionally omitted — private, local-only, never sent to Supabase
      })
      .eq("user_id", uid)
      .eq("local_id", item.id);
    if (error) console.error("[sync] syncItemEdit failed:", error.message);
  } catch (e) {
    console.error("[sync] syncItemEdit error:", e);
  }
}

// ── Outfit sync ───────────────────────────────────────────────────────────────

/**
 * Publish (or re-publish) a saved outfit. V1: no outfit image.
 * Item names are denormalized into item_names[] for display.
 */
export async function publishOutfit(outfit: Outfit, uid: string): Promise<void> {
  if (!outfit.visibility || outfit.visibility === "private") return;
  try {
    const itemNames = (outfit.items ?? []).map((i) => i.name).filter(Boolean);
    const { error } = await getSupabase().from("public_outfits").upsert(
      {
        user_id:     uid,
        local_id:    outfit.id,
        name:        outfit.name ?? null,
        description: outfit.notes ?? null,
        item_names:  itemNames,
        image_url:   null, // V1: no outfit cover image
        status:      "active",
      },
      { onConflict: "user_id,local_id" },
    );
    if (error) console.error("[sync] publishOutfit failed:", error.message);
  } catch (e) {
    console.error("[sync] publishOutfit error:", e);
  }
}

/**
 * Remove an outfit from public_outfits.
 */
export async function unpublishOutfit(localId: number, uid: string): Promise<void> {
  try {
    const { error } = await getSupabase()
      .from("public_outfits")
      .delete()
      .eq("user_id", uid)
      .eq("local_id", localId);
    if (error) console.error("[sync] unpublishOutfit failed:", error.message);
  } catch (e) {
    console.error("[sync] unpublishOutfit error:", e);
  }
}

/**
 * Remove ALL of a user's published items and outfits from Supabase and delete
 * their storage folder. Called when the user switches to Private mode.
 */
export async function unpublishAllUserPosts(uid: string): Promise<void> {
  try {
    const sb = getSupabase();
    await sb.from("public_items").delete().eq("user_id", uid);
    await sb.from("public_outfits").delete().eq("user_id", uid);
    const { data: files } = await sb.storage.from(ITEMS_BUCKET).list(uid);
    if (files?.length) {
      await sb.storage.from(ITEMS_BUCKET).remove(files.map((f) => `${uid}/${f.name}`));
    }
  } catch (e) {
    console.error("[sync] unpublishAllUserPosts error:", e);
  }
}

/**
 * Update metadata for an already-public outfit (name, notes changed).
 */
export async function syncOutfitEdit(outfit: Outfit, uid: string): Promise<void> {
  if (!outfit.visibility || outfit.visibility === "private") return;
  try {
    const itemNames = (outfit.items ?? []).map((i) => i.name).filter(Boolean);
    const { error } = await getSupabase()
      .from("public_outfits")
      .update({
        name:        outfit.name ?? null,
        description: outfit.notes ?? null,
        item_names:  itemNames,
      })
      .eq("user_id", uid)
      .eq("local_id", outfit.id);
    if (error) console.error("[sync] syncOutfitEdit failed:", error.message);
  } catch (e) {
    console.error("[sync] syncOutfitEdit error:", e);
  }
}

// ── Privacy mode ─────────────────────────────────────────────────────────────

/**
 * Change the user's privacy mode.
 *
 * The RLS policy on public_items / public_outfits enforces the result:
 * private-mode users' posts are excluded from every Discover query at the
 * database level — no client-side filtering required.
 *
 * anonymous ↔ public: only the profile row changes; posts stay 'active'.
 * → private: posts remain 'active' in the DB but are hidden by RLS.
 * private → anything: posts become visible again the moment the profile
 * row is updated; no post-level changes needed.
 */
export async function changePrivacyMode(
  userId: string,
  newMode: "private" | "anonymous" | "public",
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await getSupabase()
      .from("profiles")
      .update({ privacy_mode: newMode })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    const msg = (e as any)?.message ?? (e instanceof Error ? e.message : "Failed to update privacy mode");
    console.error("[sync] changePrivacyMode failed:", e);
    return { ok: false, error: msg };
  }
}

// ── Account cleanup ───────────────────────────────────────────────────────────

/**
 * Delete all Storage objects in the user's folder.
 * Step 1 of account deletion (before deleting auth user via Edge Function).
 */
export async function deleteAccountStorage(uid: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: files, error } = await sb.storage.from(ITEMS_BUCKET).list(uid);
    if (error || !files?.length) return;
    const paths = files.map((f) => `${uid}/${f.name}`);
    await sb.storage.from(ITEMS_BUCKET).remove(paths);
  } catch (e) {
    console.error("[sync] deleteAccountStorage error:", e);
  }
}
