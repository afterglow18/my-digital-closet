/**
 * PrivateGateSheet — shown when a Private-mode user tries to heart, follow,
 * or share to Discover.
 *
 * Explains that Private mode disables community features and offers to switch
 * to Anonymous Sharing or Public Profile in-place.
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SwitchMode = "anonymous" | "public";

interface PrivateGateSheetProps {
  /** What the user was trying to do — personalises the body copy. */
  action?: "heart" | "follow" | "share";
  onConfirm: (mode: SwitchMode) => void | Promise<void>;
  onClose: () => void;
}

const MODES: { mode: SwitchMode; icon: string; label: string; desc: string }[] = [
  {
    mode: "anonymous",
    icon: "🕶️",
    label: "Anonymous Sharing",
    desc: "Participate in Discover without showing your @handle or identity.",
  },
  {
    mode: "public",
    icon: "🌟",
    label: "Public Profile",
    desc: "Your @handle appears on posts. Others can visit your profile and follow you.",
  },
];

const ACTION_COPY: Record<NonNullable<PrivateGateSheetProps["action"]>, string> = {
  heart:  "heart posts",
  follow: "follow other users",
  share:  "share to Discover",
};

export function PrivateGateSheet({ action, onConfirm, onClose }: PrivateGateSheetProps) {
  const [selected, setSelected] = useState<SwitchMode>("anonymous");
  const [loading,  setLoading]  = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(selected); } finally { setLoading(false); }
  };

  const actionCopy = action ? ACTION_COPY[action] : "use community features";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl border-t-4 border-black
                   shadow-[0_-4px_0px_0px_rgba(0,0,0,1)] px-5 pt-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-black/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-display font-black text-xl leading-tight">
            Enable Community Features
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-black/20
                       hover:border-black transition-all ml-2 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-black/55 leading-snug mb-4">
          You're in Private mode. Switch your participation to {actionCopy}.
        </p>

        {/* Mode options */}
        <div className="flex flex-col gap-2.5 mb-4">
          {MODES.map(({ mode, icon, label, desc }) => {
            const isActive = selected === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelected(mode)}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
                  isActive
                    ? "border-black bg-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "border-black/20 hover:border-black/50 bg-white",
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
        </div>

        <button
          onClick={handleConfirm}
          disabled={loading}
          className="w-full btn-brutalist py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          )}
          Switch &amp; Continue
        </button>
        <p className="text-center text-[11px] text-black/35 mt-3 leading-snug">
          You can switch back to Private in Settings at any time.
        </p>
      </motion.div>
    </>
  );
}
