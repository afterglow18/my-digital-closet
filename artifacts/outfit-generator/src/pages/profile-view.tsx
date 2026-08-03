/**
 * ProfileViewPage — public read-only profile at /profile/:handle
 * No auth required to view.
 */

import React from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Globe, Tag, Loader2 } from "lucide-react";
import { usePublicProfile, usePublicProfileItems } from "@/hooks/useCommunity";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import type { PublicItem } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function ProfileViewPage() {
  const { handle } = useParams<{ handle: string }>();
  const [, navigate] = useLocation();

  const { data: profile, isLoading: profileLoading, error: profileError } = usePublicProfile(handle);
  const { data: items, isLoading: itemsLoading } = usePublicProfileItems(profile?.id);

  if (profileLoading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 h-64 px-6 text-center"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <p className="font-bold text-black/40 uppercase text-sm">Profile not found</p>
        <button
          onClick={() => navigate("/community")}
          className="text-xs font-bold text-black/40 underline hover:text-black"
        >
          Back to Community
        </button>
      </div>
    );
  }

  const publicCount  = items?.filter((i: PublicItem) => i.visibility === "public").length ?? 0;
  const forSaleCount = items?.filter((i: PublicItem) => i.visibility === "for_sale").length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      className="flex flex-col min-h-full"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
    >
      {/* Back */}
      <div className="px-4 pb-2">
        <button
          onClick={() => navigate("/community")}
          className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* Profile header */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full border-4 border-black bg-primary
                        flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.handle} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display font-black text-3xl uppercase">
              {profile.display_name?.[0] ?? profile.handle[0]}
            </span>
          )}
        </div>

        {/* Name + handle */}
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
            {profile.display_name || `@${profile.handle}`}
          </h1>
          <p className="text-sm text-black/40 font-medium">@{profile.handle}</p>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-black/70 leading-relaxed">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5 text-sm font-bold">
            <Globe className="w-4 h-4 text-green-600" />
            <span>{publicCount} public</span>
          </div>
          {forSaleCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <Tag className="w-4 h-4 text-amber-600" />
              <span>{forSaleCount} for sale</span>
            </div>
          )}
        </div>
      </div>

      {/* Items grid */}
      <div className="flex-1 px-4 pb-24">
        {itemsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-black/30" />
          </div>
        ) : !items?.length ? (
          <p className="text-sm text-black/30 text-center py-8">No public items yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item: PublicItem) => (
              <PublicItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
