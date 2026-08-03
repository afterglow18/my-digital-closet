/**
 * AuthSheet — bottom sheet for sign-in / sign-up.
 *
 * Flow (new account via email):
 *   entry → email-signup → privacy-pick → check-email
 *
 * Flow (new account via Apple, native only):
 *   entry → [Apple auth] → privacy-pick → close
 *
 * Flow (returning user):
 *   entry → email-signin → close
 *   entry → [Apple auth] → close  (isNewUser === false)
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Eye, EyeOff, Mail, ArrowLeft, Check } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { changePrivacyMode } from "@/lib/sync";
import { cn } from "@/lib/utils";

type PrivacyMode = "private" | "anonymous" | "public";
type ViewState = "entry" | "email-signup" | "privacy-pick" | "email-signin" | "check-email";

interface AuthSheetProps {
  onClose: () => void;
  /**
   * "signup" (default) starts at the entry screen.
   * "signin" jumps straight to the sign-in form.
   */
  defaultTab?: "signin" | "signup";
  /**
   * Called after a successful sign-in or after the privacy picker is
   * dismissed for a new Apple user. NOT called after email sign-up
   * (user must confirm email first).
   */
  onSuccess?: () => void;
}

// ── Apple logo ─────────────────────────────────────────────────────────────────
function AppleLogo() {
  return (
    <svg viewBox="0 0 814 1000" className="w-5 h-5 fill-current" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663.6 0 541.2c0-207.1 135.4-316.6 269-316.6 70.7 0 129.5 46.4 173.1 46.4 41.8 0 108.4-50 190.5-50 22.6 0 108.2 2.3 170.5 81.1zm-5.1-118.8c-33.7 39.5-89.4 70.7-138.9 70.7-4.9 0-9.8-.4-14.7-.9 1.6-46.6 24.8-93.2 57.8-123.1 35.5-32.2 97.6-56.4 148.4-58.2 1.3 5.5 2 11.1 2 16.7 0 43.4-17.6 88.6-54.6 124.8z" />
    </svg>
  );
}

// ── Privacy mode options ───────────────────────────────────────────────────────
const PRIVACY_OPTIONS: { mode: PrivacyMode; icon: string; label: string; desc: string }[] = [
  {
    mode: "private",
    icon: "🔒",
    label: "Private",
    desc: "Browse Discover without sharing. Community features are disabled — you can change this anytime.",
  },
  {
    mode: "anonymous",
    icon: "🕶️",
    label: "Anonymous Sharing",
    desc: "Publish to Discover, heart posts, and follow users. Your @handle stays hidden.",
  },
  {
    mode: "public",
    icon: "🌟",
    label: "Public Profile",
    desc: "Your @handle appears on posts. Others can visit your profile and follow you.",
  },
];

// ── Header titles per screen ───────────────────────────────────────────────────
const TITLES: Record<ViewState, string> = {
  "entry":        "Create Account",
  "email-signup": "Create Account",
  "privacy-pick": "How to Participate",
  "email-signin": "Welcome Back",
  "check-email":  "Check Your Inbox",
};

