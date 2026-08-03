/**
 * ProfileMePage — signed-in user's own profile.
 *
 * Sections:
 *  1. Profile header: avatar, handle (read-only), display name + bio (editable)
 *  2. Published content tabs: Items | Outfits  (each card has an Unpublish action)
 *  3. Settings: subscription, backup/restore, account
 */

import React, { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Edit2, Check, X, Shirt, Globe, Loader2,
  Download, Upload, RefreshCw, CheckCircle2, AlertCircle,
  LogOut, Trash2, Lock, Eye, Share2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile, useMyPublishedItems, useMyPublishedOutfits } from "@/hooks/useCommunity";
import { getSupabase } from "@/lib/supabase";
import { deleteAccountStorage, unpublishItem, unpublishOutfit } from "@/lib/sync";
import { updateClothingItem, updateOutfit } from "@/lib/db";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { PublicOutfitCard } from "@/components/community/PublicOutfitCard";
import { UpgradeSheet } from "@/components/paywall/UpgradeSheet";
import { useEntitlements, syncTierFromRC, getCurrentTier } from "@/hooks/useEntitlements";
import { restorePurchases } from "@/lib/revenuecat";
import { exportBackup, importBackup, type ImportResult } from "@/lib/backup";
import { useQueryClient } from "@tanstack/react-query";
import { getListClothingQueryKey, getListOutfitsQueryKey } from "@/lib/local-api";
import type { PublicItem, PublicOutfit } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ContentTab = "items" | "outfits";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

