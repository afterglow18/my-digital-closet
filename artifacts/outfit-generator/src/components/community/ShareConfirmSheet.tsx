/**
 * ShareConfirmSheet — confirmation sheet shown before auth when a signed-out
 * user taps the globe icon on an item or outfit.
 *
 * Flow: Globe tap → ShareConfirmSheet → Continue → AuthSheet → auto-publish.
 *
 * This sheet explains the privacy model clearly so users understand what
 * sharing means before they're asked to create an account.
 */

import React from "react";
import { motion } from "framer-motion";
import { Globe, Lock, X, Shirt, Sparkles } from "lucide-react";

interface ShareConfirmSheetProps {
  kind: "item" | "outfit";
  name: string;
  onContinue: () => void;
  onCancel: () => void;
}

export function ShareConfirmSheet({ kind, name, onContinue, onCancel }: ShareConfirmSheetProps) {
  const isOutfit = kind === "outfit";

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className="fixed inset-0 z-[75] flex flex-col justify-end max-w-md mx-auto"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-3xl border-t-2 border-x-2 border-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-black/15 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-black">
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Share this {isOutfit ? "outfit" : "item"}?
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
          className="px-5 pt-5 pb-6 flex flex-col gap-5"
          style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
        >
          {/* Item preview strip */}
          <div className="flex items-center gap-3 bg-[#f9f4ee] border-2 border-black rounded-xl p-3
                          shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <div className="w-10 h-10 rounded-full bg-primary border-2 border-black flex items-center justify-center flex-shrink-0">
              {isOutfit ? <Sparkles className="w-5 h-5" /> : <Shirt className="w-5 h-5" />}
            </div>
            <p className="font-bold text-sm truncate flex-1">{name || (isOutfit ? "This outfit" : "This item")}</p>
            <Globe className="w-4 h-4 text-green-600 flex-shrink-0" />
          </div>

          {/* Explanation */}
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Globe className="w-4 h-4 text-green-700" />
              </div>
              <div>
                <p className="font-bold text-sm">Visible on Discover</p>
                <p className="text-xs text-black/50 leading-relaxed mt-0.5">
                  This {isOutfit ? "outfit" : "item"} will appear on the Discover feed and your public profile so others can find style inspiration.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#f9f4ee] border-2 border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-sm">Everything else stays private</p>
                <p className="text-xs text-black/50 leading-relaxed mt-0.5">
                  Only the {isOutfit ? "outfits" : "items"} you choose to share become public. Your full closet stays on your device.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onContinue}
              className="w-full btn-brutalist py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <Globe className="w-4 h-4" />
              Continue — Create Account
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-xl border-2 border-black/20 text-sm font-bold uppercase
                         tracking-wide text-black/40 hover:border-black hover:text-black transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
