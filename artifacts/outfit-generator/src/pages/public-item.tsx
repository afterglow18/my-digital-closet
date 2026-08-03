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

import React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Share2 } from "lucide-react";
import { getSupabase, isSupabaseConfigured, type PublicItem, type Profile } from "@/lib/supabase";
import { ShareButton } from "@/components/community/ShareButton";
import { itemShareUrl } from "@/lib/share";
import { FollowButton } from "@/components/community/FollowButton";
import { cn } from "@/lib/utils";

const APP_STORE_URL = "https://apps.apple.com/app/my-digital-closet/idYOUR_APP_ID"; // TODO: replace

export default function PublicItemPage() {
  const { id }       = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: item, isLoading } = useQuery({
    queryKey: ["public-item-page", id],
    queryFn: async (): Promise<(PublicItem & { profiles?: Profile }) | null> => {
      if (!id || !isSupabaseConfigured()) return null;
      const { data } = await getSupabase()
        .from("public_items")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .eq("id", id)
        .eq("status", "active")
        .single();
      return (data as (PublicItem & { profiles?: Profile })) ?? null;
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

  const handle     = item.profiles?.handle ?? "";
  const shareUrl   = itemShareUrl(item.id);
  const shareText  = `Check out this item on My Digital Closet. ${shareUrl}`;

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

        {/* Creator */}
        {item.profiles && (
          <div className="flex items-center justify-between border-t-2 border-black/10 pt-4">
            <div>
              <p className="font-bold text-sm">
                {item.profiles.display_name ?? `@${item.profiles.handle}`}
              </p>
              <p className="text-xs text-black/40">@{item.profiles.handle}</p>
            </div>
            <FollowButton
              profileId={item.profiles.id}
              handle={item.profiles.handle}
              size="sm"
            />
          </div>
        )}

        {/* Published date */}
        <p className="text-[10px] text-black/25 font-medium">
          Published {new Date(item.created_at).toLocaleDateString()}
        </p>

        {/* App Store CTA (web fallback) */}
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
          <Share2 className="w-4 h-4" />
          Get My Digital Closet
        </a>
      </div>
    </div>
  );
}
