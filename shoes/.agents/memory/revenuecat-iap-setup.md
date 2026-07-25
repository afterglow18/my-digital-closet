---
name: RevenueCat IAP setup lessons
description: Common RC + App Store Connect mistakes that silently break the purchase sheet
---

## Rules

1. **RC product identifiers must exactly match ASC product IDs.** RC creates internal products — the identifier you enter must be the App Store Connect Product ID (e.g. `unlock.monthly`), not a display name. Mismatch = StoreKit returns nothing.

2. **Offering packages can be attached to the wrong app's products.** If you have multiple apps in RC (e.g. "Test Store" + "My Digital Shoes (App Store)"), the packages in the Default offering may be linked to the wrong app's products. Fix: Edit the offering, detach the Test Store products, attach the App Store ones.

3. **Entitlement ID in code must match the RC dashboard identifier exactly.** `ENTITLEMENT_ID` in `revenuecat.ts` must equal the RC entitlement identifier string — not the display name. Was `"unlock"`, should be `"My Digital Shoes Pro"`.

4. **`offerings.current` is null when packages have no loadable products.** Not a code bug — means StoreKit can't find the product IDs RC is requesting.

5. **RC offerings are server-fetched — no rebuild needed for RC dashboard changes.** But the SDK caches in memory; force-quit the app to clear it.

6. **Codemagic builds from GitHub, not Replit.** Always `git push origin main` before triggering a build, or the build uses stale code.

**Why:** All of these caused silent failures — the buy button did nothing or showed a generic error with no indication of root cause.
