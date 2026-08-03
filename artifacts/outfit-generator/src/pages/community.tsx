/**
 * community.tsx — Discover tab (V1: browse-and-share, no marketplace).
 *
 * UX PRINCIPLES
 * ─────────────
 * • Anyone can browse, search, filter, and view profiles — no account required.
 * • The call-to-action is "Share" (what users want to do), not "Sign In".
 * • Sign-up is triggered at the exact moment the user decides to share, not before.
 * • After sign-in, the user is sent to their wardrobe to choose what to publish.
 */

import React, { useState, useEffect, useContext } from "react";
import { AnimatePresence } from "framer-motion";
import { Compass, Search, UserCircle, Loader2, RefreshCw, Shirt, Globe, Share2 } from "lucide-react";
import { AboveNavSlotContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useCommunityItems, useCommunityOutfits } from "@/hooks/useCommunity";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { PublicOutfitCard } from "@/components/community/PublicOutfitCard";
import { CLOTHING_CATEGORIES } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type FeedTab = "items" | "outfits";

const CATEGORY_FILTERS = [
  { label: "All", value: "" },
  ...CLOTHING_CATEGORIES.map((c) => ({
    label: c.charAt(0).toUpperCase() + c.slice(1),
    value: c,
  })),
];

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate]   = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const setAboveNav = useContext(AboveNavSlotContext);
  const [feedTab, setFeedTab]   = useState<FeedTab>("items");
  const [category, setCategory] = useState("");
  const [search, setSearch]     = useState("");

  const itemsQuery   = useCommunityItems({ category: category || undefined, search: search || undefined });
  const outfitsQuery = useCommunityOutfits({ search: search || undefined });

  const { data: items,   isLoading: itemsLoading,   error: itemsError,   refetch: refetchItems }   = itemsQuery;
  const { data: outfits, isLoading: outfitsLoading, error: outfitsError, refetch: refetchOutfits } = outfitsQuery;

  const isLoading = feedTab === "items" ? itemsLoading   : outfitsLoading;
  const error     = feedTab === "items" ? itemsError     : outfitsError;
  const refetch   = feedTab === "items" ? refetchItems   : refetchOutfits;
  const isEmpty   = feedTab === "items" ? !items?.length : !outfits?.length;

  /** After sign-in, navigate to the wardrobe so the user can choose what to publish. */
  const handleShareSignInSuccess = () => navigate("/");

  const handleSharePress = () => {
    if (user) navigate("/");
    else setShowAuth(true);
  };

  // Inject a thin fixed bar directly above the nav bar.
  // Runs whenever auth state changes; cleans up when the tab is left.
  useEffect(() => {
    setAboveNav(
      !user ? (
        /* Signed-out: invite to share */
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
        /* Signed-in: quick shortcuts */
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
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
      >
        {/* ── Header ── */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6" />
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Discover</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Share button — primary CTA regardless of auth state */}
            <button
              onClick={handleSharePress}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-black rounded-full
                         text-xs font-bold uppercase tracking-wide bg-primary
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
            {/* Profile icon — only when signed in */}
            {user && (
              <button
                onClick={() => navigate("/profile/me")}
                className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                <UserCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Search ── */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search styles…"
              className="w-full pl-9 pr-4 py-2.5 border-2 border-black rounded-xl text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/25"
            />
          </div>
        </div>

        {/* ── Items / Outfits toggle ── */}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-2 gap-1 bg-black/5 rounded-xl p-1">
            {([
              { tab: "items",   label: "Items",   icon: Shirt },
              { tab: "outfits", label: "Outfits", icon: Globe },
            ] as const).map(({ tab, label, icon: Icon }) => (
              <button
                key={tab}
                onClick={() => setFeedTab(tab)}
                className={cn(
                  "py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                  "flex items-center justify-center gap-1.5",
                  feedTab === tab
                    ? "bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "text-black/40 hover:text-black",
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Category filter chips (items tab only) ── */}
        {feedTab === "items" && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            {CATEGORY_FILTERS.map((f) => {
              const isActive = f.value === category;
              return (
                <button
                  key={f.value}
                  onClick={() => setCategory((c) => (c === f.value ? "" : f.value))}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full border-2 text-[11px] font-bold uppercase tracking-wide transition-all",
                    isActive
                      ? "bg-black text-white border-black"
                      : "bg-white border-black/20 text-black/50 hover:border-black/40",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

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
            <Globe className="w-10 h-10 text-black/15" />
            <p className="text-sm font-bold text-black/40 uppercase">Nothing here yet</p>
            <p className="text-xs text-black/30 max-w-xs">
              Be the first to share your style. Open{" "}
              {feedTab === "items" ? "any item" : "any saved look"} and set it to Public.
            </p>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {feedTab === "items"
                ? items!.map((item) => <PublicItemCard key={item.id} item={item} />)
                : outfits!.map((outfit) => <PublicOutfitCard key={outfit.id} outfit={outfit} />)}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={handleShareSignInSuccess}
            defaultTab="signup"
          />
        )}
      </AnimatePresence>
    </>
  );
}
