/**
 * useNotifications — react-query hooks for the notification bell.
 *
 * Notifications are created when someone hearts one of your posts.
 * We never expose WHO liked — notifications are intentionally anonymous.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

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
}

export const notifQueryKey = (userId: string) => ["notifications", userId] as const;

export function useNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notifQueryKey(user?.id ?? ""),
    queryFn: async (): Promise<AppNotification[]> => {
      if (!user || !isSupabaseConfigured()) return [];
      const { data, error } = await getSupabase()
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
    enabled: Boolean(user) && isSupabaseConfigured(),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
}

/** Returns the count of unread notifications for the badge. */
export function useUnreadNotifCount(): number {
  const { data } = useNotifications();
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
