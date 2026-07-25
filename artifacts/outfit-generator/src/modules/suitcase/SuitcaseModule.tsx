/**
 * SuitcaseModule — self-contained entry point for the "My Digital Suitcase" feature.
 *
 * Renders a mini-router (wouter <Router baseURL="/suitcase">) with its own
 * isolated QueryClient so it never pollutes the outer app's cache.
 *
 * Welcome screen is shown once per device (localStorage flag "suitcase-entered").
 */

import React, { useState, useEffect } from "react";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ModuleLayout } from "./components/layout/ModuleLayout";

import WardrobePage  from "./pages/wardrobe";
import GeneratePage  from "./pages/generate";
import SavedPage     from "./pages/saved";
import FavoritesPage from "./pages/favorites";
import AccountPage   from "./pages/account";
import NotFoundPage  from "./pages/not-found";
import WelcomePage   from "./pages/welcome";

// ── Module-scoped QueryClient (isolated from the parent app) ──────────────────
const suitcaseQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ENTERED_KEY = "suitcase-entered";

// ── Module entry ──────────────────────────────────────────────────────────────
export function SuitcaseModule() {
  const [hasEntered, setHasEntered] = useState<boolean | null>(null);

  useEffect(() => {
    const entered = localStorage.getItem(ENTERED_KEY) === "true";
    setHasEntered(entered);
  }, []);

  const handleEnter = () => {
    localStorage.setItem(ENTERED_KEY, "true");
    setHasEntered(true);
  };

  // Wait for localStorage check before rendering
  if (hasEntered === null) return null;

  if (!hasEntered) {
    return (
      <QueryClientProvider client={suitcaseQueryClient}>
        <WelcomePage onEnter={handleEnter} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={suitcaseQueryClient}>
      <ModuleLayout>
        <Switch>
          <Route path="/"         component={WardrobePage}  />
          <Route path="/generate" component={GeneratePage}  />
          <Route path="/saved"    component={SavedPage}     />
          <Route path="/favorites" component={FavoritesPage} />
          <Route path="/account"  component={AccountPage}   />
          <Route                  component={NotFoundPage}  />
        </Switch>
      </ModuleLayout>
    </QueryClientProvider>
  );
}
