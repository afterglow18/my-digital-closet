/**
 * community.tsx — Discover tab.
 *
 * Unauthenticated users can browse the full public feed.
 * Sign-up is only prompted when they try to publish an item
 * (handled in ItemDetailsSheet → VisibilityPicker).
 *
 * A soft "Join" banner appears at the bottom for unauthenticated users
 * so they know publishing is available without interrupting browsing.
 */

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, Tag, Search, UserCircle, Loader2, RefreshCw, Globe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCommunityFeed } from "@/hooks/useCommunity";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { CLOTHING_CATEGORIES } from "@/lib/db";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const FEED_FILTERS = [
  { label: "All", value: "" },
  { label: "For Sale", value: "for_sale" },
  ...CLOTHING_CATEGORIES.map((c) => ({
    label: c.charAt(0).toUpperCase() + c.slice(1),
    value: c,
  })),
];

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showAuth, setShowAuth]         = useState(false);
  const [forSaleOnly, setForSaleOnly]   = useState(false);
  const [category, setCategory]         = useState("");
  const [search, setSearch]             = useState("");

  const { data: items, isLoading: feedLoading, error, refetch } = useCommunityFeed({
    forSaleOnly,
    category: category || undefined,
    search: search || undefined,
  });

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
          {user ? (
            /* Signed-in: profile button */
            <button
              onClick={() => navigate("/profile/me")}
              className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              <UserCircle className="w-5 h-5" />
            </button>
          ) : (
            /* Unauthenticated: low-key Sign In link */
            <button
              onClick={() => setShowAuth(true)}
              className="px-3 py-1.5 border-2 border-black rounded-full text-xs font-bold uppercase
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              Sign In
            </button>
          )}
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

        {/* ── Filter chips ── */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {FEED_FILTERS.map((f) => {
            const isForSaleFilter = f.value === "for_sale";
            const isActive = isForSaleFilter
              ? forSaleOnly
              : f.value === category && !forSaleOnly;
            return (
              <button
                key={f.value}
                onClick={() => {
                  if (isForSaleFilter) {
                    setForSaleOnly((v) => !v);
                    setCategory("");
                  } else {
                    setForSaleOnly(false);
                    setCategory((c) => (c === f.value ? "" : f.value));
                  }
                }}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border-2 text-[11px] font-bold uppercase tracking-wide transition-all",
                  isActive
                    ? "bg-black text-white border-black"
                    : "bg-white border-black/20 text-black/50 hover:border-black/40",
                )}
              >
                {isForSaleFilter && <Tag className="w-3 h-3" />}
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ── Feed ── */}
        {feedLoading ? (
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
        ) : !items?.length ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <Globe className="w-10 h-10 text-black/15" />
            <p className="text-sm font-bold text-black/40 uppercase">Nothing here yet</p>
            {!user && (
              <p className="text-xs text-black/30 max-w-xs">
                Be the first to share your style. Open any item in your closet and set it to Public.
              </p>
            )}
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => (
                <PublicItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* ── Soft join banner for unauthenticated users ── */}
        {!user && (
          <div className="mx-4 mb-6 mt-2">
            <div className="border-2 border-black rounded-2xl bg-primary p-4 flex flex-col gap-2
                            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-base uppercase tracking-tight">
                Share your own style
              </p>
              <p className="text-sm text-black/70 leading-snug">
                Only the items you choose to share become public.
                Everything else stays private on your device.
              </p>
              <button
                onClick={() => setShowAuth(true)}
                className="mt-1 self-start px-4 py-2 border-2 border-black rounded-xl bg-white
                           font-bold text-sm uppercase tracking-wide
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                Create a Free Account
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Auth sheet ── */}
      <AnimatePresence>
        {showAuth && (
          <AuthSheet onClose={() => setShowAuth(false)} defaultTab="signup" />
        )}
      </AnimatePresence>
    </>
  );
}
