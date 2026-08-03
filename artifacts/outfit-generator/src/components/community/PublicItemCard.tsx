/**
 * PublicItemCard — card shown in the community feed.
 */

import React from "react";
import { Tag } from "lucide-react";
import type { PublicItem, Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface PublicItemCardProps {
  item: PublicItem & { profiles?: Profile };
  onClick?: () => void;
  className?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$",
};

export function PublicItemCard({ item, onClick, className }: PublicItemCardProps) {
  const currencySymbol = item.currency ? (CURRENCY_SYMBOLS[item.currency] ?? item.currency) : "";
  const isForSale = item.visibility === "for_sale";

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
      <div className="aspect-square w-full bg-[#f9f4ee] relative overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl text-black/10 font-bold uppercase">
            {item.category[0]}
          </div>
        )}

        {/* For Sale badge */}
        {isForSale && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-amber-400 border border-black
                          rounded-full px-2 py-0.5 text-[9px] font-bold uppercase shadow-sm">
            <Tag className="w-2.5 h-2.5" />
            {item.price != null ? `${currencySymbol}${Number(item.price).toFixed(2)}` : "For Sale"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex flex-col gap-0.5">
        <p className="font-bold text-xs truncate">{item.name}</p>
        <p className="text-[10px] text-black/40 font-medium uppercase tracking-wide">
          {item.category}
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
