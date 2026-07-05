import React, { useRef, useState, useCallback, useEffect, RefObject } from "react";
import {
  useListClothing,
  getListClothingQueryKey,
  useSaveOutfit,
  useListOutfits,
  getListOutfitsQueryKey,
  ClothingItem,
} from "@workspace/api-client-react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SwipeRow, SwipeRowHandle } from "@/components/SwipeRow";
import { QuickAddSheet } from "@/components/clothing/QuickAddSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";
import { MannequinView } from "@/components/MannequinView";
import { UpgradeSheet, UpgradeReason } from "@/components/paywall/UpgradeSheet";
import { PremiumSheet } from "@/components/paywall/PremiumSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { FREE_ITEM_LIMIT, FREE_OUTFIT_LIMIT } from "@/lib/entitlements";

// ── Config ────────────────────────────────────────────────────────────────────
type RowKey   = "tops" | "bottoms" | "shoes";
type Category = "tops" | "bottoms" | "shoes" | "accessories" | "outerwear" | "dresses";

const ROWS: { key: RowKey; label: string; addLabel: string }[] = [
  { key: "tops",    label: "Tops",    addLabel: "Add Top"    },
  { key: "bottoms", label: "Bottoms", addLabel: "Add Bottom" },
  { key: "shoes",   label: "Shoes",   addLabel: "Add Shoes"  },
];

const NAV_H = 90; // AppLayout bottom-nav height in px

// ── Background image natural size ────────────────────────────────────────────
const IMG_W = 853;
const IMG_H = 1844;

// ── Landmark fractions (measured from the 853×1844 image) ────────────────────
// All values = fraction of image width or height (0 → 1)
const LM = {
  doorL: 0.141,   // left door right edge  (x fraction)
  doorR: 0.859,   // right door left edge  (x fraction)

  // Badge centre — overlays the image's "5/20 ITEMS" pill
  badgeCY: 0.297,

  // Per-row: { add button y-fraction, carousel top y-frac, carousel bottom y-frac }
  rows: [
    { addY: 0.353, carY: 0.362, carBot: 0.510 }, // TOPS
    { addY: 0.548, carY: 0.558, carBot: 0.676 }, // BOTTOMS
    { addY: 0.715, carY: 0.726, carBot: 0.838 }, // SHOES
  ],

  // Bottom action bar
  barY:   0.869,
  barBot: 0.958,

  // Hanger-icon and mannequin-icon x centres within bottom bar
  hangerCX: 0.222,
  manneCX:  0.778,
  // Save button spans barBtnL → barBtnR
  saveBtnL: 0.282,
  saveBtnR: 0.718,
};

// ── useImageRect — computes actual rendered pixel rect of an object-fit:contain image ──
interface ImgRect { top: number; left: number; width: number; height: number }

function useImageRect(containerRef: RefObject<HTMLDivElement>): ImgRect {
  const [rect, setRect] = useState<ImgRect>({ top: 0, left: 0, width: 0, height: 0 });
  useEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      if (!c) return;
      const cW = c.clientWidth, cH = c.clientHeight;
      const cR = cW / cH, iR = IMG_W / IMG_H;
      let rW: number, rH: number, rL: number, rT: number;
      if (cR > iR) {
        // Container wider than image → letterbox left/right; image fills full height, top-aligned
        rH = cH; rW = cH * iR; rT = 0; rL = (cW - rW) / 2;
      } else {
        // Container taller than image → image fills full width; objectPosition "center top" → rT = 0
        rW = cW; rH = cW / iR; rL = 0; rT = 0;
      }
      setRect({ top: rT, left: rL, width: rW, height: rH });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [containerRef]);
  return rect;
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
const pH  = (ir: ImgRect, f: number) => ir.height * f;
const pW  = (ir: ImgRect, f: number) => ir.width  * f;
const pY  = (ir: ImgRect, f: number) => ir.top    + ir.height * f;
const pX  = (ir: ImgRect, f: number) => ir.left   + ir.width  * f;

