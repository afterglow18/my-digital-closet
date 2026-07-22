/**
 * QuickAddSheet
 *
 * Upload flow:
 *   pick ──(file chosen)──► uploading ──► close
 *
 * Images are encoded to JPEG (≤2048 px) and saved to Capacitor Filesystem
 * (Documents dir) via imageStorage.ts — no server upload required.
 *
 * Camera:
 *   On native iOS/iPadOS, uses @capacitor/camera (Camera.getPhoto) which
 *   presents the picker correctly as a popover on iPad and handles permissions.
 *   Falls back to <input capture> only on web.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import {
  useCreateClothingItem,
  getListClothingQueryKey,
} from "@/lib/local-api";
import { useQueryClient } from "@tanstack/react-query";
import { saveImage } from "@/lib/imageStorage";
import type { ClothingItem } from "@/lib/local-api";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

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
  | "pick"       // two-button landing screen
  | "uploading"; // encoding + saving JPEG, creating DB record

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Re-encode any image (HEIC, JPEG, PNG, …) to a JPEG capped at 2048 px on the
 * long edge. Keeps files small for reliable storage and fast display.
 */
async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error(`Image decoded with 0 dimensions (type: ${input.type || "unknown"})`));
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
            reject(new Error(`canvas.toBlob returned ${b?.size ?? 0} bytes — image may be blank`));
          }
        },
        "image/jpeg",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image (type: ${input.type || "unknown"}, size: ${input.size} bytes)`));
    };

    img.src = url;
  });
}

/**
 * Returns true if the error represents a user cancellation of the camera picker.
 * Capacitor throws different messages across versions/platforms.
 */
function isCameraCancel(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("cancel") ||
    msg.includes("dismiss") ||
    msg.includes("no image picked") ||
    msg.includes("user denied") ||
    msg.includes("user did not") ||
    msg.includes("no photo")
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  /** Called with the newly created item after a successful save. */
  onCreated?:    (item: ClothingItem) => void;
}

const PHOTO_TIPS = [
  "Lay the clothing item flat.",
  "Use a plain, consistent background (bed, sheet, or blanket).",
  "Smooth out wrinkles.",
  "Take the photo directly from above.",
  "Make sure the entire item is visible.",
] as const;

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  const [phase,    setPhase]    = useState<Phase>("pick");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Only used as a fallback on web (non-native) — native uses Camera.getPhoto
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

  // ── File picked → encode → save locally → create DB record → close ──
  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    setPhase("uploading");

    // 1. Encode: resize to ≤2048 px and convert to JPEG
    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
      const size = file instanceof File ? file.size : (file as Blob).size;
      const name = file instanceof File ? file.name : "photo.jpg";
      const type = file instanceof File ? file.type : "image/jpeg";
      console.log(`[quickadd] encoded ${name} (${type}, ${size}B) → JPEG ${jpeg.size}B`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[quickadd] encode failed:", msg);
      setErrorMsg(`Could not read the photo: ${msg}`);
      setPhase("pick");
      return;
    }

    // 2. Save to Capacitor Filesystem and create the DB record
    try {
      const filename = `${category}-${Date.now()}.jpg`;
      const imageObjectPath = await saveImage(jpeg, filename);
      console.log(`[quickadd] saved locally as ${imageObjectPath}`);

      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: (err) => {
              console.error("[quickadd] createItem failed:", err);
              reject(err);
            },
          },
        );
      });

      handleClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[quickadd] save failed:", msg);
      setErrorMsg(`Save failed: ${msg}`);
      setPhase("pick");
    }
  }, [category, existingCount, createItem, queryClient, handleClose, onCreated]);

  // ── Take Photo (native: Capacitor Camera; web: <input capture>) ──────────
  const handleTakePhoto = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback — use the hidden input
      cameraInputRef.current?.click();
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        source:           CameraSource.Camera,
        resultType:       CameraResultType.DataUrl,
        quality:          85,
        width:            2048,
        height:           2048,
        correctOrientation: true,
        allowEditing:     false,
        // presentationStyle is handled automatically by the Capacitor plugin
        // (popover on iPad, fullscreen on iPhone)
      });

      if (!photo.dataUrl) {
        setErrorMsg("No photo was returned. Please try again.");
        return;
      }

      // Convert dataUrl → Blob → handleFile
      const res  = await fetch(photo.dataUrl);
      const blob = await res.blob();
      await handleFile(blob);
    } catch (err: unknown) {
      // User cancelled the picker — silent, no error shown
      if (isCameraCancel(err)) return;

      const msg = err instanceof Error ? err.message : String(err);
      console.error("[quickadd] Camera.getPhoto error:", msg);

      if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
        setErrorMsg("Camera access is denied. Please allow camera access in Settings and try again.");
      } else {
        setErrorMsg("Could not open the camera. Please use Upload Photo instead.");
      }
    }
  }, [handleFile]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-selecting same file
    for (const file of files) {
      await handleFile(file);
    }
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
      {/* Header */}
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
                {/* Take Photo — uses Capacitor Camera on native (iPad-safe) */}
                <button
                  onClick={handleTakePhoto}
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
      {/* Camera fallback — only used on web; native uses Camera.getPhoto above */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      {/* Gallery — opens photo library / file picker (multiple allowed) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
