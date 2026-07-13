/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick ──(file chosen)──► validating ──► uploading ──► close
 *                                  └──(not clothing)──► pick (error shown)
 *
 * The clothing check calls POST /api/clothing/validate-image with the base64
 * PNG; Gemini decides whether it's a wearable item.  The check fails open so
 * a Gemini outage never blocks legitimate uploads.
 *
 * To re-enable background removal in a future update, replace encodeToPng
 * with processClothingImage from @/lib/processImage.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Check,
} from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiUrl";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "tops" | "bottoms" | "shoes" | "accessories" | "outerwear" | "dresses";

const CATEGORY_LABELS: Record<Category, string> = {
  tops:        "Top",
  bottoms:     "Bottom",
  shoes:       "Shoes",
  accessories: "Accessory",
  outerwear:   "Outerwear",
  dresses:     "Dress",
};

type Phase =
  | "pick"        // two-button landing screen
  | "validating"  // checking with Gemini whether the image is clothing
  | "uploading";  // encoding + uploading PNG, creating DB record

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Re-encode any image (HEIC, JPEG, PNG, …) to a JPEG capped at 2048 px on the
 * long edge.  Keeps files small enough to upload reliably over mobile networks
 * and avoids the ~40 MB PNGs that a raw iPhone photo would produce.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error(`Image decoded with 0 dimensions — format may be unsupported (type: ${input.type || "unknown"})`));
        return;
      }

      const MAX_DIM = 2048;
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas.getContext('2d') returned null")); return; }

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (b) => {
          if (b && b.size > 1000) {
            resolve(b);
          } else {
            reject(new Error(`canvas.toBlob returned ${b?.size ?? 0} bytes — image may be blank or cross-origin tainted`));
          }
        },
        "image/jpeg",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image into <img> element (type: ${input.type || "unknown"}, size: ${input.size} bytes)`));
    };

    img.src = url;
  });
}

async function uploadBlob(blob: Blob, filename: string): Promise<string> {
  const contentType = "image/jpeg";

  const urlRes = await fetch(apiUrl("/api/storage/uploads/request-url"), {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name: filename, size: blob.size, contentType }),
  });
  if (!urlRes.ok) {
    const body = await urlRes.text().catch(() => "");
    throw new Error(`Upload URL request failed (HTTP ${urlRes.status}): ${body}`);
  }

  const { uploadURL, objectPath } = (await urlRes.json()) as {
    uploadURL: string;
    objectPath: string;
  };

  const put = await fetch(uploadURL, {
    method:  "PUT",
    headers: { "Content-Type": contentType },
    body:    blob,
  });
  if (!put.ok) {
    const body = await put.text().catch(() => "");
    throw new Error(`Storage PUT failed (HTTP ${put.status}): ${body}`);
  }

  return objectPath;
}

/** Convert a Blob to a base64 string (without the data-URL prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Shrink a PNG blob to at most `maxDim` on its longest edge for the
 * classification call.  Returns a small JPEG blob (enough for Gemini to
 * classify; no need for full resolution).
 */
async function resizeForValidation(blob: Blob, maxDim = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob failed"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

async function validateIsClothing(
  pngBlob: Blob,
): Promise<{ isClothing: boolean; reason: string }> {
  // Resize to a small thumbnail so the base64 payload stays under ~300 KB
  const thumb = await resizeForValidation(pngBlob, 512);
  const imageBase64 = await blobToBase64(thumb);

  const res = await fetch(apiUrl("/api/clothing/validate-image"), {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ imageBase64 }),
  });

  if (!res.ok) {
    // Fail open: validation endpoint unreachable → allow upload
    return { isClothing: true, reason: "Validation unavailable" };
  }

  return res.json() as Promise<{ isClothing: boolean; reason: string }>;
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  /** Called with the newly created item after a successful upload. */
  onCreated?:    (item: import("@workspace/api-client-react").ClothingItem) => void;
}

const PHOTO_TIPS = [
  "Lay the clothing item flat.",
  "Use a plain, consistent background (bed, sheet, or blanket).",
  "Smooth out wrinkles.",
  "Take the photo directly from above.",
  "Make sure the entire item is visible.",
] as const;

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const [phase,    setPhase]   = useState<Phase>("pick");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Two separate file inputs: one triggers camera, one opens gallery
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setPhase("pick");
    setErrorMsg(null);
    onOpenChange(false);
  }, [onOpenChange]);

  // ── File picked → encode → validate → upload → create DB record → close ──
  const handleFile = useCallback(async (file: File) => {
    setErrorMsg(null);

    // 1. Encode: resize to ≤2048 px and convert to JPEG for a small, uploadable blob
    setPhase("validating");
    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
      console.log(`[upload] encoded ${file.name} (${file.type}, ${file.size}B) → JPEG ${jpeg.size}B`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upload] encode failed:", msg);
      setErrorMsg(`Could not read the photo: ${msg}`);
      setPhase("pick");
      return;
    }

    // 2. Validate with Gemini (fails open — outage never blocks upload)
    try {
      const { isClothing, reason } = await validateIsClothing(jpeg);
      if (!isClothing) {
        setErrorMsg(
          `That doesn't look like a clothing item. ${reason || "Please try a different photo."}`
        );
        setPhase("pick");
        return;
      }
    } catch (err) {
      console.warn("[upload] validation error (failing open):", err);
    }

    // 3. Upload to storage & save DB record
    setPhase("uploading");
    try {
      const filename = `${category}-${Date.now()}.jpg`;
      console.log(`[upload] requesting presigned URL for ${filename} (${jpeg.size}B)`);
      const path = await uploadBlob(jpeg, filename);
      console.log(`[upload] stored at ${path}`);

      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: path } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: (err) => {
              console.error("[upload] createItem failed:", err);
              reject(err);
            },
          },
        );
      });

      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[upload] upload/save failed:", msg);
      setErrorMsg(`Save failed: ${msg}`);
      setPhase("pick");
    }
  }, [category, existingCount, createItem, queryClient, handleClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-selecting same file
  };

  if (!open) return null;

  const label = CATEGORY_LABELS[category];

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header — pt accounts for iOS status bar safe area */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Add {label}
        </h2>
        {phase === "pick" && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── PICK ── */}
          {phase === "pick" && (
            <motion.div
              key="pick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col p-5 gap-5"
            >
              {errorMsg && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  {errorMsg}
                </p>
              )}

              {/* Two big action buttons */}
              <div className="flex gap-3">
                {/* Take Photo */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                             border-4 border-black rounded-2xl bg-primary
                             shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-1 active:translate-y-1 active:shadow-none
                             transition-all"
                >
                  <span className="text-4xl leading-none">📷</span>
                  <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                    Take<br />Photo
                  </span>
                </button>

                {/* Upload Photo */}
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                             border-4 border-black rounded-2xl bg-white
                             shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-1 active:translate-y-1 active:shadow-none
                             transition-all"
                >
                  <span className="text-4xl leading-none">🖼️</span>
                  <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                    Upload<br />Photo
                  </span>
                </button>
              </div>

              {/* Photo tips */}
              <div className="border-2 border-black rounded-2xl bg-white p-4
                              shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                  <span>📸</span> Photo Tips
                </p>
                <ul className="flex flex-col gap-2">
                  {PHOTO_TIPS.map((tip) => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                      <span className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm bg-primary
                                       flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}

          {/* ── VALIDATING ── */}
          {phase === "validating" && (
            <motion.div
              key="validating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-6"
            >
              <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                              flex items-center justify-center
                              shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-5xl leading-none animate-pulse">👕</span>
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">Checking…</p>
                <p className="text-sm text-muted-foreground mt-1">Making sure this is a clothing item.</p>
              </div>
            </motion.div>
          )}

          {/* ── UPLOADING ── */}
          {phase === "uploading" && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-5 p-6"
            >
              <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                              flex items-center justify-center
                              shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
                <p className="text-sm text-muted-foreground mt-1">Adding to your closet.</p>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Hidden file inputs */}
      {/* Camera — opens native camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      {/* Gallery — opens photo library / file picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
