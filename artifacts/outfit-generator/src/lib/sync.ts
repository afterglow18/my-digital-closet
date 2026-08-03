/**
 * sync.ts — Supabase community sync helpers.
 *
 * These functions are called only when the user is signed in and has
 * explicitly changed an item's visibility. Private items are NEVER touched.
 *
 * All functions are fire-and-forget safe: failures are caught and logged,
 * they never throw to the caller. The local item is always the source of
 * truth; Supabase is the sync target.
 */

import { getSupabase } from "./supabase";
import type { ClothingItem } from "./db";
import { Capacitor } from "@capacitor/core";

const BUCKET = "public-items";

// ── Image upload ──────────────────────────────────────────────────────────────

/**
 * Read a local Capacitor image as a Blob.
 * Returns null on web (dev mode — no Capacitor filesystem).
 */
async function readLocalImageBlob(filename: string): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) {
    // On web dev, images are object URLs in memory — we can't re-read them
    return null;
  }
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { data } = await Filesystem.readFile({
      path: `wardrobe-images/${filename}`,
      directory: Directory.Documents,
    });
    // data is a base64 string on native
    const base64 = data as string;
    const byteChars = atob(base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    return new Blob([bytes], { type: "image/jpeg" });
  } catch {
    return null;
  }
}

/**
 * Upload a local image to Supabase Storage.
 * Path: {uid}/{localId}.jpg
 * Returns the public URL, or null on failure.
 */
async function uploadImageToStorage(
  uid: string,
  localId: number,
  filename: string,
): Promise<string | null> {
  const blob = await readLocalImageBlob(filename);
  if (!blob) return null;

  const sb = getSupabase();
  const path = `${uid}/${localId}.jpg`;

  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) {
    console.error("[sync] image upload failed:", error.message);
    return null;
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete an image from Supabase Storage.
 */
async function deleteImageFromStorage(uid: string, localId: number): Promise<void> {
  try {
    const path = `${uid}/${localId}.jpg`;
    await getSupabase().storage.from(BUCKET).remove([path]);
  } catch {
    // Non-critical — orphaned storage objects are acceptable
  }
}

// ── Public items sync ─────────────────────────────────────────────────────────

/**
 * Publish or update an item in public_items.
 * Uploads the image to Supabase Storage if one exists locally.
 * Safe to call multiple times — uses upsert on (user_id, local_id).
 */
export async function publishItem(item: ClothingItem, uid: string): Promise<void> {
  if (!item.visibility || item.visibility === "private") return;

  try {
    const sb = getSupabase();

    // Upload image first (best-effort)
    let imageUrl: string | null = null;
    if (item.imageObjectPath) {
      imageUrl = await uploadImageToStorage(uid, item.id, item.imageObjectPath);
    }

    const payload = {
      user_id:   uid,
      local_id:  item.id,
      name:      item.name,
      category:  item.category,
      color:     item.color    ?? null,
      brand:     item.brand    ?? null,
      size:      item.size     ?? null,
      season:    item.season   ?? null,
      occasion:  item.occasion ?? null,
      notes:     item.notes    ?? null,
      image_url: imageUrl,
      price:     item.price    ?? null,
      currency:  item.currency ?? null,
      visibility: item.visibility,
    };

    const { error } = await sb
      .from("public_items")
      .upsert(payload, { onConflict: "user_id,local_id" });

    if (error) {
      console.error("[sync] publishItem failed:", error.message);
    }
  } catch (e) {
    console.error("[sync] publishItem error:", e);
  }
}

/**
 * Remove an item from public_items and delete its Storage image.
 * Called when visibility changes back to 'private' or item is deleted.
 */
export async function unpublishItem(localId: number, uid: string): Promise<void> {
  try {
    const sb = getSupabase();

    await sb
      .from("public_items")
      .delete()
      .eq("user_id", uid)
      .eq("local_id", localId);

    await deleteImageFromStorage(uid, localId);
  } catch (e) {
    console.error("[sync] unpublishItem error:", e);
  }
}

/**
 * Update metadata for a currently-public item (e.g. name, notes changed).
 * Does NOT re-upload the image (image_url stays the same).
 */
export async function syncItemEdit(item: ClothingItem, uid: string): Promise<void> {
  if (!item.visibility || item.visibility === "private") return;

  try {
    const sb = getSupabase();

    const { error } = await sb
      .from("public_items")
      .update({
        name:      item.name,
        category:  item.category,
        color:     item.color    ?? null,
        brand:     item.brand    ?? null,
        size:      item.size     ?? null,
        season:    item.season   ?? null,
        occasion:  item.occasion ?? null,
        notes:     item.notes    ?? null,
        price:     item.price    ?? null,
        currency:  item.currency ?? null,
        visibility: item.visibility,
      })
      .eq("user_id", uid)
      .eq("local_id", item.id);

    if (error) {
      console.error("[sync] syncItemEdit failed:", error.message);
    }
  } catch (e) {
    console.error("[sync] syncItemEdit error:", e);
  }
}

/**
 * Delete all Storage objects in the user's folder.
 * Called as step 1 of account deletion (before deleting auth user).
 */
export async function deleteAccountStorage(uid: string): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: files, error } = await sb.storage.from(BUCKET).list(uid);
    if (error || !files?.length) return;

    const paths = files.map((f) => `${uid}/${f.name}`);
    await sb.storage.from(BUCKET).remove(paths);
  } catch (e) {
    console.error("[sync] deleteAccountStorage error:", e);
  }
}
