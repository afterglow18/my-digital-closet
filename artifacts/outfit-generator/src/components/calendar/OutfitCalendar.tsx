import React, { useMemo, useState } from "react";
import { CalendarPlus, Check, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Outfit } from "@/lib/db";
import {
  useCalendarEntries,
  useRemoveCalendarEntry,
  useSetCalendarEntry,
} from "@/lib/local-api";
import { getImageUrl } from "@/lib/utils";

interface OutfitCalendarProps {
  outfits: Outfit[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function outfitImage(outfit: Outfit): string | null {
  for (const item of outfit.items ?? []) {
    const url = getImageUrl(item.imageObjectPath);
    if (url) return url;
  }
  return null;
}

export function OutfitCalendar({ outfits }: OutfitCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data: entries = [] } = useCalendarEntries();
  const setEntry = useSetCalendarEntry();
  const removeEntry = useRemoveCalendarEntry();

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const todayKey = dateKey(today);
  const entryByDate = useMemo(
    () => new Map(entries.map((entry) => [entry.date, entry.outfitId])),
    [entries],
  );

  const cells = useMemo(() => {
    const start = addDays(today, -today.getDay());
    return Array.from({ length: 35 }, (_, index) => addDays(start, index));
  }, [today]);

  const selectedOutfitId = selectedDate ? entryByDate.get(selectedDate) : undefined;
  const selectedOutfit = outfits.find((outfit) => outfit.id === selectedOutfitId);
  const selectedDateLabel = selectedDate
    ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <section className="bg-white border-2 border-black rounded-xl p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="font-display font-bold text-lg uppercase">30-Day Planner</h2>
          <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
            Tap a day to plan your look
          </p>
        </div>
        <CalendarPlus className="w-5 h-5 text-black/35" />
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((day, index) => (
          <span key={`${day}-${index}`} className="text-center text-[9px] font-bold text-black/40">
            {day}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date) => {
          const key = dateKey(date);
          const isBeforeToday = date < today;
          const planned = outfits.find((outfit) => outfit.id === entryByDate.get(key));
          const worn = outfits.find((outfit) => outfit.lastWornDate === key);
          const outfit = worn ?? planned;
          const image = outfit ? outfitImage(outfit) : null;

          return (
            <button
              key={key}
              disabled={isBeforeToday}
              onClick={() => setSelectedDate(key)}
              className={`relative aspect-[4/5] rounded-md border-2 overflow-hidden text-left transition-transform
                ${isBeforeToday ? "border-black/10 bg-black/[0.03] text-black/25" : key === todayKey ? "border-black bg-primary/20" : "border-black/25 bg-white active:scale-95"}`}
            >
              <span className="absolute left-1 top-0.5 text-[9px] font-bold z-10">{date.getDate()}</span>
              {image ? (
                <img src={image} alt={outfit?.name ?? ""} className="w-full h-full object-cover pt-3" />
              ) : outfit ? (
                <span className="absolute inset-x-1 bottom-1 text-[7px] font-bold leading-tight uppercase text-center truncate">
                  {outfit.name}
                </span>
              ) : !isBeforeToday ? (
                <span className="absolute right-1 bottom-0 text-sm leading-none text-black/20">+</span>
              ) : null}
              {worn && (
                <span className="absolute right-0.5 bottom-0.5 w-3 h-3 rounded-full bg-black text-white flex items-center justify-center">
                  <Check className="w-2 h-2" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 mt-3 text-[9px] font-bold uppercase text-black/45">
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 border-2 border-black inline-block" /> Worn</span>
        <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 border-2 border-black/25 inline-block" /> Planned</span>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <>
            <motion.button
              aria-label="Close planner"
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 bg-white border-t-2 border-black rounded-t-2xl max-h-[70vh] overflow-hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-black/45">Plan outfit for</p>
                  <h3 className="font-display font-bold text-lg">{selectedDateLabel}</h3>
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-2 rounded-full bg-black/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {selectedOutfit && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10 bg-primary/10">
                  <span className="text-sm font-bold truncate">{selectedOutfit.name}</span>
                  <button
                    onClick={() => {
                      removeEntry.mutate({ date: selectedDate });
                      setSelectedDate(null);
                    }}
                    className="p-2 text-red-500"
                    aria-label="Remove planned outfit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="overflow-y-auto max-h-[50vh]">
                {outfits.length === 0 ? (
                  <p className="p-8 text-center text-sm font-medium text-black/45">Save a look first, then plan it here.</p>
                ) : (
                  outfits.map((outfit) => {
                    const image = outfitImage(outfit);
                    return (
                      <button
                        key={outfit.id}
                        onClick={() => {
                          setEntry.mutate({ date: selectedDate, outfitId: outfit.id });
                          setSelectedDate(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-black/10 text-left active:bg-primary/15"
                      >
                        <div className="w-11 h-11 border-2 border-black rounded overflow-hidden bg-secondary/20 shrink-0">
                          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <span className="font-bold text-sm truncate">{outfit.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}