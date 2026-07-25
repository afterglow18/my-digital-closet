/**
 * RevenueCat client — wraps @revenuecat/purchases-capacitor.
 *
 * Works in browser (test store) and native iOS (App Store).
 * Entitlement: "unlock"
 * Packages:    $rc_monthly | $rc_annual | $rc_lifetime
 */
import { Purchases } from "@revenuecat/purchases-capacitor";
import type { PurchasesPackage, PurchasesOfferings } from "@revenuecat/purchases-capacitor";
import type { PurchaseProduct, Tier } from "@/types/local";

const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string;
const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string;

export const ENTITLEMENT_ID = "My Digital Shoes Pro";

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

let _initialised = false;

/**
 * Configure the RevenueCat SDK. Returns a Promise that resolves once
 * configuration is complete so callers can chain an entitlement recheck.
 */
export async function initRevenueCat(): Promise<void> {
  if (_initialised) return;

  // In browser / dev → use test store key; in native iOS → use App Store key.
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.();
  const apiKey   = isNative ? (IOS_KEY ?? TEST_KEY) : (TEST_KEY ?? IOS_KEY);

  if (!apiKey) {
    console.warn("[RevenueCat] No API key found — purchases disabled");
    return;
  }

  try {
    await Purchases.configure({ apiKey });
    _initialised = true; // only mark initialised on success
    console.log("[RevenueCat] Configured — native:", isNative, "key prefix:", apiKey.slice(0, 8));
  } catch (e: unknown) {
    console.error("[RevenueCat] Configure error:", e);
    // do NOT set _initialised so the next launch attempt can retry
  }
}

/** Fetch the current offering and find the package for a given product. */
export async function getPackageForProduct(
  product: PurchaseProduct,
): Promise<PurchasesPackage | null> {
  const pkgId = PACKAGE_ID[product];
  let offerings: PurchasesOfferings;
  try {
    offerings = await Purchases.getOfferings();
  } catch (e: unknown) {
    console.error("[RevenueCat] getOfferings failed — SDK may not be configured:", e);
    return null;
  }
  const current = offerings.current ?? offerings.all?.["default"] ?? null;
  if (!current) {
    const allKeys = Object.keys(offerings.all ?? {}).join(", ") || "none";
    console.warn(`[RevenueCat] No current offering. all keys: [${allKeys}]`);
    throw new Error(`No current offering from RC. Offering keys on device: [${allKeys}]`);
  }
  const available = current.availablePackages;
  const availableSummary = available.length === 0
    ? "none"
    : available.map((p: PurchasesPackage) => `${p.identifier}/${p.packageType}`).join(", ");
  console.log("[RevenueCat] Available packages:", availableSummary);
  const pkg =
    available.find((p: PurchasesPackage) => p.identifier === pkgId) ??
    available.find((p: PurchasesPackage) => p.packageType === pkgId) ??
    null;
  if (!pkg) {
    console.warn(`[RevenueCat] Package not found for "${product}" (looking for id="${pkgId}"). Available: ${availableSummary}`);
    // Surface the available list so the on-screen error shows what StoreKit returned
    throw new Error(`No StoreKit product found for "${pkgId}". Packages available on device: [${availableSummary}]`);
  }
  return pkg;
}

/**
 * Fetch CustomerInfo from RevenueCat and return the correct Tier.
 * Returns null if the SDK throws (network error, not configured) so the
 * caller can leave the current tier unchanged rather than wrongly downgrading.
 */
export async function syncTierFromRevenueCat(): Promise<Tier | null> {
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const active = ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
    return active ? "unlock" : "free";
  } catch (e: unknown) {
    console.warn("[RevenueCat] Could not sync entitlement:", e);
    return null; // unknown state — do not change tier
  }
}

/** Restore previous purchases and return whether "unlock" is now active. */
export async function restoreAndCheck(): Promise<Tier | null> {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const active = ENTITLEMENT_ID in (customerInfo.entitlements?.active ?? {});
    return active ? "unlock" : "free";
  } catch (e: unknown) {
    console.warn("[RevenueCat] Restore error:", e);
    return null;
  }
}
