/**
 * PublicOutfitCard — outfit card for the Discover feed.
 * Shows a text-based item list since V1 has no outfit cover image.
 */

import React from "react";
import { Shirt } from "lucide-react";
import type { PublicOutfit, Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface PublicOutfitCardProps {
  outfit: PublicOutfit & { profiles?: Profile };
  onClick?: () => void;
  className?: string;
}

export function PublicOutfitCard({ outfit, onClick, className }: PublicOutfitCardProps) {
  const items = outfit.item_names ?? [];

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col bg-white rounded-2xl border-2 border-black overflow-hidden",
        "shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-0.5 active:translate-y-0.5",
        "transition-all text-left",
        className,
      )}
    >
      {/* Placeholder preview */}
      <div className="aspect-square w-full bg-primary/50 flex flex-col items-center justify-center gap-2 px-3">
        <Shirt className="w-8 h-8 text-black/30" />
        {items.length > 0 && (
          <div className="flex flex-col gap-0.5 w-full">
            {items.slice(0, 3).map((name, i) => (
              <p
                key={i}
                className="text-[9px] font-bold uppercase tracking-wide text-black/50 truncate text-center"
              >
                {name}
              </p>
            ))}
            {items.length > 3 && (
              <p className="text-[9px] text-black/30 text-center">+{items.length - 3} more</p>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-0.5">
        <p className="font-bold text-xs truncate">
          {outfit.name || "Untitled Look"}
        </p>
        <p className="text-[10px] text-black/40 font-medium">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </p>
        {outfit.profiles && (
          <p className="text-[10px] text-black/30 font-medium truncate mt-0.5">
            @{outfit.profiles.handle}
          </p>
        )}
      </div>
    </button>
  );
}
