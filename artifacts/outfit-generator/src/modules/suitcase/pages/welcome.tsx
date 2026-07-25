/**
 * WelcomePage — shown only on first launch (before onEnter is called).
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WelcomePageProps {
  onEnter: () => void;
}

const SLIDES = [
  {
    emoji: "🧳",
    title: "My Digital\nSuitcase",
    body: "Pack smarter. Never forget anything again.",
  },
  {
    emoji: "📸",
    title: "Snap &\nOrganise",
    body: "Photo every item you plan to bring — outfits, beauty, toiletries and essentials.",
  },
  {
    emoji: "✨",
    title: "AI Outfit\nMagic",
    body: "Our AI mixes & matches your items to create the perfect travel looks.",
  },
  {
    emoji: "💾",
    title: "Save Your\nLooks",
    body: "Build a lookbook of your best cases and re-use them for every trip.",
  },
];

export default function WelcomePage({ onEnter }: WelcomePageProps) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;

  const { emoji, title, body } = SLIDES[slide];

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col items-center justify-between px-6 pb-10 bg-[#F9F4EE]"
      style={{ paddingTop: "max(4rem, env(safe-area-inset-top))" }}
    >
      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.32, ease: "easeInOut" }}
            className="flex flex-col items-center gap-5 w-full"
          >
            {/* Emoji circle */}
            <div
              className="w-28 h-28 rounded-full border-4 border-black flex items-center justify-center bg-primary shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]"
            >
              <span className="text-5xl leading-none">{emoji}</span>
            </div>

            <div>
              <h1 className="font-display font-bold text-4xl uppercase tracking-tighter leading-none whitespace-pre-line">
                {title}
              </h1>
              <p className="mt-3 text-base font-medium text-black/60 leading-snug max-w-xs mx-auto">
                {body}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex gap-2 mb-6">
        {SLIDES.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full border-2 border-black transition-all ${
              i === slide ? "bg-black scale-125" : "bg-white"
            }`}
          />
        ))}
      </div>

      {/* CTA */}
      {isLast ? (
        <button
          onClick={onEnter}
          className="w-full py-4 rounded-2xl border-4 border-black bg-primary font-display font-bold text-xl uppercase tracking-tight shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all"
        >
          Let's Pack! 🧳
        </button>
      ) : (
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => setSlide((s) => s + 1)}
            className="w-full py-4 rounded-2xl border-4 border-black bg-primary font-display font-bold text-xl uppercase tracking-tight shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-1.5 active:translate-y-1.5 active:shadow-none transition-all"
          >
            Next →
          </button>
          <button
            onClick={onEnter}
            className="text-sm font-medium text-black/40 underline underline-offset-2"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
