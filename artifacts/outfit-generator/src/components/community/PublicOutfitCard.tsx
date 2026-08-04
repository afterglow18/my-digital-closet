/**
 * PublicOutfitCard — outfit card for the Discover feed and Discover Favorites.
 *
 * Card overlay:  ❤️ Heart (bottom-right)  ↗️ Share (bottom-left)
 * Three-dot menu: Follow · View Closet · Copy Link · Block · Report
 */

import React, { useState } from "react";
import { Shirt, Heart, MoreHorizontal, Flag, Ban, Send, Link, UserCheck, UserPlus, User } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import type { PublicOutfit, SafeProfile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useCommunity";
import { isDiscoverFavorite, toggleDiscoverFavorite } from "@/lib/discoverFavorites";
import { isBlocked, blockUser } from "@/lib/blockedUsers";
import { ReportSheet } from "@/components/community/ReportSheet";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { PrivateGateSheet } from "@/components/community/PrivateGateSheet";
import { shareContent, SHARE_TEXT } from "@/lib/share";
import { changePrivacyMode } from "@/lib/sync";
import { setSharingPref } from "@/lib/sharingPreference";
import { syncLike } from "@/lib/likes";
import { useFollowState } from "@/hooks/useFollows";
import { useQueryClient } from "@tanstack/react-query";

interface PublicOutfitCardProps {
  outfit: PublicOutfit & { profiles?: SafeProfile };
  onClick?: () => void;
  className?: string;
}

export function PublicOutfitCard({ outfit, onClick, className }: PublicOutfitCardProps) {
  const { user }                        = useAuth();
  const { data: myProfile }             = useMyProfile(user?.id);
  const [, navigate]                    = useLocation();
  const queryClient                      = useQueryClient();
  const [hearted,      setHearted]      = useState(() => isDiscoverFavorite(outfit.id));
  const [heartAnim,    setHeartAnim]    = useState(false);
  const [heartSyncing, setHeartSyncing] = useState(false);
  const [heartError,   setHeartError]   = useState<string | null>(null);
  const [blocked,      setBlocked]      = useState(() => isBlocked(outfit.user_id));
  const [showMenu,     setShowMenu]     = useState(false);
  const [showReport,   setShowReport]   = useState(false);
  const [showAuth,     setShowAuth]     = useState(false);
  const [showPrivGate, setShowPrivGate] = useState(false);
  const [copied,       setCopied]       = useState(false);

  const profile     = outfit.profiles;
  const privacyMode = profile?.privacy_mode ?? "public";
  const isAnonymous = privacyMode === "anonymous";
  const isOwn       = user?.id === outfit.user_id;
  const handle      = (!isAnonymous && profile?.handle) ? profile.handle : "";
  const items       = outfit.item_names ?? [];

  // Follow state — always called (hooks can't be conditional)
  const { following, toggle: toggleFollow, syncing: followSyncing } = useFollowState(
    outfit.user_id,
    handle,
    user?.id,
  );

  if (blocked) return null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleHeart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user)                                 { setShowAuth(true);     return; }
    if (myProfile?.privacy_mode === "private") { setShowPrivGate(true); return; }
    if (heartSyncing) return;

    const prev = hearted;
    const next = toggleDiscoverFavorite(outfit.id, "outfit");
    setHearted(next);
    setHeartError(null);
    if (next) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 500); }

    setHeartSyncing(true);
    const result = await syncLike(outfit.id, "outfit", next, user.id);
    setHeartSyncing(false);

    if (!result.ok) {
      toggleDiscoverFavorite(outfit.id, "outfit");
      setHearted(prev);
      setHeartError("Couldn't sync ❤️. Try again.");
      setTimeout(() => setHeartError(null), 3000);
    } else {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    setCopied(true);
    await new Promise(r => setTimeout(r, 1000));
    await shareContent();
    setCopied(false);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { setShowMenu(false); setShowAuth(true); return; }
    setShowMenu(false);
    await toggleFollow(user.id);
  };

  const handleViewCloset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (handle) navigate(`/profile/${handle}`);
  };

  const handleBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    blockUser(outfit.user_id);
    setBlocked(true);
    setShowMenu(false);
  };

  const handleProfileTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAnonymous && handle) navigate(`/profile/${handle}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={cn("relative", className)}>
      {/* Heart sync error toast */}
      {heartError && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap
                        bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
          {heartError}
        </div>
      )}

      {copied && (
        <div className="fixed bottom-[61%] left-0 right-0 z-[299] bg-[#2c2c2e] rounded-t-3xl px-4 py-4 flex items-center justify-center">
          <button
            onClick={() => { navigator.clipboard.writeText(SHARE_TEXT).catch(() => {}); setCopied(false); }}
            className="bg-yellow-400 text-black px-5 py-3 rounded-full text-base font-black shadow-xl whitespace-nowrap border-2 border-black active:scale-95 transition-transform"
          >
            ✨ Link Copied! Paste to Post ✨
          </button>
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
        {/* Preview */}
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

          {/* More (⋯) button — top-right */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
            aria-label="More actions"
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm
                       flex items-center justify-center active:scale-90 transition-transform"
          >
            <MoreHorizontal className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Info + action buttons */}
        <div className="p-2.5 flex items-start gap-2">
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="font-bold text-xs truncate">{outfit.name || "Untitled Look"}</p>
            <p className="text-[10px] text-black/40 font-medium">
              {items.length} {items.length === 1 ? "piece" : "pieces"}
            </p>
            {!isAnonymous && handle && (
              <button
                onClick={handleProfileTap}
                className="text-[10px] text-black/30 font-medium truncate mt-0.5 text-left
                           hover:text-black/60 transition-colors"
              >
                @{handle}
              </button>
            )}
          </div>

          {/* Heart + Share stacked */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button
              onClick={handleHeart}
              aria-label={hearted ? "Unheart" : "Heart"}
              className="w-8 h-8 rounded-full bg-white border-2 border-black
                         flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <motion.div
                animate={heartAnim ? { scale: [1, 1.6, 0.8, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
              >
                <Heart className={cn("w-3.5 h-3.5 transition-colors", hearted ? "fill-red-500 text-red-500" : "text-black/40")} />
              </motion.div>
            </button>

          </div>
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
              {/* Follow — hidden for own posts and anonymous profiles */}
              {!isOwn && !isAnonymous && handle && (
                <button
                  onClick={handleFollow}
                  disabled={followSyncing}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left active:bg-black/5
                             disabled:opacity-50"
                >
                  {following
                    ? <UserCheck className="w-4 h-4 text-green-600" />
                    : <UserPlus  className="w-4 h-4 text-black/50" />}
                  {following ? `Following @${handle}` : `Follow @${handle}`}
                </button>
              )}

              {/* View Closet — hidden for anonymous profiles */}
              {!isAnonymous && handle && (
                <button
                  onClick={handleViewCloset}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left active:bg-black/5"
                >
                  <User className="w-4 h-4 text-black/50" /> View Closet
                </button>
              )}

              {/* Copy Link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                           border-black/15 bg-white text-sm font-bold text-left active:bg-black/5"
              >
                <Link className="w-4 h-4 text-black/50" /> Copy Link
              </button>

              {/* Block */}
              {!isOwn && (
                <button
                  onClick={handleBlock}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left text-red-600 active:bg-red-50"
                >
                  <Ban className="w-4 h-4" /> Block User
                </button>
              )}

              {/* Report */}
              {!isOwn && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowReport(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl border-2
                             border-black/15 bg-white text-sm font-bold text-left text-red-600 active:bg-red-50"
                >
                  <Flag className="w-4 h-4" /> Report Outfit
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
        <ReportSheet postId={outfit.id} postType="outfit" onClose={() => setShowReport(false)} />
      )}

      {/* ── Auth sheet ── */}
      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
            defaultTab="signup"
          />
        )}
      </AnimatePresence>

      {/* ── Private gate ── */}
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
              const next  = toggleDiscoverFavorite(outfit.id, "outfit");
              setHearted(next);
              if (next) { setHeartAnim(true); setTimeout(() => setHeartAnim(false), 500); }
              setHeartSyncing(true);
              const r = await syncLike(outfit.id, "outfit", next, user.id);
              setHeartSyncing(false);
              if (!r.ok) {
                toggleDiscoverFavorite(outfit.id, "outfit");
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
