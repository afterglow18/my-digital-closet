/**
 * AvatarCropSheet — full-screen circular crop UI.
 *
 * Shows the selected photo inside a circle preview.
 * User drags to reposition. "Use Photo" produces a square-cropped 400×400 JPEG blob.
 */
import React, { useEffect, useRef, useState } from "react";

const CROP_SIZE = 224; // display px — matches the circle preview size

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel:  () => void;
}

export function AvatarCropSheet({ file, onConfirm, onCancel }: Props) {
  const [src]              = useState(() => URL.createObjectURL(file));
  const [naturalW, setNW]  = useState(0);
  const [naturalH, setNH]  = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef  = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const loaded = naturalW > 0 && naturalH > 0;
  const scale  = loaded ? Math.max(CROP_SIZE / naturalW, CROP_SIZE / naturalH) : 1;
  const dispW  = loaded ? naturalW * scale : CROP_SIZE;
  const dispH  = loaded ? naturalH * scale : CROP_SIZE;
  const maxX   = Math.max(0, (dispW - CROP_SIZE) / 2);
  const maxY   = Math.max(0, (dispH - CROP_SIZE) / 2);

  // ── Drag handlers (touch + mouse) ────────────────────────────────────────────

  const getPoint = (e: React.TouchEvent | React.MouseEvent) =>
    "touches" in e ? e.touches[0] : e;

  const onDown = (e: React.TouchEvent | React.MouseEvent) => {
    const pt = getPoint(e);
    dragRef.current = { px: pt.clientX, py: pt.clientY, ox: offset.x, oy: offset.y };
  };

  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragRef.current) return;
    // Prevent page scroll while dragging the crop
    if ("touches" in e) (e as React.TouchEvent).preventDefault();
    const pt = getPoint(e);
    const dx = pt.clientX - dragRef.current.px;
    const dy = pt.clientY - dragRef.current.py;
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, dragRef.current.ox + dx)),
      y: Math.max(-maxY, Math.min(maxY, dragRef.current.oy + dy)),
    });
  };

  const onUp = () => { dragRef.current = null; };

  // ── Confirm: crop to 400×400 blob ────────────────────────────────────────────

  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img) return;

    // Source rectangle (in image natural pixels) that maps to the crop circle
    const srcCropX    = (dispW / 2 - CROP_SIZE / 2 - offset.x) / scale;
    const srcCropY    = (dispH / 2 - CROP_SIZE / 2 - offset.y) / scale;
    const srcCropSize = CROP_SIZE / scale;

    const OUT = 400;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    canvas.getContext("2d")!.drawImage(img, srcCropX, srcCropY, srcCropSize, srcCropSize, 0, 0, OUT, OUT);
    const blob = await new Promise<Blob>((res) =>
      canvas.toBlob((b) => res(b!), "image/jpeg", 0.85),
    );
    onConfirm(blob);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center gap-6 px-6">

      <p className="text-white text-sm font-bold uppercase tracking-widest">Drag to adjust</p>

      {/* ── Circle crop preview ── */}
      <div
        className="rounded-full overflow-hidden border-[5px] border-white shadow-2xl select-none"
        style={{ width: CROP_SIZE, height: CROP_SIZE, position: "relative", touchAction: "none" }}
        onTouchStart={onDown}
        onTouchMove={onMove}
        onTouchEnd={onUp}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {/* Hidden real image used for canvas drawing */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          className="hidden"
          onLoad={() => {
            setNW(imgRef.current!.naturalWidth);
            setNH(imgRef.current!.naturalHeight);
          }}
        />
        {/* Visible positioned image */}
        <div
          style={{
            position: "absolute",
            width:  dispW,
            height: dispH,
            left:   (CROP_SIZE - dispW) / 2 + offset.x,
            top:    (CROP_SIZE - dispH) / 2 + offset.y,
          }}
        >
          <img
            src={src}
            alt="Crop preview"
            draggable={false}
            style={{ width: "100%", height: "100%", display: "block", userSelect: "none", pointerEvents: "none" }}
          />
        </div>
      </div>

      <p className="text-white/40 text-xs text-center leading-relaxed">
        Drag to reposition · Square crop
      </p>

      {/* ── Buttons ── */}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-full border-2 border-white/30 text-white text-sm font-bold
                     active:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className="px-6 py-3 rounded-full bg-primary border-2 border-black text-black text-sm font-bold
                     shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
        >
          Use Photo
        </button>
      </div>
    </div>
  );
}