// ── Palette ───────────────────────────────────────────────────────────────────
const GOLD = "#C49B2A";
const PINK = "#e8a0bc";

// ── Bottom-bar icon components ────────────────────────────────────────────────
function HangerIcon({ size = 22 }: { size?: number }) {
  const w = size, h = size * 0.85;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <path d={`M${w/2} ${h*.12} Q${w/2} ${h*.04} ${w/2+2.5} ${h*.04} Q${w/2+6} ${h*.04} ${w/2+6} ${h*.28} Q${w/2+6} ${h*.48} ${w/2} ${h*.48}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <line x1={w/2} y1={h*.48} x2={w/2} y2={h*.76} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"/>
      <path d={`M${w/2} ${h*.76} Q${w*.2} ${h*.84} 3 ${h}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d={`M${w/2} ${h*.76} Q${w*.8} ${h*.84} ${w-3} ${h}`} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <line x1="3" y1={h} x2={w-3} y2={h} stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}
function MannequinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size*1.12)} viewBox="0 0 22 24" fill="none">
      <circle cx="11" cy="3" r="2.2" stroke={GOLD} strokeWidth="1.7"/>
      <path d="M7 7 Q5 11 6 16 L16 16 Q17 11 15 7 Q13 5.5 11 5.5 Q9 5.5 7 7Z" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinejoin="round"/>
      <line x1="7.5" y1="13" x2="14.5" y2="13" stroke={GOLD} strokeWidth="1.4"/>
      <path d="M6 16 Q4.5 21 11 22 Q17.5 21 16 16" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinecap="round"/>
      <line x1="11" y1="22" x2="11" y2="24" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="8"  y1="24" x2="14" y2="24" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WardrobePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const ir = useImageRect(containerRef);

  const rowRefs = {
    tops:    useRef<SwipeRowHandle>(null),
    bottoms: useRef<SwipeRowHandle>(null),
    shoes:   useRef<SwipeRowHandle>(null),
  };

  const [centred,       setCentred]       = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [addCategory,   setAddCategory]   = useState<Category | null>(null);
  const [detailsItem,   setDetailsItem]   = useState<ClothingItem | null>(null);
  const [showMannequin, setShowMannequin] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<UpgradeReason | null>(null);
  const [showPremium,   setShowPremium]   = useState(false);
  const [isSaveOpen,    setIsSaveOpen]    = useState(false);
  const [saveName,      setSaveName]      = useState("");

  const { data: tops    = [] } = useListClothing({ category: "tops"    }, { query: { queryKey: getListClothingQueryKey({ category: "tops"    }) } });
  const { data: bottoms = [] } = useListClothing({ category: "bottoms" }, { query: { queryKey: getListClothingQueryKey({ category: "bottoms" }) } });
  const { data: shoes   = [] } = useListClothing({ category: "shoes"   }, { query: { queryKey: getListClothingQueryKey({ category: "shoes"   }) } });
  const { data: outfits = [] } = useListOutfits();

  const rowData: Record<RowKey, ClothingItem[]> = { tops, bottoms, shoes };
  const totalItems = tops.length + bottoms.length + shoes.length;

  const saveOutfit  = useSaveOutfit();
  const queryClient = useQueryClient();
  const { tier, caps, canAddItem, canSaveOutfit } = useEntitlements();

  // Stable per-key centred callbacks — avoid re-creating inside render
  const handleCentredTops    = useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, tops:    item ?? undefined })), []);
  const handleCentredBottoms = useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, bottoms: item ?? undefined })), []);
  const handleCentredShoes   = useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, shoes:   item ?? undefined })), []);
  const centredHandlers: Record<RowKey, (item: ClothingItem | null) => void> = {
    tops: handleCentredTops, bottoms: handleCentredBottoms, shoes: handleCentredShoes,
  };

  const handleItemTap  = useCallback((item: ClothingItem) => setDetailsItem(item), []);
  const handleAddClick = useCallback((cat: Category) => {
    if (canAddItem(totalItems)) setAddCategory(cat); else setUpgradeReason("items");
  }, [canAddItem, totalItems]);

  // Stable per-key add handlers
  const handleAddTops    = useCallback(() => handleAddClick("tops"),    [handleAddClick]);
  const handleAddBottoms = useCallback(() => handleAddClick("bottoms"), [handleAddClick]);
  const handleAddShoes   = useCallback(() => handleAddClick("shoes"),   [handleAddClick]);
  const addHandlers: Record<RowKey, () => void> = {
    tops: handleAddTops, bottoms: handleAddBottoms, shoes: handleAddShoes,
  };
  const handleSaveClick     = useCallback(() => {
    if (canSaveOutfit(outfits.length)) setIsSaveOpen(true); else setUpgradeReason("outfits");
  }, [canSaveOutfit, outfits.length]);
  const handleMannequinClick = useCallback(() => {
    if (caps.mannequin) setShowMannequin(true); else setShowPremium(true);
  }, [caps.mannequin]);
  const handleShuffle = useCallback(() => {
    ROWS.forEach(({ key }, i) => {
      const data = rowData[key];
      if (data.length < 2) return;
      const ref = rowRefs[key].current;
      if (!ref) return;
      const idx = Math.floor(Math.random() * data.length);
      setTimeout(() => {
        ref.scrollToIndex(data.length - 1, false);
        setTimeout(() => ref.scrollToIndex(idx, true), 60);
      }, i * 80);
    });
  }, [rowData]);
  const handleSave = () => {
    if (!saveName.trim()) return;
    if (!canSaveOutfit(outfits.length)) { setIsSaveOpen(false); setSaveName(""); setUpgradeReason("outfits"); return; }
    const itemIds = Object.values(centred).filter((i): i is ClothingItem => i != null).map(i => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }); setIsSaveOpen(false); setSaveName(""); } }
    );
  };

  const canSave     = ROWS.every(({ key }) => !!centred[key]);
  const isFree      = tier === "free";
  const outfitsLeft = isFree ? Math.max(0, FREE_OUTFIT_LIMIT - outfits.length) : null;
  const itemsLeft   = isFree ? Math.max(0, FREE_ITEM_LIMIT  - totalItems)      : null;
  const ready       = ir.width > 0;

  // Inner content width (between doors) in px
  const innerLeft  = pW(ir, LM.doorL);
  const innerRight = pW(ir, 1 - LM.doorR);
  const innerWidth = ir.width - innerLeft - innerRight;

  // Per-row card dimensions derived from rendered image height
  const rowSizes = LM.rows.map(lm => {
    const carH  = pH(ir, lm.carBot - lm.carY);
    const hH    = Math.min(18, Math.max(8, Math.round(carH * 0.155)));
    const cardH = Math.max(0, carH - hH);
    const cardW = Math.round(Math.max(36, cardH) * 0.80);
    return { carH, hH, cardH, cardW };
  });

  // Bottom bar pixel measurements
  const barH        = pH(ir, LM.barBot - LM.barY);
  const barFontSize = Math.max(10, Math.round(barH * 0.36));

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: `calc(100dvh - ${NAV_H}px)`,
        overflow: "hidden",
        background: "#f5e8c0",   // warm fallback while image loads
      }}
    >
      {/* ── Full-screen background image ── */}
      <img
        src="/closet-bg.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "contain", objectPosition: "center top",
          pointerEvents: "none", userSelect: "none", zIndex: 0,
          display: "block",
        }}
      />

      {/* ── All interactive overlays — rendered only once image rect is known ── */}
      {ready && (
        <>
          {/* ── Badge tap zone — image provides visual; only flash a warning when full ── */}
          <button
            onClick={() => setUpgradeReason("items")}
            data-testid="badge-item-count"
            style={{
              position: "absolute",
              top: pY(ir, LM.badgeCY) - pH(ir, 0.015),
              left: "50%", transform: "translateX(-50%)",
              zIndex: 12,
              minWidth: pW(ir, 0.30), height: pH(ir, 0.030),
              borderRadius: 20, border: "none",
              // transparent normally; red ring when at limit
              background: itemsLeft === 0 ? "rgba(200,40,40,0.15)" : "transparent",
              boxShadow: itemsLeft === 0 ? "0 0 0 2px rgba(200,40,40,0.45)" : "none",
              cursor: "pointer",
            }}
            aria-label={`${totalItems} of ${FREE_ITEM_LIMIT} items used`}
          />

          {/* ── Three clothing rows ── */}
          {ROWS.map(({ key, addLabel }, rowIdx) => {
            const lm    = LM.rows[rowIdx];
            const items = rowData[key];
            const { carH, hH, cardH, cardW } = rowSizes[rowIdx];

            // pixel positions of this row's elements
            const addBtnTop = pY(ir, lm.addY);
            const addBtnH   = pH(ir, lm.carY - lm.addY);
            const carTop    = pY(ir, lm.carY);

            return (
              <React.Fragment key={key}>
                {/* ── "+ Add" tap zone — fully transparent; image provides all text/visual ── */}
                <button
                  onClick={() => handleAddClick(key as Category)}
                  aria-label={addLabel}
                  data-testid={`add-btn-${key}`}
                  style={{
                    position: "absolute",
                    top: addBtnTop, left: pX(ir, LM.doorL), right: pW(ir, 1 - LM.doorR),
                    height: Math.max(24, addBtnH),
                    zIndex: 12,
                    background: "transparent", border: "none", cursor: "pointer",
                  }}
                />

                {/* ── Clothing carousel — replaces image's ghost hanger placeholders ── */}
                <div
                  data-testid={`row-${key}`}
                  style={{
                    position: "absolute",
                    top: carTop, left: 0, right: 0,
                    height: carH,
                    zIndex: 11,
                    display: "flex", alignItems: "center",
                  }}
                >
                  {/* Pink chevrons */}
                  {items.length > 0 && (
                    <>
                      <div style={{ position:"absolute", left: innerLeft - 3, top:"50%", transform:"translateY(-50%)", fontSize: Math.max(16, Math.round(carH * 0.38)), color:PINK, fontWeight:300, lineHeight:1, pointerEvents:"none", userSelect:"none", opacity:0.85, zIndex:13 }}>‹</div>
                      <div style={{ position:"absolute", right: innerRight - 3, top:"50%", transform:"translateY(-50%)", fontSize: Math.max(16, Math.round(carH * 0.38)), color:PINK, fontWeight:300, lineHeight:1, pointerEvents:"none", userSelect:"none", opacity:0.85, zIndex:13 }}>›</div>
                    </>
                  )}

                  <SwipeRow
                    ref={rowRefs[key]}
                    items={items}
                    addLabel={addLabel}
                    onCenteredItem={centredHandlers[key]}
                    onAddClick={addHandlers[key]}
                    onItemTap={handleItemTap}
                    closetStyle
                    closetItemW={cardW}
                    closetItemH={cardH}
                    closetHangerH={hH}
                  />
                </div>
              </React.Fragment>
            );
          })}

          {/* ── Bottom action bar ── */}
          <div
            style={{
              position: "absolute",
              top: pY(ir, LM.barY),
              left: ir.left,
              width: ir.width,
              height: barH,
              zIndex: 15,
            }}
          >
            {/* Shuffle — transparent hit-zone over image's hanger icon */}
            <button
              onClick={handleShuffle}
              data-testid="button-shuffle"
              title="Shuffle outfit"
              style={{
                position: "absolute",
                top: "50%", transform: "translateY(-50%)",
                left: pW(ir, LM.hangerCX) - 20,
                width: 40, height: 40,
                borderRadius: "50%",
                background: "transparent", border: "none",
                cursor: "pointer",
              }}
            />

            {/* Save Outfit — transparent hit zone + rename input when open */}
            <AnimatePresence mode="wait">
              {isSaveOpen ? (
                /* Name input floats above the bar */
                <motion.div
                  key="input"
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
                  style={{
                    position: "absolute",
                    bottom: barH + 8, left: innerLeft, right: innerRight,
                    display: "flex", gap: 6, zIndex: 20,
                  }}
                >
                  <input
                    autoFocus type="text"
                    placeholder="Name this outfit…"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    data-testid="input-outfit-name"
                    style={{ flex:1, height:36, borderRadius:20, padding:"0 14px", fontSize:13, fontWeight:600, color:"#3a2400", background:"rgba(255,252,245,0.97)", border:"1.5px solid rgba(196,155,42,0.45)", boxShadow:"0 3px 12px rgba(0,0,0,0.14)", outline:"none" }}
                  />
                  <button onClick={() => { setIsSaveOpen(false); setSaveName(""); }}
                    style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:"rgba(255,250,240,0.97)", border:"1.5px solid rgba(196,155,42,0.36)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.10)", cursor:"pointer" }}>
                    <X style={{ width:14, height:14, color:GOLD }} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || saveOutfit.isPending}
                    data-testid="button-save-outfit-confirm"
                    style={{ padding:"0 16px", height:36, borderRadius:20, flexShrink:0, background:"linear-gradient(to bottom,#f5d840,#c89018)", color:"#3a2400", fontWeight:700, fontSize:13, border:"none", boxShadow:"0 3px 10px rgba(200,168,24,0.32)", opacity:(!saveName.trim()||saveOutfit.isPending)?0.42:1, cursor:"pointer" }}
                  >
                    {saveOutfit.isPending ? "…" : "Save ♡"}
                  </button>
                </motion.div>
              ) : (
                /* Transparent tap zone over image's SAVE OUTFIT button */
                <motion.button
                  key="save"
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  onClick={canSave ? handleSaveClick : undefined}
                  data-testid="button-save-outfit"
                  style={{
                    position: "absolute",
                    top: "50%", transform: "translateY(-50%)",
                    left: pW(ir, LM.saveBtnL), right: pW(ir, 1 - LM.saveBtnR),
                    height: barH * 0.70,
                    borderRadius: 20,
                    background: "transparent",
                    border: "none",
                    cursor: canSave ? "pointer" : "default",
                    // Subtle glow ring when outfit is completeable
                    boxShadow: canSave ? `0 0 0 2px rgba(196,155,42,0.35), 0 3px 12px rgba(200,168,24,0.25)` : "none",
                  }}
                  aria-label="Save Outfit"
                />
              )}
            </AnimatePresence>

            {/* Mannequin — transparent hit-zone */}
            <button
              onClick={handleMannequinClick}
              disabled={!canSave}
              data-testid="button-view-mannequin"
              title="View on mannequin"
              style={{
                position: "absolute",
                top: "50%", transform: "translateY(-50%)",
                left: pW(ir, LM.manneCX) - 20,
                width: 40, height: 40,
                borderRadius: "50%",
                background: "transparent", border: "none",
                cursor: canSave ? "pointer" : "default",
                opacity: canSave ? 1 : 0.30,
              }}
            />
          </div>
        </>
      )}

      {/* ── Modal overlays ── */}
      <AnimatePresence>
        {showMannequin && <MannequinView top={centred.tops} bottom={centred.bottoms} shoes={centred.shoes} onClose={() => setShowMannequin(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {upgradeReason && <UpgradeSheet reason={upgradeReason} onClose={() => setUpgradeReason(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showPremium && <PremiumSheet onClose={() => setShowPremium(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {addCategory && (
          <QuickAddSheet
            key={addCategory} open={!!addCategory}
            onOpenChange={open => !open && setAddCategory(null)}
            category={addCategory}
            existingCount={rowData[addCategory as RowKey]?.length ?? 0}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detailsItem && <ItemDetailsSheet key={detailsItem.id} item={detailsItem} onClose={() => setDetailsItem(null)} />}
      </AnimatePresence>
    </div>
  );
}
