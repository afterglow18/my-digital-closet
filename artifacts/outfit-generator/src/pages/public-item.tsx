/**
 * public-item.tsx — public item detail page.
 *
 * Serves two roles:
 *  1. In-app view when a deep link opens /item/:id
 *  2. Web fallback in Safari when the app is not installed
 *
 * Shows ONLY public fields. Never exposes private notes, wear history,
 * purchase details, local IDs, or any other private metadata.
 */

import React, { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { getSupabase, isSupabaseConfigured, type PublicItem, type SafeProfile } from "@/lib/supabase";
import { ShareButton } from "@/components/community/ShareButton";
import {
  itemShareUrl,
  buildItemShareText,
  APP_STORE_URL,
  smartBannerContent,
} from "@/lib/share";
import { FollowButton } from "@/components/community/FollowButton";
import { cn } from "@/lib/utils";

const isNative = Capacitor.isNativePlatform();

export default function PublicItemPage() {
  const { id }       = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: item, isLoading } = useQuery({
    queryKey: ["public-item-page", id],
    queryFn: async (): Promise<(PublicItem & { profiles?: SafeProfile }) | null> => {
      if (!id || !isSupabaseConfigured()) return null;
      const { data } = await getSupabase()
        .from("public_items")
        .select("*, profiles:safe_profiles(*)")
        .eq("id", id)
        .eq("status", "active")
        .single();
      return (data as (PublicItem & { profiles?: SafeProfile })) ?? null;
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

  if (!item) {
    // Post deleted, hidden, or unpublished — show nothing per spec
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

  const profile    = item.profiles;
  const privMode   = profile?.privacy_mode ?? "anonymous";
  const isPublic   = privMode === "public";
  const shareUrl   = itemShareUrl(item.id);
  const shareText  = buildItemShareText(item.name, privMode, profile?.handle ?? undefined, shareUrl);

  // ── iOS Smart App Banner — shows "Open in My Digital Closet" in Safari ──
  useEffect(() => {
    if (isNative) return; // banner is irrelevant inside the native app
    let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-itunes-app"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "apple-itunes-app";
      document.head.appendChild(meta);
    }
    meta.content = smartBannerContent(shareUrl);
    return () => { meta?.remove(); };
  }, [shareUrl]);

  const meta: { label: string; value: string }[] = [
    item.brand   ? { label: "Brand",    value: item.brand   } : null,
    item.color   ? { label: "Color",    value: item.color   } : null,
    item.size    ? { label: "Size",     value: item.size    } : null,
    item.season  ? { label: "Season",   value: item.season  } : null,
    item.occasion? { label: "Occasion", value: item.occasion} : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
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

      {/* Image */}
      <div className="w-full aspect-square bg-[#f9f4ee]">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-black/10 font-black uppercase">
            {item.category[0]}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="px-4 py-5 flex flex-col gap-4">
        {/* Name + category */}
        <div>
          <h1 className="font-display font-bold text-2xl uppercase tracking-tight leading-tight">
            {item.name}
          </h1>
          <p className="text-sm text-black/40 font-bold uppercase tracking-wide mt-0.5">
            {item.category}
          </p>
        </div>

        {/* Meta chips */}
        {meta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {meta.map(({ label, value }) => (
              <span
                key={label}
                className="px-3 py-1 bg-white border-2 border-black rounded-full text-xs font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
              >
                {label}: {value}
              </span>
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
          Published {new Date(item.created_at).toLocaleDateString()}
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
