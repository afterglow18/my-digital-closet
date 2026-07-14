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
 * Check whether the user has an active "unlock" entitlement.
 * Returns false on web (dev always runs in free mode).
 */
export async function checkSubscription(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active["unlock"];
  } catch {
    return false;
  }
}

export type PurchaseResult = "success" | "cancelled" | "unavailable";

/** Purchase a subscription package via RevenueCat / Apple StoreKit. */
export async function purchaseProduct(
  product: "monthly" | "annual",
): Promise<PurchaseResult> {
  if (!Capacitor.isNativePlatform()) {
    console.warn("[RevenueCat] In-app purchases unavailable on web.");
    return "unavailable";
  }
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const offerings = await Purchases.getOfferings();
    if (!offerings.current) return "unavailable";
    const pkg =
      product === "annual" ? offerings.current.annual : offerings.current.monthly;
    if (!pkg) return "unavailable";
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return customerInfo.entitlements.active["unlock"] ? "success" : "cancelled";
  } catch (err: unknown) {
    const code = String((err as { code?: string })?.code ?? "");
    if (code.includes("PURCHASE_CANCELLED") || code === "1") return "cancelled";
    console.error("[RevenueCat] Purchase error:", err);
    return "unavailable";
  }
}

/** Restore previous purchases. Returns true if the unlock entitlement is active. */
export async function restorePurchases(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active["unlock"];
  } catch {
    return false;
  }
}
