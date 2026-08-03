/**
 * sharingPreference — localStorage cache for the user's sharing mode.
 *
 * Source of truth is profiles.privacy_mode in Supabase.
 * This cache lets the app skip the SharingModeSheet for users who have
 * previously saved their preference ("Remember my choice").
 */

export type SharingMode = "anonymous" | "public";

/**
 * Full 3-state participation mode.
 * Use this in Settings and AuthSheet where all 3 options are shown.
 */
export type ParticipationMode = "private" | "anonymous" | "public";

/** Normalize a raw profile privacy_mode to a ParticipationMode.
 *  null/undefined/"" all map to "private" (most restrictive safe default). */
export function normalizeParticipationMode(raw: string | null | undefined): ParticipationMode {
  if (raw === "anonymous") return "anonymous";
  if (raw === "public") return "public";
  return "private";
}

const KEY = "mdc_sharing_mode";

/** True when the user has explicitly saved a preference via "Remember my choice". */
export function hasSavedPref(): boolean {
  return localStorage.getItem(KEY) !== null;
}

/** Get the cached sharing mode. Defaults to "anonymous" (safer). */
export function getSharingPref(): SharingMode {
  const v = localStorage.getItem(KEY);
  if (v === "anonymous" || v === "public") return v;
  return "anonymous";
}

/** Save the user's sharing mode preference locally. */
export function setSharingPref(mode: SharingMode): void {
  localStorage.setItem(KEY, mode);
}

/** Clear the saved preference — next globe tap will show the picker again. */
export function clearSharingPref(): void {
  localStorage.removeItem(KEY);
}

/** Normalize a raw profile privacy_mode value to a SharingMode.
 *  Legacy "private" accounts are treated as "anonymous". */
export function normalizeMode(raw: string | null | undefined): SharingMode {
  if (raw === "public") return "public";
  return "anonymous"; // "private" and "anonymous" both map here
}
