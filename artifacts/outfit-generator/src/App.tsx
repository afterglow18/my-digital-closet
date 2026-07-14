import { useState } from 'react';
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
import { queryClient } from '@/lib/queryClient';

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
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AnimatePresence>
          {showSplash && (
            <SplashScreen onEnter={() => setShowSplash(false)} />
          )}
        </AnimatePresence>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}