function StatusMessage({ status }: { status: Status }) {
  if (status.kind === "idle" || status.kind === "loading") return null;
  return (
    <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
      status.kind === "ok"
        ? "bg-green-50 border-green-200 text-green-800"
        : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {status.kind === "ok"
        ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      {status.msg}
    </div>
  );
}

export default function ProfileMePage() {
  const { user, signOut } = useAuth();
  const [, navigate]      = useLocation();
  const queryClient       = useQueryClient();
  const importRef         = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useMyProfile(user?.id);
  const { data: pubItems,   isLoading: itemsLoading,   refetch: refetchItems }   = useMyPublishedItems(user?.id);
  const { data: pubOutfits, isLoading: outfitsLoading, refetch: refetchOutfits } = useMyPublishedOutfits(user?.id);

  // Profile edit
  const [editMode,      setEditMode]      = useState(false);
  const [displayName,   setDisplayName]   = useState("");
  const [bio,           setBio]           = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErr,    setProfileErr]    = useState<string | null>(null);

  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name ?? ""); setBio(profile.bio ?? ""); }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true); setProfileErr(null);
    try {
      const { error } = await getSupabase()
        .from("profiles")
        .update({ display_name: displayName.trim() || null, bio: bio.trim() || null })
        .eq("id", user.id);
      if (error) throw error;
      await refetchProfile();
      setEditMode(false);
    } catch (e) {
      setProfileErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  };

  // Published content tab
  const [contentTab, setContentTab] = useState<ContentTab>("items");

  // Unpublish
  const [unpublishingIds, setUnpublishingIds] = useState<Set<number>>(new Set());

  const handleUnpublishItem = async (localId: number) => {
    if (!user) return;
    setUnpublishingIds((s) => new Set([...s, localId]));
    try {
      await unpublishItem(localId, user.id);
      updateClothingItem(localId, { visibility: "private" });
      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
      await refetchItems();
    } finally {
      setUnpublishingIds((s) => { const n = new Set(s); n.delete(localId); return n; });
    }
  };

  const handleUnpublishOutfit = async (localId: number) => {
    if (!user) return;
    setUnpublishingIds((s) => new Set([...s, localId]));
    try {
      await unpublishOutfit(localId, user.id);
      updateOutfit(localId, { visibility: "private" });
      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      await refetchOutfits();
    } finally {
      setUnpublishingIds((s) => { const n = new Set(s); n.delete(localId); return n; });
    }
  };

  // Settings
  const { tier }                          = useEntitlements();
  const [exportStatus,  setExportStatus]  = useState<Status>({ kind: "idle" });
  const [importStatus,  setImportStatus]  = useState<Status>({ kind: "idle" });
  const [restoreStatus, setRestoreStatus] = useState<Status>({ kind: "idle" });
  const [showUpgrade,   setShowUpgrade]   = useState(false);

  const handleExport = async () => {
    setExportStatus({ kind: "loading" });
    try {
      await exportBackup();
      setExportStatus({ kind: "ok", msg: "Backup ready!" });
    } catch (err) {
      setExportStatus({ kind: "err", msg: err instanceof Error ? err.message : "Export failed." });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportStatus({ kind: "loading" });
    try {
      const result: ImportResult = await importBackup(file);
      queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setImportStatus({ kind: "ok", msg: `Restored ${result.itemCount} items and ${result.outfitCount} outfits.` });
    } catch (err) {
      setImportStatus({ kind: "err", msg: err instanceof Error ? err.message : "Import failed." });
    }
  };

  const handleRestore = async () => {
    setRestoreStatus({ kind: "loading" });
    try {
      await restorePurchases();
      await syncTierFromRC();
      const t = getCurrentTier();
      setRestoreStatus({ kind: "ok", msg: t !== "free" ? "Subscription restored! ✨" : "No active subscription found." });
    } catch {
      setRestoreStatus({ kind: "err", msg: "Restore failed. Please try again." });
    }
  };

  // Sign out
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/community");
  };

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus,      setDeleteStatus]      = useState<Status>({ kind: "idle" });

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteStatus({ kind: "loading" });
    try {
      await deleteAccountStorage(user.id);
      const { error } = await getSupabase().from("profiles").delete().eq("id", user.id);
      if (error) throw error;
      await signOut();
      navigate("/community");
    } catch (e) {
      setDeleteStatus({ kind: "err", msg: e instanceof Error ? e.message : "Delete failed." });
    }
  };

  if (!user) { navigate("/community"); return null; }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col min-h-full pb-24"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
      >
        {/* Back */}
        <div className="px-4 pb-2">
          <button onClick={() => navigate("/community")}
            className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Discover
          </button>
        </div>

        {/* ── Profile card ── */}
        {profileLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-black/30" />
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="border-2 border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-3">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full border-4 border-black bg-primary flex items-center justify-center
                                shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.handle} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display font-black text-2xl uppercase">
                      {(profile?.display_name ?? profile?.handle ?? user.email ?? "?")[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-black/40 uppercase tracking-wider">Handle</p>
                  <p className="font-display font-bold text-xl truncate">@{profile?.handle ?? "…"}</p>
                </div>
                <button onClick={() => setEditMode((v) => !v)}
                  className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                             bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Edit form */}
              <AnimatePresence>
                {editMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-3 overflow-hidden"
                  >
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1">Display Name</label>
                      <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={50} placeholder="Your name"
                        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                                   focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-black/25" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-1">Bio</label>
                      <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                        maxLength={200} rows={3} placeholder="A little about your style…"
                        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                                   focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-black/25" />
                    </div>
                    {profileErr && <p className="text-xs text-red-600">{profileErr}</p>}
                    <div className="flex gap-2">
                      <button onClick={handleSaveProfile} disabled={savingProfile}
                        className="flex-1 btn-brutalist py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                      <button onClick={() => { setEditMode(false); setProfileErr(null); }}
                        className="flex-1 py-2.5 rounded-xl border-2 border-black/20 text-sm font-bold uppercase
                                   text-black/40 hover:border-black hover:text-black transition-all flex items-center justify-center gap-1.5">
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Display */}
              {!editMode && (
                <>
                  {profile?.display_name && <p className="font-bold text-base">{profile.display_name}</p>}
                  {profile?.bio && <p className="text-sm text-black/60 leading-relaxed">{profile.bio}</p>}
                </>
              )}

              {/* Stats */}
              <div className="flex gap-4 text-sm font-bold pt-1">
                <span>{pubItems?.length ?? 0} items</span>
                <span>{pubOutfits?.length ?? 0} outfits</span>
              </div>

              {/* Preview + Share public profile */}
              {profile?.handle && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/profile/${profile.handle}`)}
                    className="flex items-center gap-1.5 text-xs font-bold text-black/40
                               hover:text-black transition-colors border border-black/15 rounded-full
                               px-3 py-1.5 hover:border-black/40"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    My Public Closet
                  </button>
                  <button
                    onClick={async () => {
                      const { shareContent, profileShareUrl } = await import("@/lib/share");
                      shareContent(
                        profileShareUrl(profile.handle),
                        `Check out @${profile.handle}'s public closet on My Digital Closet.`,
                        "My Digital Closet",
                      );
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-black/40
                               hover:text-black transition-colors border border-black/15 rounded-full
                               px-3 py-1.5 hover:border-black/40"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Published content tabs ── */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-1 bg-black/5 rounded-xl p-1">
            {([
              { tab: "items",   label: "Items",   icon: Shirt },
              { tab: "outfits", label: "Outfits", icon: Globe },
            ] as const).map(({ tab, label, icon: Icon }) => (
              <button key={tab} onClick={() => setContentTab(tab)}
                className={cn(
                  "py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all",
                  "flex items-center justify-center gap-1.5",
                  contentTab === tab
                    ? "bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "text-black/40 hover:text-black",
                )}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Items grid ── */}
        {contentTab === "items" && (
          <div className="px-4 pb-4">
            {itemsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-black/30" /></div>
            ) : !pubItems?.length ? (
              <div className="text-center py-8 flex flex-col gap-1">
                <p className="text-sm font-bold text-black/40 uppercase">No published items yet</p>
                <p className="text-xs text-black/30">Open any item in your closet → set Sharing to Public</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pubItems.map((item: PublicItem) => (
                  <div key={item.id} className="relative">
                    <PublicItemCard item={item} />
                    {/* Unpublish button */}
                    <button
                      onClick={() => handleUnpublishItem(item.local_id)}
                      disabled={unpublishingIds.has(item.local_id)}
                      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full
                                 bg-white/90 border border-black/20 text-[9px] font-bold uppercase
                                 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-all
                                 disabled:opacity-50"
                    >
                      {unpublishingIds.has(item.local_id)
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <Lock className="w-2.5 h-2.5" />}
                      Unpublish
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Outfits grid ── */}
        {contentTab === "outfits" && (
          <div className="px-4 pb-4">
            {outfitsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-black/30" /></div>
            ) : !pubOutfits?.length ? (
              <div className="text-center py-8 flex flex-col gap-1">
                <p className="text-sm font-bold text-black/40 uppercase">No published outfits yet</p>
                <p className="text-xs text-black/30">Go to Saved Looks and tap 🌍 on any outfit</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pubOutfits.map((outfit: PublicOutfit) => (
                  <div key={outfit.id} className="relative">
                    <PublicOutfitCard outfit={outfit} />
                    <button
                      onClick={() => handleUnpublishOutfit(outfit.local_id)}
                      disabled={unpublishingIds.has(outfit.local_id)}
                      className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full
                                 bg-white/90 border border-black/20 text-[9px] font-bold uppercase
                                 hover:bg-red-50 hover:border-red-400 hover:text-red-700 transition-all
                                 disabled:opacity-50"
                    >
                      {unpublishingIds.has(outfit.local_id)
                        ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        : <Lock className="w-2.5 h-2.5" />}
                      Unpublish
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Settings ── */}
        <div className="px-4 flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg uppercase tracking-tight">Settings</h2>

          {/* Subscription */}
          <section className="border-2 border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👑</span>
              <h3 className="font-display font-bold text-base uppercase tracking-tight">My Plan</h3>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-black/70">Current plan</span>
              {tier === "free"
                ? <span className="px-3 py-1 border-2 border-black rounded-full text-sm font-bold bg-[#f9f4ee]">Free</span>
                : <span className="px-3 py-1 border-2 border-black rounded-full text-sm font-bold bg-primary">Unlocked ✨</span>}
            </div>
            {tier === "free" && (
              <button onClick={() => setShowUpgrade(true)}
                className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                           bg-primary font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">
                Lifetime Unlock – $9.99
              </button>
            )}
            <StatusMessage status={restoreStatus} />
            <button onClick={handleRestore} disabled={restoreStatus.kind === "loading"}
              className="flex items-center justify-center gap-1.5 text-xs font-semibold
                         text-black/40 hover:text-black/70 transition-colors disabled:opacity-50">
              {restoreStatus.kind === "loading" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Restore Purchases
            </button>
          </section>

          {/* Backup */}
          <section className="border-2 border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💾</span>
              <h3 className="font-display font-bold text-base uppercase tracking-tight">Backup & Restore</h3>
            </div>
            <p className="text-sm text-black/60 leading-snug">Export your wardrobe to a ZIP file. Save it to iCloud or Files.</p>
            <button onClick={handleExport} disabled={exportStatus.kind === "loading"}
              className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                         bg-primary font-bold text-sm uppercase tracking-tight
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                         disabled:opacity-50 transition-all">
              {exportStatus.kind === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Backup
            </button>
            <StatusMessage status={exportStatus} />
            <button onClick={() => importRef.current?.click()} disabled={importStatus.kind === "loading"}
              className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                         bg-primary font-bold text-sm uppercase tracking-tight
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                         disabled:opacity-50 transition-all">
              {importStatus.kind === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import Backup
            </button>
            <input ref={importRef} type="file" accept=".zip" className="hidden" onChange={handleImportFile} />
            <StatusMessage status={importStatus} />
          </section>

          {/* Account */}
          <section className="border-2 border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👤</span>
              <h3 className="font-display font-bold text-base uppercase tracking-tight">Account</h3>
            </div>
            <p className="text-xs text-black/40 truncate">{user.email}</p>
            <button onClick={handleSignOut} disabled={signingOut}
              className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                         bg-white font-bold text-sm uppercase tracking-tight
                         shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                         disabled:opacity-50 transition-all">
              {signingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Sign Out
            </button>
            <StatusMessage status={deleteStatus} />
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-black/30
                           hover:text-red-600 transition-colors uppercase tracking-wide">
                <Trash2 className="w-3.5 h-3.5" /> Delete Community Account
              </button>
            ) : (
              <div className="flex flex-col gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-bold text-red-800">
                  This deletes your profile and all published items. Your local closet stays on your device.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 border-2 border-black rounded-lg text-xs font-bold uppercase bg-white">
                    Cancel
                  </button>
                  <button onClick={handleDeleteAccount} disabled={deleteStatus.kind === "loading"}
                    className="flex-1 py-2 border-2 border-red-600 rounded-lg text-xs font-bold uppercase
                               bg-red-500 text-white disabled:opacity-50">
                    {deleteStatus.kind === "loading" ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </motion.div>

      <AnimatePresence>
        {showUpgrade && <UpgradeSheet reason="items" onClose={() => setShowUpgrade(false)} />}
      </AnimatePresence>
    </>
  );
}
