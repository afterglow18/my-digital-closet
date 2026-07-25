import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { LayoutProvider } from '@/context/LayoutContext';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import BackupPage from './pages/backup';
import WelcomePage from './pages/welcome';
import { LockedScreen } from './components/LockedScreen';
import { queryClient } from '@/lib/queryClient';
import { useState, useEffect } from 'react';
import { initRevenueCat } from '@/lib/revenuecat';
import { syncWithRevenueCat } from '@/hooks/useEntitlements';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { BiometricLockContext } from '@/contexts/BiometricLockContext';
import { AnimatePresence } from 'framer-motion';

// Kick off RevenueCat configuration as early as possible.
// initRevenueCat() returns a Promise — fire it now so configure() has
// maximum time to finish before the first purchase attempt.
initRevenueCat().catch((e) => console.error('[RevenueCat] Init failed:', e));

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <h1 className="text-6xl font-display font-bold text-primary drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">404</h1>
      <p className="text-xl font-bold uppercase">As if! This page is totally lost.</p>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/backup" component={BackupPage} />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

function AppShell() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [entered, setEntered] = useState<boolean>(() => isPreview);
  const { enabled, isLocked, authenticate, enableLock, disableLock } = useBiometricLock();

  // Sync entitlements from RevenueCat on launch and every time the app
  // returns to the foreground. This ensures refunded or expired purchases
  // are reflected automatically without relying on the local cache.
  useEffect(() => {
    // Await SDK configuration before the first sync so we don't query
    // CustomerInfo before Purchases.configure() has resolved.
    initRevenueCat().then(() => syncWithRevenueCat());

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncWithRevenueCat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <BiometricLockContext.Provider value={{ enabled, enableLock, disableLock }}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
        {!entered && <WelcomePage onEnter={() => setEntered(true)} />}
      </WouterRouter>

      {/* Biometric lock gate — sits above everything including the welcome splash */}
      <AnimatePresence>
        {isLocked && (
          <LockedScreen key="locked" onAuthenticate={authenticate} />
        )}
      </AnimatePresence>
    </BiometricLockContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LayoutProvider>
        <AppShell />
      </LayoutProvider>
    </QueryClientProvider>
  );
}

export default App;
