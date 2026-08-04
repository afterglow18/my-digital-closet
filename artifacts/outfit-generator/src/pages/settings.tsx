/**
 * SettingsPage — accessible from the mannequin button in the wardrobe header.
 *
 * Sections:
 *  My Account · Community Profile · Privacy · Notifications ·
 *  Upgrade to Premium · Export / Import · Help & Support · Sign Out
 */

import React, { useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, Loader2,
  Download, Upload, RefreshCw, CheckCircle2, AlertCircle,
  LogOut, Trash2, Check, Bell, HelpCircle, Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useCommunity";
import { changePrivacyMode, deleteAccountStorage, unpublishAllUserPosts } from "@/lib/sync";
import { ParticipationMode, normalizeParticipationMode, setSharingPref, clearSharingPref } from "@/lib/sharingPreference";
import { resetAllVisibilityToPrivate } from "@/lib/db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { UpgradeSheet } from "@/components/paywall/UpgradeSheet";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { useEntitlements, syncTierFromRC, getCurrentTier } from "@/hooks/useEntitlements";
import { restorePurchases } from "@/lib/revenuecat";
import { exportBackup, importBackup, type ImportResult } from "@/lib/backup";
import { useQueryClient } from "@tanstack/react-query";
import { useHeartNotifsEnabled } from "@/hooks/useNotifications";
import { getListClothingQueryKey, getListOutfitsQueryKey } from "@/lib/local-api";
import { cn } from "@/lib/utils";

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
        : <AlertCircle   className="w-4 h-4 mt-0.5 flex-shrink-0" />}
      {status.msg}
    </div>
  );
}

const PARTICIPATION_OPTIONS: { mode: ParticipationMode; icon: string; label: string; desc: string }[] = [
  {
    mode: "private",
    icon: "🔒",
    label: "Private",
    desc: "Browse Discover without participating. Community features (hearts, follows, notifications) are disabled.",
  },
  {
    mode: "anonymous",
    icon: "🕶️",
    label: "Anonymous Sharing",
    desc: "Publish to Discover, heart posts, follow users. Your @handle stays hidden.",
  },
  {
    mode: "public",
    icon: "🌟",
    label: "Public Profile",
    desc: "Your @handle appears on posts. Others can visit your profile and follow you.",
  },
];

// ── Row components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-black/35">
      {children}
    </p>
  );
}

function SettingsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      "border-2 border-black rounded-2xl bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden",
      className,
    )}>
      {children}
    </div>
  );
}

interface RowProps {
  emoji: string;
  label: string;
  sublabel?: string;
  value?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  border?: boolean;
}

