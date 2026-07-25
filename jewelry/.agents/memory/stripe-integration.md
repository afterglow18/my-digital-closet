---
name: Stripe integration
description: How Stripe payments are wired into the outfit-generator app — credential field names, checkout flow, security decisions.
---

## Replit connector credential field names

The Replit connectors API (`/api/v2/connection?connector_names=stripe`) returns:
```
settings.secret       ← Stripe secret key (NOT settings.secret_key)
settings.publishable  ← Stripe publishable key
```
The template in the Stripe skill uses `settings.secret_key` which is WRONG for this connector. Use `settings.secret`.

**Why:** Discovered by inspecting the raw connector API response. The field naming differs from the skill template.

## Checkout flow (no user accounts)

1. Frontend: `POST /api/stripe/checkout` with `{ product, returnPath }` (relative path only)
2. Server builds `successUrl`/`cancelUrl` from `req.headers.origin` + `returnPath` (prevents open redirect)
3. Server looks up unlock product by `metadata['product_key']:'unlock'` (no hardcoded price_id)
4. Page navigates to Stripe-hosted checkout
5. Stripe redirects to `<origin><returnPath>?unlock=success&session_id=<id>`
6. `App.tsx` useEffect detects params, cleans URL, calls `GET /api/stripe/verify?session_id=<id>`
7. Server retrieves session from Stripe API, checks `payment_status === 'paid'`
8. Frontend calls `setGlobalTier('unlock')` — stored in localStorage

**Why:** No user auth system — entitlements are client-side with server-verified payment proof.

## stripe-replit-sync `stripe.accounts` warning

On startup, `findOrCreateManagedWebhook` logs:
```
error: relation "stripe.accounts" does not exist
```
This is a known issue with `stripe-replit-sync@1.0.0` — `runMigrations` doesn't create all tables the webhook setup needs. **This is non-fatal** — the checkout and verify endpoints work because they call the Stripe API directly, not the sync database. The warning can be ignored in development.

**How to apply:** Keep `initStripe()` errors caught and non-fatal in `index.ts`.

## Stripe product seeding

Product is created by running:
```
pnpm --filter @workspace/scripts run seed-products
```
This creates the "Unlock Forever" product with `metadata.product_key = 'unlock'` and a $4.99 one-time price. Idempotent — safe to run multiple times.
