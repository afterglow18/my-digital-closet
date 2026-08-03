import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import CommunityPage from './pages/community';
import ProfileMePage from './pages/profile-me';
import ProfileViewPage from './pages/profile-view';
import SplashScreen from './components/SplashScreen';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/hooks/useAuth';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Handles the deep-link callback for email confirmation and password reset */
function AuthCallback() {
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isSupabaseConfigured()) { navigate('/community'); return; }
    // Supabase SDK automatically exchanges the code from the URL
    getSupabase().auth.getSession().then(() => navigate('/community'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem('mdc_entered')
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
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

          <Toaster position="bottom-center" richColors={false} />
          <AppLayout>
            <Switch>
              <Route path="/" component={WardrobePage} />
              <Route path="/generate" component={GeneratePage} />
              <Route path="/saved" component={SavedPage} />
              <Route path="/favorites" component={FavoritesPage} />
              <Route path="/community" component={CommunityPage} />
              <Route path="/profile/me" component={ProfileMePage} />
              <Route path="/profile/:handle" component={ProfileViewPage} />
              <Route path="/auth/callback" component={AuthCallback} />
            </Switch>
          </AppLayout>
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
