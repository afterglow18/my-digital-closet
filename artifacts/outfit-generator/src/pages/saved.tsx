import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  useListOutfits,
  useListClothing,
  useDeleteOutfit,
  useRenameOutfit,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  useUpdateClothingItem,
  getListOutfitsQueryKey,
  getListClothingQueryKey,
  ClothingItem,
} from "@/lib/local-api";
import { Trash2, Bookmark, Plus, Pencil, Check, X, Shirt, Search } from "lucide-react";
import { search as searchFn } from "@/lib/search";
import { motion, AnimatePresence } from "framer-motion";
import { getImageUrl } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useEntitlements } from "@/hooks/useEntitlements";
import { UpgradeSheet } from "@/components/paywall/UpgradeSheet";
import { FREE_OUTFIT_LIMIT } from "@/lib/entitlements";
import { WardrobePickerSheet } from "@/components/clothing/WardrobePickerSheet";
import { ItemDetailsSheet } from "@/components/clothing/ItemDetailsSheet";

const SLOT_ORDER = ["tops", "bottoms", "shoes", "dresses", "outerwear", "accessories"] as const;
type SlotKey = (typeof SLOT_ORDER)[number];

const SLOT_LABELS: Record<SlotKey, string> = {
  tops: "Top",
  bottoms: "Bottom",
  shoes: "Shoes",
  dresses: "Dress",
  outerwear: "Jacket",
  accessories: "Acc",
};

