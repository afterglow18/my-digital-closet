/**
 * RevenueCat seed script — My Digital Vanity
 *
 * Creates:
 *   - Project: "My Digital Vanity"
 *   - Apps: Test Store (auto-exists), App Store (iOS), optional Android
 *   - Products: monthly ($1.99), yearly ($19.99), lifetime ($9.99 one-time)
 *   - Entitlement: "unlock"
 *   - Offering: "default" with 3 packages ($rc_monthly, $rc_annual, $rc_lifetime)
 *
 * Run with:  pnpm --filter @workspace/scripts exec tsx src/seedRevenueCat.ts
 */

import { getUncachableRevenueCatClient } from "./revenueCatClient";
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
} from "@replit/revenuecat-sdk";

// ── Config ──────────────────────────────────────────────────────────────────
const PROJECT_NAME     = "My Digital Vanity";
const IOS_BUNDLE_ID    = "com.mydigitalvanity.app";
const IOS_APP_NAME     = "My Digital Vanity";

const ENTITLEMENT_ID           = "unlock";
const ENTITLEMENT_DISPLAY_NAME = "Unlock Forever";

const OFFERING_ID           = "default";
const OFFERING_DISPLAY_NAME = "Default Offering";

// Products
const PRODUCTS = [
  {
    label:           "Monthly",
    storeIdentifier: "mdv_monthly",
    displayName:     "Monthly Unlock",
    title:           "Monthly Unlock",
    type:            "subscription" as const,
    duration:        "P1M" as const,
    packageId:       "$rc_monthly",
    packageName:     "Monthly",
    priceMicros:     1990000, // $1.99
  },
  {
    label:           "Yearly",
    storeIdentifier: "mdv_yearly",
    displayName:     "Yearly Unlock",
    title:           "Yearly Unlock",
    type:            "subscription" as const,
    duration:        "P1Y" as const,
    packageId:       "$rc_annual",
    packageName:     "Yearly",
    priceMicros:     19990000, // $19.99
  },
  {
    label:           "Lifetime",
    storeIdentifier: "mdv_lifetime",
    displayName:     "Lifetime Unlock",
    title:           "Lifetime Unlock",
    type:            "non_consumable" as const,
    duration:        undefined,
    packageId:       "$rc_lifetime",
    packageName:     "Lifetime",
    priceMicros:     9990000, // $9.99
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects: " + JSON.stringify(listProjectsError));

  const existingProject = existingProjects?.items?.find((p: Project) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("✓ Project exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error || !newProject) throw new Error("Failed to create project: " + JSON.stringify(error));
    console.log("✓ Created project:", newProject.id);
    project = newProject;
  }

  // ── Apps ──────────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps?.items?.length) throw new Error("Failed to list apps");

  const testStoreApp: App | undefined = apps.items.find((a: App) => a.type === "test_store");
  let appStoreApp: App | undefined     = apps.items.find((a: App) => a.type === "app_store");

  if (!testStoreApp) throw new Error("No test store app found in project");
  console.log("✓ Test Store app:", testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: IOS_APP_NAME, type: "app_store", app_store: { bundle_id: IOS_BUNDLE_ID } },
    });
    if (error || !newApp) throw new Error("Failed to create App Store app: " + JSON.stringify(error));
    appStoreApp = newApp;
    console.log("✓ Created App Store app:", appStoreApp.id);
  } else {
    console.log("✓ App Store app exists:", appStoreApp.id);
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const testStoreProductMap: Record<string, Product> = {};
  const appStoreProductMap:  Record<string, Product> = {};

  for (const p of PRODUCTS) {
    // Test Store product
    const existingTestProduct = existingProducts?.items?.find(
      (ep: Product) => ep.store_identifier === p.storeIdentifier && ep.app_id === testStoreApp!.id,
    );
    let testProduct: Product;
    if (existingTestProduct) {
      console.log(`✓ Test Store product "${p.label}" exists:`, existingTestProduct.id);
      testProduct = existingTestProduct;
    } else {
      const body: any = {
        store_identifier: p.storeIdentifier,
        app_id:           testStoreApp!.id,
        type:             p.type,
        display_name:     p.displayName,
        title:            p.title,
      };
      if (p.type === "subscription") {
        body.subscription = { duration: p.duration };
      }
      const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
      if (error || !created) throw new Error(`Failed to create test store product "${p.label}": ` + JSON.stringify(error));
      console.log(`✓ Created Test Store product "${p.label}":`, created.id);
      testProduct = created;
    }
    testStoreProductMap[p.storeIdentifier] = testProduct;

    // Add test store price
    const { error: priceError } = await client.post({
      url:  "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProduct.id },
      body: { prices: [{ amount_micros: p.priceMicros, currency: "USD" }] },
    }) as { data: TestStorePricesResponse | null; error: any };
    if (priceError) {
      if (priceError?.type === "resource_already_exists") {
        console.log(`  ↳ Price already set for "${p.label}"`);
      } else {
        console.warn(`  ⚠ Could not set price for "${p.label}":`, JSON.stringify(priceError));
      }
    } else {
      console.log(`  ↳ Price set $${p.priceMicros / 1_000_000} for "${p.label}"`);
    }

    // App Store product
    const existingAppProduct = existingProducts?.items?.find(
      (ep: Product) => ep.store_identifier === p.storeIdentifier && ep.app_id === appStoreApp!.id,
    ) ?? existingProducts?.items?.find(
      (ep: Product) => ep.display_name === p.displayName && ep.app_id === appStoreApp!.id,
    );
    let appProduct: Product;
    if (existingAppProduct) {
      console.log(`✓ App Store product "${p.label}" exists:`, existingAppProduct.id);
      appProduct = existingAppProduct;
    } else {
      const { data: created, error } = await createProduct({
        client,
        path: { project_id: project.id },
        body: {
          store_identifier: p.storeIdentifier,
          app_id:           appStoreApp!.id,
          type:             p.type,
          display_name:     p.displayName,
        },
      });
      if (error) {
        if ((error as any)?.type === "resource_already_exists") {
          // Already exists under a different identifier — find it by display name fallback
          const fallback = existingProducts?.items?.find(
            (ep: Product) => ep.app_id === appStoreApp!.id && (ep as any).display_name === p.displayName,
          );
          if (fallback) {
            console.log(`✓ App Store product "${p.label}" already existed (display_name match):`, fallback.id);
            appProduct = fallback;
          } else {
            console.warn(`⚠ App Store product "${p.label}" already exists but could not find it — skipping`);
            appStoreProductMap[p.storeIdentifier] = null as any;
            continue;
          }
        } else {
          throw new Error(`Failed to create App Store product "${p.label}": ` + JSON.stringify(error));
        }
      } else if (!created) {
        throw new Error(`Failed to create App Store product "${p.label}": no data returned`);
      } else {
        console.log(`✓ Created App Store product "${p.label}":`, created.id);
        appProduct = created;
      }
    }
    appStoreProductMap[p.storeIdentifier] = appProduct;
  }

  // ── Entitlement ───────────────────────────────────────────────────────────
  let entitlement: Entitlement;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error("Failed to list entitlements");

  const existingEntitlement = existingEntitlements?.items?.find(
    (e: Entitlement) => e.lookup_key === ENTITLEMENT_ID,
  );
  if (existingEntitlement) {
    console.log("✓ Entitlement exists:", existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newE, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_ID, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error || !newE) throw new Error("Failed to create entitlement: " + JSON.stringify(error));
    console.log("✓ Created entitlement:", newE.id);
    entitlement = newE;
  }

  // Attach all products to entitlement
  const allProductIds = [
    ...Object.values(testStoreProductMap).map((p: Product) => p.id),
    ...Object.values(appStoreProductMap).map((p: Product) => p.id),
  ];
  const { error: attachEntError } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntError) {
    if ((attachEntError as any)?.type === "unprocessable_entity_error") {
      console.log("  ↳ Products already attached to entitlement");
    } else {
      throw new Error("Failed to attach products to entitlement: " + JSON.stringify(attachEntError));
    }
  } else {
    console.log("✓ Attached products to entitlement");
  }

  // ── Offering ──────────────────────────────────────────────────────────────
  let offering: Offering;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings?.items?.find(
    (o: Offering) => o.lookup_key === OFFERING_ID,
  );
  if (existingOffering) {
    console.log("✓ Offering exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newO, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_ID, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error || !newO) throw new Error("Failed to create offering: " + JSON.stringify(error));
    console.log("✓ Created offering:", newO.id);
    offering = newO;
  }

  if (!(offering as any).is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("✓ Set offering as current");
  }

  // ── Packages ──────────────────────────────────────────────────────────────
  const { data: existingPackages, error: listPkgError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPkgError) throw new Error("Failed to list packages");

  for (const p of PRODUCTS) {
    const existingPkg = existingPackages?.items?.find(
      (pk: Package) => pk.lookup_key === p.packageId,
    );
    let pkg: Package;
    if (existingPkg) {
      console.log(`✓ Package "${p.packageId}" exists:`, existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: p.packageId, display_name: p.packageName },
      });
      if (error || !newPkg) throw new Error(`Failed to create package "${p.packageId}": ` + JSON.stringify(error));
      console.log(`✓ Created package "${p.packageId}":`, newPkg.id);
      pkg = newPkg;
    }

    const { error: attachPkgError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testStoreProductMap[p.storeIdentifier]!.id, eligibility_criteria: "all" },
          { product_id: appStoreProductMap[p.storeIdentifier]!.id,  eligibility_criteria: "all" },
        ],
      },
    });
    if (attachPkgError) {
      if ((attachPkgError as any)?.type === "unprocessable_entity_error") {
        console.log(`  ↳ Products already attached to package "${p.packageId}"`);
      } else {
        throw new Error(`Failed to attach products to package "${p.packageId}": ` + JSON.stringify(attachPkgError));
      }
    } else {
      console.log(`  ↳ Attached products to package "${p.packageId}"`);
    }
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  const { data: testKeys, error: testKeyErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: testStoreApp!.id },
  });
  if (testKeyErr) throw new Error("Failed to get test store API key");

  const { data: iosKeys, error: iosKeyErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp!.id },
  });
  if (iosKeyErr) throw new Error("Failed to get App Store API key");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("Project ID:           ", project.id);
  console.log("Test Store App ID:    ", testStoreApp!.id);
  console.log("App Store App ID:     ", appStoreApp!.id);
  console.log("Entitlement ID:       ", ENTITLEMENT_ID);
  console.log("Test API Key:         ", testKeys?.items?.map((k: any) => k.key).join(", ") ?? "N/A");
  console.log("iOS API Key:          ", iosKeys?.items?.map((k: any) => k.key).join(", ") ?? "N/A");
  console.log("\nPaste these into your env vars:");
  console.log(`REVENUECAT_PROJECT_ID=${project.id}`);
  console.log(`REVENUECAT_TEST_STORE_APP_ID=${testStoreApp!.id}`);
  console.log(`REVENUECAT_APPLE_APP_STORE_APP_ID=${appStoreApp!.id}`);
  console.log(`VITE_REVENUECAT_TEST_API_KEY=${testKeys?.items?.[0]?.key ?? "N/A"}`);
  console.log(`VITE_REVENUECAT_IOS_API_KEY=${iosKeys?.items?.[0]?.key ?? "N/A"}`);
  console.log("====================\n");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
