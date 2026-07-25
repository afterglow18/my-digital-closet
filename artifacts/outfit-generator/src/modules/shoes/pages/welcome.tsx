/**
 * WelcomePage — shoes line themselves up on a shelf.
 *
 * IDLE     : empty shelf, title + "TAP TO ENTER" button.
 * SLIDING  : four shoes slide in from off-screen and snap into place.
 * TITLE    : "My Digital Shoes" rises in below the shelf.
 * HERO     : hero image crossfades over the scene.
 * EXITING  : screen fades out → onEnter().
 */
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "idle" | "sliding" | "hero" | "exiting";

const SLIDE_MS   = 480;
const STAGGER_MS = 130;
const SETTLE_MS  = 400;
const HERO_MS    = 700;
const EXIT_MS    = 600;

const SHOES = [
  { emoji: "👟", label: "Sneaker", dir: -1, stagger: 0 },
  { emoji: "👠", label: "Heel",    dir:  1, stagger: 1 },
  { emoji: "👢", label: "Boot",    dir: -1, stagger: 2 },
  { emoji: "🩴", label: "Sandal",  dir:  1, stagger: 3 },
];

const totalSlide = SLIDE_MS + STAGGER_MS * 3;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = useCallback(() => {
    if (phase !== "idle") return;

    const t0 = totalSlide + SETTLE_MS;
    const t1 = t0 + HERO_MS;
    const t2 = t1 + EXIT_MS;

    setPhase("sliding");
    setTimeout(() => setPhase("hero"),    t0);
    setTimeout(() => setPhase("exiting"), t1);
    setTimeout(finish,                    t2);
  }, [phase, finish]);

  const shoesOnShelf = phase !== "idle";

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#080808",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        cursor: phase === "idle" ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 70% 35% at 50% 48%, rgba(80,70,60,0.18) 0%, transparent 70%)",
      }} />

      {/* ── Hero image ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(phase === "hero" || phase === "exiting") && (
          <motion.img
            key="hero"
            src="/shoes/hero-splash.jpg"
            alt=""
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: HERO_MS / 1000, ease: "easeOut" }}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Shelf + shoes ─────────────────────────────────────────────────── */}
      <motion.div
        animate={{ opacity: (phase === "hero" || phase === "exiting") ? 0 : 1 }}
        transition={{ duration: 0.4 }}
        style={{
          position: "absolute",
          top: "34%",
          left: 0, right: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        {/* Shoe row */}
        <div style={{
          display: "flex", flexDirection: "row",
          alignItems: "flex-end", justifyContent: "center",
          gap: "clamp(18px, 6vw, 36px)",
          paddingBottom: 10,
          width: "100%",
          overflow: "hidden",
        }}>
          {SHOES.map((shoe) => (
            <motion.div
              key={shoe.label}
              initial={{ x: shoe.dir * 500, opacity: 0 }}
              animate={shoesOnShelf ? { x: 0, opacity: 1 } : { x: shoe.dir * 500, opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
                delay: shoe.stagger * (STAGGER_MS / 1000),
              }}
              style={{
                fontSize: "clamp(44px, 11vw, 64px)",
                lineHeight: 1,
                filter: "brightness(0) invert(1) drop-shadow(0 6px 12px rgba(255,255,255,0.15))",
              }}
            >
              {shoe.emoji}
            </motion.div>
          ))}
        </div>

        {/* Shelf plank */}
        <div style={{
          width: "clamp(260px, 72vw, 380px)",
          height: 10,
          borderRadius: "5px 5px 3px 3px",
          background: "linear-gradient(to bottom, #ffffff, #e0e0e0)",
          boxShadow: "0 0 18px 4px rgba(255,255,255,0.55), 0 1px 0 rgba(255,255,255,0.9) inset",
        }} />
        {/* Glow underneath */}
        <div style={{
          width: "clamp(200px, 60vw, 320px)",
          height: 14,
          borderRadius: "0 0 50% 50%",
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.45) 0%, transparent 70%)",
          filter: "blur(6px)",
          marginTop: 2,
        }} />
      </motion.div>


      {/* ── Idle state ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "idle" && (
          <motion.div
            key="idle-ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.9 }}
            style={{
              position: "absolute", top: "58%",
              left: 0, right: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 26,
              zIndex: 20, pointerEvents: "none",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontFamily: "'Great Vibes', cursive",
                fontSize: "clamp(26px, 8vw, 36px)",
                color: "rgba(255,255,255,0.80)",
                textShadow: "0 2px 10px rgba(0,0,0,0.80)",
                lineHeight: 1.3,
              }}>Welcome to</div>
              <div style={{
                fontFamily: "'Great Vibes', cursive",
                fontSize: "clamp(40px, 12vw, 56px)",
                color: "#f5f0e8",
                textShadow: "0 0 32px rgba(255,240,200,0.18), 0 2px 10px rgba(0,0,0,0.95)",
                lineHeight: 1.2,
              }}>My Digital Shoes</div>
            </div>

            <motion.button
              animate={{ opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              onClick={handleTap}
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.22em",
                textTransform: "uppercase", color: "#fff",
                background: "rgba(255,255,255,0.15)",
                border: "1.5px solid rgba(255,255,255,0.55)",
                borderRadius: 40,
                padding: "10px 28px",
                cursor: "pointer",
                backdropFilter: "blur(4px)",
                pointerEvents: "auto",
              }}
            >
              TAP TO ENTER
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer links ───────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
        pointerEvents: "none",
      }}>
        <a href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.18)", textDecoration: "none", letterSpacing: "0.02em", pointerEvents: "auto" }}>
          Privacy Policy
        </a>
        <a href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.18)", textDecoration: "none", letterSpacing: "0.02em", pointerEvents: "auto" }}>
          Support
        </a>
      </div>
    </motion.div>
  );
}
