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
