---
name: Local-first migration
description: My Digital Vanity converted from Express/PostgreSQL/JWT to IndexedDB-only with no auth.
---

## What changed
- All clothing and outfit data now lives in IndexedDB (via `idb`) — no API server calls from the front-end.
- Auth (JWT, bcrypt, login/register pages, AuthProvider, AuthContext) was fully removed.
- IDs changed from `number` (postgres serial) to `string` (UUID via `crypto.randomUUID()`).
- Images stored as JPEG data URLs directly in IndexedDB (no Capacitor Filesystem).

## Key file locations
- `src/types/local.ts` — all shared types (`ClothingItem`, `SavedOutfit`, `WardrobeStats`, tier types)
- `src/lib/db.ts` — full IndexedDB service layer
- `src/lib/backup.ts` — JSON export/import (uses `@capacitor/share` on native)
- `src/hooks/useLocalWardrobe.ts` — React Query wardrobe hooks (replaces api-client-react)
- `src/hooks/useLocalOutfits.ts` — React Query outfit hooks (replaces api-client-react)
- `src/hooks/useEntitlements.ts` — localStorage tier store; `purchase()` returns `"unavailable"` (RevenueCat stub)
- `src/pages/backup.tsx` — new Backup page (4th nav slot)

## What's NOT done yet (follow-up)
- RevenueCat: use `@revenuecat/purchases-capacitor`; wire real `purchase()` in `useEntitlements`.
- Server data migration: one-time import from old API server on first launch (decision deferred to user).

**Why:**
User wanted full offline/local-first operation with no login flow for the iOS app on TestFlight.
