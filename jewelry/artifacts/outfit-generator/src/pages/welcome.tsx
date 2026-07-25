/**
 * WelcomePage — Jewelry box opening animation.
 *
 * CLOSED : deep plum box face with gold trim and a clasp.
 * OPENING: 3-D lid swings open (rotateX around the top hinge).
 * OPEN   : jewelry box interior image fully revealed.
 * EXITING: fade out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "closed" | "opening" | "open" | "exiting";

// Total timing (ms)
const OPEN_DURATION_MS  = 2200;  // lid swing (slow, physical feel)
const HERO_FADE_IN_MS   = 1800;  // hero fades in during the lid swing
const HOLD_AFTER_MS     = 200;   // brief pause once lid is fully open
const EXIT_DURATION_MS  = 700;   // whole-screen fade-out → jewelry page

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase,     setPhase]     = useState<Phase>("closed");
  const [heroReady, setHeroReady] = useState(false); // triggers hero fade-in
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleOpen = () => {
    if (phase !== "closed") return;
    setPhase("opening");

    // Hero fades in immediately as the lid swings — both happen together.
    setHeroReady(true);

    const afterOpen = OPEN_DURATION_MS + HOLD_AFTER_MS;
    const afterExit = afterOpen + EXIT_DURATION_MS;

    setTimeout(() => setPhase("open"),    OPEN_DURATION_MS);
    setTimeout(() => setPhase("exiting"), afterOpen);
    setTimeout(finish,                    afterExit);
  };

  const isExiting = phase === "exiting";

  return (
    <motion.div
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: EXIT_DURATION_MS / 1000, ease: "easeIn" }}
      onClick={phase === "closed" ? handleOpen : undefined}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#160520",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: phase === "closed" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient background glow ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(100,30,140,0.45) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Box container with 3-D perspective ── */}
      <div
        style={{
          position: "relative",
          width: "min(92vw, 400px)",
          /* match image aspect ratio ~0.78 */
          height: "min(118vw, 512px)",
          perspective: "600px",
          perspectiveOrigin: "50% 0%",
        }}
      >
        {/* ── Interior layers (always present behind the lid) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 22,
            overflow: "hidden",
            boxShadow: "0 8px 60px rgba(80,0,120,0.7), 0 0 0 2px rgba(212,175,55,0.5)",
          }}
        >
          {/* Hero photo — fades IN once lid is fully open, then whole screen fades out */}
          <img
            src="/jewelry-box-open.jpg"
            alt="Jewelry box interior"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              display: "block",
              userSelect: "none",
              opacity: heroReady ? 1 : 0,
              transition: `opacity ${HERO_FADE_IN_MS}ms ease-out`,
            }}
          />
        </div>

        {/* ── Lid (rotates open around top hinge) ── */}
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            /* Lid covers full box face when closed */
            height: "100%",
            transformOrigin: "top center",
            borderRadius: 22,
            overflow: "hidden",
            zIndex: 10,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          animate={{
            rotateX: phase === "closed" ? 0 : -105,
          }}
          transition={{
            duration: OPEN_DURATION_MS / 1000,
            ease: [0.4, 0.0, 0.2, 1], // slow start → accelerates → settles open
          }}
        >
          {/* Lid face — plum velvet with gold trim */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(160deg, #3a0d52 0%, #220838 45%, #160420 100%)",
              borderRadius: 22,
              border: "2px solid rgba(212,175,55,0.6)",
              boxShadow:
                "inset 0 0 40px rgba(80,0,110,0.5), 0 12px 50px rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {/* Gold corner accents */}
            {[
              { top: 10, left: 10, borderTop: "2px solid", borderLeft: "2px solid" },
              { top: 10, right: 10, borderTop: "2px solid", borderRight: "2px solid" },
              { bottom: 10, left: 10, borderBottom: "2px solid", borderLeft: "2px solid" },
              { bottom: 10, right: 10, borderBottom: "2px solid", borderRight: "2px solid" },
            ].map((style, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 22,
                  height: 22,
                  borderColor: "rgba(212,175,55,0.7)",
                  ...style,
                }}
              />
            ))}

            {/* Lid inner border */}
            <div
              style={{
                position: "absolute",
                inset: 18,
                borderRadius: 14,
                border: "1px solid rgba(212,175,55,0.2)",
                pointerEvents: "none",
              }}
            />

            {/* Logo + App name */}
            <div
              style={{
                textAlign: "center",
                padding: "0 32px",
                zIndex: 2,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              {/* Ring icon logo */}
              <div style={{
                width: "clamp(72px, 20vw, 96px)",
                height: "clamp(72px, 20vw, 96px)",
                borderRadius: 20,
                overflow: "hidden",
                boxShadow: "0 4px 20px rgba(0,0,0,0.6), 0 0 0 2px rgba(212,175,55,0.5)",
              }}>
                <img
                  src="/app-icon.jpg"
                  alt="My Digital Jewelry Box"
                  draggable={false}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              <div
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontWeight: 700,
                  fontSize: "clamp(20px, 6vw, 28px)",
                  letterSpacing: "0.06em",
                  color: "#f0d080",
                  textShadow:
                    "0 0 30px rgba(212,175,55,0.5), 0 2px 8px rgba(0,0,0,0.8)",
                  lineHeight: 1.2,
                }}
              >
                MY DIGITAL
                <br />
                JEWELRY BOX
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "rgba(212,175,55,0.5)",
                }}
              >
                your collection, curated
              </div>
            </div>

            {/* Clasp / latch */}
            <div
              style={{
                position: "absolute",
                bottom: 28,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                zIndex: 2,
              }}
            >
              {/* Clasp body */}
              <div
                style={{
                  width: 42,
                  height: 16,
                  borderRadius: 8,
                  background:
                    "linear-gradient(180deg, #d4af37 0%, #a07820 50%, #d4af37 100%)",
                  boxShadow:
                    "0 2px 8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,240,160,0.5)",
                  border: "1px solid rgba(180,140,20,0.8)",
                }}
              />
              {/* Tap hint */}
              <AnimatePresence>
                {phase === "closed" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "rgba(212,175,55,0.55)",
                      marginTop: 4,
                    }}
                  >
                    tap to open
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Subtle shimmer line across lid */}
            <motion.div
              style={{
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "60%",
                height: "100%",
                background:
                  "linear-gradient(105deg, transparent 30%, rgba(255,240,180,0.07) 50%, transparent 70%)",
                pointerEvents: "none",
                zIndex: 3,
              }}
              animate={{ left: ["−100%", "160%"] }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: "linear",
              }}
            />
          </div>

          {/* Lid underside — dark velvet seen as lid swings up */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 22,
              background:
                "linear-gradient(180deg, #0e0318 0%, #1a062a 100%)",
              transform: "rotateX(180deg)",
              backfaceVisibility: "visible",
            }}
          />
        </motion.div>
      </div>

      {/* ── Footer links ── */}
      <div
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom) + 10px)",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          zIndex: 210,
        }}
      >
        <a
          href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Privacy Policy
        </a>
        <a
          href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.25)",
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          Support
        </a>
      </div>
    </motion.div>
  );
}
