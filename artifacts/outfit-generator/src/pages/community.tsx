/**
 * CommunityPage — community feed tab.
 *
 * Not signed in: shows a CTA to join.
 * Signed in: shows browse feed of public/for_sale items with filters.
 */

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Users, Globe, Tag, Search, UserCircle, Loader2, RefreshCw } from "lucide-react";
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
  ...CLOTHING_CATEGORIES.map((c) => ({ label: c.charAt(0).toUpperCase() + c.slice(1), value: c })),
];

export default function CommunityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [forSaleOnly, setForSaleOnly] = useState(false);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

  const { data: items, isLoading: feedLoading, error, refetch } = useCommunityFeed(
    user ? { forSaleOnly, category: category || undefined, search: search || undefined } : {},
  );

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
        {/* Header */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6" />
            <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Community</h1>
          </div>
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

        {/* Not signed in — CTA */}
        {!user && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 py-12">
            <div className="w-20 h-20 rounded-full border-4 border-black bg-primary flex items-center justify-center
                            shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <Globe className="w-10 h-10" />
            </div>
            <div className="text-center">
              <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">
                Share Your Style
              </h2>
              <p className="text-sm text-black/60 leading-relaxed max-w-xs">
                Sign up to publish items to the community, build a public profile, and discover what others are wearing.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                onClick={() => setShowAuth(true)}
                className="w-full btn-brutalist py-4 rounded-xl text-sm"
              >
                Join the Community
              </button>
              <p className="text-center text-[11px] text-black/30 font-medium">
                Your private closet stays private. Always.
              </p>
            </div>
          </div>
        )}

        {/* Signed in — feed */}
        {user && (
          <>
            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search community…"
                  className="w-full pl-9 pr-4 py-2.5 border-2 border-black rounded-xl text-sm font-medium
                             bg-white focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/25"
                />
              </div>
            </div>

            {/* Filter chips */}
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

            {/* Feed */}
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
              <div className="flex flex-col items-center gap-2 py-16 px-6 text-center">
                <p className="text-sm font-bold text-black/40 uppercase">Nothing here yet</p>
                <p className="text-xs text-black/30">Be the first to publish an item!</p>
              </div>
            ) : (
              <div className="px-4 pb-24">
                <div className="grid grid-cols-2 gap-3">
                  {items.map((item) => (
                    <PublicItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {showAuth && (
          <AuthSheet onClose={() => setShowAuth(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
