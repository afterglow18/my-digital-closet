/**
 * PublicOutfitCard — outfit card for the Discover feed and Discover Favorites.
 *
 * Includes:
 *  • Heart toggle with bounce animation (local-only, no account required)
 *  • "⋯" menu → Report (requires account) or Block creator (local-only)
 *  • Blocked creators' cards render null
 */

import React, { useState } from "react";
import { Shirt, Heart, MoreHorizontal, Flag, Ban, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { PublicOutfit, Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isDiscoverFavorite, toggleDiscoverFavorite } from "@/lib/discoverFavorites";
import { isBlocked, blockUser } from "@/lib/blockedUsers";
import { ReportSheet } from "@/components/community/ReportSheet";
import { shareContent, outfitShareUrl } from "@/lib/share";

interface PublicOutfitCardProps {
  outfit: PublicOutfit & { profiles?: Profile };
  onClick?: () => void;
  className?: string;
}

export function PublicOutfitCard({ outfit, onClick, className }: PublicOutfitCardProps) {
  const { user }                     = useAuth();
  const [hearted,    setHearted]     = useState(() => isDiscoverFavorite(outfit.id));
  const [heartAnim,  setHeartAnim]   = useState(false);
  const [blocked,    setBlocked]     = useState(() => isBlocked(outfit.user_id));
  const [showMenu,   setShowMenu]    = useState(false);
  const [showReport, setShowReport]  = useState(false);

  if (blocked) return null;

  const isOwn  = user?.id === outfit.user_id;
  const items  = outfit.item_names ?? [];

  const handleHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = toggleDiscoverFavorite(outfit.id, "outfit");
    setHearted(next);
    if (next) {
      setHeartAnim(true);
      setTimeout(() => setHeartAnim(false), 500);
    }
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    blockUser(outfit.user_id);
    setBlocked(true);
    setShowMenu(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* ── Card body ── */}
      <motion.div
        onClick={onClick}
        whileTap={{ scale: 0.97, y: 2 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="group flex flex-col bg-white rounded-2xl border-2 border-black overflow-hidden
                   shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
      >
        {/* Preview area */}
        <div className="aspect-square w-full bg-primary/50 relative flex flex-col
                        items-center justify-center gap-2 px-3">
          <Shirt className="w-8 h-8 text-black/30" />
          {items.length > 0 && (
            <div className="flex flex-col gap-0.5 w-full">
              {items.slice(0, 3).map((name, i) => (
                <p key={i} className="text-[9px] font-bold uppercase tracking-wide text-black/50 truncate text-center">
                  {name}
                </p>
              ))}
              {items.length > 3 && (
                <p className="text-[9px] text-black/30 text-center">+{items.length - 3} more</p>
              )}
            </div>
          )}

          {/* Heart button */}
          <button
            onClick={handleHeart}
            aria-label={hearted ? "Unheart" : "Heart"}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 border-2 border-black
                       flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]"
          >
            <motion.div
              animate={heartAnim ? { scale: [1, 1.6, 0.8, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
            >
              <Heart
                className={cn("w-3.5 h-3.5 transition-colors",
                  hearted ? "fill-red-500 text-red-500" : "text-black/40",
                )}
              />
            </motion.div>
          </button>

          {/* More (⋯) button */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
            aria-label="More actions"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm
                       flex items-center justify-center active:scale-90 transition-transform"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Info */}
        <div className="p-2.5 flex flex-col gap-0.5">
          <p className="font-bold text-xs truncate">{outfit.name || "Untitled Look"}</p>
          <p className="text-[10px] text-black/40 font-medium">
            {items.length} {items.length === 1 ? "piece" : "pieces"}
          </p>
          {outfit.profiles && (
            <p className="text-[10px] text-black/30 font-medium truncate mt-0.5">
              @{outfit.profiles.handle}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Actions sheet ── */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/30 z-[50]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[51] bg-white rounded-t-3xl
                         border-t-2 border-black p-4 pb-safe flex flex-col gap-2"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  shareContent(
                    outfitShareUrl(outfit.id),
                    `Check out this look on My Digital Closet.`,
                    "My Digital Closet",
                  );
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                           border-black/15 bg-white text-sm font-bold text-left
                           active:bg-black/5 transition-colors"
              >
                <Share2 className="w-4 h-4 text-black/50" /> Share
              </button>
              {!isOwn && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowReport(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left
                             active:bg-black/5 transition-colors"
                >
                  <Flag className="w-4 h-4 text-black/50" /> Report
                </button>
              )}
              {!isOwn && (
                <button
                  onClick={handleBlock}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left
                             text-red-600 active:bg-red-50 transition-colors"
                >
                  <Ban className="w-4 h-4" /> Block creator
                </button>
              )}
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 rounded-xl border-2 border-black/10 text-sm font-bold
                           text-black/40 active:bg-black/5 transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Report sheet ── */}
      {showReport && (
        <ReportSheet
          postId={outfit.id}
          postType="outfit"
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
