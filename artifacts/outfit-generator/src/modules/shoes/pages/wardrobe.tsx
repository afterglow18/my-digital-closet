/**
 * WardrobePage — vanity-bg.png (1024×1536 PNG)
 * Local-first: data comes from IndexedDB via useListClothing / useSaveOutfit.
 */

import React, {
  useEffect, useRef, useState,
  useCallback, RefObject,
} from "react";
import { useLocation } from "wouter";
import {
  useListClothing, getListClothingQueryKey,
} from "../hooks/useLocalWardrobe";
import {
  useListOutfits, useSaveOutfit, getListOutfitsQueryKey,
} from "../hooks/useLocalOutfits";
import type { ClothingItem } from "@/types/local";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoesRow, ShoesRowHandle } from "../components/ShoesRow";
import { QuickAddSheet } from "../components/clothing/QuickAddSheet";
import { ItemDetailsSheet } from "../components/clothing/ItemDetailsSheet";
import { UpgradeSheet, UpgradeReason } from "@/components/paywall/UpgradeSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FREE_ITEM_LIMIT } from "@/types/local";

// ── Types ─────────────────────────────────────────────────────────────────────
type RowKey   = "heels" | "sneakers" | "boots" | "sandals-flats";
type Category = "heels" | "sneakers" | "boots" | "sandals-flats";

const ROWS: { key: RowKey; btnLabel: string }[] = [
  { key: "heels",         btnLabel: "+ ADD HEELS"          },
  { key: "sneakers",      btnLabel: "+ ADD SNEAKERS"        },
  { key: "boots",         btnLabel: "+ ADD BOOTS"           },
  { key: "sandals-flats", btnLabel: "+ ADD SANDALS + FLATS" },
];

// ── Image constants ───────────────────────────────────────────────────────────
const IMG_W = 1086;
const IMG_H = 1448;
const NAV_H = 90;

// Fraction of image height reserved at the top of every section for the heading.
const LABEL_FRAC = 0.042;

// Layout markers calibrated for handbag-bg.png (1086×1448).
// All four sections are ~16-18% tall so photos render at the same size.
// Row 1 → LED + velvet roll; Rows 2-4 → the three open shelf bays.
const LM = {
  doorL: 0.12,
  doorR: 0.88,
  rows: [
    { sectionTop: 0.07, shelfY: 0.24 },
    { sectionTop: 0.24, shelfY: 0.42 },
    { sectionTop: 0.437, shelfY: 0.617 },
    { sectionTop: 0.675, shelfY: 0.855 },
  ],
  saveAreaY: 0.85,
} as const;

// ── useImageRect ─────────────────────────────────────────────────────────────
interface ImgRect {
  top: number; left: number; width: number; height: number;
  containerH: number; containerW: number;
}

function useImageRect(containerRef: RefObject<HTMLDivElement>): ImgRect {
  const [rect, setRect] = useState<ImgRect>({ top: 0, left: 0, width: 0, height: 0, containerH: 0, containerW: 0 });
  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;
      const cW = c.clientWidth, cH = c.clientHeight;
      // Cover: scale to fill. rL may be negative — used only for UI positioning.
      // The image itself uses left:50%+translateX(-50%) so iOS clips both sides.
      const scale = Math.max(cW / IMG_W, cH / IMG_H);
      const rW = IMG_W * scale, rH = IMG_H * scale;
      const rL = (cW - rW) / 2, rT = (cH - rH) / 2;
      setRect({ top: rT, left: rL, width: rW, height: rH, containerH: cH, containerW: cW });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [containerRef]);
  return rect;
}

