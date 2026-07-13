import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import { queryClient } from './lib/queryClient';
import { apiUrl } from './lib/apiUrl';

import App from './App';

import './index.css';

// When running inside Capacitor (iOS/Android), there is no browser proxy to
// route /api/* calls.  VITE_API_BASE_URL must be set at build time to the
// deployed API server URL (e.g. https://api.mydigitalcloset.com).
// In the normal Replit web build this variable is absent and relative /api/*
// URLs are used as-is.
if (import.meta.env.VITE_API_BASE_URL) {
  setBaseUrl(import.meta.env.VITE_API_BASE_URL as string);
}

async function main() {
  // ── Screenshot / preview mode ─────────────────────────────────────────────
  // When ?preview=1 is in the URL (used for App Store screenshot capture),
  // pre-populate the React Query cache with live API data BEFORE the first
  // render.  This ensures every page shows its real populated state the moment
  // React renders, without waiting for individual async fetches.
  if (new URLSearchParams(window.location.search).get('preview') === '1') {
    try {
      const CATEGORIES = ['tops', 'bottoms', 'shoes', 'accessories', 'outerwear', 'dresses'] as const;

      const [outfits, stats, allItems, ...categoryItems] = await Promise.all([
        fetch(apiUrl('/api/outfits')).then(r => r.json()),
        fetch(apiUrl('/api/clothing/stats')).then(r => r.json()),
        fetch(apiUrl('/api/clothing')).then(r => r.json()),
        ...CATEGORIES.map(cat => fetch(apiUrl(`/api/clothing?category=${cat}`)).then(r => r.json())),
      ]);

      // Seed each per-category query
      CATEGORIES.forEach((cat, i) => {
        queryClient.setQueryData(['/api/clothing', { category: cat }], categoryItems[i]);
      });

      // Seed the "all items" and other queries
      queryClient.setQueryData(['/api/clothing'], allItems);
      queryClient.setQueryData(['/api/outfits'], outfits);
      queryClient.setQueryData(['/api/clothing/stats'], stats);
    } catch (e) {
      // Non-fatal — app will fall back to live fetches
      console.warn('[preview] Cache preload failed:', e);
    }
  }

  createRoot(document.getElementById('root')!).render(<App />);
}

main();
