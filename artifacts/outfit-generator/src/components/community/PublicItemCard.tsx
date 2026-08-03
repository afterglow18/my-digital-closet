/**
 * PublicItemCard — item card shown in the Discover feed.
 */

import React from "react";
import type { PublicItem, Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface PublicItemCardProps {
  item: PublicItem & { profiles?: Profile };
  onClick?: () => void;
  className?: string;
}

export function PublicItemCard({ item, onClick, className }: PublicItemCardProps) {
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
      {/* Image */}
      <div className="aspect-square w-full bg-[#f9f4ee] overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-black/10 font-black uppercase">
            {item.category[0]}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-0.5">
        <p className="font-bold text-xs truncate">{item.name}</p>
        <p className="text-[10px] text-black/40 font-medium uppercase tracking-wide">
          {item.category}
          {item.brand ? ` · ${item.brand}` : ""}
        </p>
        {item.profiles && (
          <p className="text-[10px] text-black/30 font-medium truncate mt-0.5">
            @{item.profiles.handle}
          </p>
        )}
      </div>
    </button>
  );
}
