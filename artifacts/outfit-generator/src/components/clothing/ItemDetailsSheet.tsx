/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 */
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Heart, Trash2, Save, ChevronDown, Sparkles, Loader2, CheckCircle2,
  Shirt, Check, BookmarkPlus,
} from "lucide-react";
import { AddToLookbookSheet } from './AddToLookbookSheet';
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";
import { saveImage, deleteImage } from "@/lib/imageStorage";
import {
  ClothingItem,
  ClothingItemUpdateCategory,
  useUpdateClothingItem,
  useDeleteClothingItem,
  getListClothingQueryKey,
  getListOutfitsQueryKey,
} from "@/lib/local-api";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useCommunity";
import { publishItem, unpublishItem, syncItemEdit, changePrivacyMode } from "@/lib/sync";
import { VisibilityPicker } from "@/components/clothing/VisibilityPicker";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { SharingModeSheet } from "@/components/community/SharingModeSheet";
import { PrivateGateSheet } from "@/components/community/PrivateGateSheet";
import { hasSavedPref, getSharingPref, setSharingPref } from "@/lib/sharingPreference";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEASON_OPTIONS    = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS  = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];
const CATEGORY_OPTIONS  = ["tops", "bottoms", "shoes", "dresses", "outerwear", "accessories"];

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary
                   placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-8
                     text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary
                     cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o || `— ${label} —`}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/40" />
      </div>
    </div>
  );
}

// ── BgCompareOverlay ──────────────────────────────────────────────────────────

interface BgCompareOverlayProps {
  originalDataUrl: string;
  cleanedDataUrl:  string;
  onSave:   (choice: "original" | "cleaned") => void;
  onCancel: () => void;
}

