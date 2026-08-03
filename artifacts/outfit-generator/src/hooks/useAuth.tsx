/**
 * useAuth — Supabase auth state hook.
 *
 * Wraps auth state in a React context so components anywhere in the tree
 * can read the current user without prop-drilling.
 *
 * Progressive auth: the Supabase client is only created when the user
 * first attempts to sign in. Until then, user === null and isLoading === false,
 * and no network calls are made.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** Email + password sign-in */
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Email + password sign-up. Also creates the profile row in Supabase. */
  signUp: (
    email: string,
    password: string,
    handle: string,
    displayName?: string,
  ) => Promise<{ error: string | null }>;
  /** Native Apple Sign-In (Capacitor only). No-op on web. */
  signInWithApple: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: false,
  signIn: async () => ({ error: "AuthProvider not mounted" }),
  signUp: async () => ({ error: "AuthProvider not mounted" }),
  signInWithApple: async () => ({ error: "AuthProvider not mounted" }),
  signOut: async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount (no network call if not previously signed in)
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    const sb = getSupabase();

    // Restore existing session from localStorage
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: listener } = sb.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      try {
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Sign in failed" };
      }
    },
    [],
  );

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      handle: string,
      displayName?: string,
    ): Promise<{ error: string | null }> => {
      try {
        const sb = getSupabase();

        // Pass handle + display_name as user metadata so the server-side
        // `on_auth_user_created` trigger (SECURITY DEFINER) can create the
        // profile row immediately — before the user has confirmed their email.
        // A direct client-side INSERT would fail with an RLS violation when
        // email confirmation is enabled, because the session is null at that
        // point and auth.uid() returns null.
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            data: {
              handle: handle.toLowerCase().trim(),
              display_name: displayName?.trim() || null,
            },
          },
        });

        if (error) return { error: error.message };
        if (!data.user) return { error: "Sign up failed — no user returned" };

        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Sign up failed" };
      }
    },
    [],
  );

  // ── Apple Sign-In ──────────────────────────────────────────────────────────
  const signInWithApple = useCallback(async (): Promise<{ error: string | null }> => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) {
        return { error: "Apple Sign-In is only available on iOS" };
      }

      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: "com.mydigitalcloset.communitydev",
        redirectURI: "mydigitalcloset://auth/callback",
        scopes: "email name",
        state: Math.random().toString(36).substring(2),
        nonce: Math.random().toString(36).substring(2),
      });

      const identityToken = result.response.identityToken;
      if (!identityToken) return { error: "Apple Sign-In did not return an identity token" };

      // Pass name as metadata so the on_auth_user_created trigger can build
      // the profile row if this is a brand-new Apple user. For returning users
      // the trigger's ON CONFLICT DO NOTHING makes this a no-op.
      const givenName  = result.response.givenName;
      const familyName = result.response.familyName;
      const displayName = [givenName, familyName].filter(Boolean).join(" ") || null;

      const { error } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        options: {
          data: {
            display_name: displayName,
            // handle will be derived from email by the trigger
          },
        },
      });
      if (error) return { error: error.message };

      return { error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User cancelled
      if (msg.includes("cancel") || msg.includes("dismiss")) return { error: null };
      return { error: msg };
    }
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    await getSupabase().auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signInWithApple, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
