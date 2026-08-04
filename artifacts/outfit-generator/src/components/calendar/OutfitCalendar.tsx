/**
 * OutfitCalendar — 30-day rolling outfit planner.
 *
 * Shows a week-aligned grid of the next 30 days starting from today.
 * Months are labelled when they change mid-grid. No navigation needed —
 * the window always starts at today. Tap any day to plan an outfit;
 * empty days show a "+" corner badge.
 *
 * "Worn" entries (outfit.lastWornDate) override planned entries automatically.
 */

import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Outfit } from "@/lib/db";
import {
  useCalendarEntries,
  useSetCalendarEntry,
  useRemoveCalendarEntry,
} from "@/lib/local-api";
import { getImageUrl } from "@/lib/utils";

interface Props {
  outfits: Outfit[];
}

const DAY_LABELS  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** Returns a local "YYYY-MM-DD" string for a Date. */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Add `n` days to a Date (returns a new Date). */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getOutfitThumb(outfit: Outfit): string | null {
  for (const item of outfit.items ?? []) {
    const url = getImageUrl(item.imageObjectPath);
    if (url) return url;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export function OutfitCalendar({ outfits }: Props) {
  const [pickingDate, setPickingDate]   = useState<string | null>(null);
  const [previewDate, setPreviewDate]   = useState<string | null>(null);

  const { data: calEntries = [] } = useCalendarEntries();
  const setEntry    = useSetCalendarEntry();
  const removeEntry = useRemoveCalendarEntry();

  // ── Data maps ───────────────────────────────────────────────────────────────
  const plannedMap = new Map(calEntries.map((e) => [e.date, e.outfitId]));

  const wornMap = new Map<string, Outfit>();
  for (const o of outfits) {
    if (o.lastWornDate) wornMap.set(o.lastWornDate, o);
  }

  function getEntryForDate(date: string): { outfit: Outfit; type: "worn" | "planned" } | null {
    const worn = wornMap.get(date);
    if (worn) return { outfit: worn, type: "worn" };
    const pid = plannedMap.get(date);
    if (pid != null) {
      const planned = outfits.find((o) => o.id === pid);
      if (planned) return { outfit: planned, type: "planned" };
    }
    return null;
  }

  // ── Build the 30-day grid ────────────────────────────────────────────────────
  const today     = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr  = toDateStr(today);
  const lastDay   = addDays(today, 29);          // 30th day (inclusive)

  // Pad left to the Sunday that starts today's week
  const gridStart = new Date(today);
  gridStart.setDate(today.getDate() - today.getDay()); // rewind to Sunday

  // Pad right to the Saturday that ends the week containing lastDay
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay())); // advance to Saturday

  // Build flat list of all cell dates
  interface Cell { date: Date; dateStr: string; inWindow: boolean }
  const allCells: Cell[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
    allCells.push({
      date:      new Date(d),
      dateStr:   toDateStr(d),
      inWindow:  d >= today && d <= lastDay,
    });
  }

  // Chunk into rows of 7
  const rows: Cell[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    rows.push(allCells.slice(i, i + 7));
  }

  // ── Picker state ─────────────────────────────────────────────────────────────
  const pickerEntry = pickingDate ? getEntryForDate(pickingDate) : null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">

      {/* ── Day-of-week column headers ── */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[9px] font-bold uppercase text-black/35 py-0.5">
            {d[0]}
          </div>
        ))}
      </div>

      {/* ── Week rows ── */}
      {rows.map((row, rowIdx) => {
        // Show a month label before a row when the first active cell in it
        // is the first day of a new month within the window.
        const firstActive = row.find((c) => c.inWindow);
        const prevRow     = rows[rowIdx - 1];
        const prevActive  = prevRow?.find((c) => c.inWindow);
        const showMonth   =
          firstActive &&
          (rowIdx === 0 ||
            firstActive.date.getMonth() !== (prevActive?.date.getMonth() ?? -1));

        return (
          <React.Fragment key={rowIdx}>
            {showMonth && (
              <div className="col-span-7 text-[10px] font-black uppercase tracking-widest text-black/50 pt-3 pb-1 px-0.5">
                {MONTH_NAMES[firstActive!.date.getMonth()]} {firstActive!.date.getFullYear()}
              </div>
            )}
            <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
              {row.map((cell) => {
                const { dateStr, inWindow, date } = cell;
                const entry   = inWindow ? getEntryForDate(dateStr) : null;
                const thumb   = entry ? getOutfitThumb(entry.outfit) : null;
                const isToday = dateStr === todayStr;

                if (!inWindow) {
                  // Padding cell — preserve grid alignment
                  return <div key={dateStr} className="aspect-[4/5]" />;
                }

                return (
                  <button
                    key={dateStr}
                    onClick={() => entry ? setPreviewDate(dateStr) : setPickingDate(dateStr)}
                    className={`relative flex flex-col items-center rounded-lg border-2 pt-0.5 pb-1 transition-all aspect-[4/5]
                      active:scale-95
                      ${isToday
                        ? "border-black bg-primary/25"
                        : entry?.type === "worn"
                        ? "border-black bg-white"
                        : entry?.type === "planned"
                        ? "border-black/50 bg-white"
                        : "border-black/15 bg-white hover:border-black/30"
                      }`}
                  >
                    {/* Date number */}
                    <span className={`text-[9px] font-bold leading-none mb-0.5 ${isToday ? "text-black" : "text-black/60"}`}>
                      {date.getDate()}
                    </span>

                    {/* Outfit thumbnail or "+" */}
                    {thumb ? (
                      <div className="flex-1 w-full px-0.5 pb-0.5 relative min-h-0">
                        <img src={thumb} alt="" className="w-full h-full object-cover rounded-[3px]" />
                        {entry?.type === "worn" && (
                          <div className="absolute bottom-1 right-1 w-3 h-3 bg-black rounded-full flex items-center justify-center">
                            <span className="text-white leading-none" style={{ fontSize: 6 }}>✓</span>
                          </div>
                        )}
                      </div>
                    ) : entry ? (
                      // Has outfit but no image — show initials
                      <div className="flex-1 w-full px-0.5 pb-0.5 min-h-0">
                        <div className="w-full h-full rounded-[3px] bg-muted flex items-center justify-center
                                        text-[8px] font-bold text-black/40 uppercase">
                          {entry.outfit.name.slice(0, 2)}
                        </div>
                      </div>
                    ) : (
                      // Empty — "+" in bottom-right corner
                      <div className="flex-1" />
                    )}

                    {/* "+" badge when empty */}
                    {!entry && (
                      <span className="absolute bottom-0.5 right-0.5 text-black/20 leading-none" style={{ fontSize: 10 }}>+</span>
                    )}
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        );
      })}

      {/* ── Legend ── */}
      <div className="flex gap-5 mt-4 justify-center">
        <span className="flex items-center gap-1.5 text-[10px] text-black/40">
          <span className="w-3.5 h-3.5 rounded border-2 border-black inline-block shrink-0" />
          Worn
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-black/40">
          <span className="w-3.5 h-3.5 rounded border-2 border-black/50 inline-block shrink-0" />
          Planned
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-black/40">
          <span className="w-3.5 h-3.5 rounded bg-primary/25 border-2 border-black inline-block shrink-0" />
          Today
        </span>
      </div>

      {/* ── Day preview card (tap a filled day) ── */}
      <AnimatePresence>
        {previewDate && (() => {
          const entry = getEntryForDate(previewDate);
          if (!entry) return null;
          const { outfit, type } = entry;
          const itemThumbs = (outfit.items ?? [])
            .map((i) => ({ item: i, url: getImageUrl(i.imageObjectPath) }))
            .filter((x) => x.url);
          const dateLabel = new Date(previewDate + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          });
          return (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setPreviewDate(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-50 bg-white border-2 border-black
                           rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b-2 border-black">
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border-2
                      ${type === "worn" ? "bg-black text-white border-black" : "bg-white text-black border-black/40"}`}>
                      {type === "worn" ? "✓ Worn" : "Planned"}
                    </span>
                    <p className="text-base font-bold mt-1.5 leading-tight">{dateLabel}</p>
                    <p className="text-[11px] font-medium text-black/50 uppercase tracking-wide">{outfit.name}</p>
                  </div>
                  <button
                    onClick={() => setPreviewDate(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-black/8 shrink-0 mt-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Item thumbnails */}
                <div className="px-4 py-3">
                  {itemThumbs.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {itemThumbs.map(({ item, url }) => (
                        <div key={item.id} className="shrink-0 flex flex-col items-center gap-1">
                          <div className="w-20 h-24 rounded-xl border-2 border-black overflow-hidden
                                          shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <img src={url!} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[9px] font-bold text-black/40 uppercase max-w-[80px] truncate text-center">
                            {item.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-24 rounded-xl border-2 border-dashed border-black/20 flex items-center
                                    justify-center text-xs text-black/30 font-medium">
                      No item photos
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 px-4 pb-4">
                  {type === "planned" && (
                    <button
                      onClick={() => { removeEntry.mutate({ date: previewDate }); setPreviewDate(null); }}
                      className="flex-1 py-2 rounded-lg border-2 border-black/30 text-[11px] font-bold
                                 uppercase tracking-wide text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => { setPreviewDate(null); setPickingDate(previewDate); }}
                    className="flex-1 py-2 rounded-lg border-2 border-black bg-black text-white
                               text-[11px] font-bold uppercase tracking-wide
                               shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]
                               active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  >
                    Change outfit
                  </button>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── Outfit picker bottom sheet ── */}
      <AnimatePresence>
        {pickingDate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setPickingDate(null)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-black rounded-t-2xl overflow-hidden"
              style={{ maxHeight: "72vh" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b-2 border-black shrink-0">
                <div>
                  <p className="text-[10px] font-bold uppercase text-black/40 tracking-wide">Plan outfit for</p>
                  <p className="text-base font-bold">
                    {new Date(pickingDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setPickingDate(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/8 hover:bg-black/12"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Outfit list */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(72vh - 76px)" }}>
                {/* Remove option */}
                {pickerEntry && (
                  <button
                    onClick={() => { removeEntry.mutate({ date: pickingDate }); setPickingDate(null); }}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/10
                               text-left hover:bg-red-50 active:bg-red-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg border-2 border-dashed border-red-300
                                    flex items-center justify-center shrink-0">
                      <X className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm font-bold text-red-500">Remove from this day</span>
                  </button>
                )}

                {outfits.length === 0 ? (
                  <div className="py-12 text-center px-6">
                    <p className="text-sm font-bold text-black/40">No saved outfits yet</p>
                    <p className="text-xs text-black/30 mt-1">Save some looks in your Lookbook first</p>
                  </div>
                ) : (
                  outfits.map((outfit) => {
                    const thumb      = getOutfitThumb(outfit);
                    const isSelected = pickerEntry?.outfit.id === outfit.id;
                    return (
                      <button
                        key={outfit.id}
                        onClick={() => { setEntry.mutate({ date: pickingDate, outfitId: outfit.id }); setPickingDate(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 border-b border-black/10
                                    text-left transition-colors
                                    ${isSelected ? "bg-primary/20" : "hover:bg-black/5 active:bg-black/10"}`}
                      >
                        <div className="w-10 h-10 rounded-lg border-2 border-black overflow-hidden shrink-0">
                          {thumb
                            ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-bold text-black/40 uppercase">{outfit.name.slice(0, 2)}</div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{outfit.name}</p>
                          <p className="text-[10px] text-black/40">
                            {outfit.items?.length ?? 0} item{outfit.items?.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="shrink-0 text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
