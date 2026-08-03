/**
 * VisibilityPicker — two-option toggle for item/outfit visibility.
 *
 * V1 options:
 *   🔒 Private  — stays on device only, never leaves the app
 *   🌍 Public   — visible on the Discover feed and your public profile
 *
 * When the user picks Public while not signed in, calls onNeedSignIn()
 * so the parent can open AuthSheet.
 */

import React from "react";
import { Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type Visibility = "private" | "public";

interface Option {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}

const OPTIONS: Option[] = [
  {
    value: "private",
    label: "Private",
    description: "Only on your device — never uploaded",
    icon: Lock,
    activeClass: "bg-[#f9f4ee] border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
  },
  {
    value: "public",
    label: "Public",
    description: "Visible on Discover and your profile",
    icon: Globe,
    activeClass: "bg-green-100 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
  },
];

interface VisibilityPickerProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
  /** Called when user picks Public while not signed in */
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
    if (opt === "public" && !isSignedIn) {
      onNeedSignIn?.();
      return;
    }
    onChange(opt);
  };

  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        Sharing
      </span>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          const Icon     = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all",
                "font-bold text-[10px] uppercase tracking-wide active:scale-95 disabled:opacity-40",
                isActive ? opt.activeClass : "border-black/20 bg-white hover:border-black/40",
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-black" : "text-black/35")} />
              <span className={isActive ? "text-black" : "text-black/35"}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-black/40 font-medium pl-0.5">{current.description}</p>
    </div>
  );
}

/** Small badge used on item cards */
export function VisibilityBadge({ visibility }: { visibility?: Visibility }) {
  if (!visibility || visibility === "private") return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px]
                     font-bold uppercase bg-green-100 border border-green-400 text-green-800">
      <Globe className="w-2.5 h-2.5" />
      Public
    </span>
  );
}
