import { useState, lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import AccountPage from './pages/account';
import SplashScreen from './components/SplashScreen';
import HubPage from './hub/HubPage';
import { queryClient } from '@/lib/queryClient';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Lazy-load each module so only the active module's code is parsed on entry
const HandbagsModule = lazy(() =>
  import('./modules/handbags/HandbagsModule').then((m) => ({ default: m.HandbagsModule }))
);
const ShoesModule = lazy(() =>
  import('./modules/shoes/ShoesModule').then((m) => ({ default: m.ShoesModule }))
);
const JewelryModule = lazy(() =>
  import('./modules/jewelry/JewelryModule').then((m) => ({ default: m.JewelryModule }))
);
const VanityModule = lazy(() =>
  import('./modules/vanity/VanityModule').then((m) => ({ default: m.VanityModule }))
);
const SuitcaseModule = lazy(() =>
  import('./modules/suitcase/SuitcaseModule').then((m) => ({ default: m.SuitcaseModule }))
);

/** Shared suspense shell shown while a lazy module chunk is loading */
function ModuleShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-[#FFFDF7]">
          <p className="text-sm font-bold animate-pulse">Loading…</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

/** Closet module — uses the existing src/pages/ and AppLayout */
function ClosetRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/account" component={AccountPage} />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem('mdc_entered')
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={BASE}>
        <AnimatePresence>
          {showSplash && (
            <SplashScreen
              onEnter={() => {
                sessionStorage.setItem('mdc_entered', '1');
                setShowSplash(false);
              }}
            />
          )}
        </AnimatePresence>

        <Switch>
          {/* Hub — the app's new home */}
          <Route path="/" component={HubPage} />

          {/* Closet — existing pages, sub-router at /closet */}
          <Route path="/closet/:rest*">
            <WouterRouter base={`${BASE}/closet`}>
              <ClosetRoutes />
            </WouterRouter>
          </Route>

          {/* Other modules — each gets its own sub-router */}
          <Route path="/handbags/:rest*">
            <WouterRouter base={`${BASE}/handbags`}>
              <ModuleShell>
                <HandbagsModule />
              </ModuleShell>
            </WouterRouter>
          </Route>

          <Route path="/shoes/:rest*">
            <WouterRouter base={`${BASE}/shoes`}>
              <ModuleShell>
                <ShoesModule />
              </ModuleShell>
            </WouterRouter>
          </Route>

          <Route path="/jewelry/:rest*">
            <WouterRouter base={`${BASE}/jewelry`}>
              <ModuleShell>
                <JewelryModule />
              </ModuleShell>
            </WouterRouter>
          </Route>

          <Route path="/vanity/:rest*">
            <WouterRouter base={`${BASE}/vanity`}>
              <ModuleShell>
                <VanityModule />
              </ModuleShell>
            </WouterRouter>
          </Route>

          <Route path="/suitcase/:rest*">
            <WouterRouter base={`${BASE}/suitcase`}>
              <ModuleShell>
                <SuitcaseModule />
              </ModuleShell>
            </WouterRouter>
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
