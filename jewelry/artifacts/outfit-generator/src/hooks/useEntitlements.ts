/**
 * useEntitlements — entitlement hook backed by RevenueCat.
 *
 * The authoritative source is always RevenueCat's CustomerInfo.
 * localStorage is used only as a fast-read cache for the UI while the
 * live check completes. It is never the sole source of truth.
 *
 * Sync triggers:
 *  - App launch          → syncWithRevenueCat() called from App.tsx
 *  - Foreground return   → syncWithRevenueCat() called from App.tsx visibilitychange
 *  - After purchase      → customerInfo from purchasePackage response used directly
 *  - After restore       → customerInfo from restorePurchases response used directly
 *  - Refund / expiry     → next sync sets tier back to 'free' automatically
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import type { Tier, TierCapabilities, PurchaseProduct } from '@/types/local';
import { TIER_CAPS } from '@/types/local';
import {
  ENTITLEMENT_ID,
  PRODUCT_TIER_MAP,
  getPackageForProduct,
  deriveStateFromCustomerInfo,
  fetchEntitlementState,
  restoreAndCheck,
} from '@/lib/revenuecat';

// ── Shared external store ─────────────────────────────────────────────────────

const STORAGE_KEY         = 'mdc_tier';
const STORAGE_PRODUCT_KEY = 'mdc_active_product';

function readStoredTier(): Tier {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'unlock' || v === 'premium') return v;
  } catch {
    // private browsing
  }
  return 'free';
}

export function readStoredProduct(): PurchaseProduct | null {
  try {
    const v = localStorage.getItem(STORAGE_PRODUCT_KEY);
    if (v === 'monthly' || v === 'yearly' || v === 'lifetime') return v as PurchaseProduct;
  } catch {}
  return null;
}

// Initialise from cache so the UI is instant on load; syncWithRevenueCat()
// will correct it as soon as the SDK responds.
let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/** Update the global tier, persist to cache, and notify all subscribers. */
export function setGlobalTier(t: Tier, product?: PurchaseProduct): void {
  try {
    localStorage.setItem(STORAGE_KEY, t);
    if (product) {
      localStorage.setItem(STORAGE_PRODUCT_KEY, product);
    } else if (t === 'free') {
      localStorage.removeItem(STORAGE_PRODUCT_KEY);
    }
  } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

/**
 * Fetch live CustomerInfo from RevenueCat and sync the global tier.
 *
 * - If RC confirms no active entitlement → downgrades to 'free'.
 * - If the RC call fails (network error, SDK not yet ready) → keeps the
 *   existing cached tier and logs a warning. We never downgrade on a
 *   network failure; only on an explicit "not active" response.
 */
export async function syncWithRevenueCat(): Promise<void> {
  try {
    const { tier, product } = await fetchEntitlementState();
    setGlobalTier(tier, product ?? undefined);
    console.log('[RevenueCat] Sync complete — tier:', tier);
  } catch (err) {
    // SDK not configured, offline, or sandbox — keep cached tier.
    console.warn('[RevenueCat] Sync failed, keeping cached tier:', err);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseResult = 'success' | 'cancelled' | 'unavailable';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntitlements() {
  const tier = useSyncExternalStore(subscribeTier, getTierSnapshot);
  const caps: TierCapabilities = TIER_CAPS[tier];

  const canAddItem = useCallback(
    (currentCount: number) =>
      caps.maxItems === null || currentCount < caps.maxItems,
    [caps.maxItems],
  );

  const canSaveOutfit = useCallback(
    (currentCount: number) =>
      caps.maxOutfits === null || currentCount < caps.maxOutfits,
    [caps.maxOutfits],
  );

  const purchase = useCallback(
    async (product: PurchaseProduct): Promise<PurchaseResult> => {
      try {
        const pkg = await getPackageForProduct(product);
        if (!pkg) {
          console.warn('[RevenueCat] Package not found for product:', product);
          return 'unavailable';
        }

        const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

        // purchasePackage resolved without throwing = Apple approved the purchase.
        // Try RC's confirmed entitlement state first.
        const { tier: newTier, product: newProduct } = deriveStateFromCustomerInfo(customerInfo);

        if (newTier !== 'free') {
          setGlobalTier(newTier, newProduct ?? undefined);
          return 'success';
        }

        // RC hasn't processed the receipt yet (verification lag).
        // Set the tier optimistically from what was purchased so the UI
        // updates immediately. The next syncWithRevenueCat call will confirm.
        const optimisticTier = PRODUCT_TIER_MAP[product] ?? 'unlock';
        setGlobalTier(optimisticTier, product);
        console.log('[RevenueCat] Set tier optimistically:', optimisticTier, product);

        // Background sync to replace optimistic state with confirmed state.
        fetchEntitlementState()
          .then(({ tier: t, product: p }) => {
            if (t !== 'free') setGlobalTier(t, p ?? undefined);
          })
          .catch(() => { /* keep optimistic */ });

        return 'success';
      } catch (err: any) {
        if (err?.code === 'PURCHASE_CANCELLED' || err?.userCancelled === true) {
          return 'cancelled';
        }
        console.error('[RevenueCat] Purchase error:', err);
        return 'unavailable';
      }
    },
    [],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    try {
      const { tier: restoredTier, product: restoredProduct } = await restoreAndCheck();
      if (restoredTier !== 'free') {
        setGlobalTier(restoredTier, restoredProduct ?? undefined);
        return 'success';
      }
      // No active entitlement after restore — ensure tier is cleared.
      setGlobalTier('free');
      return 'cancelled';
    } catch (err) {
      console.error('[RevenueCat] Restore error:', err);
      return 'unavailable';
    }
  }, []);

  return { tier, caps, canAddItem, canSaveOutfit, purchase, restore };
}
