/**
 * SharingModeSheet — shown when a user taps the globe on an item or outfit.
 *
 * Two options:
 *   🕶️  Anonymous  — post appears in Discover, @handle hidden, no profile link
 *   🌟  Public     — @handle shown on post, profile browsable, followable
 *
 * "Remember my choice" checkbox (checked by default): when checked, saves the
 * preference to localStorage so future globe taps publish instantly without
 * showing this sheet again.  Users can reset it in Settings.
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { getSharingPref, setSharingPref, type SharingMode } from "@/lib/sharingPreference";
import { cn } from "@/lib/utils";

const OPTIONS: { mode: SharingMode; icon: string; label: string; desc: string }[] = [
  {
    mode: "anonymous",
    icon: "🕶️",
    label: "Share Anonymously",
    desc: "Your post appears in Discover. Your @handle and profile stay hidden.",
  },
  {
    mode: "public",
    icon: "🌟",
    label: "Share with My @Handle",
    desc: "Your @handle is shown on the post. Others can visit your profile and follow you.",
  },
];

interface Props {
  /** Pre-selected mode. Falls back to localStorage pref → "anonymous". */
  initialMode?: SharingMode;
  /** Called with the chosen mode after the user confirms. */
  onConfirm: (mode: SharingMode) => void | Promise<void>;
  onCancel: () => void;
}

export function SharingModeSheet({ initialMode, onConfirm, onCancel }: Props) {
  const [selected,   setSelected]   = useState<SharingMode>(initialMode ?? getSharingPref());
  const [remember,   setRemember]   = useState(true);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    if (remember) setSharingPref(selected); // save before calling onConfirm
    await onConfirm(selected);
    // parent will unmount — no need to clear confirming
  };

  const toggleRemember = () => setRemember((r) => !r);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className="fixed inset-0 z-[80] flex flex-col justify-end max-w-md mx-auto"
      onClick={onCancel}
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
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            How would you like to share?
          </h2>
          <button
            onClick={onCancel}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="px-5 pt-4 pb-6 flex flex-col gap-3"
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {/* Mode options */}
          {OPTIONS.map(({ mode, icon, label, desc }) => {
            const isActive = selected === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setSelected(mode)}
                disabled={confirming}
                className={cn(
                  "flex items-start gap-3 p-3.5 rounded-2xl border-2 text-left transition-all",
                  isActive
                    ? "border-black bg-primary shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    : "border-black/20 hover:border-black/50 bg-white active:bg-black/5",
                  confirming && !isActive && "opacity-50",
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

          {/* Remember checkbox */}
          <button
            type="button"
            onClick={toggleRemember}
            disabled={confirming}
            className="flex items-center gap-2.5 px-1 text-left group"
          >
            <div className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
              remember
                ? "border-black bg-black"
                : "border-black/30 bg-white group-hover:border-black/60",
            )}>
              {remember && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium text-black/70 select-none leading-snug">
              Remember my choice for future shares
            </span>
          </button>

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full btn-brutalist py-3.5 rounded-xl flex items-center justify-center gap-2
                       text-sm disabled:opacity-50"
          >
            {confirming && <Loader2 className="w-4 h-4 animate-spin" />}
            Share to Discover
          </button>
        </div>
      </div>
    </motion.div>
  );
}
