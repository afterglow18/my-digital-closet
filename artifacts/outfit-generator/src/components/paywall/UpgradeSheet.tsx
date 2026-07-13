/**
 * UpgradeSheet
 *
 * Full-screen paywall — shown when the user hits a free-tier limit.
 *
 * Design:
 *   Background  — cream #F8F4ED
 *   Card        — black, white text
 *   CTA button  — closet-door yellow #F0C030, black text
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEntitlements, PurchaseResult } from "@/hooks/useEntitlements";
import { PurchaseProduct } from "@/lib/entitlements";

export type UpgradeReason = "items" | "outfits" | "mannequin";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

const FEATURES = [
  { emoji: "♾️",  text: "Unlimited clothing items"   },
  { emoji: "👗",  text: "Unlimited saved outfits"    },
  { emoji: "☁️",  text: "Wardrobe saved to the cloud" },
  { emoji: "🔄",  text: "Cancel anytime"              },
] as const;

const SUBTITLES: Record<UpgradeReason, string> = {
  items:     "You've reached your 20-item limit. Subscribe to unlock your full digital closet.",
  outfits:   "You've hit the free outfit limit. Subscribe to save unlimited outfits.",
  mannequin: "Subscribe to unlock all premium features.",
};

export function UpgradeSheet({ reason, onClose }: Props) {
  const { purchase } = useEntitlements();
  const [status, setStatus] = useState<"idle" | "pending">("idle");
  const [plan, setPlan] = useState<PurchaseProduct>("annual");

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");
    const result: PurchaseResult = await purchase(plan);
    if (result === "success") {
      onClose();
    } else {
      setStatus("idle");
    }
  }, [status, purchase, plan, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto"
      style={{ background: "#F8F4ED" }}
    >
      {/* Close button */}
      <div className="flex justify-end px-4 pb-2 flex-shrink-0"
           style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-5 pb-4 gap-4 min-h-0">

        {/* Headline */}
        <div className="flex flex-col gap-0.5">
          <h1 className="font-display font-bold text-4xl uppercase tracking-tight leading-none">
            Unlock Your<br />Unlimited<br />Digital Closet
          </h1>
          <p className="text-sm font-bold text-black/55 mt-2">
            {SUBTITLES[reason]}
          </p>
        </div>

        {/* Black card */}
        <div
          className="rounded-3xl overflow-hidden border-4 border-black flex flex-col flex-1 min-h-0"
          style={{ background: "#0a0a0a", boxShadow: "6px 6px 0px 0px rgba(0,0,0,0.35)" }}
        >
          {/* Plan toggle */}
          <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex gap-2 bg-white/10 rounded-xl p-1">
              <button
                onClick={() => setPlan("monthly")}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: plan === "monthly" ? "#F0C030" : "transparent",
                  color:      plan === "monthly" ? "#0a0a0a"  : "rgba(255,255,255,0.55)",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setPlan("annual")}
                className="flex-1 py-2 rounded-lg text-sm font-bold transition-all relative"
                style={{
                  background: plan === "annual" ? "#F0C030" : "transparent",
                  color:      plan === "annual" ? "#0a0a0a"  : "rgba(255,255,255,0.55)",
                }}
              >
                Annual
                {plan !== "annual" && (
                  <span className="absolute -top-2 -right-1 bg-green-400 text-black text-[9px] font-black px-1 py-0.5 rounded-full leading-none">
                    SAVE
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Feature list */}
          <ul className="px-5 py-0 flex flex-col flex-1 justify-evenly">
            {FEATURES.map(({ emoji, text }) => (
              <li key={text} className="flex items-center gap-4 py-1">
                <span className="text-xl leading-none w-7 flex-shrink-0 text-center">{emoji}</span>
                <span className="text-white font-semibold text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          {/* Price */}
          <div className="px-5 pb-5 pt-2 border-t border-white/10 flex-shrink-0">
            <div className="flex items-baseline gap-2">
              <span
                className="font-display font-bold text-5xl leading-none"
                style={{ color: "#F0C030" }}
              >
                {plan === "annual" ? "$19.99" : "$1.99"}
              </span>
              <span className="text-white/50 font-semibold text-sm leading-tight">
                {plan === "annual" ? "/ year" : "/ month"}
              </span>
            </div>
            {plan === "annual" && (
              <p className="text-green-400 text-xs font-bold mt-1">
                That's $1.67/mo — 2 months free vs monthly
              </p>
            )}
          </div>
        </div>

      </div>

      {/* CTA footer */}
      <div
        className="px-5 pt-3 flex flex-col gap-3 flex-shrink-0"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-2xl font-display font-bold text-xl uppercase
                     tracking-tight border-4 border-black text-black
                     active:translate-x-1 active:translate-y-1 transition-all
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: "#F0C030",
            boxShadow: status === "pending" ? "none" : "5px 5px 0px 0px rgba(0,0,0,1)",
          }}
        >
          {status === "pending"
            ? "Opening checkout…"
            : plan === "annual"
              ? "Start Annual – $19.99/yr"
              : "Start Monthly – $1.99/mo"}
        </button>
        <button
          onClick={onClose}
          className="text-sm font-bold text-black/40 text-center underline underline-offset-2
                     hover:text-black/60 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
