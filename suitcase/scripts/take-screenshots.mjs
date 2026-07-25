/**
 * Playwright screenshot script for My Digital Closet App Store screenshots.
 * Captures 5 screens at 1320×2868 (Apple 6.9" / iPhone 16 Pro Max).
 *
 * Run: node scripts/take-screenshots.mjs
 */

import pkg from '/home/runner/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js';
const { chromium } = pkg;
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL  = 'http://localhost:21371';
const OUT_DIR   = path.join(__dirname, '..', 'app-store', 'screenshots');

// 6.9" iPhone 16 Pro Max: 1320×2868 physical px = 440×956 logical @3x
const VIEWPORT = { width: 440, height: 956 };
const DPR      = 3;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function snap(page, name, label) {
  await wait(2000); // let animations & fonts settle
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const { width, height } = page.viewportSize();
  console.log(`✓  ${name}.png  (${width * DPR}×${height * DPR} physical px)  — ${label}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DPR,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // ── 1. Welcome ──────────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await wait(500);
  await snap(page, '01-welcome', 'Welcome / Enter Closet screen');

  // ── 2. Wardrobe ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/wardrobe`, { waitUntil: 'networkidle' });
  // Wait for at least one clothing card image or carousel to appear
  await page.waitForTimeout(2500);
  await snap(page, '02-wardrobe', 'Wardrobe with clothing items');

  // ── 3. Generate — show the generate page with an outfit result ────────────
  await page.goto(`${BASE_URL}/generate`, { waitUntil: 'networkidle' });
  await wait(1000);

  // Find and click the Generate / Surprise Me button
  const generateBtn = await page.locator(
    '[data-testid="button-generate"], button:has-text("Surprise Me"), button:has-text("Generate Outfit"), button:has-text("Generate")'
  ).first();

  if (await generateBtn.count() > 0) {
    await generateBtn.click();
    // Wait for the AI to return an outfit (up to 10 s)
    await page.waitForTimeout(6000);
  }
  await snap(page, '03-generate', 'Generate page with AI outfit');

  // ── 4. Saved / Lookbook ─────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/saved`, { waitUntil: 'networkidle' });
  await wait(1500);
  await snap(page, '04-lookbook', 'Saved Lookbook with outfits');

  // ── 5. Favorites / Totally 💛 ───────────────────────────────────────────────
  await page.goto(`${BASE_URL}/favorites`, { waitUntil: 'networkidle' });
  await wait(1500);
  await snap(page, '05-favorites', 'Totally 💛 Favorites');

  await browser.close();
  console.log('\nAll done! Files saved to app-store/screenshots/');
})();
