/**
 * backgroundRemoval.ts
 *
 * On-device background removal powered by Apple Vision's
 * VNGenerateForegroundInstanceMaskRequest (iOS 17.0+).
 *
 * • Works only on native iOS — web always returns { supported: false }.
 * • Photos never leave the device; no API key or network call required.
 * • Returns a PNG data-URL with transparent background so the item can be
 *   composited onto any colour in the wardrobe views.
 *
 * Usage:
 *   const ok = await isBackgroundRemovalSupported();
 *   if (ok) {
 *     const pngDataUrl = await removeBackground(jpegDataUrl);
 *   }
 */

import { registerPlugin, Capacitor } from "@capacitor/core";

// ── Plugin interface ──────────────────────────────────────────────────────────

interface BackgroundRemovalPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  removeBackground(opts: { dataUrl: string }): Promise<{ dataUrl: string }>;
}

const BackgroundRemoval = registerPlugin<BackgroundRemovalPlugin>(
  "BackgroundRemoval",
  {
    // Web stub — the feature is native-only
    web: () => ({
      isSupported:      async () => ({ supported: false }),
      removeBackground: async () => { throw new Error("Native only"); },
    }),
  }
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true only on native iOS 17.0+.
 * Safe to call on web — returns false immediately.
 */
export async function isBackgroundRemovalSupported(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log("[bgremoval] isNativePlatform=false — web stub active");
    return false;
  }
  try {
    const { supported } = await BackgroundRemoval.isSupported();
    console.log(`[bgremoval] isSupported() → ${supported}`);
    return supported;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[bgremoval] isSupported() threw:", msg);
    // Re-throw so callers can surface a useful error message
    throw err;
  }
}

/**
 * Returns a diagnostic string for why background removal is unavailable.
 * Empty string means it IS available.
 * Safe to call on web — returns an explanation immediately.
 */
export async function getBackgroundRemovalError(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "web (non-native)";
  try {
    const { supported } = await BackgroundRemoval.isSupported();
    return supported ? "" : "iOS < 17";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Remove the background from a base64 data-URL image.
 * Returns a PNG data-URL with transparent background.
 *
 * Throws if:
 *  - running on web
 *  - iOS < 17
 *  - no foreground subject is detected
 *  - Vision request fails
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  const { dataUrl: result } = await BackgroundRemoval.removeBackground({ dataUrl });
  return result;
}

// ── Helpers shared with QuickAddSheet ────────────────────────────────────────

/** Convert a Blob to a base64 data-URL string. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/** Convert a data-URL string back to a Blob (e.g. to pass to saveImage). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
