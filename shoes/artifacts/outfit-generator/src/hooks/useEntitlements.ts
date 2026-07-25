/**
 * useEntitlements — entitlement hook backed by RevenueCat.
 *
 * The authoritative source is always RevenueCat CustomerInfo.
 * localStorage is used only as a fast initial render cache — it is
 * overwritten by the first real RC check on launch / foreground.
 *
 * Access is revoked automatically when RC reports the entitlement
 * is no longer active (refund, expiry, etc.).
 */

import { useCallback, useSyncExternalStore } from 'react';
import { Purchases } from '@revenuecat/purchases-capacitor';
import type { Tier, TierCapabilities, PurchaseProduct } from '@/types/local';
import { TIER_CAPS, PRODUCT_TIER } from '@/types/local';
import {
  ENTITLEMENT_ID,
  PRODUCT_TIER_MAP,
  getPackageForProduct,
  syncTierFromRevenueCat,
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

let _currentTier: Tier = readStoredTier();
const _subscribers = new Set<() => void>();

function subscribeTier(notify: () => void) {
  _subscribers.add(notify);
  return () => { _subscribers.delete(notify); };
}

function getTierSnapshot(): Tier {
  return _currentTier;
}

/**
 * Update the global tier and persist to localStorage.
 * Can promote OR demote (e.g. back to 'free' on refund/expiry).
 */
export function setGlobalTier(t: Tier, product?: PurchaseProduct): void {
  try {
    localStorage.setItem(STORAGE_KEY, t);
    if (product) localStorage.setItem(STORAGE_PRODUCT_KEY, product);
    // Clear product key when downgrading to free
    if (t === 'free') localStorage.removeItem(STORAGE_PRODUCT_KEY);
  } catch {}
  _currentTier = t;
  _subscribers.forEach((fn) => fn());
}

/**
 * Ask RevenueCat for the current CustomerInfo and sync the global tier.
 * Safe to call at any time — if RC is unavailable (network error, not yet
 * configured) it returns early without changing the tier.
 *
 * Call this on: app launch (after init), foreground resume, after purchase,
 * and after restore.
 */
export async function recheckEntitlement(): Promise<void> {
  const tier = await syncTierFromRevenueCat();
  if (tier !== null) {
    setGlobalTier(tier);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | 'success'
  | 'cancelled'
  | { result: 'unavailable'; detail: string };

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
          const detail = 'No package found for this product in the current RC offering.';
          console.warn('[RevenueCat]', detail);
          return { result: 'unavailable', detail };
        }

        const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

        // Always trust CustomerInfo returned by the SDK — never just assume success.
        if (ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {})) {
          const newTier: Tier = PRODUCT_TIER_MAP[product] ?? PRODUCT_TIER[product] ?? 'unlock';
          setGlobalTier(newTier, product);
          return 'success';
        }

        // Purchase flow completed but entitlement not active — recheck to be sure.
        await recheckEntitlement();
        return 'cancelled';
      } catch (err: any) {
        if (err?.code === 'PURCHASE_CANCELLED' || err?.userCancelled === true) {
          return 'cancelled';
        }
        const detail = err?.message ?? err?.code ?? JSON.stringify(err) ?? 'Unknown error';
        console.error('[RevenueCat] Purchase error:', err);
        return { result: 'unavailable', detail };
      }
    },
    [],
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    try {
      const tier = await restoreAndCheck();
      if (tier === null) return { result: 'unavailable', detail: 'RC restore call failed — check connection.' };
      // Apply whatever RC says — this also handles revocations.
      setGlobalTier(tier);
      return tier !== 'free' ? 'success' : 'cancelled';
    } catch (err: any) {
      console.error('[RevenueCat] Restore error:', err);
      return { result: 'unavailable', detail: err?.message ?? err?.code ?? JSON.stringify(err) ?? 'Unknown error' };
    }
  }, []);

  return { tier, caps, canAddItem, canSaveOutfit, purchase, restore };
}
