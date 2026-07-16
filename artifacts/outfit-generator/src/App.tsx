import { useState, useEffect, useCallback } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import AccountPage from './pages/account';
import SplashScreen from './components/SplashScreen';
import { BiometricLockScreen } from './components/BiometricLockScreen';
import { queryClient } from '@/lib/queryClient';
import { NativeBiometric } from 'capacitor-native-biometric';

const LOCK_KEY = 'mdc_biometric_lock';

function getLockLabel(): string {
  // Will be refined once checkBiometry resolves; default reasonable label
  return localStorage.getItem('mdc_biometric_type') ?? 'Face ID / Touch ID';
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/account" component={AccountPage} />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem('mdc_entered')
  );
  const [locked, setLocked] = useState(false);
  const [lockLabel, setLockLabel] = useState(getLockLabel());

  // Resolve the biometry label once (for the lock screen copy)
  useEffect(() => {
    NativeBiometric.isAvailable({ useFallback: false })
      .then(({ biometryType }) => {
        const labels: Record<number, string> = {
          1: 'Touch ID',
          2: 'Face ID',
          3: 'Fingerprint',
          4: 'Face Recognition',
          5: 'Iris Recognition',
        };
        const label = labels[biometryType] ?? 'Biometrics';
        localStorage.setItem('mdc_biometric_type', label);
        setLockLabel(label);
      })
      .catch(() => {});
  }, []);

  // Lock the app and prompt biometric auth
  const triggerLock = useCallback(async () => {
    if (localStorage.getItem(LOCK_KEY) !== '1') return;
    setLocked(true);
    // Attempt auth immediately — if it succeeds, unlock transparently
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock My Digital Closet',
        title: 'My Digital Closet',
        useFallback: false,
      });
      setLocked(false);
    } catch {
      // Auth failed or cancelled — lock screen stays, user can retry
    }
  }, []);

  // Lock on first launch (after splash)
  useEffect(() => {
    if (!showSplash) {
      triggerLock();
    }
  }, [showSplash, triggerLock]);

  // Re-lock when the app returns from the background
  useEffect(() => {
    const onResume = () => triggerLock();
    document.addEventListener('resume', onResume);
    // Also catch visibility change for web / PWA context
    const onVisible = () => {
      if (!document.hidden) triggerLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('resume', onResume);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [triggerLock]);

  const handleAuthenticate = async (): Promise<boolean> => {
    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock My Digital Closet',
        title: 'My Digital Closet',
        useFallback: false,
      });
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AnimatePresence>
          {showSplash && (
            <SplashScreen onEnter={() => {
              sessionStorage.setItem('mdc_entered', '1');
              setShowSplash(false);
            }} />
          )}
        </AnimatePresence>
        <Router />
        {/* Biometric lock overlay — rendered above everything */}
        {locked && (
          <BiometricLockScreen
            lockLabel={lockLabel}
            onAuthenticate={handleAuthenticate}
          />
        )}
      </WouterRouter>
    </QueryClientProvider>
  );
}
