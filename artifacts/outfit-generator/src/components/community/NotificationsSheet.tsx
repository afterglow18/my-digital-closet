/**
 * NotificationsSheet — bottom sheet showing heart notifications.
 *
 * Design rules:
 *  • Never reveal who liked a post.
 *  • Show the post name/thumbnail so the owner knows which post was liked.
 *  • Mark all as read the moment the sheet opens.
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkAllNotifsRead,
  AppNotification,
} from "@/hooks/useNotifications";

interface NotificationsSheetProps {
  onClose: () => void;
}

// ── Relative time helper ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Notification row ─────────────────────────────────────────────────────────

function NotifRow({ n }: { n: AppNotification }) {
  const label =
    n.type === "heart_item"
      ? `Love received on "${n.post_name || "your item"}"`
      : `Love received on "${n.post_name || "your outfit"}"`;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl transition-colors",
        n.read ? "bg-transparent" : "bg-primary/30",
      )}
    >
      {/* Thumbnail or fallback */}
      <div className="w-11 h-11 flex-shrink-0 rounded-xl border-2 border-black overflow-hidden bg-black/5 relative">
        {n.post_image_url ? (
          <img
            src={n.post_image_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-lg">
              {n.type === "heart_item" ? "👕" : "✨"}
            </span>
          </div>
        )}
        {/* Heart badge */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
          <Heart className="w-2.5 h-2.5 text-white fill-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-snug text-black/85 line-clamp-2">{label}</p>
        <p className="text-[10px] text-black/35 mt-0.5">{timeAgo(n.created_at)}</p>
      </div>

      {/* Unread dot */}
      {!n.read && (
        <div className="w-2 h-2 rounded-full bg-black flex-shrink-0" />
      )}
    </div>
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────

export function NotificationsSheet({ onClose }: NotificationsSheetProps) {
  const { data: notifs = [], isLoading } = useNotifications();
  const markRead = useMarkAllNotifsRead();

  // Mark all read as soon as the sheet opens
  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl
                   border-t-4 border-black shadow-[0_-4px_0px_0px_rgba(0,0,0,1)]
                   flex flex-col max-h-[75vh]"
        style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-black/20 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 border-b border-black/8">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            <h2 className="font-display font-black text-lg uppercase tracking-tight">
              Notifications
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full border-2 border-black/20
                       hover:border-black transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-14 h-14 rounded-full border-2 border-black/10 bg-black/5
                              flex items-center justify-center text-2xl">
                🔔
              </div>
              <p className="text-sm font-bold text-black/40">No notifications yet</p>
              <p className="text-xs text-black/30 text-center max-w-[200px] leading-snug">
                You'll hear here when someone likes one of your posts.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 pb-2">
              {notifs.map((n) => (
                <NotifRow key={n.id} n={n} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
