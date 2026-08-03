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
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) return { error: error.message };
        if (!data.user) return { error: "Sign up failed — no user returned" };

        // Create profile row immediately
        const { error: profileError } = await sb.from("profiles").insert({
          id: data.user.id,
          handle: handle.toLowerCase().trim(),
          display_name: displayName?.trim() || null,
        });
        if (profileError) {
          // Profile creation failed — still signed up but profile missing
          return { error: `Account created but profile setup failed: ${profileError.message}` };
        }
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

      const { error } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
      });
      if (error) return { error: error.message };

      // Ensure profile row exists (Apple sign-in may create a new user)
      const sb = getSupabase();
      const { data: { user: currentUser } } = await sb.auth.getUser();
      if (currentUser) {
        const { data: existing } = await sb.from("profiles").select("id").eq("id", currentUser.id).single();
        if (!existing) {
          // Create a default profile from Apple-provided name / email
          const givenName = result.response.givenName;
          const familyName = result.response.familyName;
          const displayName = [givenName, familyName].filter(Boolean).join(" ") || null;
          const emailHandle = (currentUser.email ?? "").split("@")[0].replace(/[^a-z0-9_-]/gi, "").toLowerCase().slice(0, 30) || `user${Date.now()}`;
          await sb.from("profiles").insert({
            id: currentUser.id,
            handle: emailHandle,
            display_name: displayName,
          });
        }
      }

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
