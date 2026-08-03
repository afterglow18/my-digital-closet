/**
 * AuthSheet — bottom sheet for sign-in / sign-up.
 *
 * Tabs:
 *   Sign In  — email + password
 *   Sign Up  — email + password + @handle + display name
 *
 * Apple Sign-In button shown on native iOS.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Apple, Mail, Eye, EyeOff } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AuthSheetProps {
  onClose: () => void;
}

type Tab = "signin" | "signup";
type ViewState = "form" | "check-email";

export function AuthSheet({ onClose }: AuthSheetProps) {
  const { signIn, signUp, signInWithApple } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  const [tab, setTab] = useState<Tab>("signin");
  const [viewState, setViewState] = useState<ViewState>("form");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sign in
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign up
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suHandle, setSuHandle] = useState("");
  const [suDisplayName, setSuDisplayName] = useState("");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const { error } = await signIn(siEmail.trim(), siPassword);
    setIsLoading(false);
    if (error) { setError(error); return; }
    onClose();
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate handle format
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
    setIsLoading(true);
    const { error } = await signInWithApple();
    setIsLoading(false);
    if (error) { setError(error); return; }
    onClose();
  };

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
          <div className="w-10 h-1 bg-black/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black">
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Join the Community
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
          {/* Check email state */}
          {viewState === "check-email" ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-black bg-primary flex items-center justify-center
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <Mail className="w-8 h-8" />
              </div>
              <h3 className="font-display font-bold text-lg uppercase">Check your inbox</h3>
              <p className="text-sm text-black/60 leading-snug">
                We sent a confirmation link to <strong>{suEmail}</strong>.
                Tap it to activate your account, then sign in.
              </p>
              <button
                onClick={() => setViewState("form")}
                className="mt-2 text-sm font-bold underline text-black/50 hover:text-black transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-black/5 rounded-xl p-1">
                {(["signin", "signup"] as Tab[]).map((t) => (
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
                    {t === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* Apple Sign-In */}
              {isNative && (
                <>
                  <button
                    onClick={handleApple}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                               bg-black text-white font-bold text-sm uppercase tracking-wide
                               shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                               active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                               disabled:opacity-50 transition-all"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Apple className="w-4 h-4" />}
                    Sign in with Apple
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-black/15" />
                    <span className="text-xs text-black/30 font-bold uppercase">or</span>
                    <div className="flex-1 h-px bg-black/15" />
                  </div>
                </>
              )}

              {/* Sign In form */}
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
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
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
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Sign In
                  </button>
                </form>
              )}

              {/* Sign Up form */}
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
                      placeholder="Password"
                      value={suPassword}
                      onChange={(e) => setSuPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      className="w-full border-2 border-black rounded-lg px-3 py-2.5 pr-10 text-sm font-medium
                                 focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-black/30">@</span>
                    <input
                      type="text"
                      placeholder="handle (e.g. jane_doe)"
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
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
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
