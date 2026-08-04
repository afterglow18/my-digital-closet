/**
 * community.tsx — Discover tab (V1: browse-and-share, no marketplace).
 *
 * UX PRINCIPLES
 * ─────────────
 * • Anyone can browse, search, filter, and view profiles — no account required.
 * • The call-to-action is "Share" (what users want to do), not "Sign In".
 * • Sign-up is triggered at the exact moment the user decides to share, not before.
 * • After sign-in, the user is sent to their wardrobe to choose what to publish.
 *
 * FEATURES
 * ────────
 * • Sticky controls — tabs, search, and chips stay pinned while the feed scrolls.
 * • Infinite scroll — next page loads automatically when the sentinel enters view.
 * • Scroll restoration — returning to Discover after leaving resumes from the same spot.
 */

import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, UserCircle, Loader2, RefreshCw, Shirt, Globe, Users, Heart, X, Plane } from "lucide-react";
import { AboveNavSlotContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCommunityItems, useCommunityOutfits, useFollowingFeed } from "@/hooks/useCommunity";
import { getFollowCount } from "@/lib/localFollows";
import { migrateLocalFollowsToSupabase } from "@/hooks/useFollows";
import { migrateLocalBlocksToSupabase } from "@/lib/blockedUsers";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { NotificationsSheet } from "@/components/community/NotificationsSheet";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { PublicOutfitCard } from "@/components/community/PublicOutfitCard";
import { shareContent, SHARE_TEXT } from "@/lib/share";
import { CLOTHING_CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useUnreadNotifCount, useHeartNotifsEnabled } from "@/hooks/useNotifications";

type FeedTab = "items" | "outfits" | "following";

const CATEGORY_FILTERS = [
  { label: "All", value: "" },
  ...CLOTHING_CATEGORIES.map((c) => ({
    label: c.charAt(0).toUpperCase() + c.slice(1),
    value: c,
  })),
];

/** Key used to persist the scroll position for the Discover feed. */
const SCROLL_KEY = "discover-scroll-v1";

