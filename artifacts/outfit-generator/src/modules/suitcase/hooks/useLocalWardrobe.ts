/**
 * useLocalWardrobe — React Query hooks for clothing items.
 *
 * All data lives in the device's IndexedDB (via lib/localDB.ts).
 * Mutation signatures deliberately mirror the old generated API client so
 * pages need only a one-line import change.
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listClothing,
  getClothingItem,
  createClothingItem,
  updateClothingItem,
  deleteClothingItem,
  getWardrobeStats,
  generateOutfit,
} from "../lib/localDB";

export type { ClothingItem, SavedOutfit } from "../lib/db";
import type { ClothingItem } from "../lib/db";

// ── Query keys ────────────────────────────────────────────────────────────────

export function getListClothingQueryKey(params?: { category?: string }) {
  return params?.category
    ? ["clothing", { category: params.category }]
    : ["clothing"];
}

export function getWardrobeStatsQueryKey() {
  return ["wardrobe-stats"];
}

export function getGetClothingItemQueryKey(id: number) {
  return ["clothing", id];
}

// ── Clothing hooks ────────────────────────────────────────────────────────────

export function useListClothing(
  params?: { category?: string },
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<ClothingItem[], Error>({
    queryKey: options?.query?.queryKey ?? getListClothingQueryKey(params),
    queryFn:  () => listClothing(params?.category),
    staleTime: 0,
    enabled:  options?.query?.enabled !== false,
  });
}

export function useGetClothingItem(
  id: number,
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<ClothingItem | null, Error>({
    queryKey: options?.query?.queryKey ?? getGetClothingItemQueryKey(id),
    queryFn:  () => getClothingItem(id),
    enabled:  options?.query?.enabled !== false,
    staleTime: 0,
  });
}

export function useCreateClothingItem() {
  return useMutation<ClothingItem, Error, {
    data: {
      name:            string;
      category:        string;
      imageObjectPath?: string | null;
      color?:          string | null;
      brand?:          string | null;
      size?:           string | null;
      season?:         string | null;
      occasion?:       string | null;
      purchasePrice?:  string | null;
      purchaseDate?:   string | null;
      notes?:          string | null;
    };
  }>({
    mutationFn: ({ data }) => createClothingItem(data),
  });
}

export function useUpdateClothingItem() {
  return useMutation<ClothingItem, Error, {
    id:   number;
    data: Parameters<typeof updateClothingItem>[1];
  }>({
    mutationFn: ({ id, data }) => updateClothingItem(id, data),
  });
}

export function useDeleteClothingItem() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteClothingItem(id),
  });
}

// ── Stats + generate ──────────────────────────────────────────────────────────

type WardrobeStats = {
  total:            number;
  byCategory:       { category: string; count: number }[];
  favorites:        number;
  outfitsGenerated: number;
};

export function useGetWardrobeStats() {
  return useQuery<WardrobeStats, Error>({
    queryKey: getWardrobeStatsQueryKey(),
    queryFn:  getWardrobeStats,
    staleTime: 0,
  });
}

export function useGenerateOutfit() {
  return useMutation<{ items: ClothingItem[] }, Error, { data: { excludeCategories?: string[] } }>({
    mutationFn: ({ data }) =>
      generateOutfit(data.excludeCategories ?? []).then((items) => ({ items })),
  });
}

// ── Runtime value + type for ClothingItemInputCategory ────────────────────────

/** Used by ClothingForm.tsx as z.nativeEnum(ClothingItemInputCategory) */
export const ClothingItemInputCategory = {
  outfits:    "outfits",
  beauty:     "beauty",
  toiletries: "toiletries",
  essentials: "essentials",
} as const;

// ── Type aliases kept for compatibility ───────────────────────────────────────
export type ClothingItemCategory       = "outfits" | "beauty" | "toiletries" | "essentials";
export type ListClothingCategory        = ClothingItemCategory;
export type ClothingItemUpdateCategory  = ClothingItemCategory;
export type ClothingItemInputCategoryType = ClothingItemCategory;

// ── Outfit mutations ──────────────────────────────────────────────────────────
import { saveOutfit, listOutfits, deleteOutfit } from "../lib/localDB";

export function getListOutfitsQueryKey() {
  return ["saved-outfits"];
}

export function useListOutfits() {
  return useQuery({
    queryKey: getListOutfitsQueryKey(),
    queryFn: listOutfits,
    staleTime: 0,
  });
}

export function useSaveOutfit() {
  return useMutation<void, Error, { data: { name: string; itemIds: number[] } }>({
    mutationFn: ({ data }) => saveOutfit(data).then(() => undefined),
  });
}

export function useDeleteOutfit() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteOutfit(id),
  });
}
