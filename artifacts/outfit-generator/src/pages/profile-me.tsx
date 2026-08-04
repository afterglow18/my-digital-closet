/**
 * ProfileMePage — signed-in user's community profile.
 *
 * Sections:
 *  1. Profile header: avatar, handle (changeable), display name + bio (editable)
 *  2. Published content tabs: Items | Outfits  (each card has an Unpublish action)
 *
 * Settings (privacy, plan, export/import, sign-out) live at /settings.
 */

import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Edit2, Check, X, Shirt, Globe, Loader2,
  Lock, Eye, Share2, Camera,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile, useMyPublishedItems, useMyPublishedOutfits } from "@/hooks/useCommunity";
import { useFollowerCount, useFollowingCount } from "@/hooks/useFollows";
import { getSupabase } from "@/lib/supabase";
import { unpublishItem, unpublishOutfit, uploadAvatar } from "@/lib/sync";
import { updateClothingItem, updateOutfit } from "@/lib/db";
import { PublicItemCard } from "@/components/community/PublicItemCard";
import { PublicOutfitCard } from "@/components/community/PublicOutfitCard";
import { useQueryClient } from "@tanstack/react-query";
import { getListClothingQueryKey, getListOutfitsQueryKey } from "@/lib/local-api";
import type { PublicItem, PublicOutfit } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ContentTab = "items" | "outfits";

