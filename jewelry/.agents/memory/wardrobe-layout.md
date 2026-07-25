---
name: Wardrobe layout strategy
description: Background image sizing, landmark fractions, ClosetRow contract, hanger overlay, and save bar placement for the My Digital Closet app.
---

## Background image

**Current file:** `artifacts/outfit-generator/public/closet-bg.png`
**Dimensions:** 941×1672 px (aspect ratio H/W = 1.7769)
**Source:** User-supplied image (no modifications).

**Rendering:** Container height = `min(calc(100dvh-90px), calc(100vw * 1.776833))` so image fills container width exactly with no letterbox gap on standard portrait phones. `useImageRect` anchors image to top (rT=0, rL=0 on portrait).

**Container background:** `#F0C030` (matches yellow doors visible on sides).

## Landmark fractions (941×1672 image, from pixel sampling at x=150)

```
doorL: 0.092   (x≈87,  boundary yellow→pink)
doorR: 0.901   (x≈848, boundary pink→yellow)

rows[0] TOPS:
  btnCY: 0.311  (rod centre  y≈520)
  boxY:  0.319  (rod bottom  y≈533)
  boxBot:0.495  (y≈828, just before BOTTOMS rod)
  hangerTop: 0.311  hangerBot: 0.319  (thin overlay, rod-bottom only)

rows[1] BOTTOMS:
  btnCY: 0.498  (rod centre  y≈833)
  boxY:  0.506  (rod bottom  y≈846)
  boxBot:0.685  (y≈1145, just before SHOES rod)
  hangerTop: 0.498  hangerBot: 0.506

rows[2] SHOES:
  btnCY: 0.690  (rod centre  y≈1153)
  boxY:  0.697  (rod bottom  y≈1165)
  boxBot:0.849  (y≈1420, just before floor/rug)
  hangerTop: 0.697  hangerBot: 0.697  (isShoes guard prevents overlay)

Save bar (transparent tap zones over baked-in rug circles):
  barY:    0.885   (rug top   y≈1480)
  barBot:  0.993   (bar bot   y≈1660)
  hangerCX: 0.175  (left hanger icon centre x≈165)
  saveBtnL: 0.350  (centre button left  x≈329)
  saveBtnR: 0.650  (centre button right x≈612)
  manneCX:  0.824  (right dress-form   x≈775)
```

## ClosetRow photo positioning

- `photoTopFrac = isShoes ? lm.boxY : lm.hangerBot`
  For all rows in new image: hangerBot = boxY, so photos start at rod-bottom for every row.
- `carH = pH(ir, lm.boxBot - photoTopFrac)` — same for all rows.

## ClosetRow card spec

- `cardW = slotW`, `cardH = slotW * 4/3` (strict 3:4, same for all three rows)
- Inset ~8%: `GAP = slotW*0.08`, `photoW = slotW-GAP`, `photoH = photoW*4/3`, `inset = GAP/2`
- Center item: `border: 1.5px solid #F7C6D8`. Non-center: borderless.
- `objectFit: cover`, `objectPosition: center`
- Pink center hanger in background = selection indicator (no extra glow on card)

## Hanger overlay (z=20)

New background has NO visible hanging hanger-arm graphics. The overlay height is only:
`hangerBot - hangerTop = boxY - btnCY ≈ 0.008` (≈8 px at 390px wide rendering).
This thin strip covers the rod bottom edge above photos to prevent any photo-edge overlap.
SHOES skipped via `{!isShoes && ...}` guard.

## Save bar

Visual comes entirely from baked-in background circles on the pink rug.
HTML = three invisible tap zones positioned at image fractions (barY, barBot etc.).
When `isSaveOpen`: name-input form appears floating above (via `bottom: calc(100% - pY(ir,LM.barY)px + 8px)`).