function Row({ emoji, label, sublabel, value, chevron, onClick, disabled, danger, border = true }: RowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={disabled ? undefined : onClick}
      disabled={onClick ? disabled : undefined}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
        border && "border-b-2 border-black/8 last:border-b-0",
        onClick && !disabled && "active:bg-black/5",
        disabled && "opacity-40 cursor-default",
        danger && "text-red-600",
      )}
    >
      <span className="text-xl leading-none flex-shrink-0 w-7 text-center">{emoji}</span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-bold", danger && "text-red-600")}>{label}</p>
        {sublabel && <p className="text-[11px] text-black/40 mt-0.5 truncate">{sublabel}</p>}
      </div>
      {value && <span className="text-xs text-black/40 font-medium flex-shrink-0">{value}</span>}
      {chevron && <ChevronRight className="w-4 h-4 text-black/25 flex-shrink-0" />}
    </Tag>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [, navigate]      = useLocation();
  const queryClient       = useQueryClient();
  const importRef         = useRef<HTMLInputElement>(null);

  const { data: profile, refetch: refetchProfile } = useMyProfile(user?.id);
  const { tier } = useEntitlements();
  const [heartNotifsEnabled, toggleHeartNotifs] = useHeartNotifsEnabled();

  // Auth sheet
  const [showAuth,    setShowAuth]    = useState(false);
  // Upgrade sheet
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Privacy
  const [changingMode,   setChangingMode]   = useState<ParticipationMode | null>(null);
  const [confirmPrivate, setConfirmPrivate] = useState(false);
  const [privacyErr,     setPrivacyErr]     = useState<string | null>(null);

  const handleChangeMode = async (newMode: ParticipationMode) => {
    if (!user) return;
    const current = normalizeParticipationMode(profile?.privacy_mode);
    if (current === newMode) return;
    if (newMode === "private") { setConfirmPrivate(true); return; }
    setConfirmPrivate(false);
    setChangingMode(newMode);
    setPrivacyErr(null);
    const result = await changePrivacyMode(user.id, newMode);
    if (result.ok) {
      setSharingPref(newMode);
      await refetchProfile();
    } else setPrivacyErr(result.error);
    setChangingMode(null);
  };

  const confirmSwitchToPrivate = async () => {
    if (!user) return;
    setChangingMode("private");
    setPrivacyErr(null);
    try {
      await unpublishAllUserPosts(user.id);
      resetAllVisibilityToPrivate();
      const result = await changePrivacyMode(user.id, "private");
      if (result.ok) {
        clearSharingPref();
        await refetchProfile();
        queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
      } else {
        setPrivacyErr(result.error);
      }
    } catch (e) {
      setPrivacyErr(e instanceof Error ? e.message : "Switch failed");
    } finally {
      setChangingMode(null);
      setConfirmPrivate(false);
    }
  };

  // Export / Import
  const [exportStatus,  setExportStatus]  = useState<Status>({ kind: "idle" });
  const [importStatus,  setImportStatus]  = useState<Status>({ kind: "idle" });
  const [restoreStatus, setRestoreStatus] = useState<Status>({ kind: "idle" });

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
      setRestoreStatus({
        kind: "ok",
        msg: t !== "free" ? "Subscription restored! ✨" : "No active subscription found.",
      });
    } catch {
      setRestoreStatus({ kind: "err", msg: "Restore failed. Please try again." });
    }
  };

  // Sign out
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/");
  };

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus,      setDeleteStatus]      = useState<Status>({ kind: "idle" });

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteStatus({ kind: "loading" });
    try {
      // Step 1: remove uploaded images from storage
      await deleteAccountStorage(user.id);
      // Step 2: delete all DB data + auth record via RPC (SECURITY DEFINER)
      // This is what Apple requires — the auth.users row is permanently removed.
      const { error } = await getSupabase().rpc("delete_user");
      if (error) throw error;
      // Step 3: clear local session (auth record is already gone)
      await signOut();
      navigate("/");
    } catch (e) {
      setDeleteStatus({ kind: "err", msg: e instanceof Error ? e.message : "Delete failed." });
    }
  };

  const currentMode = normalizeParticipationMode(profile?.privacy_mode);

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
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm font-bold text-black/50 hover:text-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Wardrobe
          </button>
        </div>

        {/* Title */}
        <div className="px-4 pb-4">
          <h1 className="font-display font-bold text-3xl uppercase tracking-tight">Settings</h1>
        </div>

        <div className="px-4 flex flex-col gap-5">

          {/* ── Account sections (auth-gated) ── */}
          {user ? (
            <>
              {/* Account + Community Profile */}
              <div>
                <SectionLabel>Account</SectionLabel>
                <SettingsCard>
                  <Row
                    emoji="👤"
                    label="My Account"
                    sublabel={user.email ?? undefined}
                  />
                  {isSupabaseConfigured() && (
                    <Row
                      emoji="🌍"
                      label="Community Profile"
                      sublabel={profile?.handle ? `@${profile.handle}` : undefined}
                      chevron
                      onClick={() => navigate("/profile/me")}
                    />
                  )}
                </SettingsCard>
              </div>

              {/* Community Participation */}
              {isSupabaseConfigured() && (
                <div>
                  <SectionLabel>Community Participation</SectionLabel>
                  <SettingsCard className="p-4 flex flex-col gap-3">
                    <p className="text-xs text-black/50 leading-snug px-1">
                      Choose how you want to participate in Discover. You can change this at any time.
                    </p>

                    {/* Private-switch confirmation banner */}
                    {confirmPrivate && (
                      <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-50 border-2 border-amber-300">
                        <p className="text-[11px] font-bold text-amber-800 leading-snug">
                          ⚠️ Switching to Private will immediately remove all your posts from Discover.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={confirmSwitchToPrivate}
                            disabled={changingMode !== null}
                            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase border-2 border-red-600
                                       bg-red-500 text-white active:opacity-80 disabled:opacity-50
                                       flex items-center justify-center gap-1"
                          >
                            {changingMode === "private"
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : "Yes, Go Private"}
                          </button>
                          <button
                            onClick={() => setConfirmPrivate(false)}
                            disabled={changingMode !== null}
                            className="flex-1 py-2 rounded-lg text-xs font-bold uppercase border-2 border-black/20
                                       text-black/50 active:bg-black/5 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {PARTICIPATION_OPTIONS.map(({ mode, icon, label, desc }) => {
                      const isActive   = currentMode === mode;
                      const isChanging = changingMode === mode;
                      const isBlocked  = changingMode !== null || (confirmPrivate && mode !== "private");
                      return (
                        <button
                          key={mode}
                          onClick={() => handleChangeMode(mode)}
                          disabled={isActive || isBlocked}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all",
                            isActive
                              ? "border-black bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              : "border-black/20 hover:border-black/50 bg-white active:bg-black/5",
                            !isActive && isBlocked && "opacity-40",
                          )}
                        >
                          <span className="text-xl leading-none mt-0.5 flex-shrink-0">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm">{label}</p>
                              {isChanging && <Loader2 className="w-3 h-3 animate-spin text-black/40" />}
                            </div>
                            <p className="text-[11px] text-black/50 mt-0.5 leading-snug">{desc}</p>
                          </div>
                          {isActive && <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-black/60" />}
                        </button>
                      );
                    })}
                    {privacyErr && <p className="text-xs text-red-600 px-1">{privacyErr}</p>}
                  </SettingsCard>
                </div>
              )}
            </>
          ) : (
            /* Guest CTA */
            <div>
              <SectionLabel>Account</SectionLabel>
              <SettingsCard className="p-4 flex flex-col gap-3">
                <p className="text-sm text-black/60 leading-snug">
                  Create a free account to share your looks on Discover, follow other closets, and sync your preferences.
                </p>
                <button
                  onClick={() => setShowAuth(true)}
                  className="w-full btn-brutalist py-3 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => setShowAuth(true)}
                  className="text-center text-xs text-black/40 font-bold underline hover:text-black transition-colors"
                >
                  Already have an account? Sign In
                </button>
              </SettingsCard>
            </div>
          )}

          {/* ── Admin ── (only visible to admins) */}
          {profile?.is_admin && (
            <div>
              <SectionLabel>Admin</SectionLabel>
              <SettingsCard>
                <Row
                  emoji="🛡️"
                  label="Moderation"
                  onClick={() => navigate("/admin")}
                  chevron
                />
              </SettingsCard>
            </div>
          )}

          {/* ── Notifications ── */}
          <div>
            <SectionLabel>Notifications</SectionLabel>
            <SettingsCard>
              <Row
                emoji="❤️"
                label="Heart Notifications"
                value={
                  <span className={cn("text-[11px] font-semibold", heartNotifsEnabled ? "text-green-600" : "text-black/30")}>
                    {heartNotifsEnabled ? "Active" : "Off"}
                  </span>
                }
                onClick={toggleHeartNotifs}
              />
            </SettingsCard>
          </div>

          {/* ── My Plan ── */}
          <div>
            <SectionLabel>Plan</SectionLabel>
            <SettingsCard>
              <Row
                emoji="👑"
                label="My Plan"
                value={tier === "free"
                  ? <span className="font-bold text-xs text-black/50">Free</span>
                  : <span className="font-bold text-xs text-black">Unlocked ✨</span>}
              />
              {tier === "free" && (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left
                             active:bg-black/5 transition-colors border-t-2 border-black/8"
                >
                  <Crown className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <span className="flex-1 text-sm font-bold">Upgrade to Premium</span>
                  <ChevronRight className="w-4 h-4 text-black/25 flex-shrink-0" />
                </button>
              )}
              <button
                onClick={handleRestore}
                disabled={restoreStatus.kind === "loading"}
                className="w-full flex items-center gap-3 px-4 py-3 border-t-2 border-black/8
                           active:bg-black/5 transition-colors disabled:opacity-50 text-left"
              >
                {restoreStatus.kind === "loading"
                  ? <Loader2 className="w-4 h-4 animate-spin text-black/40 flex-shrink-0" />
                  : <RefreshCw className="w-4 h-4 text-black/40 flex-shrink-0" />}
                <span className="text-sm font-semibold text-black/50">Restore Purchases</span>
              </button>
              {restoreStatus.kind !== "idle" && restoreStatus.kind !== "loading" && (
                <div className="px-4 pb-3">
                  <StatusMessage status={restoreStatus} />
                </div>
              )}
            </SettingsCard>
          </div>

          {/* ── Export / Import ── */}
          <div>
            <SectionLabel>Export / Import</SectionLabel>
            <SettingsCard className="p-4 flex flex-col gap-3">
              <p className="text-xs text-black/50 leading-snug px-1">
                Back up your wardrobe to a ZIP file. Save it to iCloud or Files, then restore anytime.
              </p>
              <button
                onClick={handleExport}
                disabled={exportStatus.kind === "loading"}
                className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                           bg-primary font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           disabled:opacity-50 transition-all"
              >
                {exportStatus.kind === "loading"
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />}
                Export Backup
              </button>
              <StatusMessage status={exportStatus} />
              <button
                onClick={() => importRef.current?.click()}
                disabled={importStatus.kind === "loading"}
                className="flex items-center justify-center gap-2 py-3 border-2 border-black rounded-xl
                           bg-white font-bold text-sm uppercase tracking-tight
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           disabled:opacity-50 transition-all"
              >
                {importStatus.kind === "loading"
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Upload className="w-4 h-4" />}
                Import Backup
              </button>
              <input ref={importRef} type="file" accept=".zip" className="hidden" onChange={handleImportFile} />
              <StatusMessage status={importStatus} />
            </SettingsCard>
          </div>

          {/* ── Help & Support ── */}
          <div>
            <SectionLabel>Support</SectionLabel>
            <SettingsCard>
              <Row
                emoji="❓"
                label="Help & Support"
                chevron
                onClick={() => window.open("mailto:support@mydigitalcloset.app", "_blank")}
              />
            </SettingsCard>
          </div>

          {/* ── Sign Out + Delete ── */}
          {user && (
            <div>
              <SectionLabel>Account Actions</SectionLabel>
              <SettingsCard>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left
                             active:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <span className="text-xl leading-none w-7 text-center">🚪</span>
                  <span className="flex-1 text-sm font-bold text-red-600">Sign Out</span>
                  {signingOut && <Loader2 className="w-4 h-4 animate-spin text-black/30" />}
                </button>

                {/* Delete account */}
                <div className="border-t-2 border-black/8">
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left
                                 active:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-black/25 ml-1.5 flex-shrink-0" />
                      <span className="text-xs font-bold text-black/30 uppercase tracking-wide hover:text-red-500 transition-colors">
                        Delete Account
                      </span>
                    </button>
                  ) : (
                    <div className="p-4 flex flex-col gap-3">
                      <p className="text-sm font-bold text-red-800">
                        This permanently deletes your account, profile, and all published posts. Your local wardrobe stays on this device.
                      </p>
                      <StatusMessage status={deleteStatus} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="flex-1 py-2 border-2 border-black rounded-lg text-xs font-bold uppercase bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleteStatus.kind === "loading"}
                          className="flex-1 py-2 border-2 border-red-600 rounded-lg text-xs font-bold uppercase
                                     bg-red-500 text-white disabled:opacity-50"
                        >
                          {deleteStatus.kind === "loading"
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsCard>
            </div>
          )}

          {/* spacer */}
          <div className="h-4" />
        </div>
      </motion.div>

      {/* Sheets */}
      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => setShowAuth(false)}
          />
        )}
      </AnimatePresence>

      {showUpgrade && (
        <UpgradeSheet onClose={() => setShowUpgrade(false)} reason="mannequin" />
      )}
    </>
  );
}