export default function ProfileMePage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient  = useQueryClient();

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useMyProfile(user?.id);
  const { data: pubItems,   isLoading: itemsLoading,   refetch: refetchItems }   = useMyPublishedItems(user?.id);
  const { data: pubOutfits, isLoading: outfitsLoading, refetch: refetchOutfits } = useMyPublishedOutfits(user?.id);
  const { data: followerCount  = 0 } = useFollowerCount(user?.id);
  const { data: followingCount = 0 } = useFollowingCount(user?.id);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const avatarInputRef               = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    const url = await uploadAvatar(user.id, file);
    if (url) await refetchProfile();
    setAvatarUploading(false);
    // Reset input so same file can be re-selected if needed
    e.target.value = "";
  };

  // ── Display name + bio edit ───────────────────────────────────────────────
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

  // ── Handle change ─────────────────────────────────────────────────────────
  const [handleEditMode, setHandleEditMode] = useState(false);
  const [newHandle,      setNewHandle]      = useState("");
  const [savingHandle,   setSavingHandle]   = useState(false);
  const [handleErr,      setHandleErr]      = useState<string | null>(null);
  const [handleSuccess,  setHandleSuccess]  = useState(false);

  const openHandleEdit = () => {
    setNewHandle(profile?.handle ?? "");
    setHandleErr(null);
    setHandleSuccess(false);
    setHandleEditMode(true);
  };

  const handleSaveHandle = async () => {
    if (!user) return;
    const trimmed = newHandle.trim().toLowerCase();

    // Same handle — close silently
    if (trimmed === (profile?.handle ?? "")) { setHandleEditMode(false); return; }

    // Client-side validation
    if (!trimmed)                                          { setHandleErr("Handle can't be empty"); return; }
    if (trimmed.length > 15)                              { setHandleErr("Max 15 characters"); return; }
    if (!/^[a-z0-9_-]+$/.test(trimmed))                  { setHandleErr("Letters, numbers, _ and - only"); return; }
    if (["anonymous", "someone"].includes(trimmed))       { setHandleErr(`@${trimmed} is reserved`); return; }

    setSavingHandle(true); setHandleErr(null);
    try {
      // Uniqueness check
      const { data: existing } = await getSupabase()
        .from("profiles")
        .select("id")
        .eq("handle", trimmed)
        .neq("id", user.id)
        .maybeSingle();
      if (existing) { setHandleErr(`@${trimmed} is already taken`); return; }

      const { error } = await getSupabase()
        .from("profiles")
        .update({ handle: trimmed, handle_changed_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;

      await refetchProfile();
      setHandleEditMode(false);
      setHandleSuccess(true);
      setTimeout(() => setHandleSuccess(false), 4000);
    } catch (e) {
      setHandleErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingHandle(false);
    }
  };

  // ── Published content ─────────────────────────────────────────────────────
  const [contentTab, setContentTab] = useState<ContentTab>("items");
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

  if (!user) { navigate("/settings"); return null; }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col min-h-full pb-24"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))", background: "#FDECEF" }}
      >
        {/* Back */}
        <div className="px-4 pb-2">
          <button onClick={() => navigate("/settings")}
            className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors">
            <ArrowLeft className="w-4 h-4" /> Settings
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

              {/* ── Header row: avatar + handle + edit pencil ── */}
              <div className="flex items-center gap-4">
                {/* Avatar — tap to change */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="w-16 h-16 rounded-full border-4 border-black bg-primary flex items-center justify-center
                               shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative"
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.handle} className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: "1.75rem", lineHeight: 1 }}>
                        {(profile?.display_name ?? profile?.handle ?? user.email ?? "?")[0]}
                      </span>
                    )}
                    {avatarUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                  </button>
                  {/* Camera badge */}
                  {!avatarUploading && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border-2 border-white
                                    flex items-center justify-center pointer-events-none">
                      <Camera className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                {/* Handle + change button */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-black/40 uppercase tracking-wider mb-0.5">Handle</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold text-xl leading-none">
                      @{profile?.handle ?? "…"}
                    </p>
                    {handleSuccess && (
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">✓ Updated</span>
                    )}
                    {!handleEditMode && profile && (
                      <button
                        onClick={openHandleEdit}
                        className="text-[10px] font-bold uppercase tracking-wide text-black/35
                                   hover:text-black border border-black/15 rounded-full px-2 py-0.5
                                   hover:border-black/50 transition-all flex-shrink-0"
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>

                {/* Display name / bio edit button */}
                <button onClick={() => setEditMode((v) => !v)}
                  className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                             bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                             flex-shrink-0">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* ── Handle edit panel ── */}
              <AnimatePresence>
                {handleEditMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-2 border-t-2 border-black/10 pt-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                        New Handle
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold
                                           text-black/30 pointer-events-none select-none">@</span>
                          <input
                            type="text"
                            value={newHandle}
                            onChange={(e) => {
                              // strip invalid chars live; enforce max 15
                              const v = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_-]/g, "")
                                .slice(0, 15);
                              setNewHandle(v);
                              setHandleErr(null);
                            }}
                            maxLength={15}
                            placeholder="new_handle"
                            autoFocus
                            className="w-full border-2 border-black rounded-lg pl-7 pr-3 py-2 text-sm
                                       font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <span className={cn(
                          "text-[11px] font-bold flex-shrink-0 tabular-nums w-9 text-right",
                          newHandle.length >= 15 ? "text-red-500" : "text-black/30",
                        )}>
                          {newHandle.length}/15
                        </span>
                      </div>

                      {handleErr && (
                        <p className="text-xs text-red-600 font-medium">{handleErr}</p>
                      )}

                      <p className="text-[10px] text-black/30 leading-snug">
                        Letters, numbers, _ and -
                      </p>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveHandle}
                          disabled={savingHandle || !newHandle || newHandle === (profile?.handle ?? "")}
                          className="flex-1 btn-brutalist py-2.5 rounded-xl text-sm
                                     flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          {savingHandle
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Check className="w-4 h-4" />}
                          Save Handle
                        </button>
                        <button
                          onClick={() => { setHandleEditMode(false); setHandleErr(null); }}
                          className="flex-1 py-2.5 rounded-xl border-2 border-black/20 text-sm font-bold
                                     uppercase text-black/40 hover:border-black hover:text-black transition-all
                                     flex items-center justify-center gap-1.5"
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Display name / bio edit form ── */}
              <AnimatePresence>
                {editMode && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-3 overflow-hidden"
                  >
                    <div className="border-t-2 border-black/10 pt-3 flex flex-col gap-3">
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
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Read-only display ── */}
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
                <span>{followerCount} {followerCount === 1 ? "follower" : "followers"}</span>
                <span>{followingCount} following</span>
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
              <div className="text-center py-10 flex flex-col items-center gap-3">
                <span className="text-3xl">🌍</span>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 border-2 border-black rounded-full text-sm font-bold
                             shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                >
                  + Add from Closet
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {pubItems.map((item: PublicItem) => (
                  <div key={item.id} className="relative">
                    <PublicItemCard item={item} />
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
              <div className="text-center py-10 flex flex-col items-center gap-3">
                <span className="text-3xl">🌍</span>
                <button
                  onClick={() => navigate("/saved")}
                  className="px-4 py-2 border-2 border-black rounded-full text-sm font-bold
                             shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                             active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
                >
                  + Add from Saved Looks
                </button>
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

        <div className="h-4" />
      </motion.div>
    </>
  );
}
