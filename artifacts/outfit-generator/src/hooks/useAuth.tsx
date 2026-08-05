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
    privacyMode?: "private" | "anonymous" | "public",
  ) => Promise<{ error: string | null }>;
  /** Native Apple Sign-In (Capacitor only). No-op on web. */
  signInWithApple: () => Promise<{ error: string | null; isNewUser?: boolean; userId?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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
  resetPassword: async () => ({ error: "AuthProvider not mounted" }),
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

    // Listen for auth state changes.
    // On SIGNED_IN: heal any missing profile row so publishItem never hits a
    // FK violation. This handles users who signed up before the
    // on_auth_user_created trigger was installed (their initial profile insert
    // failed due to the RLS bug fixed by that trigger, so no row was created).
    const { data: listener } = sb.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);

      if (event === "SIGNED_IN" && sess?.user) {
        const uid   = sess.user.id;
        const email = sess.user.email ?? "";
        // Fire-and-forget: check for missing profile and create it if absent.
        (async () => {
          const { data: existing } = await sb
            .from("profiles")
            .select("id")
            .eq("id", uid)
            .maybeSingle();
          if (!existing) {
            const raw   = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase().slice(0, 30);
            const handle = raw || `user${uid.slice(0, 8)}`;
            await sb.from("profiles").insert({ id: uid, handle, display_name: null });
          }
        })();
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  // ── Reset password ─────────────────────────────────────────────────────────
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: string | null }> => {
      try {
        const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
        return { error: error?.message ?? null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Reset failed" };
      }
    },
    [],
  );

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
      privacyMode: "private" | "anonymous" | "public" = "public",
    ): Promise<{ error: string | null }> => {
      try {
        const sb = getSupabase();

        // Pass metadata to the on_auth_user_created SECURITY DEFINER trigger so
        // the profile row is created before email confirmation (when auth.uid()
        // is null and a direct INSERT would fail RLS). privacy_mode is stored
        // directly on the profile so the user's choice takes effect immediately.
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
            data: {
              handle: handle.toLowerCase().trim() || undefined,
              display_name: displayName?.trim() || null,
              privacy_mode: privacyMode,
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
  const signInWithApple = useCallback(async (): Promise<{
    error: string | null;
    isNewUser?: boolean;
    userId?: string;
  }> => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) {
        return { error: "Apple Sign-In is only available on iOS" };
      }

      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: "com.mydigitalcloset.app",
        redirectURI: "mydigitalcloset://auth/callback",
        scopes: "email name",
        state: Math.random().toString(36).substring(2),
        // No nonce — if a nonce is passed to Apple it gets embedded in the
        // id_token, and Supabase will reject the token unless the raw nonce
        // is also forwarded via signInWithIdToken. Omitting it avoids the
        // "nonce mismatch" error without reducing security for native flows.
      });

      const identityToken = result.response.identityToken;
      if (!identityToken) return { error: "Apple Sign-In did not return an identity token" };

      // signInWithIdToken does not accept a `data` option so we cannot inject
      // privacy_mode here. New Apple users see the privacy picker after auth
      // and we call changePrivacyMode() at that point.
      const { error } = await getSupabase().auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
      });
      if (error) return { error: error.message };

      // Detect new vs returning user by how recently the account was created.
      const { data: { session: newSession } } = await getSupabase().auth.getSession();
      const userId     = newSession?.user?.id;
      const createdAt  = new Date(newSession?.user?.created_at ?? 0);
      const isNewUser  = (Date.now() - createdAt.getTime()) < 60_000;

      return { error: null, isNewUser, userId };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
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
    <AuthContext.Provider value={{ user, session, isLoading, signIn, signUp, signInWithApple, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
