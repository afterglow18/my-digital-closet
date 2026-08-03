/**
 * VisibilityPicker — inline 3-option toggle for item visibility.
 *
 * 🔒 Private  — stays on device, never shared
 * 🌍 Public   — visible on community feed and public profile
 * 🏷 For Sale — same as Public + shows price badge
 *
 * When a non-private option is chosen without being signed in,
 * calls onNeedSignIn() so the parent can open AuthSheet.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Lock, Globe, Tag } from "lucide-react";

export type Visibility = "private" | "public" | "for_sale";

interface VisibilityOption {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OPTIONS: VisibilityOption[] = [
  {
    value: "private",
    label: "Private",
    description: "Only on your device",
    icon: Lock,
  },
  {
    value: "public",
    label: "Public",
    description: "Visible on your profile",
    icon: Globe,
  },
  {
    value: "for_sale",
    label: "For Sale",
    description: "Listed for sale",
    icon: Tag,
  },
];

interface VisibilityPickerProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** Called when user picks a non-private option while not signed in */
  onNeedSignIn?: () => void;
  isSignedIn?: boolean;
  disabled?: boolean;
  className?: string;
}

export function VisibilityPicker({
  value,
  onChange,
  onNeedSignIn,
  isSignedIn = false,
  disabled = false,
  className,
}: VisibilityPickerProps) {
  const handleSelect = (opt: Visibility) => {
    if (disabled) return;
    if (opt !== "private" && !isSignedIn) {
      onNeedSignIn?.();
      return;
    }
    onChange(opt);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        Sharing
      </span>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 transition-all",
                "font-bold text-[10px] uppercase tracking-wide",
                "active:scale-95 disabled:opacity-40",
                isActive
                  ? opt.value === "for_sale"
                    ? "border-black bg-amber-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : opt.value === "public"
                      ? "border-black bg-green-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "border-black bg-[#f9f4ee] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  : "border-black/20 bg-white hover:border-black/40",
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4",
                  isActive ? "text-black" : "text-black/40",
                )}
              />
              <span className={isActive ? "text-black" : "text-black/40"}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Description of current selection */}
      <p className="text-[11px] text-black/40 font-medium pl-0.5">
        {OPTIONS.find((o) => o.value === value)?.description}
      </p>
    </div>
  );
}

/** Small badge shown on item cards to indicate visibility */
export function VisibilityBadge({ visibility }: { visibility?: Visibility }) {
  if (!visibility || visibility === "private") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border",
        visibility === "public"
          ? "bg-green-100 border-green-400 text-green-800"
          : "bg-amber-100 border-amber-400 text-amber-800",
      )}
    >
      {visibility === "public" ? <Globe className="w-2.5 h-2.5" /> : <Tag className="w-2.5 h-2.5" />}
      {visibility === "public" ? "Public" : "For Sale"}
    </span>
  );
}
