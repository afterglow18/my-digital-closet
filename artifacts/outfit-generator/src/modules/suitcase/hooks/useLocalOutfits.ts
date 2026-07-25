/**
 * useLocalOutfits — React Query hooks for saved outfits.
 *
 * All data lives in the device's IndexedDB (via lib/localDB.ts).
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import {
  listOutfits,
  saveOutfit,
  updateOutfit,
  deleteOutfit,
  addItemToOutfit,
  removeItemFromOutfit,
} from "../lib/localDB";

export type { SavedOutfit } from "../lib/db";
import type { SavedOutfit } from "../lib/db";

// ── Query keys ────────────────────────────────────────────────────────────────

export function getListOutfitsQueryKey() {
  return ["outfits"];
}

// ── Outfit hooks ──────────────────────────────────────────────────────────────

export function useListOutfits(
  options?: { query?: { enabled?: boolean; queryKey?: unknown[] } },
) {
  return useQuery<SavedOutfit[], Error>({
    queryKey: options?.query?.queryKey ?? getListOutfitsQueryKey(),
    queryFn:  listOutfits,
    staleTime: 0,
    enabled:  options?.query?.enabled !== false,
  });
}

export function useSaveOutfit() {
  return useMutation<SavedOutfit, Error, { data: { name: string; itemIds: number[] } }>({
    mutationFn: ({ data }) => saveOutfit(data),
  });
}

export function useRenameOutfit() {
  return useMutation<void, Error, { id: number; data: { name?: string; notes?: string | null } }>({
    mutationFn: ({ id, data }) => updateOutfit(id, data),
  });
}

export function useDeleteOutfit() {
  return useMutation<void, Error, { id: number }>({
    mutationFn: ({ id }) => deleteOutfit(id),
  });
}

export function useAddItemToOutfit() {
  return useMutation<void, Error, { id: number; data: { itemId: number } }>({
    mutationFn: ({ id, data }) => addItemToOutfit(id, data.itemId),
  });
}

export function useRemoveItemFromOutfit() {
  return useMutation<void, Error, { id: number; itemId: number }>({
    mutationFn: ({ id, itemId }) => removeItemFromOutfit(id, itemId),
  });
}