const pH = (ir: ImgRect, f: number) => ir.height * f;
const pW = (ir: ImgRect, f: number) => ir.width  * f;
const pX = (ir: ImgRect, f: number) => ir.left   + ir.width  * f;
const pY = (ir: ImgRect, f: number) => ir.top    + ir.height * f;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const ir = useImageRect(containerRef);

  const rowRefs: Record<RowKey, RefObject<ShoesRowHandle | null>> = {
    "heels":              useRef<ShoesRowHandle | null>(null),
    "sneakers":      useRef<ShoesRowHandle | null>(null),
    "boots":     useRef<ShoesRowHandle | null>(null),
    "sandals-flats": useRef<ShoesRowHandle | null>(null),
  };

  const [centred,       setCentred]       = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [addCategory,   setAddCategory]   = useState<Category | null>(null);
  const [detailsItem,   setDetailsItem]   = useState<ClothingItem | null>(null);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [isSaveOpen,    setIsSaveOpen]    = useState(false);
  const [saveName,      setSaveName]      = useState("");
  const [saveSuccess,   setSaveSuccess]   = useState(false);

  const saveOutfit = useSaveOutfit();

  const { data: totes            = [] } = useListClothing({ category: "heels"              }, { query: { queryKey: getListClothingQueryKey({ category: "heels"              }) } });
  const { data: shoulderBags     = [] } = useListClothing({ category: "sneakers"      }, { query: { queryKey: getListClothingQueryKey({ category: "sneakers"      }) } });
  const { data: crossbodyBags    = [] } = useListClothing({ category: "boots"     }, { query: { queryKey: getListClothingQueryKey({ category: "boots"     }) } });
  const { data: clutchesWristlets = [] } = useListClothing({ category: "sandals-flats" }, { query: { queryKey: getListClothingQueryKey({ category: "sandals-flats" }) } });
  const { data: outfits = [] } = useListOutfits();

  const rowData: Record<RowKey, ClothingItem[]> = {
    "heels":              totes,
    "sneakers":      shoulderBags,
    "boots":     crossbodyBags,
    "sandals-flats": clutchesWristlets,
  };
  const totalItems = totes.length + shoulderBags.length + crossbodyBags.length + clutchesWristlets.length;

  const queryClient = useQueryClient();
  const { tier, canAddItem } = useEntitlements();

  useEffect(() => {
    setCentred(prev => {
      const next = { ...prev };
      let changed = false;
      (["heels", "sneakers", "boots", "sandals-flats"] as RowKey[]).forEach(key => {
        if (rowData[key].length === 0 && next[key] !== undefined) {
          delete next[key]; changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [totes.length, shoulderBags.length, crossbodyBags.length, clutchesWristlets.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCentredHandlers: Record<RowKey, (item: ClothingItem | null) => void> = {
    "heels":              useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "heels":              item ?? undefined })), []),
    "sneakers":      useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "sneakers":      item ?? undefined })), []),
    "boots":     useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "boots":     item ?? undefined })), []),
    "sandals-flats": useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "sandals-flats": item ?? undefined })), []),
  };

  const handleAddClick = useCallback((cat: Category) => {
    if (canAddItem(totalItems)) setAddCategory(cat); else setUpgradeReason("items");
  }, [canAddItem, totalItems]);

  const addHandlers: Record<RowKey, () => void> = {
    "heels":              useCallback(() => handleAddClick("heels"),              [handleAddClick]),
    "sneakers":      useCallback(() => handleAddClick("sneakers"),      [handleAddClick]),
    "boots":     useCallback(() => handleAddClick("boots"),     [handleAddClick]),
    "sandals-flats": useCallback(() => handleAddClick("sandals-flats"), [handleAddClick]),
  };

  const handleItemTap = useCallback((item: ClothingItem) => setDetailsItem(item), []);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const itemIds = Object.values(centred)
      .filter((i): i is ClothingItem => i != null)
      .map(i => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          setSaveSuccess(true);
          setTimeout(() => { setIsSaveOpen(false); setSaveSuccess(false); setSaveName(""); }, 1400);
        },
      },
    );
  };

  const [, navigate] = useLocation();
  const isFree    = tier === "free";
  const itemsLeft = isFree ? Math.max(0, FREE_ITEM_LIMIT - totalItems) : null;
  const ready     = ir.width > 0;

  // Consistent photo height = smallest section minus the heading strip.
  const labelH          = ready ? pH(ir, LABEL_FRAC) : 0;
  const minSecH         = ready ? Math.min(...LM.rows.map(lm => pH(ir, lm.shelfY - lm.sectionTop))) : 0;
  const consistentPhotoH = Math.max(0, minSecH - labelH);
  // Use container-relative insets so the carousel always stays inside the
  // visible viewport regardless of how much the cover-scaled image overflows.
  const INSET   = ready ? ir.containerW * 0.10 : 0;   // 10% padding each side
  const carLeft = ready ? INSET : 0;
  const carW    = ready ? ir.containerW - INSET * 2 : 0;

  return (
    <>
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: `calc(100dvh - ${NAV_H}px)`,
        overflow: "hidden",
        transform: "translateZ(0)", // force iOS WKWebView to honour overflow:hidden
        background: "#0a0a0a",
      }}
    >
      {/* Background image — centred via CSS transform; iOS clips transform overflow correctly */}
      <img
        src="/shoes/closet-bg.png"
        alt="My Digital Shoes"
        style={{
          position: "absolute",
          top:       ready ? ir.top   : 0,
          left:      "50%",
          transform: "translateX(-50%)",
          width:     ready ? ir.width  : "100%",
          height:    ready ? ir.height : "auto",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />


      {ready && (
        <>
          {/* Item counter — pinned below the bottom shelf */}
          {itemsLeft !== null && (
            <button
              onClick={() => setUpgradeReason("items")}
              data-testid="badge-item-count"
              aria-label={`${totalItems} of ${FREE_ITEM_LIMIT} items used — tap to upgrade`}
              style={{
                position: "absolute",
                top: pY(ir, LM.rows[3].shelfY) + pH(ir, 0.012),
                left: 0, right: 0,
                margin: "0 auto",
                width: "fit-content",
                zIndex: 25,
                padding: "2px 12px", borderRadius: 20, border: "none",
                background: totalItems >= FREE_ITEM_LIMIT
                  ? "rgba(200,40,40,0.15)"
                  : "rgba(92,15,30,0.12)",
                boxShadow: totalItems >= FREE_ITEM_LIMIT
                  ? "0 0 0 1.5px rgba(200,40,40,0.45)"
                  : "0 0 0 1.5px rgba(92,15,30,0.35)",
                color: totalItems >= FREE_ITEM_LIMIT ? "#ff6b6b" : "#ffffff",
                fontWeight: 700, fontSize: 9,
                letterSpacing: "0.08em", textTransform: "uppercase",
                whiteSpace: "nowrap", cursor: "pointer",
              }}
            >
              {totalItems}/{FREE_ITEM_LIMIT} ITEMS
            </button>
          )}

          {/* 4 shelf rows — heading pinned to top of section, photos below at consistent height */}
          {ROWS.map(({ key, btnLabel }, rowIdx) => {
            const lm    = LM.rows[rowIdx];
            const items = rowData[key];
            const secTop = pY(ir, lm.sectionTop);
            const secH   = pH(ir, lm.shelfY - lm.sectionTop);
            const labelNudge = rowIdx === 0 ? -pH(ir, 0.003) : 0;

            return (
              <React.Fragment key={key}>
                {/* Heading — anchored to top of section, tappable to add */}
                <button
                  onClick={addHandlers[key]}
                  aria-label={btnLabel}
                  data-testid={`add-btn-${key}`}
                  style={{
                    position: "absolute",
                    top: rowIdx === 0 ? secTop + labelNudge : secTop,
                    left: carLeft,
                    width: carW, height: labelH,
                    zIndex: 24, background: "none", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <span style={{
                    fontSize: Math.max(9, labelH * 0.55),
                    fontWeight: 300, letterSpacing: "0.22em",
                    color: "#ffffff",
                    fontFamily: "var(--font-display)", textTransform: "uppercase",
                    textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                  }}>
                    {btnLabel}
                  </span>
                </button>

                {/* Carousel — starts below heading; heels also shift down by nudge */}
                {items.length > 0 && (
                  <div
                    data-testid={`row-${key}`}
                    style={{
                      position: "absolute",
                      top: secTop + labelH + (rowIdx === 0 ? labelNudge : 0) + (rowIdx === 1 || rowIdx === 2 ? pH(ir, 0.02) : 0), left: carLeft,
                      width: carW, height: rowIdx === 3 ? consistentPhotoH - pH(ir, 0.012) : consistentPhotoH,
                      zIndex: 10, overflow: "visible",
                    }}
                  >
                    <ShoesRow
                      ref={rowRefs[key]}
                      items={items}
                      onCenteredItem={setCentredHandlers[key]}
                      onItemTap={handleItemTap}
                      maxPhotoH={rowIdx === 3 ? consistentPhotoH - pH(ir, 0.012) : consistentPhotoH}
                    />
                  </div>
                )}

                {/* Empty-state tap zone — full section, only when no items */}
                {items.length === 0 && (
                  <button
                    onClick={addHandlers[key]}
                    aria-label={btnLabel}
                    style={{
                      position: "absolute",
                      top: secTop + labelH + (rowIdx === 0 ? labelNudge : 0) + (rowIdx === 1 || rowIdx === 2 ? pH(ir, 0.02) : 0), left: carLeft,
                      width: carW, height: secH - labelH,
                      zIndex: 22, background: "transparent", border: "none", cursor: "pointer",
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Person icon → favorites */}
          <button
            onClick={() => navigate("/favorites")}
            data-testid="button-person-icon"
            aria-label="View saved looks"
            style={{
              position: "absolute", top: pY(ir, 0.905), left: pX(ir, 0.190),
              width: pW(ir, 0.120), height: pH(ir, 0.065),
              zIndex: 25, background: "transparent", border: "none", cursor: "pointer",
            }}
          />

          {/* Lipstick icon → upgrade */}
          <button
            onClick={() => setUpgradeReason("items")}
            aria-label="Upgrade to premium"
            style={{
              position: "absolute", top: pY(ir, 0.906), left: pX(ir, 0.670),
              width: pW(ir, 0.130), height: pH(ir, 0.080),
              zIndex: 25, background: "transparent", border: "none", cursor: "pointer",
            }}
          />

          {/* Invisible tap zone over the save element on the background image */}
          <button
            onClick={() => { setSaveName(""); setIsSaveOpen(true); }}
            aria-label="Save current look"
            style={{
              position: "absolute",
              top:    pY(ir, 0.9466) - pW(ir, 0.0625),
              left:   pX(ir, 0.54)  - pW(ir, 0.0625),
              width:  pW(ir, 0.125), height: pW(ir, 0.125),
              borderRadius: "50%", zIndex: 26,
              background: "transparent", border: "none",
              cursor: "pointer", padding: 0,
            }}
          />
        </>
      )}

    </div>

    {/* ── Modals — rendered OUTSIDE the overflow:hidden+transform container so
        that position:fixed children aren't clipped by the iOS WKWebView
        "transform creates a new containing block" behaviour. ── */}

    {/* Save modal */}
    <AnimatePresence>
      {isSaveOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 12 }}
            style={{
              background: "#fff", borderRadius: 20,
              border: "2.5px solid #000",
              boxShadow: "4px 4px 0 #000",
              padding: "24px 20px 20px",
              width: "100%", maxWidth: 340,
            }}
          >
            {saveSuccess ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💕</div>
                <p style={{ fontWeight: 800, fontSize: 16, fontFamily: "var(--font-display)" }}>Look saved!</p>
              </div>
            ) : (
              <>
                <p style={{ fontWeight: 800, fontSize: 15, fontFamily: "var(--font-display)", marginBottom: 12 }}>
                  Name this look
                </p>
                <input
                  autoFocus
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveName.trim() && handleSave()}
                  placeholder="e.g. Sunday Glow ✨"
                  style={{
                    width: "100%", height: 42, borderRadius: 10,
                    border: "2px solid #000", padding: "0 12px",
                    fontSize: 14, fontFamily: "var(--font-display)",
                    boxSizing: "border-box", marginBottom: 12, outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setIsSaveOpen(false)}
                    style={{
                      flex: 1, height: 40, borderRadius: 20,
                      border: "2px solid #000", background: "#fff",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                      fontFamily: "var(--font-display)",
                    }}
                  >Cancel</button>
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || saveOutfit.isPending}
                    style={{
                      flex: 1, height: 40, borderRadius: 20,
                      border: "2px solid rgba(255,255,255,0.25)",
                      background: "linear-gradient(to bottom, #707070, #555555)",
                      color: "#ffffff", fontWeight: 800, fontSize: 13,
                      cursor: saveName.trim() ? "pointer" : "default",
                      opacity: saveName.trim() ? 1 : 0.45,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {saveOutfit.isPending ? "…" : "Save ♡"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <AnimatePresence>
      {upgradeReason && (
        <UpgradeSheet reason={upgradeReason} onClose={() => setUpgradeReason(null)} />
      )}
    </AnimatePresence>
    <AnimatePresence>
      {addCategory && (
        <QuickAddSheet
          key={addCategory}
          open={!!addCategory}
          onOpenChange={open => !open && setAddCategory(null)}
          category={addCategory}
          existingCount={rowData[addCategory as RowKey]?.length ?? 0}
        />
      )}
    </AnimatePresence>
    <AnimatePresence>
      {detailsItem && (
        <ItemDetailsSheet
          key={detailsItem.id}
          item={detailsItem}
          onClose={() => setDetailsItem(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
