/**
 * Prepends VITE_API_BASE_URL to a path when running inside Capacitor.
 * In the normal Replit web build the env var is absent and relative URLs work as-is.
 */
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "")
  .replace(/\/+$/, "");

export const apiUrl = (path: string): string => `${API_BASE}${path}`;
