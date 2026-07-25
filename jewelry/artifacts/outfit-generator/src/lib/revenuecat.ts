/**
 * RevenueCat client — wraps @revenuecat/purchases-capacitor.
 *
 * Works in browser (test store) and native iOS (App Store).
 * Entitlement: "unlock"
 * Packages:    $rc_monthly | $rc_annual | $rc_lifetime
 */
import { Purchases } from "@revenuecat/purchases-capacitor";
import type {
  PurchasesPackage,
  PurchasesOfferings,
  CustomerInfo,
} from "@revenuecat/purchases-capacitor";
import type { PurchaseProduct, Tier } from "@/types/local";

const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string;
const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string;

export const ENTITLEMENT_ID = "unlock";

/** Map app product keys → RevenueCat package identifiers */
const PACKAGE_ID: Record<PurchaseProduct, string> = {
  monthly:  "$rc_monthly",
  yearly:   "$rc_annual",
  lifetime: "$rc_lifetime",
  premium:  "$rc_lifetime", // premium uses lifetime package as fallback
};

/** Which tier each product unlocks */
export const PRODUCT_TIER_MAP: Record<PurchaseProduct, Tier> = {
  monthly:  "unlock",
  yearly:   "unlock",
  lifetime: "unlock",
  premium:  "premium",
};

// Resolves when configure() completes (or immediately if no key is available).
// All SDK calls must await this before proceeding.
let _configuredPromise: Promise<void> | null = null;

export function initRevenueCat(): Promise<void> {
  if (_configuredPromise) return _configuredPromise;

  // In browser / dev → use test store key; in native iOS → use App Store key.
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const apiKey   = isNative ? (IOS_KEY ?? TEST_KEY) : (TEST_KEY ?? IOS_KEY);

  if (!apiKey) {
    console.warn("[RevenueCat] No API key found — purchases disabled");
    _configuredPromise = Promise.resolve();
    return _configuredPromise;
  }

  _configuredPromise = Purchases.configure({ apiKey })
    .then(() => console.log("[RevenueCat] Configured"))
    .catch((e: unknown) => console.error("[RevenueCat] Configure error:", e));

  return _configuredPromise;
}

/** Await SDK readiness before making any Purchases.* call. */
async function awaitConfigured(): Promise<void> {
  if (_configuredPromise) await _configuredPromise;
}

/** Fetch the current offering and find the package for a given product. */
export async function getPackageForProduct(
  product: PurchaseProduct,
): Promise<PurchasesPackage | null> {
  await awaitConfigured();
  const pkgId = PACKAGE_ID[product];
  const offerings: PurchasesOfferings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  return (
    current.availablePackages.find(
      (p: PurchasesPackage) => p.packageType === pkgId || p.identifier === pkgId,
    ) ?? null
  );
}

/**
 * Derive the app tier + product from a live CustomerInfo snapshot.
 * Returns { tier: 'free', product: null } when the entitlement is inactive.
 */
export function deriveStateFromCustomerInfo(
  customerInfo: CustomerInfo,
): { tier: Tier; product: PurchaseProduct | null } {
  const activeEnt = (customerInfo.entitlements?.active ?? {})[ENTITLEMENT_ID];
  if (!activeEnt) return { tier: "free", product: null };

  const prodId = activeEnt.productIdentifier ?? "";

  // Match known App Store product IDs and RC package types
  let product: PurchaseProduct = "lifetime"; // safe default
  if (/monthly/i.test(prodId) || prodId === "$rc_monthly") {
    product = "monthly";
  } else if (/annual|yearly/i.test(prodId) || prodId === "$rc_annual") {
    product = "yearly";
  } else if (/lifetime/i.test(prodId) || prodId === "$rc_lifetime") {
    product = "lifetime";
  }

  const tier = PRODUCT_TIER_MAP[product] ?? "unlock";
  return { tier, product };
}

/**
 * Fetch live CustomerInfo from RevenueCat and derive entitlement state.
 * Throws if the SDK call fails — callers should handle gracefully.
 */
export async function fetchEntitlementState(): Promise<{
  tier: Tier;
  product: PurchaseProduct | null;
}> {
  await awaitConfigured();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return deriveStateFromCustomerInfo(customerInfo);
}

/** Restore previous purchases and return derived entitlement state. */
export async function restoreAndCheck(): Promise<{
  tier: Tier;
  product: PurchaseProduct | null;
}> {
  await awaitConfigured();
  const { customerInfo } = await Purchases.restorePurchases();
  return deriveStateFromCustomerInfo(customerInfo);
}
