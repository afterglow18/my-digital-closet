import { useState } from 'react';
import { Switch, Route } from 'wouter';
import { ModuleLayout } from './components/layout/ModuleLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import AccountPage from './pages/account';
import WelcomePage from './pages/welcome';

const WELCOME_KEY = 'mdc_vanity_welcomed';

export function VanityModule() {
  const [welcomed, setWelcomed] = useState(() => !!localStorage.getItem(WELCOME_KEY));

  if (!welcomed) {
    return (
      <WelcomePage
        onEnter={() => {
          localStorage.setItem(WELCOME_KEY, '1');
          setWelcomed(true);
        }}
      />
    );
  }

  return (
    <ModuleLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/account" component={AccountPage} />
      </Switch>
    </ModuleLayout>
  );
}
