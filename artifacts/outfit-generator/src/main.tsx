import { createRoot } from 'react-dom/client';
import { getAllClothingItems } from './lib/db';
import { warmImageUrls } from './lib/imageStorage';
import { initializeRevenueCat } from './lib/revenuecat';
import App from './App';
import './index.css';

async function main() {
  // Pre-warm image URL cache before first render.
  // Native iOS: resolves Filesystem paths to capacitor:// display URLs.
  // Web (dev): no-op — object URLs are populated at upload time.
  const filenames = getAllClothingItems()
    .map((i) => i.imageObjectPath)
    .filter(Boolean) as string[];
  await warmImageUrls(filenames);

  // Initialize RevenueCat in the background (non-blocking on failure).
  initializeRevenueCat().catch(console.warn);

  createRoot(document.getElementById('root')!).render(<App />);
}

main();
