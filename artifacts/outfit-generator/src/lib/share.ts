/**
 * share.ts — Capacitor Share wrapper with Web Share API + clipboard fallback.
 *
 * BASE_URL preference order:
 *  1. VITE_PUBLIC_BASE_URL env var  (set this once you have a custom domain)
 *  2. https://mydigitalcloset.app   (final production domain placeholder)
 *
 * Set VITE_PUBLIC_BASE_URL in Replit Secrets to your deployed URL while the
 * custom domain is being set up, e.g. https://my-app.replit.app
 */

import { Share } from "@capacitor/share";

const BASE_URL =
  (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://mydigitalcloset.app";

/**
 * App Store URL for share sheets and "Get the App" CTAs.
 *
 * Set ONE of these in Codemagic's build_env group:
 *   VITE_APP_STORE_URL   Full App Store URL (preferred)
 *                        e.g. https://apps.apple.com/us/app/my-digital-closet/id6743215890
 *   VITE_APP_STORE_ID    Numeric App Store ID only (e.g. 6743215890)
 *                        The full URL is constructed automatically from this.
 */
export const APP_STORE_URL: string =
  (import.meta.env.VITE_APP_STORE_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_APP_STORE_ID
    ? `https://apps.apple.com/app/my-digital-closet/id${import.meta.env.VITE_APP_STORE_ID as string}`
    : "https://apps.apple.com/us/app/my-digital-closet/id6789233372");

/**
 * Value for the `content` attribute of the iOS Smart App Banner meta tag.
 * Browsers that support it (Safari on iOS) show a banner:
 *   "My Digital Closet  [Open]" — opens the post directly if the app is installed,
 *   or takes the user to the App Store if not.
 */
export function smartBannerContent(postUrl: string): string {
  const appId = (import.meta.env.VITE_APP_STORE_ID as string | undefined) ?? "0";
  return `app-id=${appId}, app-argument=${postUrl}`;
}

// ── URL builders ──────────────────────────────────────────────────────────────

export function profileShareUrl(handle: string): string {
  return `${BASE_URL}/profile/${handle}`;
}

export function itemShareUrl(id: string): string {
  return `${BASE_URL}/item/${id}`;
}

export function outfitShareUrl(id: string): string {
  return `${BASE_URL}/outfit/${id}`;
}

// ── Share text builders ───────────────────────────────────────────────────────

type PrivacyMode = "private" | "anonymous" | "public";

/**
 * Pre-filled share sheet message for an item post.
 * Public profiles include the @handle; anonymous profiles don't.
 * The URL is embedded in the text so it works across all share destinations.
 */
export function buildItemShareText(
  itemName: string,
  privacyMode: PrivacyMode,
  handle: string | undefined,
): string {
  const credit = privacyMode === "public" && handle ? ` by @${handle}` : "";
  return `✨ Check out "${itemName}"${credit} on My Digital Closet!\n\nDownload the app 👇`;
}

/**
 * Pre-filled share sheet message for an outfit post.
 * Public profiles include the @handle; anonymous profiles don't.
 */
export function buildOutfitShareText(
  outfitName: string | null | undefined,
  privacyMode: PrivacyMode,
  handle: string | undefined,
): string {
  const name   = outfitName?.trim() || "this outfit";
  const credit = privacyMode === "public" && handle ? ` by @${handle}` : "";
  return `✨ Check out "${name}"${credit} on My Digital Closet!\n\nDownload the app 👇`;
}

// ── Share action ──────────────────────────────────────────────────────────────

/**
 * Open the native share sheet (iOS/Android) or fall through to
 * Web Share API → clipboard copy on desktop.
 *
 * Swallows "cancelled" errors silently — the user tapped away.
 */
export async function shareContent(
  url: string,
  text: string,
  title = "My Digital Closet",
): Promise<void> {
  try {
    await Share.share({ url, text, title, dialogTitle: title });
    return;
  } catch {
    // Share cancelled or Capacitor not available on this platform
  }

  // Web Share API fallback (Chrome Android, Safari iOS via web)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ url, text, title });
      return;
    } catch {
      // User dismissed
    }
  }

  // Last resort: copy to clipboard
  try {
    await navigator.clipboard.writeText(url);
  } catch {}
}
