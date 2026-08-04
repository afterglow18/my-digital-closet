/**
 * ProfileViewPage — read-only public profile at /profile/:handle.
 * No auth required. Only shows items/outfits the owner has made public.
 */

import React, { useState } from "react";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Shirt, Globe, Loader2, Lock } from "lucide-react";
import { FollowButton } from "@/components/community/FollowButton";
import { ShareButton } from "@/components/community/ShareButton";
import { profileShareUrl } from "@/lib/share";
import { useAuth } from "@/hooks/useAuth";
import { usePublicProfile, usePublicProfileItems, usePublicProfileOutfits } from "@/hooks/useCommunity";
import { useFollowerCount } from "@/hooks/useFollows";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { PublicOutfitCard } from "@/components/community/PublicOutfitCard";
import { cn } from "@/lib/utils";

type Tab = "items" | "outfits";

export default function ProfileViewPage() {
  const { handle }   = useParams<{ handle: string }>();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("items");

  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, error: profileError } = usePublicProfile(handle);
  const { data: items,   isLoading: itemsLoading }  = usePublicProfileItems(profile?.id);
  const { data: outfits, isLoading: outfitsLoading } = usePublicProfileOutfits(profile?.id);
  const { data: followerCount = 0 } = useFollowerCount(profile?.id);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 px-6 text-center"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <p className="font-bold text-black/40 uppercase text-sm">Profile not found</p>
        <button onClick={() => navigate("/community")}
          className="text-xs font-bold text-black/40 underline hover:text-black">
          Back to Discover
        </button>
      </div>
    );
  }

  // Anonymous or private accounts don't have a browsable public profile page.
  if (profile.privacy_mode !== "public") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 px-6 text-center"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Lock className="w-10 h-10 text-black/15" />
        <p className="font-bold text-black/40 uppercase text-sm">This profile is private</p>
        <p className="text-xs text-black/30 max-w-xs">
          This user hasn't made their profile public.
        </p>
        <button onClick={() => navigate("/community")}
          className="text-xs font-bold text-black/40 underline hover:text-black">
          Back to Discover
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      className="flex flex-col min-h-full"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))", background: "#FDECEF" }}
    >
      {/* Back */}
      <div className="px-4 pb-2">
        <button onClick={() => navigate("/community")}
          className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors">
          <ArrowLeft className="w-4 h-4" /> Discover
        </button>
      </div>

      {/* Profile header */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        <div className="w-20 h-20 rounded-full border-4 border-black bg-primary
                        flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.handle} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: "2rem", lineHeight: 1 }}>
              {(profile.display_name ?? profile.handle)[0]}
            </span>
          )}
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight">
            {profile.display_name || `@${profile.handle}`}
          </h1>
          <p className="text-sm text-black/40 font-medium">@{profile.handle}</p>
        </div>
        {profile.bio && (
          <p className="text-sm text-black/70 leading-relaxed">{profile.bio}</p>
        )}
        {/* Stats + Follow */}
        <div className="flex items-center gap-4">
          <div className="flex gap-4 text-sm font-bold flex-1">
            <span>{items?.length ?? 0} items</span>
            <span>{outfits?.length ?? 0} outfits</span>
            <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>
          </div>
          <div className="flex items-center gap-2">
            {profile.id !== user?.id && (
              <FollowButton profileId={profile.id} handle={profile.handle} />
            )}
            <ShareButton
              url={profileShareUrl(profile.handle)}
              text={`Check out @${profile.handle}'s public closet on My Digital Closet.`}
              title="My Digital Closet"
              variant="icon"
            />
          </div>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-1 bg-black/5 rounded-xl p-1">
          {([
            { t: "items",   label: "Items",   icon: Shirt },
            { t: "outfits", label: "Outfits", icon: Globe },
          ] as const).map(({ t, label, icon: Icon }) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                "py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                "flex items-center justify-center gap-1.5",
                tab === t
                  ? "bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "text-black/40 hover:text-black",
              )}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-24">
        {(tab === "items" ? itemsLoading : outfitsLoading) ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-black/30" />
          </div>
        ) : tab === "items" ? (
          !items?.length ? (
            <p className="text-sm text-black/30 text-center py-8">No public items</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => <PublicItemCard key={item.id} item={item} />)}
            </div>
          )
        ) : (
          !outfits?.length ? (
            <p className="text-sm text-black/30 text-center py-8">No public outfits</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {outfits.map((outfit) => <PublicOutfitCard key={outfit.id} outfit={outfit} />)}
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
