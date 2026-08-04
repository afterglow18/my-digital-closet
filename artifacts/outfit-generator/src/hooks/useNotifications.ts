/**
 * useNotifications — react-query hooks for the notification bell.
 *
 * Notifications are created when someone hearts one of your posts.
 * We never expose WHO liked — notifications are intentionally anonymous.
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ── Heart notification preference ─────────────────────────────────────────────

const HEART_NOTIFS_KEY = "heart_notifs_enabled";

export function getHeartNotifsEnabled(): boolean {
  try { return localStorage.getItem(HEART_NOTIFS_KEY) !== "false"; }
  catch { return true; }
}

export function setHeartNotifsEnabled(enabled: boolean): void {
  try { localStorage.setItem(HEART_NOTIFS_KEY, enabled ? "true" : "false"); }
  catch { /* ignore */ }
}

/** Reactive hook — returns [enabled, toggle] */
export function useHeartNotifsEnabled(): [boolean, () => void] {
  const [enabled, setEnabled] = useState(getHeartNotifsEnabled);
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setHeartNotifsEnabled(next);
      return next;
    });
  }, []);
  return [enabled, toggle];
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: "heart_item" | "heart_outfit";
  post_id: string;
  post_type: "item" | "outfit";
  post_name: string | null;
  post_image_url: string | null;
  read: boolean;
  created_at: string;
  // Joined liker info (null if join unavailable or liker is anonymous)
  liker_handle: string | null;
  liker_privacy_mode: string | null;
}

export const notifQueryKey = (userId: string) => ["notifications", userId] as const;

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = notifQueryKey(user?.id ?? "");

  // Supabase Realtime subscription — invalidates the query the moment a new
  // notification row arrives, so the badge updates without any polling delay.
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    // Use a unique channel name each mount so Supabase never reuses a
    // previously-subscribed channel (which would throw "cannot add callbacks
    // after subscribe()").
    const channel = getSupabase()
      .channel(`notifications:${user.id}:${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();

    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<AppNotification[]> => {
      if (!user || !isSupabaseConfigured()) return [];
      // Only show today's notifications — reset at midnight
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);

      const { data, error } = await getSupabase()
        .from("notifications")
        .select(`
          *,
          post_likes!like_id (
            liker_id,
            profiles!liker_id (
              handle,
              privacy_mode
            )
          )
        `)
        .eq("user_id", user.id)
        .gte("created_at", todayMidnight.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      return ((data ?? []) as any[]).map((n) => {
        const like    = n.post_likes;
        const profile = like?.profiles;
        return {
          ...n,
          liker_handle:       (profile?.privacy_mode === "public" ? profile?.handle : null) ?? null,
          liker_privacy_mode: profile?.privacy_mode ?? null,
        } as AppNotification;
      });
    },
    enabled: Boolean(user) && isSupabaseConfigured(),
    staleTime: 1000 * 60,      // Realtime handles instant updates; poll as fallback
    refetchInterval: 1000 * 60, // 60s fallback poll (was 30s)
  });
}

/** Returns the count of unread notifications for the badge (0 when disabled). */
export function useUnreadNotifCount(): number {
  const { data } = useNotifications();
  if (!getHeartNotifsEnabled()) return 0;
  return (data ?? []).filter((n) => !n.read).length;
}

/** Marks all notifications as read (optimistic update). */
export function useMarkAllNotifsRead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = notifQueryKey(user?.id ?? "");

  return useMutation({
    mutationFn: async () => {
      if (!user || !isSupabaseConfigured()) return;
      await getSupabase()
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AppNotification[]>(key);
      qc.setQueryData<AppNotification[]>(key, (old) =>
        (old ?? []).map((n) => ({ ...n, read: true })),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}
