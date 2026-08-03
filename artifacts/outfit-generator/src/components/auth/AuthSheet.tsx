/**
 * AuthSheet — bottom sheet for sign-in / sign-up.
 *
 * Layout (native iOS):
 *   1. "Continue with Apple" — primary CTA, top of the form (one tap)
 *   2. — or —
 *   3. Tab: Sign In | Sign Up
 *   4. Email + password (+ handle + display name for sign-up)
 *
 * On web (non-native): Apple button is hidden; email form is the only path.
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Eye, EyeOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AuthSheetProps {
  onClose: () => void;
  /** Pre-select the sign-up tab (e.g. when user taps "Join" from the feed) */
  defaultTab?: "signin" | "signup";
  /**
   * Called immediately after a successful sign-in or Apple sign-in.
   * NOT called after sign-up (user must verify email first).
   * Use this to trigger auto-publish or navigation post-auth.
   */
  onSuccess?: () => void;
}

type Tab = "signin" | "signup";
type ViewState = "form" | "check-email";

// ── Apple logo SVG (native-only) ──────────────────────────────────────────────
function AppleLogo() {
  return (
    <svg viewBox="0 0 814 1000" className="w-5 h-5 fill-current" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663.6 0 541.2c0-207.1 135.4-316.6 269-316.6 70.7 0 129.5 46.4 173.1 46.4 41.8 0 108.4-50 190.5-50 22.6 0 108.2 2.3 170.5 81.1zm-5.1-118.8c-33.7 39.5-89.4 70.7-138.9 70.7-4.9 0-9.8-.4-14.7-.9 1.6-46.6 24.8-93.2 57.8-123.1 35.5-32.2 97.6-56.4 148.4-58.2 1.3 5.5 2 11.1 2 16.7 0 43.4-17.6 88.6-54.6 124.8z" />
    </svg>
  );
}

export function AuthSheet({ onClose, defaultTab = "signup", onSuccess }: AuthSheetProps) {
  const { signIn, signUp, signInWithApple } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  const [tab, setTab]             = useState<Tab>(defaultTab);
  const [viewState, setViewState] = useState<ViewState>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Sign in fields
  const [siEmail,    setSiEmail]    = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign up fields
  const [suEmail,       setSuEmail]       = useState("");
  const [suPassword,    setSuPassword]    = useState("");
  const [suHandle,      setSuHandle]      = useState("");
  const [suDisplayName, setSuDisplayName] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const { error } = await signIn(siEmail.trim(), siPassword);
    setIsLoading(false);
    if (error) { setError(error); return; }
    onSuccess?.();
    onClose();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[a-z0-9_-]{3,30}$/.test(suHandle.trim().toLowerCase())) {
      setError("Handle must be 3–30 characters: letters, numbers, _ or - only");
      return;
    }
    setIsLoading(true);
    const { error } = await signUp(suEmail.trim(), suPassword, suHandle.trim(), suDisplayName.trim());
    setIsLoading(false);
    if (error) { setError(error); return; }
    setViewState("check-email");
  };

  const handleApple = async () => {
    setError(null);
    setAppleLoading(true);
    const { error } = await signInWithApple();
    setAppleLoading(false);
    if (error) { setError(error); return; }
    onSuccess?.();
    onClose();
  };

  const titleText = tab === "signin" ? "Welcome back" : "Join Discover";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className="fixed inset-0 z-[80] flex flex-col justify-end max-w-md mx-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl border-t-2 border-x-2 border-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-black/15 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black">
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">{titleText}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="px-5 pt-4 pb-6 flex flex-col gap-4 overflow-y-auto"
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {/* Check-email confirmation */}
          {viewState === "check-email" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-black bg-primary flex items-center justify-center
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-2xl">
                ✉️
              </div>
              <h3 className="font-display font-bold text-lg uppercase">Check your inbox</h3>
              <p className="text-sm text-black/60 leading-snug">
                We sent a confirmation link to <strong>{suEmail}</strong>.
                Tap it to activate your account, then sign in below.
              </p>
              <button
                onClick={() => { setViewState("form"); setTab("signin"); }}
                className="mt-2 text-sm font-bold underline text-black/50 hover:text-black transition-colors"
              >
                Go to Sign In →
              </button>
            </div>
          ) : (
            <>
              {/* ── Apple Sign-In (FIRST, most prominent, native only) ── */}
              {isNative && (
                <>
                  <button
                    onClick={handleApple}
                    disabled={appleLoading}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-black
                               bg-black text-white font-bold text-base
                               shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                               active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                               disabled:opacity-50 transition-all"
                  >
                    {appleLoading
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <AppleLogo />}
                    Continue with Apple
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-black/12" />
                    <span className="text-xs text-black/30 font-bold uppercase tracking-wide">or</span>
                    <div className="flex-1 h-px bg-black/12" />
                  </div>
                </>
              )}

              {/* ── Tab switcher ── */}
              <div className="grid grid-cols-2 gap-1 bg-black/5 rounded-xl p-1">
                {(["signup", "signin"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setError(null); }}
                    className={cn(
                      "py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                      tab === t
                        ? "bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "text-black/40 hover:text-black",
                    )}
                  >
                    {t === "signup" ? "Sign Up" : "Sign In"}
                  </button>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* ── Sign In form ── */}
              {tab === "signin" && (
                <form onSubmit={handleSignIn} className="flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="w-full border-2 border-black rounded-lg px-3 py-2.5 pr-10 text-sm font-medium
                                 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" disabled={isLoading}
                    className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Sign In
                  </button>
                </form>
              )}

              {/* ── Sign Up form ── */}
              {tab === "signup" && (
                <form onSubmit={handleSignUp} className="flex flex-col gap-3">
                  <input
                    type="email"
                    placeholder="Email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password (6+ characters)"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full border-2 border-black rounded-lg px-3 py-2.5 pr-10 text-sm font-medium
                                 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-black/30 select-none">@</span>
                    <input
                      type="text"
                      placeholder="handle"
                      value={suHandle}
                      onChange={(e) => setSuHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      required
                      minLength={3}
                      maxLength={30}
                      autoComplete="username"
                      className="w-full border-2 border-black rounded-lg pl-7 pr-3 py-2.5 text-sm font-medium
                                 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Display name (optional)"
                    value={suDisplayName}
                    onChange={(e) => setSuDisplayName(e.target.value)}
                    maxLength={50}
                    className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium
                               focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                  />
                  <button type="submit" disabled={isLoading}
                    className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Account
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
