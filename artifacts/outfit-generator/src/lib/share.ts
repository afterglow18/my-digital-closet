/**
 * share.ts — Capacitor Share wrapper with Web Share API + clipboard fallback.
 */

import { Share } from "@capacitor/share";

/** Direct App Store link — for in-app buttons and the landing page redirect. */
export const APP_STORE_URL = "https://apps.apple.com/us/app/my-digital-closet/id6789233372";

/**
 * Share landing page — what gets sent to Facebook, iMessage, WhatsApp, etc.
 * Lives at /share/index.html with full Open Graph meta tags so social platforms
 * generate a rich preview. iPhone/iPad visitors are auto-redirected to the
 * App Store after 800 ms; desktop visitors see a download landing page.
 */
export const SHARE_PAGE_URL =
  (import.meta.env.VITE_SHARE_PAGE_URL as string | undefined)?.trim() ||
  "https://mydigitalcloset.replit.app/share/";

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

export function profileShareUrl(_handle: string): string {
  return APP_STORE_URL;
}

export function itemShareUrl(_id: string): string {
  return APP_STORE_URL;
}

export function outfitShareUrl(_id: string): string {
  return APP_STORE_URL;
}

// ── Share text builders ───────────────────────────────────────────────────────

type PrivacyMode = "private" | "anonymous" | "public";

/**
 * Pre-filled share sheet message for an item post.
 * Public profiles include the @handle; anonymous profiles don't.
 * The URL is embedded in the text so it works across all share destinations.
 */
export function buildItemShareText(
  _itemName: string,
  _privacyMode: PrivacyMode,
  _handle: string | undefined,
): string {
  return `✨ Check this out on My Digital Closet!\n\n${APP_STORE_URL}`;
}

/**
 * Pre-filled share sheet message for an outfit post.
 */
export function buildOutfitShareText(
  _outfitName: string | null | undefined,
  _privacyMode: PrivacyMode,
  _handle: string | undefined,
): string {
  return `✨ Check this out on My Digital Closet!\n\n${APP_STORE_URL}`;
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