function BgCompareOverlay({
  originalDataUrl,
  cleanedDataUrl,
  onSave,
  onCancel,
}: BgCompareOverlayProps) {
  const [selected, setSelected] = useState<"original" | "cleaned">("cleaned");

  const CHECKER = {
    backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
    backgroundSize: "16px 16px",
  } as React.CSSProperties;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3
                   bg-white border-b-2 border-black"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Choose a Version
          </h2>
          <p className="text-xs text-black/40 font-medium">Tap a photo to select it</p>
        </div>
        <button
          onClick={onCancel}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Side-by-side panels */}
      <div className="flex-1 flex gap-3 p-4 min-h-0">
        {(["original", "cleaned"] as const).map((side) => {
          const isSelected = selected === side;
          const url        = side === "original" ? originalDataUrl : cleanedDataUrl;
          return (
            <button
              key={side}
              onClick={() => setSelected(side)}
              className={`relative flex-1 flex flex-col rounded-2xl overflow-hidden border-2
                          transition-all duration-150 focus:outline-none
                          ${isSelected
                            ? "border-[#f472b6] shadow-[0_0_0_3px_#f472b6]"
                            : "border-black/20"}`}
            >
              {/* Image */}
              <div className="flex-1 min-h-0 w-full" style={CHECKER}>
                <img
                  src={url}
                  alt={side}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>

              {/* Label bar */}
              <div
                className={`flex-shrink-0 py-2 text-center text-xs font-bold uppercase tracking-wide
                             ${isSelected
                               ? "bg-[#f472b6] text-white"
                               : "bg-white text-black/60 border-t border-black/10"}`}
              >
                {side === "original" ? "Original" : "Cleaned ✨"}
              </div>

              {/* Selection checkmark */}
              {isSelected && (
                <div className="absolute top-2 right-2 bg-[#f472b6] rounded-full p-0.5 shadow">
                  <CheckCircle2 className="w-5 h-5 text-white" fill="white" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="flex-shrink-0 px-4 py-4 bg-white border-t-2 border-black flex flex-col gap-2"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => onSave(selected)}
          className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
        >
          <Sparkles className="w-4 h-4" />
          {selected === "cleaned" ? "Save Cleaned Version" : "Save Original"}
        </button>
        <button
          onClick={onCancel}
          className="w-full py-3 rounded-xl text-sm font-bold uppercase border-2 border-black/20
                     text-black/40 hover:text-black hover:border-black/40 transition-all"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item: ClothingItem | null;
  onClose: () => void;
  onDeleted?: () => void;
  /** When true (search results, favorites): show "Add to Lookbook" instead of "Clean Up Photo".
   *  "Wearing Today" always shows regardless. */
  showAddToLookbook?: boolean;
}

interface FormState {
  name: string;
  brand: string;
  color: string;
  size: string;
  season: string;
  occasion: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
  isFavorite: boolean;
  category: string;
  timesWorn: string;
  visibility: "private" | "public";
}

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
    timesWorn:     String(item.timesWorn ?? 0),
    visibility:    item.visibility === "public" ? "public" : "private",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")  ||
    form.timesWorn     !== String(item.timesWorn ?? 0) ||
    form.visibility    !== (item.visibility === "public" ? "public" : "private")
  );
}

export function ItemDetailsSheet({ item, onClose, onDeleted, showAddToLookbook = false }: ItemDetailsSheetProps) {
  const [form, setForm]           = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgError,    setBgError]    = useState<string | null>(null);
  // compare overlay: holds both data URLs while user picks
  const [compareState, setCompareState] = useState<{
    originalDataUrl: string;
    cleanedDataUrl:  string;
  } | null>(null);
  // optimistic display URL — set immediately on save so there is no flash
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  // track whether a background save is in progress (for cleanup on unmount)
  const bgSaveAbortRef = useRef(false);
  // set to true when the user skips while analysis is still running
  const bgAnalysisAbortRef = useRef(false);

  // ── Wearing Today (item-level) ────────────────────────────────────────────
  const [showLookbookSheet, setShowLookbookSheet] = useState(false);
  const [itemWornToday, setItemWornToday] = useState(false);
  const prevItemWornRef = useRef<{ timesWorn: number; lastWornDate: string | null } | null>(null);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const formatShortDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m}/${d}/${String(y).slice(2)}`;
  };

  const handleWearItem = () => {
    if (!item) return;
    const newTimesWorn = (item.timesWorn ?? 0) + 1;
    prevItemWornRef.current = { timesWorn: item.timesWorn ?? 0, lastWornDate: item.lastWornDate ?? null };
    setItemWornToday(true);
    setForm((prev) => prev ? { ...prev, timesWorn: String(newTimesWorn) } : prev);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: newTimesWorn, lastWornDate: todayStr } },
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      }},
    );
  };

  const handleUnwearItem = () => {
    if (!item || !prevItemWornRef.current) return;
    const prev = prevItemWornRef.current;
    setItemWornToday(false);
    setForm((f) => f ? { ...f, timesWorn: String(prev.timesWorn) } : f);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: prev.timesWorn, lastWornDate: prev.lastWornDate } },
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      }},
    );
    prevItemWornRef.current = null;
  };

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();
  const { user }            = useAuth();
  const { data: myProfile } = useMyProfile(user?.id);
  const [showAuthSheet,   setShowAuthSheet]   = useState(false);
  const [showSharingMode,  setShowSharingMode]  = useState(false);
  const [showPrivateGate,  setShowPrivateGate]  = useState(false);
  const [publishError,    setPublishError]    = useState<string | null>(null);
  const postAuthSharingRef = useRef(false);

  // Reset form whenever item changes
  useEffect(() => {
    if (item) setForm(toForm(item));
    setShowDeleteConfirm(false);
  }, [item?.id]);

  // After background save completes the query re-fetches with a new imageObjectPath.
  // Clear the optimistic local URL so the freshly-stored file takes over.
  useEffect(() => {
    setLocalImageUrl(null);
  }, [item?.imageObjectPath]);

  // Declared before the early return so the hook call count is stable across
  // all renders. The ref is kept current via assignment after the guard below.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const handleSaveRef = useRef<() => void>(() => {});

  if (!item || !form) return null;

  const dirty = isDirty(form, item);

  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  const handleSave = () => {
    const prevVisibility = item.visibility === "public" ? "public" : "private";
    const newVisibility  = form.visibility;

    updateItem.mutate(
      {
        id: item.id,
        data: {
          // Always send every editable field so the backend can clear it when empty.
          // Backend converts "" → null in DB.
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim(),
          color:         form.color.trim(),
          size:          form.size.trim(),
          season:        form.season,
          occasion:      form.occasion,
          purchasePrice: form.purchasePrice.trim(),
          purchaseDate:  form.purchaseDate.trim(),
          notes:         form.notes.trim(),
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
          timesWorn:     Math.max(0, parseInt(form.timesWorn, 10) || 0),
          visibility:    newVisibility,
        },
      },
      {
        onSuccess: (savedItem) => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          setPublishError(null);
          // Sync to Supabase then invalidate the Discover cache so the item
          // appears immediately. Uses getSession() directly to avoid stale
          // React user state (important for auto-publish-after-sign-in).
          if (savedItem && isSupabaseConfigured()) {
            // Run Supabase sync BEFORE closing so publish errors remain visible
            // and so invalidateQueries fires while the sheet is still mounted
            // (guaranteeing the Discover feed refetches regardless of whether
            // that tab is currently active).
            getSupabase().auth.getSession().then(async ({ data: { session } }) => {
              const uid = session?.user?.id;
              if (uid) {
                if (newVisibility !== "private") {
                  const result = await publishItem(savedItem, uid);
                  if (!result.ok) {
                    setPublishError(`Could not publish to Discover: ${result.error}`);
                    return; // keep sheet open so the user sees the error
                  }
                  queryClient.invalidateQueries({ queryKey: ["community"] });
                } else if (prevVisibility !== "private") {
                  await unpublishItem(item.id, uid);
                  queryClient.invalidateQueries({ queryKey: ["community"] });
                }
              }
              onClose();
            });
          } else {
            onClose();
          }
        },
      }
    );
  };
  // Keep the ref pointing at the latest handleSave so AuthSheet's onSuccess
  // callback (captured at render time) always calls the current version.
  handleSaveRef.current = handleSave;

  // ── Step 1: run bg removal, then show compare overlay ────────────────────
  const handleCleanUpPhoto = async () => {
    if (!item.imageObjectPath) return;
    const displayUrl = getImageUrl(item.imageObjectPath);
    if (!displayUrl) return;

    bgAnalysisAbortRef.current = false;
    setBgError(null);
    setBgRemoving(true);
    try {
      const srcBlob        = await fetch(displayUrl).then((r) => r.blob());
      const originalDataUrl = await blobToDataUrl(srcBlob);
      const cleanedDataUrl  = await removeBackground(originalDataUrl);
      // User tapped "Keep Original" while WASM was running — discard result
      if (bgAnalysisAbortRef.current) return;
      setCompareState({ originalDataUrl, cleanedDataUrl });
    } catch (err) {
      console.error("[details] bg removal failed:", err);
      setBgError("Could not remove background. Please try again.");
    } finally {
      setBgRemoving(false);
    }
  };

  // ── Step 2: user confirmed their choice in the overlay ────────────────────
  const handleCompareSave = async (choice: "original" | "cleaned") => {
    if (!compareState) return;

    // Immediately update the visible photo — no flash while DB write runs.
    const chosenUrl = choice === "cleaned"
      ? compareState.cleanedDataUrl
      : compareState.originalDataUrl;
    setLocalImageUrl(chosenUrl);
    setCompareState(null);

    if (choice === "original") {
      // Nothing changed in storage — original is already saved.
      return;
    }

    // Save cleaned version in the background.
    bgSaveAbortRef.current = false;
    try {
      const blob        = await dataUrlToBlob(compareState.cleanedDataUrl);
      const newFilename = await saveImage(
        blob,
        `${item.category}-${item.id}-cleaned-${Date.now()}.png`,
      );
      if (bgSaveAbortRef.current) return; // component unmounted
      if (item.imageObjectPath) await deleteImage(item.imageObjectPath);
      updateItem.mutate(
        { id: item.id, data: { imageObjectPath: newFilename } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
            // imageObjectPath changed → useEffect clears localImageUrl
          },
        },
      );
    } catch (err) {
      console.error("[details] background save failed:", err);
      // The chosen image is still showing optimistically; a silent failure
      // here means the item reverts on next open. Acceptable trade-off.
    }
  };

  const handleDelete = () => {
    // Unpublish from Supabase before deleting locally (fire-and-forget)
    if (user && (item.visibility ?? "private") !== "private") {
      unpublishItem(item.id, user.id);
    }
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
          onDeleted?.();
          onClose();
        },
      }
    );
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
    >
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3
                      bg-white border-b-2 border-black flex-shrink-0"
           style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">
          Item Details
        </h2>
        <div className="flex items-center gap-2">
          {/* Favourite toggle — saves instantly */}
          <button
            onClick={() => {
              const next = !form.isFavorite;
              patch("isFavorite")(next);
              updateItem.mutate(
                { id: item.id, data: { isFavorite: next } },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
                    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
                  },
                }
              );
            }}
            className={`w-9 h-9 border-2 border-black rounded-full flex items-center justify-center transition-all
                        ${form.isFavorite
                          ? "bg-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
            title="Favourite"
          >
            <Heart
              className="w-4 h-4"
              fill={form.isFavorite ? "white" : "none"}
              stroke={form.isFavorite ? "white" : "currentColor"}
            />
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Photo ── */}
      {item.imageObjectPath && (
        <div className="flex-shrink-0 border-b-2 border-black">
          <div
            className="w-full h-52"
            style={{
              backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
              backgroundSize: "16px 16px",
            }}
          >
            <img
              src={localImageUrl ?? getImageUrl(item.imageObjectPath)!}
              alt={item.name}
              className="w-full h-full object-contain"
            />
          </div>
        </div>
      )}

      {/* ── Action buttons (always shown) ── */}
      <div className="flex-shrink-0 border-b-2 border-black px-4 py-2 bg-white flex flex-col gap-2">
        {/* Button 1: Add to Lookbook OR Clean Up Photo */}
        {showAddToLookbook ? (
          <button
            onClick={() => setShowLookbookSheet(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       border-2 border-black bg-[#f9f4ee] font-bold text-sm uppercase tracking-wide
                       shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                       active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <Heart className="w-4 h-4 fill-yellow-400 text-yellow-400" /> Add to Lookbook
          </button>
        ) : (
          item.imageObjectPath && !item.imageObjectPath.includes('-cleaned-') && (
            <>
              <button
                onClick={handleCleanUpPhoto}
                disabled={bgRemoving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           border-2 border-black bg-[#f9f4ee] font-bold text-sm uppercase tracking-wide
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           disabled:opacity-50 transition-all"
              >
                {bgRemoving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Photo…</>
                  : <><Sparkles className="w-4 h-4" /> Clean Up Photo ✨</>}
              </button>
              {bgRemoving && (
                <button
                  onClick={() => { bgAnalysisAbortRef.current = true; setBgRemoving(false); }}
                  className="w-full py-1.5 text-xs font-semibold text-black/40 hover:text-black/70 transition-colors"
                >
                  Keep Original
                </button>
              )}
              {bgError && <p className="text-xs text-red-600 text-center">{bgError}</p>}
            </>
          )
        )}
      </div>

      {/* ── Form ── */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-4">

        {/* Name */}
        <Field
          label="Item Name"
          value={form.name}
          onChange={patch("name") as (v: string) => void}
          placeholder="e.g. White Linen Shirt"
        />

        {/* Brand + Color */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"  value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="Nike, Zara…" />
          <Field label="Color"  value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Navy Blue" />
        </div>

        {/* Size — hidden for accessories */}
        {item.category !== "accessories" && (
          <Field label="Size" value={form.size} onChange={patch("size") as (v: string) => void} placeholder="S, M, L, 32, 8…" />
        )}

        {/* Season + Occasion */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
          <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
        </div>

        {/* Price + Date */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
          <Field label="Purchase Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => patch("notes")(e.target.value)}
            placeholder="Anything worth remembering…"
            rows={3}
            className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                       bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none
                       placeholder:font-normal placeholder:text-black/25"
          />
        </div>

        {/* ── Community: Visibility ── */}
        <div className="border-2 border-black/10 rounded-xl p-3 bg-white flex flex-col gap-3">
          <VisibilityPicker
            value={form.visibility}
            onChange={(v) => {
              patch("visibility")(v);
              if (v === "public" && user && isSupabaseConfigured()) {
                if (myProfile?.privacy_mode === "private") {
                  // Private-mode user — ask them to switch participation first
                  setShowPrivateGate(true);
                } else if (hasSavedPref()) {
                  // Has a remembered preference — apply it silently.
                  // User still taps Save to complete the publish.
                  getSupabase().auth.getSession().then(async ({ data: { session } }) => {
                    if (session?.user?.id) await changePrivacyMode(session.user.id, getSharingPref());
                  });
                } else {
                  setShowSharingMode(true);
                }
              }
            }}
            onNeedSignIn={() => {
              // Not logged in — pre-select Public then open AuthSheet directly.
              patch("visibility")("public");
              setShowAuthSheet(true);
            }}
            isSignedIn={Boolean(user)}
          />
        </div>

        {/* Category + Times Worn */}
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={form.category}
            onChange={patch("category") as (v: string) => void}
            options={CATEGORY_OPTIONS}
          />
          <div className="flex flex-col gap-1">
            <Field
              label="Times Worn"
              type="number"
              value={form.timesWorn}
              onChange={patch("timesWorn") as (v: string) => void}
              placeholder="0"
            />
            {item.lastWornDate && (() => {
              const [y, m, d] = item.lastWornDate.split("-").map(Number);
              return (
                <span className="text-[10px] font-semibold text-black/40 pl-1">
                  Last worn: {m}/{d}/{String(y).slice(2)}
                </span>
              );
            })()}
          </div>
        </div>

      </div>

      {/* ── Footer actions ── */}
      <div className="sticky bottom-0 px-4 py-4 bg-white border-t-2 border-black flex-shrink-0 flex flex-col gap-2">

        {/* Publish error (set when Supabase upsert fails after a local save) */}
        {publishError && (
          <p className="text-xs text-red-600 text-center -mb-1">{publishError}</p>
        )}

        {/* Save (only when dirty) */}
        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={handleSave}
              disabled={updateItem.isPending}
              className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              {updateItem.isPending ? "Saving…" : "Save Changes"}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Delete */}
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                       font-bold uppercase border-2 border-black/20 text-black/35
                       hover:border-red-500 hover:text-red-600 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete from Closet Forever
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-red-600
                         bg-red-500 text-white
                         shadow-[2px_2px_0px_0px_rgba(185,28,28,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                         disabled:opacity-50"
            >
              {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
            </button>
          </div>
        )}
      </div>
    </motion.div>

    {/* ── Compare overlay ── */}
    <AnimatePresence>
      {compareState && (
        <BgCompareOverlay
          originalDataUrl={compareState.originalDataUrl}
          cleanedDataUrl={compareState.cleanedDataUrl}
          onSave={handleCompareSave}
          onCancel={() => setCompareState(null)}
        />
      )}
    </AnimatePresence>

    {/* ── Add to Lookbook sheet ── */}
    <AnimatePresence>
      {showLookbookSheet && (
        <AddToLookbookSheet item={item} onClose={() => setShowLookbookSheet(false)} />
      )}
    </AnimatePresence>

    {/* ── Sharing mode picker ── */}
    <AnimatePresence>
      {showSharingMode && (
        <SharingModeSheet
          onCancel={() => {
            setShowSharingMode(false);
            if (postAuthSharingRef.current) {
              postAuthSharingRef.current = false;
              patch("visibility")("private"); // revert if cancelled after auth
            }
          }}
          onConfirm={async (mode) => {
            setShowSharingMode(false);
            const { data: { session } } = await getSupabase().auth.getSession();
            const uid = session?.user?.id;
            if (uid) await changePrivacyMode(uid, mode);
            if (postAuthSharingRef.current) {
              postAuthSharingRef.current = false;
              handleSaveRef.current(); // auto-save for the post-auth flow
            }
            // For already-logged-in flow: user taps Save manually
          }}
        />
      )}
    </AnimatePresence>
    {/* ── Private gate (globe tapped while in Private mode) ── */}
    <AnimatePresence>
      {showPrivateGate && (
        <PrivateGateSheet
          action="share"
          onClose={() => {
            setShowPrivateGate(false);
            patch("visibility")("private"); // revert the picker
          }}
          onConfirm={async (mode) => {
            setShowPrivateGate(false);
            const { data: { session } } = await getSupabase().auth.getSession();
            const uid = session?.user?.id;
            if (uid) {
              await changePrivacyMode(uid, mode);
              setSharingPref(mode);
              handleSaveRef.current(); // auto-save with new mode
            }
          }}
        />
      )}
    </AnimatePresence>
    {/* ── Auth sheet ── */}
    <AnimatePresence>
      {showAuthSheet && (
        <AuthSheet
          onClose={() => {
            setShowAuthSheet(false);
            patch("visibility")("private"); // revert if user closes without signing in
          }}
          onSuccess={() => {
            setShowAuthSheet(false);
            if (hasSavedPref()) {
              // Returning user with a saved preference — skip the picker
              const mode = getSharingPref();
              getSupabase().auth.getSession().then(async ({ data: { session } }) => {
                const uid = session?.user?.id;
                if (uid) await changePrivacyMode(uid, mode);
                handleSaveRef.current();
              });
            } else {
              postAuthSharingRef.current = true;
              setShowSharingMode(true);
            }
          }}
        />
      )}
    </AnimatePresence>
    </>
  );
}
