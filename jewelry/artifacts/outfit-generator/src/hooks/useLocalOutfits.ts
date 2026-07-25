/**
 * Local outfit hooks — replaces @workspace/api-client-react outfit hooks.
 * Uses React Query backed by IndexedDB.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  dbListOutfits,
  dbCreateOutfit,
  dbUpdateOutfit,
  dbDeleteOutfit,
  dbAddItemToOutfit,
  dbRemoveItemFromOutfit,
} from '@/lib/db';
import type { SavedOutfit } from '@/types/local';

// ── Query key ─────────────────────────────────────────────────────────────────

export function getListOutfitsQueryKey() {
  return ['outfits', 'list'];
}

// ── List ──────────────────────────────────────────────────────────────────────

export function useListOutfits() {
  return useQuery<SavedOutfit[]>({
    queryKey: getListOutfitsQueryKey(),
    queryFn: dbListOutfits,
    staleTime: 0,
  });
}

// ── Create / Save ─────────────────────────────────────────────────────────────

export function useSaveOutfit() {
  const qc = useQueryClient();
  return useMutation<SavedOutfit, Error, { data: { name: string; itemIds: string[] } }>({
    mutationFn: ({ data }) => dbCreateOutfit(data.name, data.itemIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    },
  });
}

// ── Rename / Update notes ─────────────────────────────────────────────────────

export function useRenameOutfit() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { id: string; data: { name?: string; notes?: string | null } }
  >({
    mutationFn: ({ id, data }) => dbUpdateOutfit(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteOutfit() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string }>({
    mutationFn: ({ id }) => dbDeleteOutfit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    },
  });
}

// ── Add item to outfit ────────────────────────────────────────────────────────

export function useAddItemToOutfit() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; data: { itemId: string } }>({
    mutationFn: ({ id, data }) => dbAddItemToOutfit(id, data.itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    },
  });
}

// ── Remove item from outfit ───────────────────────────────────────────────────

export function useRemoveItemFromOutfit() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; itemId: string }>({
    mutationFn: ({ id, itemId }) => dbRemoveItemFromOutfit(id, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
    },
  });
}

// ── Re-export type ────────────────────────────────────────────────────────────
export type { SavedOutfit };
