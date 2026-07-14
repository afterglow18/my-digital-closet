/**
 * useEntitlements
 *
 * Reads the user's current tier from localStorage and exposes capability
 * helpers. Uses useSyncExternalStore so every mounted instance of this hook
 * shares the same tier and updates atomically when a purchase completes.
 *
 * On app mount, syncs with RevenueCat to restore active subscriptions
 * across installs / reinstalls.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REVENUECAT PURCHASE FLOW
 *
 * 1. purchase("monthly" | "annual") is called from a paywall component.
 * 2. purchaseProduct() opens the native Apple StoreKit sheet.
 * 3. On success, setGlobalTier("unlock") is called immediately.
 * 4. Tier is persisted to localStorage so it survives restarts.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  Tier,
  TIER_CAPS,
  TierCapabilities,
  PurchaseProduct,
} from "@/lib/entitlements";
import { checkSubscription, purchaseProduct } from "@/lib/revenuecat";

// ── Shared external store ─────────────────────────────────────────────────────
const STORAGE_KEY = "mdc_tier";

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "unlock" || v === "premium") return v;
  } catch {
    // localStorage unavailable (rare private-browsing scenario)
  }
  return "free";
}

let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/** Update the shared tier store and persist to localStorage. */
export function setGlobalTier(t: Tier): void {
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

// ── Purchase result ───────────────────────────────────────────────────────────
export type PurchaseResult = "success" | "cancelled" | "unavailable";

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntitlements() {
  const tier = useSyncExternalStore(subscribeTier, getTierSnapshot);
  const caps: TierCapabilities = TIER_CAPS[tier];

  // Sync tier with RevenueCat on mount — restores subscriptions after reinstall
  useEffect(() => {
    checkSubscription().then((isActive) => {
      if (isActive && _currentTier === "free") setGlobalTier("unlock");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** True if the user can add another item given the current wardrobe size. */
  const canAddItem = useCallback(
    (currentCount: number) =>
      caps.maxItems === null || currentCount < caps.maxItems,
    [caps.maxItems],
  );

  /** True if the user can save another outfit given the current saved count. */
  const canSaveOutfit = useCallback(
    (currentCount: number) =>
      caps.maxOutfits === null || currentCount < caps.maxOutfits,
    [caps.maxOutfits],
  );

  /**
   * Trigger the purchase flow for a product via RevenueCat / Apple StoreKit.
   * Returns "success", "cancelled", or "unavailable".
   * On "success", the shared tier store is updated automatically.
   */
  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      const result = await purchaseProduct(product);
      if (result === "success") setGlobalTier("unlock");
      return result;
    },
    [],
  );

  return { tier, caps, canAddItem, canSaveOutfit, purchase };
}
