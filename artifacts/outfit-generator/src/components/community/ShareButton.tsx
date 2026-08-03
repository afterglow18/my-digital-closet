/**
 * ShareButton — triggers the native iOS share sheet (or web fallback).
 *
 * variant="pill"  → icon + label (default)
 * variant="icon"  → icon-only circle, compact placement
 */

import React from "react";
import { Share2 } from "lucide-react";
import { shareContent } from "@/lib/share";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  text: string;
  title?: string;
  label?: string;
  variant?: "pill" | "icon";
  size?: "sm" | "default";
  className?: string;
}

export function ShareButton({
  url,
  text,
  title,
  label = "Share",
  variant = "pill",
  size = "default",
  className,
}: ShareButtonProps) {
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await shareContent(url, text, title);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        aria-label="Share"
        className={cn(
          "flex items-center justify-center rounded-full border-2 border-black bg-white",
          "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all",
          size === "sm" ? "w-8 h-8" : "w-9 h-9",
          className,
        )}
      >
        <Share2 className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={cn(
        "flex items-center gap-1.5 border-2 border-black rounded-full font-bold",
        "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        "active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all",
        size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-sm",
        "bg-white text-black",
        className,
      )}
    >
      <Share2 className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {label}
    </button>
  );
}
