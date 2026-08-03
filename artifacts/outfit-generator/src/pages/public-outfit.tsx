/**
 * public-outfit.tsx — public outfit detail page.
 *
 * Serves two roles:
 *  1. In-app view when a deep link opens /outfit/:id
 *  2. Web fallback in Safari when the app is not installed
 *
 * Shows ONLY public fields. Never exposes private notes, wear history,
 * purchase details, local IDs, or any other private metadata.
 */

import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Shirt } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { getSupabase, isSupabaseConfigured, type PublicOutfit, type SafeProfile } from "@/lib/supabase";
import { ShareButton } from "@/components/community/ShareButton";
import {
  outfitShareUrl,
  buildOutfitShareText,
  APP_STORE_URL,
  smartBannerContent,
} from "@/lib/share";
import { FollowButton } from "@/components/community/FollowButton";
import { cn } from "@/lib/utils";

const isNative = Capacitor.isNativePlatform();

export default function PublicOutfitPage() {
  const { id }       = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: outfit, isLoading } = useQuery({
    queryKey: ["public-outfit-page", id],
    queryFn: async (): Promise<(PublicOutfit & { profiles?: SafeProfile }) | null> => {
      if (!id || !isSupabaseConfigured()) return null;
      const sb = getSupabase();
      const { data } = await sb
        .from("public_outfits")
        .select("*")
        .eq("id", id)
        .eq("status", "active")
        .single();
      if (!data) return null;
      const outfitRow = data as PublicOutfit;
      const { data: profileData } = await sb
        .from("safe_profiles")
        .select("*")
        .eq("id", outfitRow.user_id)
        .maybeSingle();
      return { ...outfitRow, profiles: (profileData as SafeProfile) ?? undefined };
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    );
  }

  if (!outfit) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 px-8 text-center">
        <p className="font-bold text-black/30">This post is no longer available.</p>
        <button
          onClick={() => navigate("/community")}
          className="text-xs font-bold text-black/40 underline"
        >
          Back to Discover
        </button>
      </div>
    );
  }

  const profile  = outfit.profiles;
  const privMode = profile?.privacy_mode ?? "anonymous";
  const isPublic = privMode === "public";
  const items    = outfit.item_names ?? [];
  const shareUrl = outfitShareUrl(outfit.id);
  const shareText = buildOutfitShareText(outfit.name, privMode, profile?.handle ?? undefined, shareUrl);

  // ── iOS Smart App Banner — shows "Open in My Digital Closet" in Safari ──
  useEffect(() => {
    if (isNative) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-itunes-app"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "apple-itunes-app";
      document.head.appendChild(meta);
    }
    meta.content = smartBannerContent(shareUrl);
    return () => { meta?.remove(); };
  }, [shareUrl]);

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ paddingTop: "max(safe-area-inset-top, 16px)" }}
    >
      {/* Back */}
      <div className="px-4 pb-2 flex items-center justify-between">
        <button
          onClick={() => navigate("/community")}
          className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Discover
        </button>
        <ShareButton url={shareUrl} text={shareText} variant="icon" size="sm" />
      </div>

      {/* Preview */}
      <div className="w-full aspect-square bg-primary/40 flex flex-col items-center justify-center gap-3 px-6">
        <Shirt className="w-12 h-12 text-black/20" />
        <div className="flex flex-col gap-1 w-full max-w-xs">
          {items.slice(0, 5).map((name, i) => (
            <p
              key={i}
              className="text-sm font-bold text-black/60 text-center truncate"
            >
              {name}
            </p>
          ))}
          {items.length > 5 && (
            <p className="text-xs text-black/30 text-center">+{items.length - 5} more pieces</p>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Name */}
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight leading-tight">
            {outfit.name || "Untitled Look"}
          </h1>
          <p className="text-sm text-black/40 font-bold uppercase tracking-wide mt-0.5">
            {items.length} {items.length === 1 ? "piece" : "pieces"}
          </p>
        </div>

        {/* Piece list */}
        {items.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {items.map((name, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-medium">
                <span className="w-5 h-5 rounded-full bg-black/5 flex items-center justify-center text-[10px] font-bold text-black/40">
                  {i + 1}
                </span>
                {name}
              </div>
            ))}
          </div>
        )}

        {/* Creator — handle only shown for public profiles */}
        {profile && (
          <div className="flex items-center justify-between border-t-2 border-black/10 pt-4">
            <div>
              {isPublic ? (
                <>
                  <p className="font-bold text-sm">
                    {profile.display_name ?? `@${profile.handle}`}
                  </p>
                  <p className="text-xs text-black/40">@{profile.handle}</p>
                </>
              ) : (
                <p className="font-bold text-sm text-black/40">Anonymous</p>
              )}
            </div>
            {isPublic && (
              <FollowButton profileId={profile.id} handle={profile.handle ?? ""} size="sm" />
            )}
          </div>
        )}

        {/* Published date */}
        <p className="text-[10px] text-black/25 font-medium">
          Published {new Date(outfit.created_at).toLocaleDateString()}
        </p>

        {/* App Store CTA — only shown in web browser, not inside the native app */}
        {!isNative && (
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center gap-2 w-full py-3.5 mt-2",
              "border-2 border-black rounded-2xl bg-primary font-bold text-sm uppercase tracking-wide",
              "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
            )}
          >
            📱 Get My Digital Closet — Free
          </a>
        )}
      </div>
    </div>
  );
}
