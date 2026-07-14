/**
 * RevenueCat integration — initializes purchases on iOS and wraps
 * the purchase/restore flows. All functions are safe to call on web
 * (they return immediately with sensible defaults).
 */

import { Capacitor } from "@capacitor/core";

const IOS_KEY  = import.meta.env.VITE_REVENUECAT_IOS_API_KEY  as string | undefined;
const TEST_KEY = import.meta.env.VITE_REVENUECAT_TEST_API_KEY as string | undefined;

/** Initialize RevenueCat. Call once on app startup before first render. */
export async function initializeRevenueCat(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const apiKey = IOS_KEY ?? TEST_KEY;
  if (!apiKey) {
    console.warn("[RevenueCat] No API key configured — in-app purchases unavailable.");
    return;
  }
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.configure({ apiKey });
}

/**
 * Check whether the user has an active "unlock" or "premium" entitlement.
 * Returns false on web (dev always runs in free mode).
 */
export async function checkSubscription(): Promise<"unlock" | "premium" | false> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.getCustomerInfo();
    if (customerInfo.entitlements.active["premium"]) return "premium";
    if (customerInfo.entitlements.active["unlock"])  return "unlock";
    return false;
  } catch {
    return false;
  }
}

export type PurchaseResult = "success" | "cancelled" | "unavailable";

/** Purchase a subscription package via RevenueCat / Apple StoreKit. */
export async function purchaseProduct(
  product: "monthly" | "annual" | "lifetime",
): Promise<PurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RevenueCat] In-app purchases unavailable on web.");
    return "unavailable";
  }
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) return "unavailable";

    let pkg =
      product === "annual"   ? offerings.current.annual   :
      product === "lifetime" ? offerings.current.lifetime  :
                               offerings.current.monthly;

    // Fallback: search availablePackages by identifier string
    if (!pkg) {
      const id = product === "annual"   ? "$rc_annual"   :
                 product === "lifetime" ? "$rc_lifetime" :
                                         "$rc_monthly";
      pkg = offerings.current.availablePackages.find(
        (p) => p.identifier === id,
      ) ?? null;
    }

    if (!pkg) return "unavailable";
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    if (customerInfo.entitlements.active["premium"]) return "success";
    if (customerInfo.entitlements.active["unlock"])  return "success";
    return "cancelled";
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code ?? "");
    if (code.includes("PURCHASE_CANCELLED") || code === "1") return "cancelled";
    console.error("[RevenueCat] Purchase error:", err);
    return "unavailable";
  }
}

/** Restore previous purchases. Returns the active tier, or false if none. */
export async function restorePurchases(): Promise<"unlock" | "premium" | false> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    if (customerInfo.entitlements.active["premium"]) return "premium";
    if (customerInfo.entitlements.active["unlock"])  return "unlock";
    return false;
  } catch {
    return false;
  }
}
