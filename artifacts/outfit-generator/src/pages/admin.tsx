/**
 * admin.tsx — Moderation dashboard.
 *
 * Only accessible to users with is_admin = true in their profile row.
 * Shows posts in pending_review status and allows Restore or permanent Delete.
 */

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2, CheckCircle2, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getSupabase, isSupabaseConfigured, type PublicItem, type PublicOutfit, type Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

type PendingItem   = PublicItem   & { profiles?: Profile; report_count?: number };
type PendingOutfit = PublicOutfit & { profiles?: Profile; report_count?: number };
type AdminTab = "items" | "outfits";

// ── Admin profile check ────────────────────────────────────────────────────────

function useAdminCheck() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user || !isSupabaseConfigured()) return false;
      const { data } = await getSupabase()
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      return (data as { is_admin: boolean } | null)?.is_admin ?? false;
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Pending items query ────────────────────────────────────────────────────────

function usePendingItems() {
  return useQuery({
    queryKey: ["admin", "pending-items"],
    queryFn: async (): Promise<PendingItem[]> => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_items")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PendingItem[];
    },
    staleTime: 0,
  });
}

function usePendingOutfits() {
  return useQuery({
    queryKey: ["admin", "pending-outfits"],
    queryFn: async (): Promise<PendingOutfit[]> => {
      if (!isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("public_outfits")
        .select("*, profiles(id, handle, display_name, avatar_url)")
        .eq("status", "pending_review")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PendingOutfit[];
    },
    staleTime: 0,
  });
}

// ── Action helpers ─────────────────────────────────────────────────────────────

async function restorePost(table: "public_items" | "public_outfits", id: string) {
  const { error } = await getSupabase()
    .from(table)
    .update({ status: "active" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

async function deletePost(table: "public_items" | "public_outfits", id: string) {
  const { error } = await getSupabase()
    .from(table)
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Row component ──────────────────────────────────────────────────────────────

function PendingRow({
  id,
  name,
  imageUrl,
  handle,
  category,
  onRestore,
  onDelete,
}: {
  id: string;
  name: string;
  imageUrl?: string | null;
  handle?: string | null;
  category?: string;
  onRestore: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"restore" | "delete" | null>(null);

  const act = async (which: "restore" | "delete", fn: () => Promise<void>) => {
    setBusy(which);
    try { await fn(); } catch (e) { alert(e instanceof Error ? e.message : "Error"); }
    setBusy(null);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white border-2 border-black rounded-xl
                    shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-primary/30 border-2 border-black overflow-hidden flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-black/30 uppercase">
            {category?.[0] ?? "?"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{name || "Untitled"}</p>
        {category && (
          <p className="text-[10px] uppercase font-bold text-black/40 tracking-wide">{category}</p>
        )}
        {handle && (
          <p className="text-[10px] text-black/30 font-medium">@{handle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => act("restore", onRestore)}
          disabled={busy !== null}
          className={cn(
            "w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center",
            "bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            "active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all",
            "disabled:opacity-40",
          )}
          title="Restore"
        >
          {busy === "restore"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RotateCcw className="w-4 h-4" />}
        </button>
        <button
          onClick={() => act("delete", onDelete)}
          disabled={busy !== null}
          className={cn(
            "w-9 h-9 rounded-xl border-2 border-black flex items-center justify-center",
            "bg-red-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
            "active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all",
            "disabled:opacity-40",
          )}
          title="Delete permanently"
        >
          {busy === "delete"
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Trash2 className="w-4 h-4 text-red-600" />}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: isAdmin, isLoading: checkLoading } = useAdminCheck();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<AdminTab>("items");
  const qc = useQueryClient();

  const itemsQuery   = usePendingItems();
  const outfitsQuery = usePendingOutfits();

  if (authLoading || checkLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-black/30" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 h-64 px-8 text-center">
        <Shield className="w-10 h-10 text-black/20" />
        <p className="font-bold text-black/40">Access denied</p>
        <button
          onClick={() => navigate("/")}
          className="text-xs font-bold text-black/40 underline"
        >
          Go home
        </button>
      </div>
    );
  }

  const pendingItems   = itemsQuery.data ?? [];
  const pendingOutfits = outfitsQuery.data ?? [];
  const total          = pendingItems.length + pendingOutfits.length;

  return (
    <div
      className="flex flex-col min-h-full px-4 pt-4 pb-6"
      style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-6 h-6" />
        <h1 className="font-display font-bold text-2xl uppercase tracking-tight">Moderation</h1>
        {total > 0 && (
          <span className="ml-auto text-xs font-bold bg-red-100 text-red-600 border-2 border-red-300 rounded-full px-2.5 py-0.5">
            {total} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-2 border-black rounded-xl overflow-hidden mb-4 bg-white">
        {(["items", "outfits"] as const).map((t) => {
          const count = t === "items" ? pendingItems.length : pendingOutfits.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2.5 text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-1.5",
                tab === t ? "bg-primary border-r-0" : "bg-white",
              )}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {count > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {(tab === "items" ? itemsQuery : outfitsQuery).isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-black/30" />
        </div>
      ) : (tab === "items" ? pendingItems : pendingOutfits).length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400" />
          <p className="font-bold text-black/40">All clear</p>
          <p className="text-xs text-black/30">No {tab} awaiting review.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tab === "items"
            ? pendingItems.map((item) => (
                <PendingRow
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  imageUrl={item.image_url}
                  handle={(item.profiles as Profile | undefined)?.handle}
                  category={item.category}
                  onRestore={async () => {
                    await restorePost("public_items", item.id);
                    qc.invalidateQueries({ queryKey: ["admin", "pending-items"] });
                  }}
                  onDelete={async () => {
                    if (!confirm(`Permanently delete "${item.name}"?`)) return;
                    await deletePost("public_items", item.id);
                    qc.invalidateQueries({ queryKey: ["admin", "pending-items"] });
                  }}
                />
              ))
            : pendingOutfits.map((outfit) => (
                <PendingRow
                  key={outfit.id}
                  id={outfit.id}
                  name={outfit.name ?? "Untitled Look"}
                  imageUrl={outfit.image_url}
                  handle={(outfit.profiles as Profile | undefined)?.handle}
                  onRestore={async () => {
                    await restorePost("public_outfits", outfit.id);
                    qc.invalidateQueries({ queryKey: ["admin", "pending-outfits"] });
                  }}
                  onDelete={async () => {
                    if (!confirm(`Permanently delete "${outfit.name ?? "this look"}"?`)) return;
                    await deletePost("public_outfits", outfit.id);
                    qc.invalidateQueries({ queryKey: ["admin", "pending-outfits"] });
                  }}
                />
              ))}
        </div>
      )}

      {/* Warning note */}
      <div className="mt-6 flex gap-2 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-700 font-medium">
          Restored posts immediately return to the public feed. Deleted posts are gone permanently.
        </p>
      </div>
    </div>
  );
}
