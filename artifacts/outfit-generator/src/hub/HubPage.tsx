/**
 * HubPage — main Collections hub.
 * Opens when the app launches. Tap a card to enter that module.
 */
import React from "react";
import { useLocation } from "wouter";

interface Module {
  id: string;
  emoji: string;
  label: string;
  description: string;
  accent: string;
  path: string;
}

const MODULES: Module[] = [
  {
    id: "closet",
    emoji: "👗",
    label: "Closet",
    description: "Your wardrobe & outfits",
    accent: "#f6db3a",
    path: "/closet",
  },
  {
    id: "handbags",
    emoji: "👜",
    label: "Handbags",
    description: "Bags & accessories",
    accent: "#e8d5c4",
    path: "/handbags",
  },
  {
    id: "shoes",
    emoji: "👠",
    label: "Shoes",
    description: "Your shoe collection",
    accent: "#fce4ec",
    path: "/shoes",
  },
  {
    id: "jewelry",
    emoji: "💍",
    label: "Jewelry",
    description: "Rings, necklaces & more",
    accent: "#e8eaf6",
    path: "/jewelry",
  },
  {
    id: "vanity",
    emoji: "💄",
    label: "Vanity",
    description: "Beauty & skincare",
    accent: "#f8d7da",
    path: "/vanity",
  },
  {
    id: "suitcase",
    emoji: "🧳",
    label: "Suitcase",
    description: "Pack your travel essentials",
    accent: "#d8ccbf",
    path: "/suitcase",
  },
];

export default function HubPage() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-[100dvh] w-full flex justify-center"
      style={{ background: "#FFFDF7" }}
    >
      {/* Phone frame */}
      <div className="w-full max-w-md h-[100dvh] lg:min-h-[850px] lg:h-[850px] lg:border-[6px] lg:border-black lg:rounded-[3rem] lg:shadow-2xl lg:my-8 relative overflow-hidden flex flex-col">
        {/* Header */}
        <div
          className="shrink-0 border-b-[3px] border-black px-5 pt-safe pb-4"
          style={{ background: "#f6db3a" }}
        >
          <h1
            className="font-display font-black text-2xl uppercase tracking-tight mt-2"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            My Digital Closet
          </h1>
          <p className="text-sm font-medium text-black/70 mt-0.5">
            Your complete fashion &amp; personal collection organiser
          </p>
        </div>

        {/* Module grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => navigate(mod.path)}
                className="flex flex-col items-start gap-2 p-4 rounded-2xl border-[3px] border-black text-left transition-all active:scale-95"
                style={{
                  background: mod.accent,
                  boxShadow: "4px 4px 0px 0px rgba(0,0,0,1)",
                }}
              >
                <span className="text-4xl leading-none">{mod.emoji}</span>
                <div>
                  <p
                    className="font-black text-base uppercase tracking-tight leading-tight"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {mod.label}
                  </p>
                  <p className="text-[11px] text-black/60 font-medium leading-snug mt-0.5">
                    {mod.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
