/**
 * PremiumSheet — mannequin-page paywall, no scrolling.
 * All sections use flex proportional sizing so the layout fills any device height.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEntitlements, PurchaseResult } from "@/hooks/useEntitlements";
import type { PurchaseProduct } from "@/lib/entitlements";

interface Props { onClose: () => void; }

const FEATURES = [
  "Unlimited clothing items",
  "Unlimited outfits",
  "Save your entire wardrobe",
  "360° Mannequin outfit view",
  "Choose monthly, yearly or lifetime!",
] as const;

const PLAID = `
  repeating-linear-gradient(45deg,  transparent, transparent 14px, rgba(180,130,0,0.22) 14px, rgba(180,130,0,0.22) 28px),
  repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(255,255,255,0.12) 14px, rgba(255,255,255,0.12) 28px),
  #F0C030
`;

function HangerIcon() {
  return (
    <svg width="48" height="42" viewBox="0 0 60 52" fill="none"
         stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 18 C30 11 38 9 38 15 C38 19 34 19 30 18" />
      <line x1="30" y1="18" x2="30" y2="22" />
      <path d="M30 22 C25 27 12 36 4 46" />
      <path d="M30 22 C35 27 48 36 56 46" />
      <line x1="4" y1="46" x2="56" y2="46" />
    </svg>
  );
}

function GoldCheck() {
  return (
    <span className="flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 20, height: 20, background: "#F0C030" }}>
      <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
        <path d="M1 4.5L4 7.5L10 1" stroke="#0a0a0a" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type Plan = PurchaseProduct;
interface PlanCard {
  id: Plan; label: string; price: string; period: string;
  bullets: { text: string; accent?: boolean }[];
  bestValue?: boolean; cta: string;
}

const PLANS: PlanCard[] = [
  {
    id: "monthly", label: "MONTHLY", price: "$1.99", period: "/month",
    bullets: [{ text: "Cancel anytime" }, { text: "Billed monthly" }],
    cta: "START MONTHLY – $1.99",
  },
  {
    id: "annual", label: "YEARLY", price: "$19.99", period: "/year",
    bullets: [{ text: "Save 17%", accent: true }, { text: "Billed yearly" }],
    cta: "START YEARLY – $19.99",
  },
  {
    id: "lifetime", label: "LIFETIME", price: "$9.99", period: "one-time",
    bullets: [{ text: "Pay once" }, { text: "Yours forever" }],
    bestValue: true, cta: "UNLOCK FOREVER – $9.99",
  },
];

export function PremiumSheet({ onClose }: Props) {
  const { purchase } = useEntitlements();
  const [status, setStatus] = useState<"idle" | "pending">("idle");
  const [plan, setPlan]     = useState<Plan>("lifetime");
  const activePlan = PLANS.find((p) => p.id === plan)!;

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");
    const result: PurchaseResult = await purchase(plan);
    if (result === "success") onClose(); else setStatus("idle");
  }, [status, purchase, plan, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#F8F4ED" }}
    >
      {/* ── Plaid header ── */}
      <div className="flex-shrink-0 relative flex items-center justify-center"
           style={{
             paddingTop: "max(18px, env(safe-area-inset-top))",
             paddingBottom: 12,
             background: PLAID,
           }}>
        <HangerIcon />
        <button onClick={onClose}
                className="absolute top-0 right-4 w-8 h-8 rounded-full bg-white/90
                           flex items-center justify-center shadow active:opacity-70 transition-opacity"
                style={{ marginTop: "max(10px, calc(env(safe-area-inset-top) - 4px))" }}>
          <X className="w-3.5 h-3.5 text-black" />
        </button>
      </div>

      {/* ── Body — flex column, NO scroll ── */}
      <div className="flex-1 min-h-0 flex flex-col px-4 pt-3 pb-1 gap-2">

        {/* Headline */}
        <div className="flex-shrink-0">
          <h1 className="font-display font-black uppercase leading-none tracking-tight"
              style={{ fontSize: "clamp(1.55rem, 7.5vw, 2.1rem)", color: "#0a0a0a" }}>
            Unlock Your Unlimited<br />Digital Closet
          </h1>
          <p className="text-xs text-black/45 font-semibold mt-1">
            A premium feature — unlock it once.
          </p>
        </div>

        {/* Dark features card — grows to fill remaining space */}
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
             style={{ background: "#0a0a0a" }}>
          <div className="px-4 pt-3 pb-2 flex-shrink-0">
            <p className="font-bold text-[10px] tracking-widest uppercase"
               style={{ color: "#F0C030" }}>
              Upgrade to Premium &amp; Get:
            </p>
          </div>
          <div className="flex-shrink-0" style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />

          <ul className="flex-1 flex flex-col justify-evenly px-4 py-1">
            {FEATURES.map((text, i) => (
              <React.Fragment key={text}>
                <li className="flex items-center gap-3 py-0.5">
                  <GoldCheck />
                  <span className="text-white font-semibold text-[13px] leading-snug">{text}</span>
                </li>
                {i < FEATURES.length - 1 && (
                  <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginLeft: 32 }} />
                )}
              </React.Fragment>
            ))}
          </ul>
        </div>

        {/* Plan label */}
        <p className="flex-shrink-0 text-center text-[10px] font-black tracking-widest uppercase text-black/45">
          Choose Your Plan
        </p>

        {/* Plan cards */}
        <div className="flex-shrink-0 flex gap-2">
          {PLANS.map((p) => {
            const selected   = plan === p.id;
            const isLifetime = p.id === "lifetime";
            return (
              <button key={p.id} onClick={() => setPlan(p.id)}
                      className="flex-1 rounded-xl flex flex-col relative overflow-hidden text-left transition-all"
                      style={{
                        background:  isLifetime ? "#F0C030" : "#fff",
                        border:      `2px solid ${selected ? "#0a0a0a" : "rgba(0,0,0,0.12)"}`,
                        boxShadow:   selected ? "3px 3px 0 rgba(0,0,0,0.85)" : "none",
                        padding:     "8px 7px 8px",
                      }}>
                {p.bestValue && (
                  <span className="absolute top-0 right-0 font-black text-white text-[7px]
                                   uppercase tracking-tight leading-tight px-1.5 py-1
                                   rounded-bl-xl rounded-tr-xl"
                        style={{ background: "#E0345A" }}>
                    BEST ★{"\n"}VALUE
                  </span>
                )}
                <span className="font-black text-[8px] tracking-widest uppercase block mb-0.5"
                      style={{ color: isLifetime ? "#0a0a0a" : "rgba(0,0,0,0.4)" }}>
                  {p.label}
                </span>
                <span className="font-black leading-none block"
                      style={{ fontSize: "clamp(1.15rem, 5.5vw, 1.4rem)", color: "#0a0a0a" }}>
                  {p.price}
                </span>
                <span className="text-[9px] font-semibold block mb-1.5"
                      style={{ color: isLifetime ? "#0a0a0a" : "rgba(0,0,0,0.4)" }}>
                  {p.period}
                </span>
                <div className="flex flex-col gap-0.5">
                  {p.bullets.map((b) => (
                    <div key={b.text} className="flex items-center gap-1">
                      <span className="flex-shrink-0 rounded-full flex items-center justify-center"
                            style={{ width: 12, height: 12,
                                     background: isLifetime ? "rgba(0,0,0,0.18)" : "#F0C030" }}>
                        <svg width="6" height="5" viewBox="0 0 7 6" fill="none">
                          <path d="M1 3L2.8 5L6 1"
                                stroke={isLifetime ? "#fff" : "#0a0a0a"}
                                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="text-[8px] font-bold leading-tight"
                            style={{ color: b.accent ? "#D07010" : (isLifetime ? "#0a0a0a" : "rgba(0,0,0,0.5)") }}>
                        {b.text}
                      </span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

      </div>

      {/* ── CTA footer ── */}
      <div className="flex-shrink-0 px-4 pt-2 flex flex-col gap-1.5"
           style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <button onClick={handlePurchase} disabled={status === "pending"}
                className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-tight
                           border-4 border-black text-black flex items-center justify-center gap-2
                           active:translate-x-0.5 active:translate-y-0.5 transition-all
                           disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background:  "#F0C030",
                  boxShadow:   status === "pending" ? "none" : "4px 4px 0px rgba(0,0,0,1)",
                  letterSpacing: "0.03em",
                }}>
          {status === "pending" ? "Opening checkout…" : activePlan.cta}
          {status !== "pending" && <span className="text-lg leading-none">›</span>}
        </button>
        <button onClick={onClose}
                className="text-xs font-bold text-black/35 text-center underline underline-offset-2
                           hover:text-black/55 transition-colors py-0.5">
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