function ItemPhoto({
  item,
  size = "md",
  onClick,
}: {
  item: ClothingItem;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}) {
  const sizeClass = size === "lg" ? "h-32" : size === "md" ? "h-24" : "h-16";
  return (
    <button
      onClick={onClick}
      className={`w-full ${sizeClass} border-2 border-black overflow-hidden relative`}
      style={{ background: "#FDECEF", padding: 0, display: "block" }}
    >
      {item.imageObjectPath ? (
        <img
          src={getImageUrl(item.imageObjectPath)!}
          alt={item.name}
          className="w-full h-full object-contain"
          style={{ objectFit: "contain", objectPosition: "center" }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          <span className="text-[9px] font-bold uppercase text-center leading-tight text-black/30">—</span>
        </div>
      )}
      {item.isFavorite && (
        <span className="absolute top-1 right-1 text-[10px] leading-none">❤️</span>
      )}
    </button>
  );
}

export default function SavedPage() {
  const { data: outfits, isLoading } = useListOutfits();
  const deleteOutfit = useDeleteOutfit();
  const renameOutfit = useRenameOutfit();
  const removeItemFromOutfit = useRemoveItemFromOutfit();
  const addItemToOutfit = useAddItemToOutfit();
  const queryClient = useQueryClient();
  const updateItem = useUpdateClothingItem();
  const { tier } = useEntitlements();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsFromSearch, setDetailsFromSearch] = useState(false);
  const { data: allItems = [] } = useListClothing({});
  const [wornTodayIds, setWornTodayIds] = useState<Set<number>>(new Set());
  // Keep the open details sheet in sync with live item data (e.g. lastWornDate
  // stamped by "Wearing Today" on an outfit card while the sheet is open).
  useEffect(() => {
    if (!detailsItem) return;
    const fresh = allItems.find((i) => i.id === detailsItem.id);
    if (fresh && fresh !== detailsItem) setDetailsItem(fresh);
  }, [allItems]); // eslint-disable-line

  // Scroll to top the instant the user starts searching
  useEffect(() => { if (searchQuery) window.scrollTo({ top: 0 }); }, [!!searchQuery]); // eslint-disable-line

  // Memoized search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchFn(searchQuery, allItems, outfits ?? []);
  }, [searchQuery, allItems, outfits]);

  // Remembers the outfit date before "Wearing Today" so Undo can restore it.
  const prevWornDatesRef = useRef<Map<number, string | null>>(new Map());
  // Remembers each item's lastWornDate before "Wearing Today" stamps today on them.
  // Map<outfitId, Map<itemId, prevDate>>
  const prevItemWornDatesRef = useRef<Map<number, Map<number, string | null>>>(new Map());
  const [replacingSlot, setReplacingSlot] = useState<{ outfitId: number; category: SlotKey } | null>(null);
  const [detailsItem, setDetailsItem] = useState<ClothingItem | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [editingNotesId, setEditingNotesId] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const notesInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    if (editingNotesId !== null) notesInputRef.current?.focus();
  }, [editingNotesId]);

  const startRename = (id: number, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = (id: number) => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== outfits?.find((o) => o.id === id)?.name) {
      renameOutfit.mutate(
        { id, data: { name: trimmed } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    }
    setRenamingId(null);
  };

  const startEditNotes = (id: number, currentNotes: string | null | undefined) => {
    setEditingNotesId(id);
    setNotesValue(currentNotes ?? "");
  };

  const commitNotes = (id: number) => {
    const trimmed = notesValue.trim();
    const current = outfits?.find((o) => o.id === id)?.notes ?? "";
    if (trimmed !== (current ?? "")) {
      renameOutfit.mutate(
        { id, data: { notes: trimmed || null } },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
      );
    }
    setEditingNotesId(null);
  };

  const isFree = tier === "free";
  const outfitCount = outfits?.length ?? 0;
  const atLimit = isFree && outfitCount >= FREE_OUTFIT_LIMIT;

  const handleDelete = (id: number) => {
    deleteOutfit.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
        },
      }
    );
  };

  const handleRemoveItem = (outfitId: number, itemId: number) => {
    removeItemFromOutfit.mutate(
      { id: outfitId, itemId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
  };

  /** "YYYY-MM-DD" in the device's local timezone — changes at local midnight. */
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  /** Formats "YYYY-MM-DD" → "M/D/YY" */
  const formatShortDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${m}/${d}/${String(y).slice(2)}`;
  };

  const handleWearToday = (outfitId: number, items: ClothingItem[], currentLastWornDate?: string | null) => {
    if (items.length === 0) return;
    // Remember the old date so Unwear can restore it this session
    prevWornDatesRef.current.set(outfitId, currentLastWornDate ?? null);
    // Optimistic: show logged state instantly
    setWornTodayIds((prev) => new Set([...prev, outfitId]));
    // Remember each item's previous lastWornDate before overwriting
    const itemDates = new Map<number, string | null>();
    items.forEach((item) => itemDates.set(item.id, item.lastWornDate ?? null));
    prevItemWornDatesRef.current.set(outfitId, itemDates);
    // Increment every item's wear count and stamp today's date on each
    items.forEach((item) => {
      updateItem.mutate({ id: item.id, data: { timesWorn: (item.timesWorn ?? 0) + 1, lastWornDate: todayStr } });
    });
    // Persist today's date on the outfit so it survives app restarts
    renameOutfit.mutate({ id: outfitId, data: { lastWornDate: todayStr } });
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
  };

  const handleUnwearToday = (outfitId: number, items: ClothingItem[]) => {
    // Restore the date that was showing before "Wearing This Today" was tapped
    const restoredDate = prevWornDatesRef.current.get(outfitId) ?? null;
    prevWornDatesRef.current.delete(outfitId);
    // Remove optimistic state
    setWornTodayIds((prev) => {
      const next = new Set(prev);
      next.delete(outfitId);
      return next;
    });
    // Decrement every item's wear count and restore their previous lastWornDate
    const itemDates = prevItemWornDatesRef.current.get(outfitId);
    prevItemWornDatesRef.current.delete(outfitId);
    items.forEach((item) => {
      const prevDate = itemDates?.get(item.id) ?? null;
      updateItem.mutate({ id: item.id, data: { timesWorn: Math.max(0, (item.timesWorn ?? 1) - 1), lastWornDate: prevDate } });
    });
    // Restore the previous date (or null if it was never worn before)
    renameOutfit.mutate({ id: outfitId, data: { lastWornDate: restoredDate } });
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
  };

  const handlePickedItem = (item: ClothingItem) => {
    if (replacingSlot == null) return;
    addItemToOutfit.mutate(
      { id: replacingSlot.outfitId, itemId: item.id },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() }) }
    );
  };

  return (
    <div className="min-h-full flex flex-col pt-8 px-4 pb-8 bg-secondary/10 relative">
      <header className="mb-6">
        <h1 className="text-4xl font-display font-bold uppercase tracking-tighter mb-1">Lookbook</h1>
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-sm">Hall of fame.</p>

          {/* Free tier outfit usage badge */}
          {isFree && outfitCount > 0 && (
            <button
              onClick={() => setShowUpgrade(true)}
              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
                          border-2 transition-colors
                          ${atLimit
                            ? "bg-black text-white border-black"
                            : outfitCount >= FREE_OUTFIT_LIMIT - 1
                            ? "bg-primary border-black text-black"
                            : "bg-white border-black/20 text-black/40 hover:border-black/40"
                          }`}
            >
              {outfitCount}/{FREE_OUTFIT_LIMIT} saved
            </button>
          )}
        </div>
      </header>

      {/* ── Search bar ── */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, category, or notes…"
          className="w-full pl-9 pr-9 py-2.5 rounded-full border-2 border-black bg-white text-sm font-medium
                     focus:outline-none focus:ring-2 focus:ring-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     placeholder:text-black/30 placeholder:font-normal"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center
                       rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Search results ── */}
      {searchResults && (
        <div className="flex flex-col gap-6">
          {searchResults.items.length === 0 && searchResults.groups.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm font-bold text-black/40 uppercase tracking-wide">No results</p>
              <p className="text-xs text-black/30 mt-1">Try a different search term</p>
            </div>
          ) : (
            <>
              {searchResults.items.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3">Items</h3>
                  <div className="flex flex-col gap-2">
                    {searchResults.items.map(({ item }) => (
                      <button
                        key={item.id}
                        onClick={() => { setDetailsFromSearch(true); setDetailsItem(item); }}
                        className="flex items-center gap-3 bg-white border-2 border-black rounded-xl p-3
                                   shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                   active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-left"
                      >
                        <div
                          className="w-12 h-12 border border-black/20 rounded overflow-hidden flex-shrink-0"
                          style={{ background: '#FDECEF' }}
                        >
                          {item.imageObjectPath ? (
                            <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-lg opacity-30">👚</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{item.name || '—'}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">{item.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {searchResults.groups.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3">Saved Looks</h3>
                  <div className="flex flex-col gap-2">
                    {searchResults.groups.map(({ outfit }) => (
                      <button
                        key={outfit.id}
                        onClick={() => setSearchQuery('')}
                        className="flex items-center gap-3 bg-white border-2 border-black rounded-xl p-3
                                   shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                   active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-left"
                      >
                        <div className="flex gap-1 flex-shrink-0">
                          {(outfit.items ?? []).slice(0, 3).map((ti) => (
                            <div
                              key={ti.id}
                              className="w-10 h-10 border border-black/20 rounded overflow-hidden"
                              style={{ background: '#FDECEF' }}
                            >
                              {ti.imageObjectPath ? (
                                <img src={getImageUrl(ti.imageObjectPath)!} alt={ti.name} className="w-full h-full object-contain" />
                              ) : (
                                <div className="w-full h-full" />
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="flex-1 font-display font-bold text-sm uppercase tracking-tight truncate">
                          {outfit.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Normal content (hidden during search) ── */}
      {!searchResults && atLimit && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 border-2 border-black rounded-xl bg-primary p-4
                     shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <p className="font-display font-bold text-sm uppercase tracking-tight">
            🔓 Lookbook is full
          </p>
          <p className="text-xs text-black/60 mt-1 mb-3 leading-snug">
            You've saved {FREE_OUTFIT_LIMIT} outfits — the free limit.
            Unlock Forever to save unlimited looks.
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full py-2.5 rounded-lg border-2 border-black bg-primary text-black
                       font-bold uppercase text-xs tracking-wide
                       shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            Lifetime Unlock – $9.99
          </button>
        </motion.div>
      )}

      {!searchResults && (isLoading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-muted animate-pulse border-2 border-black rounded-xl" />
          ))}
        </div>
      ) : outfits && outfits.length > 0 ? (
        <div className="flex flex-col gap-6">
          {outfits.map((outfit) => {
            // Group items by category for structured display
            const byCategory = (outfit.items ?? []).reduce<Partial<Record<SlotKey, ClothingItem>>>(
              (acc, item) => {
                const key = item.category as SlotKey;
                if (SLOT_ORDER.includes(key) && !acc[key]) acc[key] = item;
                return acc;
              },
              {}
            );

            // Primary slots: the "look" — tops/dresses as hero, bottoms, shoes
            const heroItem = byCategory["dresses"] ?? byCategory["tops"];
            const bottomItem = byCategory["bottoms"];
            const shoesItem = byCategory["shoes"];
            const outerwearItem = byCategory["outerwear"];

            // Secondary slots (any items not shown in the primary layout)
            const primaryShown = new Set([
              byCategory["tops"]?.id,
              byCategory["dresses"]?.id,
              byCategory["bottoms"]?.id,
              byCategory["shoes"]?.id,
            ]);
            const extras = (outfit.items ?? []).filter((i) => !primaryShown.has(i.id));

            return (
              <motion.div
                key={outfit.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl overflow-hidden"
                data-testid={`outfit-card-${outfit.id}`}
              >
                {/* Card header */}
                <div className="px-4 py-3 border-b-2 border-black flex justify-between items-center bg-primary gap-2">
                  {renamingId === outfit.id ? (
                    <form
                      className="flex-1 flex items-center gap-1"
                      onSubmit={(e) => { e.preventDefault(); commitRename(outfit.id); }}
                    >
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(outfit.id)}
                        maxLength={60}
                        className="flex-1 font-display font-bold text-lg uppercase tracking-tight bg-white/60 border-2 border-black rounded-lg px-2 py-0.5 outline-none min-w-0"
                      />
                      <button type="submit" className="w-7 h-7 flex items-center justify-center bg-primary border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => startRename(outfit.id, outfit.name)}
                      className="flex-1 flex items-center gap-1.5 text-left group min-w-0"
                    >
                      <h3 className="font-display font-bold text-lg uppercase tracking-tight truncate">{outfit.name}</h3>
                      <Pencil className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(outfit.id)}
                    className="w-8 h-8 flex items-center justify-center bg-primary border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-colors shrink-0"
                    data-testid={`button-delete-outfit-${outfit.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Notes */}
                <div className="px-4 py-2 border-b border-black/10">
                  {editingNotesId === outfit.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); commitNotes(outfit.id); }} className="flex gap-2">
                      <textarea
                        ref={notesInputRef}
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onBlur={() => commitNotes(outfit.id)}
                        rows={2}
                        maxLength={300}
                        placeholder="Add notes…"
                        className="flex-1 text-xs border-2 border-black rounded-lg px-2 py-1.5 resize-none outline-none focus:ring-2 focus:ring-primary bg-white"
                      />
                      <button type="submit" className="self-start w-7 h-7 flex items-center justify-center bg-primary text-black border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => startEditNotes(outfit.id, outfit.notes)}
                      className="w-full text-left group"
                    >
                      {outfit.notes ? (
                        <p className="text-xs text-black/60 leading-snug flex items-start gap-1">
                          <span className="flex-1">{outfit.notes}</span>
                          <Pencil className="w-3 h-3 shrink-0 mt-0.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                        </p>
                      ) : (
                        <p className="text-xs text-black/25 italic">Add notes…</p>
                      )}
                    </button>
                  )}
                </div>

                {/* Outfit grid */}
                <div className="p-3">
                  {/* Main 3-column look: top · bottom · shoes */}
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {/* Hero: top or dress */}
                    <div className="flex flex-col gap-0.5">
                      {heroItem ? (
                        <>
                          <ItemPhoto item={heroItem} size="lg" onClick={() => setDetailsItem(heroItem)} />
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">
                              {byCategory["dresses"] ? "Dress" : "Top"}
                            </span>
                            <button onClick={() => handleRemoveItem(outfit.id, heroItem.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-100 transition-colors">
                              <X className="w-2.5 h-2.5 text-black/50" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => setReplacingSlot({ outfitId: outfit.id, category: byCategory["dresses"] ? "dresses" : "tops" })}
                          className="h-32 w-full border-2 border-dashed border-black/25 rounded flex flex-col items-center justify-center gap-1 hover:border-black/50 hover:bg-black/5 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-black/30" />
                          <span className="text-[9px] font-bold uppercase text-black/25">{byCategory["dresses"] ? "Add Dress" : "Add Top"}</span>
                        </button>
                      )}
                    </div>

                    {/* Bottom */}
                    <div className="flex flex-col gap-0.5">
                      {bottomItem && !byCategory["dresses"] ? (
                        <>
                          <ItemPhoto item={bottomItem} size="lg" onClick={() => setDetailsItem(bottomItem)} />
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Bottom</span>
                            <button onClick={() => handleRemoveItem(outfit.id, bottomItem.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-100 transition-colors">
                              <X className="w-2.5 h-2.5 text-black/50" />
                            </button>
                          </div>
                        </>
                      ) : byCategory["dresses"] && outerwearItem ? (
                        <>
                          <ItemPhoto item={outerwearItem} size="lg" onClick={() => setDetailsItem(outerwearItem)} />
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Jacket</span>
                            <button onClick={() => handleRemoveItem(outfit.id, outerwearItem.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-100 transition-colors">
                              <X className="w-2.5 h-2.5 text-black/50" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => setReplacingSlot({ outfitId: outfit.id, category: byCategory["dresses"] ? "outerwear" : "bottoms" })}
                          className="h-32 w-full border-2 border-dashed border-black/25 rounded flex flex-col items-center justify-center gap-1 hover:border-black/50 hover:bg-black/5 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-black/30" />
                          <span className="text-[9px] font-bold uppercase text-black/25">{byCategory["dresses"] ? "Add Jacket" : "Add Bottom"}</span>
                        </button>
                      )}
                    </div>

                    {/* Shoes */}
                    <div className="flex flex-col gap-0.5">
                      {shoesItem ? (
                        <>
                          <ItemPhoto item={shoesItem} size="lg" onClick={() => setDetailsItem(shoesItem)} />
                          <div className="flex items-center justify-between px-0.5">
                            <span className="text-[9px] font-bold uppercase text-muted-foreground">Shoes</span>
                            <button onClick={() => handleRemoveItem(outfit.id, shoesItem.id)}
                              className="w-4 h-4 flex items-center justify-center rounded-full bg-black/10 hover:bg-red-100 transition-colors">
                              <X className="w-2.5 h-2.5 text-black/50" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => setReplacingSlot({ outfitId: outfit.id, category: "shoes" })}
                          className="h-32 w-full border-2 border-dashed border-black/25 rounded flex flex-col items-center justify-center gap-1 hover:border-black/50 hover:bg-black/5 transition-colors"
                        >
                          <Plus className="w-4 h-4 text-black/30" />
                          <span className="text-[9px] font-bold uppercase text-black/25">Add Shoes</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Accessories — 5-slot grid, filled items + empty "+" slots */}
                  {(() => {
                    const MAX_SLOTS = 5;
                    const allAccItems = extras.filter((i) => i.category === "accessories");
                    const accItems = allAccItems.slice(0, MAX_SLOTS);
                    const otherExtras = extras.filter((i) => i.category !== "accessories");
                    const emptySlots = Math.max(0, MAX_SLOTS - accItems.length);
                    return (
                      <div className="pt-1 border-t border-black/10">
                        {/* Non-accessory extras (outerwear etc.) if any */}
                        {otherExtras.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
                            {otherExtras.map((item) => (
                              <div key={item.id} className="flex-none flex flex-col items-center gap-0.5 relative">
                                <button onClick={() => setDetailsItem(item)}>
                                  <div className="w-14 h-14 border-2 border-black overflow-hidden" style={{ background: "#FDECEF" }}>
                                    {item.imageObjectPath ? (
                                      <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-[8px] font-bold uppercase text-black/30">—</span>
                                      </div>
                                    )}
                                  </div>
                                </button>
                                <button onClick={() => handleRemoveItem(outfit.id, item.id)}
                                  className="absolute top-0 right-0 w-4 h-4 bg-white border border-black rounded-full flex items-center justify-center shadow-sm z-10">
                                  <X className="w-2 h-2" />
                                </button>
                                {item.isFavorite && <span className="absolute top-0 left-0 text-[9px] leading-none">❤️</span>}
                                <span className="text-[8px] font-bold uppercase text-muted-foreground">
                                  {SLOT_LABELS[item.category as SlotKey] ?? item.category}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* 5-slot accessory row */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {accItems.map((item) => (
                            <div key={item.id} className="flex flex-col items-center gap-0.5 relative">
                              <button onClick={() => setDetailsItem(item)} className="w-full">
                                <div className="w-full aspect-square border-2 border-black overflow-hidden" style={{ background: "#FDECEF" }}>
                                  {item.imageObjectPath ? (
                                    <img src={getImageUrl(item.imageObjectPath)!} alt={item.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-[8px] font-bold uppercase text-black/30">—</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                              <button onClick={() => handleRemoveItem(outfit.id, item.id)}
                                className="absolute top-0 right-0 w-4 h-4 bg-white border border-black rounded-full flex items-center justify-center shadow-sm z-10">
                                <X className="w-2 h-2" />
                              </button>
                              <span className="text-[8px] font-bold uppercase text-muted-foreground truncate w-full text-center">Acc</span>
                              {item.isFavorite && <span className="absolute top-0 left-0 text-[9px] leading-none">⭐</span>}
                            </div>
                          ))}
                          {Array.from({ length: emptySlots }).map((_, i) => (
                            <button
                              key={`empty-${i}`}
                              onClick={() => setReplacingSlot({ outfitId: outfit.id, category: "accessories" })}
                              className="flex flex-col items-center gap-0.5"
                            >
                              <div
                                className="w-full aspect-square border-2 border-dashed border-black/25 rounded flex items-center justify-center"
                                style={{ background: "#FAFAFA" }}
                              >
                                <Plus className="w-3.5 h-3.5 text-black/25" />
                              </div>
                              {i === 0 ? (
                                <span className="text-[8px] font-bold uppercase text-black/25 whitespace-nowrap">+ ACC</span>
                              ) : (
                                <span className="text-[8px]">&nbsp;</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer: Wearing This Today + item count */}
                <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-2 border-t border-black/10">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide shrink-0">
                    {outfit.items?.length ?? 0} piece{(outfit.items?.length ?? 0) !== 1 ? "s" : ""}
                  </span>
                  <AnimatePresence mode="wait">
                    {(wornTodayIds.has(outfit.id) || outfit.lastWornDate === todayStr) ? (
                      /* ── Worn today: Logged + Unwear ── */
                      <motion.div
                        key="logged"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.85 }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-[10px] font-medium text-black/35 whitespace-nowrap">
                          Last worn: {formatShortDate(todayStr)}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-bold text-yellow-500">
                          <Check className="w-3.5 h-3.5" /> Logged!
                        </span>
                        <button
                          onClick={() => handleUnwearToday(outfit.id, outfit.items ?? [])}
                          className="text-[10px] font-bold uppercase tracking-wide text-black/40
                                     underline underline-offset-2 hover:text-black/70 transition-colors"
                        >
                          Undo
                        </button>
                      </motion.div>
                    ) : (
                      /* ── Not worn today: optional last-worn label + button ── */
                      <motion.div
                        key="wear-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        {outfit.lastWornDate && (
                          <span className="text-[10px] font-medium text-black/35 whitespace-nowrap">
                            Last worn: {formatShortDate(outfit.lastWornDate)}
                          </span>
                        )}
                        <button
                          onClick={() => handleWearToday(outfit.id, outfit.items ?? [], outfit.lastWornDate)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black
                                     bg-primary text-xs font-bold uppercase tracking-wide
                                     shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                                     active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                                     whitespace-nowrap"
                        >
                          <Shirt className="w-3.5 h-3.5" />
                          Wearing Today
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-xl mt-8">
          <div className="w-14 h-14 bg-accent rounded-full flex items-center justify-center border-2 border-black mb-4">
            <Bookmark className="w-7 h-7" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">No looks saved.</h3>
          <p className="text-sm font-medium text-muted-foreground">
            Go to your digital closet, pick pieces from each row, and save the combo.
          </p>
        </div>
      ))}

      {/* Upgrade sheet */}
      <AnimatePresence>
        {showUpgrade && (
          <UpgradeSheet reason="outfits" onClose={() => setShowUpgrade(false)} />
        )}
      </AnimatePresence>

      {/* Wardrobe replacement picker */}
      <AnimatePresence>
        {replacingSlot !== null && (
          <WardrobePickerSheet
            key={`${replacingSlot.outfitId}-${replacingSlot.category}`}
            open
            onOpenChange={(open) => { if (!open) setReplacingSlot(null); }}
            category={replacingSlot.category}
            existingItemIds={
              outfits?.find((o) => o.id === replacingSlot.outfitId)?.items?.map((i) => i.id) ?? []
            }
            onPick={handlePickedItem}
          />
        )}
      </AnimatePresence>

      {/* Accessory details sheet */}
      <AnimatePresence>
        {detailsItem && (
          <ItemDetailsSheet
            key={detailsItem.id}
            item={detailsItem}
            onClose={() => { setDetailsItem(null); setDetailsFromSearch(false); }}
            showAddToLookbook={detailsFromSearch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
