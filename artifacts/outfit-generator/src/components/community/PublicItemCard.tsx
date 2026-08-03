/**
 * PublicItemCard — item card shown in the Discover feed and Discover Favorites.
 *
 * Privacy:
 *  • anonymous profile → handle and profile link are hidden
 *  • public profile    → @handle shown; tapping it navigates to their profile
 *
 * Auth gating:
 *  • Hearting requires a signed-in account — tapping the heart when logged out
 *    opens AuthSheet instead.
 *
 * Also includes:
 *  • Heart toggle with bounce animation
 *  • "⋯" menu → Report / Block creator
 *  • Shimmer placeholder while image loads
 */

import React, { useState } from "react";
import { Heart, MoreHorizontal, Flag, Ban, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import type { PublicItem, SafeProfile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useCommunity";
import { isDiscoverFavorite, toggleDiscoverFavorite } from "@/lib/discoverFavorites";
import { isBlocked, blockUser } from "@/lib/blockedUsers";
import { ReportSheet } from "@/components/community/ReportSheet";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { PrivateGateSheet } from "@/components/community/PrivateGateSheet";
import { shareContent, itemShareUrl, buildItemShareText } from "@/lib/share";
import { changePrivacyMode } from "@/lib/sync";
import { setSharingPref } from "@/lib/sharingPreference";
import { syncLike } from "@/lib/likes";
import { useQueryClient } from "@tanstack/react-query";

interface PublicItemCardProps {
  item: PublicItem & { profiles?: SafeProfile };
  onClick?: () => void;
  className?: string;
}

export function PublicItemCard({ item, onClick, className }: PublicItemCardProps) {
  const { user }                             = useAuth();
  const { data: myProfile }                  = useMyProfile(user?.id);
  const [, navigate]                         = useLocation();
  const queryClient                            = useQueryClient();
  const [hearted,       setHearted]          = useState(() => isDiscoverFavorite(item.id));
  const [heartAnim,     setHeartAnim]        = useState(false);
  const [heartSyncing,  setHeartSyncing]     = useState(false);
  const [heartError,    setHeartError]       = useState<string | null>(null);
  const [blocked,       setBlocked]          = useState(() => isBlocked(item.user_id));
  const [showMenu,      setShowMenu]         = useState(false);
  const [showReport,    setShowReport]       = useState(false);
  const [showAuth,      setShowAuth]         = useState(false);
  const [showPrivGate,  setShowPrivGate]     = useState(false);
  const [imgLoaded,     setImgLoaded]        = useState(false);

  if (blocked) return null;

  const profile     = item.profiles;
  const privacyMode = profile?.privacy_mode ?? "public";
  const isAnonymous = privacyMode === "anonymous";
  const isOwn       = user?.id === item.user_id;

  const handleHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user)                                 { setShowAuth(true);     return; }
    if (myProfile?.privacy_mode === "private") { setShowPrivGate(true); return; }
    if (heartSyncing) return; // prevent rapid duplicate requests

    const prev = hearted;
    const next = toggleDiscoverFavorite(item.id, "item");
    setHearted(next);
    setHeartError(null);
    if (next) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 500); }

    setHeartSyncing(true);
    const result = await syncLike(item.id, "item", next, user.id);
    setHeartSyncing(false);

    if (!result.ok) {
      // Revert local state
      toggleDiscoverFavorite(item.id, "item");
      setHearted(prev);
      setHeartError("Couldn't sync ❤️. Try again.");
      setTimeout(() => setHeartError(null), 3000);
    } else {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const handleProfileTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (profile && privacyMode === "public") navigate(`/profile/${profile.handle}`);
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    blockUser(item.user_id);
    setBlocked(true);
    setShowMenu(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Heart sync error toast */}
      {heartError && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap
                        bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
          {heartError}
        </div>
      )}

      {/* ── Card body ── */}
      <motion.div
        onClick={onClick}
        whileTap={{ scale: 0.97, y: 2 }}
        transition={{ type: "spring", stiffness: 450, damping: 28 }}
        className="group flex flex-col bg-white rounded-2xl border-2 border-black overflow-hidden
                   shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
      >
        {/* Image */}
        <div className="aspect-square w-full bg-[#f9f4ee] overflow-hidden relative">
          {item.image_url ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#ede8e1] via-[#f5f0ea] to-[#ede8e1]" />
              )}
              <img
                src={item.image_url}
                alt={item.name}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  imgLoaded ? "opacity-100" : "opacity-0",
                )}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-black/10 font-black uppercase">
              {item.category[0]}
            </div>
          )}

          {/* Heart button */}
          <button
            onClick={handleHeart}
            disabled={heartSyncing}
            aria-label={hearted ? "Unheart" : "Heart"}
            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white/90 border-2 border-black
                       flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.4)]
                       disabled:opacity-60"
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
          <p className="font-bold text-xs truncate">{item.name}</p>
          <p className="text-[10px] text-black/40 font-medium uppercase tracking-wide">
            {item.category}{item.brand ? ` · ${item.brand}` : ""}
          </p>
          {/* Handle — only for public profiles */}
          {!isAnonymous && profile && (
            <button
              onClick={handleProfileTap}
              className="text-[10px] text-black/30 font-medium truncate mt-0.5 text-left
                         hover:text-black/60 transition-colors"
            >
              @{profile.handle}
            </button>
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
                    itemShareUrl(item.id),
                    buildItemShareText(item.name, privacyMode, profile?.handle ?? undefined, itemShareUrl(item.id)),
                    "My Digital Closet",
                  );
                }}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                           border-black/15 bg-white text-sm font-bold text-left active:bg-black/5"
              >
                <Share2 className="w-4 h-4 text-black/50" /> Share
              </button>
              {!isOwn && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowReport(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left active:bg-black/5"
                >
                  <Flag className="w-4 h-4 text-black/50" /> Report
                </button>
              )}
              {!isOwn && (
                <button
                  onClick={handleBlock}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left text-red-600 active:bg-red-50"
                >
                  <Ban className="w-4 h-4" /> Block creator
                </button>
              )}
              <button
                onClick={() => setShowMenu(false)}
                className="w-full py-3 rounded-xl border-2 border-black/10 text-sm font-bold text-black/40 active:bg-black/5"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Report sheet ── */}
      {showReport && (
        <ReportSheet postId={item.id} postType="item" onClose={() => setShowReport(false)} />
      )}

      {/* ── Auth sheet (heart tapped while logged out) ── */}
      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
            defaultTab="signup"
          />
        )}
      </AnimatePresence>

      {/* ── Private gate (heart tapped while in Private mode) ── */}
      <AnimatePresence>
        {showPrivGate && (
          <PrivateGateSheet
            action="heart"
            onClose={() => setShowPrivGate(false)}
            onConfirm={async (mode) => {
              setShowPrivGate(false);
              if (!user) return;
              await changePrivacyMode(user.id, mode);
              setSharingPref(mode);
              const prev2 = hearted;
              const next  = toggleDiscoverFavorite(item.id, "item");
              setHearted(next);
              if (next) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 500); }
              setHeartSyncing(true);
              const r = await syncLike(item.id, "item", next, user.id);
              setHeartSyncing(false);
              if (!r.ok) {
                toggleDiscoverFavorite(item.id, "item");
                setHearted(prev2);
                setHeartError("Couldn't sync ❤️. Try again.");
                setTimeout(() => setHeartError(null), 3000);
              } else {
                queryClient.invalidateQueries({ queryKey: ["notifications"] });
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