export function AuthSheet({ onClose, defaultTab = "signup", onSuccess }: AuthSheetProps) {
  const { signIn, signUp, signInWithApple } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  const initialView: ViewState = defaultTab === "signin" ? "email-signin" : "entry";
  const [view,          setView]          = useState<ViewState>(initialView);
  const [showPassword,  setShowPassword]  = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [isLoading,     setIsLoading]     = useState(false);
  const [appleLoading,  setAppleLoading]  = useState(false);

  // Shared email / password used by both sign-up and sign-in forms
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");

  // Sign-up email: email confirmed state
  const [signedUpEmail, setSignedUpEmail] = useState("");

  // Privacy picker
  const [selectedMode, setSelectedMode]   = useState<PrivacyMode>("anonymous");
  // True when picker is shown for a newly-authenticated Apple user
  const [appleUserId,  setAppleUserId]    = useState<string | null>(null);

  const isApplePath = appleUserId !== null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleContinueEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) return;
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setView("privacy-pick");
  };

  const handleCreateAccount = async () => {
    setError(null);
    setIsLoading(true);
    // handle is left blank — the trigger generates one from the email prefix
    const { error: err } = await signUp(email.trim(), password, "", undefined, selectedMode);
    setIsLoading(false);
    if (err) { setError(err); return; }
    setSignedUpEmail(email.trim());
    setView("check-email");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setIsLoading(false);
    if (err) { setError(err); return; }
    onSuccess?.();
    onClose();
  };

  const handleApple = async () => {
    setError(null);
    setAppleLoading(true);
    const { error: err, isNewUser, userId } = await signInWithApple();
    setAppleLoading(false);
    if (err) { setError(err); return; }
    if (isNewUser && userId) {
      setAppleUserId(userId);
      setSelectedMode("anonymous");
      setView("privacy-pick");
    } else {
      onSuccess?.();
      onClose();
    }
  };

  /** Confirm the privacy picker — different actions for email vs Apple paths. */
  const handlePrivacyConfirm = async () => {
    setError(null);
    if (isApplePath && appleUserId) {
      // Apple new-user path: already authenticated, just update the profile
      setIsLoading(true);
      const result = await changePrivacyMode(appleUserId, selectedMode);
      setIsLoading(false);
      if (!result.ok) { setError(result.error); return; }
      onSuccess?.();
      onClose();
    } else {
      // Email path: create the account now
      await handleCreateAccount();
    }
  };

  const goBack = () => {
    setError(null);
    if (view === "email-signup") setView("entry");
    else if (view === "email-signin") setView("entry");
    else if (view === "privacy-pick") setView(isApplePath ? "entry" : "email-signup");
  };

  const showBack = view === "email-signup" || view === "email-signin" || view === "privacy-pick";

  // ── Render ───────────────────────────────────────────────────────────────────

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
          {showBack ? (
            <button
              onClick={goBack}
              className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            {TITLES[view]}
          </h2>
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
          {/* ── Error ── */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ══ ENTRY ══════════════════════════════════════════════════════════ */}
          {view === "entry" && (
            <div className="flex flex-col gap-3">
              {/* Apple Sign-In — native only, most prominent */}
              {isNative && (
                <button
                  onClick={handleApple}
                  disabled={appleLoading}
                  className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-black
                             bg-black text-white font-bold text-base
                             shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                             disabled:opacity-50 transition-all"
                >
                  {appleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AppleLogo />}
                  Continue with Apple
                </button>
              )}

              {/* Divider */}
              {isNative && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-black/12" />
                  <span className="text-xs text-black/30 font-bold uppercase tracking-wide">or</span>
                  <div className="flex-1 h-px bg-black/12" />
                </div>
              )}

              {/* Continue with Email */}
              <button
                onClick={() => { setError(null); setView("email-signup"); }}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 border-black
                           bg-white text-black font-bold text-base
                           shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Mail className="w-5 h-5" />
                Continue with Email
              </button>

              {/* Sign in link */}
              <p className="text-center text-sm text-black/40">
                Already have an account?{" "}
                <button
                  onClick={() => { setError(null); setView("email-signin"); }}
                  className="font-bold text-black underline hover:text-black/60 transition-colors"
                >
                  Sign In
                </button>
              </p>
            </div>
          )}

          {/* ══ EMAIL SIGN-UP ══════════════════════════════════════════════════ */}
          {view === "email-signup" && (
            <form onSubmit={handleContinueEmail} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium
                           focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password (6+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border-2 border-black rounded-lg px-3 py-2.5 pr-10 text-sm font-medium
                             focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ══ PRIVACY PICKER ═════════════════════════════════════════════════ */}
          {view === "privacy-pick" && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-black/60 leading-snug">
                Choose how you want to participate in Discover.
              </p>

              {PRIVACY_OPTIONS.map(({ mode, icon, label, desc }) => {
                const isActive = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
                      isActive
                        ? "border-black bg-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                        : "border-black/20 hover:border-black/50 bg-white active:bg-black/5",
                    )}
                  >
                    <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-[11px] text-black/50 mt-0.5 leading-snug">{desc}</p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all",
                      isActive ? "border-black bg-black" : "border-black/25 bg-transparent",
                    )}>
                      {isActive && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handlePrivacyConfirm}
                disabled={isLoading}
                className="w-full btn-brutalist py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isApplePath ? "Get Started" : "Create Account"}
              </button>

              <p className="text-center text-[11px] text-black/35 leading-snug">
                You can change this anytime in Settings.
              </p>
            </div>
          )}

          {/* ══ EMAIL SIGN-IN ══════════════════════════════════════════════════ */}
          {view === "email-signin" && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full border-2 border-black rounded-lg px-3 py-2.5 text-sm font-medium
                           focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
              />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border-2 border-black rounded-lg px-3 py-2.5 pr-10 text-sm font-medium
                             focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>

              <p className="text-center text-sm text-black/40">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => { setError(null); setView("entry"); }}
                  className="font-bold text-black underline hover:text-black/60 transition-colors"
                >
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ══ CHECK EMAIL ════════════════════════════════════════════════════ */}
          {view === "check-email" && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-black bg-primary flex items-center justify-center
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-2xl">
                ✉️
              </div>
              <h3 className="font-display font-bold text-lg uppercase">Check your inbox</h3>
              <p className="text-sm text-black/60 leading-snug max-w-xs">
                We sent a confirmation link to{" "}
                <strong>{signedUpEmail}</strong>.
                Tap it to activate your account, then sign in.
              </p>
              <button
                onClick={() => { setError(null); setView("email-signin"); }}
                className="mt-1 px-5 py-2.5 border-2 border-black rounded-xl text-sm font-bold
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Go to Sign In →
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