/** Returns the `<main>` scroll container created by AppLayout. */
function getScrollContainer(): HTMLElement | null {
  return document.querySelector("main");
}

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate]        = useLocation();
  const [showAuth,    setShowAuth]    = useState(false);
  const [showNotifs,  setShowNotifs]  = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [showNudge,   setShowNudge]   = useState(false);
  const unreadCount = useUnreadNotifCount();
  const [heartNotifsEnabled] = useHeartNotifsEnabled();
  const setAboveNav = useContext(AboveNavSlotContext);
  const [feedTab, setFeedTab]   = useState<FeedTab>("items");
  const [category, setCategory] = useState("");
  const [search, setSearch]     = useState("");

  // ── Infinite queries ───────────────────────────────────────────────────────
  const itemsQuery   = useCommunityItems({ category: category || undefined, search: search || undefined });
  const outfitsQuery = useCommunityOutfits({ search: search || undefined });
  const followingQuery = useFollowingFeed(user?.id);

  // Flatten pages into a single array
  const items      = itemsQuery.data?.pages.flat()   ?? [];
  const outfits    = outfitsQuery.data?.pages.flat()  ?? [];
  const followFeed = followingQuery.data              ?? [];

  const isLoading = feedTab === "items"     ? itemsQuery.isLoading
                  : feedTab === "outfits"   ? outfitsQuery.isLoading
                  : followingQuery.isLoading;

  const error     = feedTab === "items"     ? itemsQuery.error
                  : feedTab === "outfits"   ? outfitsQuery.error
                  : null;

  const refetch   = feedTab === "items"     ? itemsQuery.refetch
                  : feedTab === "outfits"   ? outfitsQuery.refetch
                  : followingQuery.refetch;

  const isEmpty   = feedTab === "items"     ? items.length === 0
                  : feedTab === "outfits"   ? outfits.length === 0
                  : followFeed.length === 0;

  // Infinite scroll state for the active tab
  const fetchNextPage     = feedTab === "items"   ? itemsQuery.fetchNextPage
                          : feedTab === "outfits" ? outfitsQuery.fetchNextPage
                          : undefined;
  const hasNextPage       = feedTab === "items"   ? itemsQuery.hasNextPage
                          : feedTab === "outfits" ? outfitsQuery.hasNextPage
                          : false;
  const isFetchingNextPage = feedTab === "items"  ? itemsQuery.isFetchingNextPage
                           : feedTab === "outfits" ? outfitsQuery.isFetchingNextPage
                           : false;

  const followCount = getFollowCount();

  // ── Scroll restoration ────────────────────────────────────────────────────
  useEffect(() => {
    const main = getScrollContainer();
    if (!main) return;
    // Restore saved position after the feed has had a chance to render
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      requestAnimationFrame(() => { main.scrollTop = parseInt(saved, 10); });
    }
    // Save position when leaving the page
    return () => {
      sessionStorage.setItem(SCROLL_KEY, String(main.scrollTop));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Infinite scroll sentinel ───────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !fetchNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Reset scroll when tab changes
  const handleTabChange = useCallback((tab: FeedTab) => {
    setFeedTab(tab);
    requestAnimationFrame(() => { getScrollContainer()?.scrollTo({ top: 0 }); });
  }, []);

  // ── Above-nav bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    setAboveNav(
      !user ? (
        <div className="bg-primary border-t-2 border-black px-4 py-2.5 flex items-center gap-3">
          <p className="flex-1 font-display font-bold text-sm uppercase tracking-tight leading-none">
            Share your style
          </p>
          <button
            onClick={() => setShowAuth(true)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 border-2 border-black
                       rounded-xl bg-white text-xs font-bold uppercase tracking-wide
                       shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <Globe className="w-3.5 h-3.5" />
            Add Items
          </button>
        </div>
      ) : (
        <div className="bg-white/95 border-t border-black/10 px-4 py-2 flex items-center gap-2">
          <p className="flex-1 text-[11px] font-bold text-black/40 uppercase tracking-wide">
            Ready to share?
          </p>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 px-3 py-1.5 border-2 border-black rounded-xl
                       bg-primary text-[11px] font-bold uppercase tracking-wide
                       shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <Shirt className="w-3 h-3" /> Items
          </button>
          <button
            onClick={() => navigate("/saved")}
            className="flex items-center gap-1 px-3 py-1.5 border-2 border-black rounded-xl
                       bg-white text-[11px] font-bold uppercase tracking-wide
                       shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <Globe className="w-3 h-3" /> Outfits
          </button>
        </div>
      ),
    );
    return () => setAboveNav(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Migrate localStorage follows + blocks to Supabase once on sign-in
  useEffect(() => {
    if (user) {
      migrateLocalFollowsToSupabase(user.id).catch(() => {});
      migrateLocalBlocksToSupabase(user.id).catch(() => {});
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    );
  }

  return (
    <>
      <div
        className="flex flex-col min-h-full"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))", background: "linear-gradient(to bottom, #f5b8c8 0%, #FDECEF 180px)" }}
      >
        {/* ── Scrollable header — Discover title (scrolls away) ── */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6" />
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Discover</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* My profile shortcut — only for signed-in users */}
            {user && (
              <button
                onClick={() => navigate("/profile/me")}
                className="w-9 h-9 flex items-center justify-center border-2 border-black
                           rounded-full bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                           text-base leading-none"
                aria-label="My profile"
              >
                ✨
              </button>
            )}

            {/* Notification bell — only for signed-in users with notifications on */}
            {user && heartNotifsEnabled && (
              <button
                onClick={() => setShowNotifs(true)}
                className="relative w-9 h-9 flex items-center justify-center border-2 border-black
                           rounded-full bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                aria-label="Notifications"
              >
                <Heart className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5
                                   bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-white
                                   flex items-center justify-center leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={async () => {
                setCopied(true);
                await new Promise(r => setTimeout(r, 1000));
                await shareContent();
                setCopied(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-full
                         text-xs font-bold uppercase tracking-wide bg-primary
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <Plane className="w-4 h-4 fill-current" />
              SHARE
            </button>
          </div>
        </div>

        {/* ── Sticky controls — tabs + search + chips ── */}
        <div className="sticky top-0 z-20 bg-[#FDECEF] shadow-[0px_2px_8px_rgba(0,0,0,0.06)]">
          {/* Tabs */}
          <div className="px-4 pt-1 pb-2">
            <div className="grid grid-cols-3 gap-1 bg-black/5 rounded-xl p-1">
              {(
                [
                  { tab: "items"     as FeedTab, label: "Items",     icon: Shirt, badge: undefined   },
                  { tab: "outfits"   as FeedTab, label: "Outfits",   icon: Globe, badge: undefined   },
                  { tab: "following" as FeedTab, label: "Following", icon: Users, badge: followCount },
                ]
              ).map(({ tab, label, icon: Icon, badge }) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                    "flex items-center justify-center gap-1",
                    feedTab === tab
                      ? "bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "text-black/40 hover:text-black",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                  {badge != null && badge > 0 && (
                    <span className="bg-black text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search (hidden on Following tab) */}
          {feedTab !== "following" && (
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search styles…"
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-black/20 rounded-full text-sm font-medium
                             bg-white/80 shadow-sm focus:outline-none focus:border-black/50 placeholder:text-black/25"
                />
              </div>
            </div>
          )}

          {/* Category chips (items tab only) */}
          {feedTab === "items" && (
            <div className="flex gap-2 px-4 pb-2 overflow-x-auto no-scrollbar">
              {CATEGORY_FILTERS.map((f) => {
                const isActive = f.value === category;
                return (
                  <button
                    key={f.value}
                    onClick={() => setCategory((c) => (c === f.value ? "" : f.value))}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-full border-2 text-[11px] font-bold uppercase tracking-wide transition-all",
                      isActive
                        ? "bg-primary text-black border-black"
                        : "bg-white/70 border-black/20 text-black/50 hover:border-black/40",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Feed ── */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-black/30" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <p className="text-sm text-black/50">Could not load feed</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs font-bold text-black/40 hover:text-black"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
            {feedTab === "following" ? (
              <>
                <Users className="w-10 h-10 text-black/15" />
                <p className="text-sm font-bold text-black/40 uppercase">No one followed yet</p>
                <p className="text-xs text-black/30 max-w-xs">
                  Visit a public profile and tap Follow to see their posts here.
                </p>
              </>
            ) : (
              <>
                <Globe className="w-10 h-10 text-black/15" />
                <p className="text-sm font-bold text-black/40 uppercase">Nothing here yet</p>
                <p className="text-xs text-black/30 max-w-xs">
                  Be the first to share your style.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="px-4 pt-3 pb-4">
            {/* Items = 2-col grid; Outfits/Following = full-width single column */}
            <div className="grid grid-cols-2 gap-3">
              {feedTab === "following"
                ? followFeed.map((entry) =>
                    entry.type === "item"
                      ? <PublicItemCard   key={entry.data.id} item={entry.data}   />
                      : <PublicOutfitCard key={entry.data.id} outfit={entry.data} />
                  )
                : feedTab === "items"
                  ? items.map((item)     => <PublicItemCard   key={item.id}   item={item}     />)
                  : outfits.map((outfit) => <PublicOutfitCard key={outfit.id} outfit={outfit} />)}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="flex justify-center py-4 mt-2">
              {isFetchingNextPage && (
                <Loader2 className="w-5 h-5 animate-spin text-black/25" />
              )}
              {!hasNextPage && !isFetchingNextPage && items.length + outfits.length > 0 && feedTab !== "following" && (
                <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest">
                  All caught up
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNotifs && (
          <NotificationsSheet onClose={() => setShowNotifs(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowNudge(true)}
            defaultTab="signup"
          />
        )}
      </AnimatePresence>

      {copied && (
        <div className="fixed top-[25%] bottom-0 left-3 right-3 z-[299] bg-[#2c2c2e] rounded-t-3xl px-4 pt-5 pb-0 flex items-start justify-center">
          <button
            onClick={() => { navigator.clipboard.writeText(SHARE_TEXT).catch(() => {}); setCopied(false); }}
            className="bg-yellow-400 text-black px-7 py-4 rounded-full text-lg font-black shadow-xl whitespace-nowrap border-2 border-black active:scale-95 transition-transform"
          >
            ✨ Link Copied! Paste to Post ✨
          </button>
        </div>
      )}

      {/* Post-sign-in nudge */}
      <AnimatePresence>
        {showNudge && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-24 left-4 right-4 z-50 bg-black text-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
          >
            <Shirt className="shrink-0 w-5 h-5 text-white/70" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Share your style</p>
              <p className="text-xs text-white/60 leading-tight mt-0.5">Add items from your closet to Discover</p>
            </div>
            <button
              onClick={() => { setShowNudge(false); navigate("/"); }}
              className="shrink-0 bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg"
            >
              Add Items
            </button>
            <button
              onClick={() => setShowNudge(false)}
              className="shrink-0 text-white/50 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
