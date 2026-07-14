/**
 * SplashScreen — shown on every app launch.
 * Yellow doors with app branding, Enter Closet CTA, and legal links.
 */
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onEnter: () => void;
}

export default function SplashScreen({ onEnter }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
        style={{ background: "#F0C030" }}
      >
        {/* Closet background — doors visible */}
        <div className="flex-1 relative">
          <img
            src="/closet-bg.png"
            alt="My Digital Closet"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Dark gradient overlay at bottom for text legibility */}
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: "55%",
              background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.72))",
            }}
          />

          {/* Branding + CTA */}
          <div
            className="absolute inset-x-0 bottom-0 flex flex-col items-center px-8 pb-12 gap-5"
            style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
          >
            {/* App name */}
            <div className="text-center">
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">
                Welcome to
              </p>
              <h1
                className="font-display font-black uppercase text-white leading-none"
                style={{ fontSize: "clamp(2rem, 9vw, 3rem)", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                My Digital<br />Closet
              </h1>
            </div>

            {/* Enter button */}
            <motion.button
              onClick={onEnter}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl border-2 border-black font-display font-black
                         uppercase tracking-tight text-black text-lg
                         shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              style={{ background: "#F0C030" }}
            >
              Enter Closet ✨
            </motion.button>

            {/* Legal links */}
            <div className="flex items-center gap-4">
              <a
                href="https://mydigitalcloset.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 text-xs font-medium"
              >
                Privacy Policy
              </a>
              <span className="text-white/30 text-xs">•</span>
              <a
                href="https://mydigitalcloset.app/support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 text-xs font-medium"
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
