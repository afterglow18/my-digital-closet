/**
 * FollowButton — Follow / Following toggle for a public profile.
 *
 * Auth-gated: tapping Follow while logged out opens AuthSheet first.
 * After sign-in, a pending follow is completed via a useEffect.
 *
 * Follow state is backed by Supabase when authenticated (via useFollowState),
 * with localStorage as a fallback for logged-out users. On first sign-in,
 * community.tsx migrates local follows to Supabase.
 */

import React, { useState, useEffect } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useFollowState } from "@/hooks/useFollows";
import { useAuth }        from "@/hooks/useAuth";
import { useMyProfile }   from "@/hooks/useCommunity";
import { AuthSheet }      from "@/components/auth/AuthSheet";
import { PrivateGateSheet } from "@/components/community/PrivateGateSheet";
import { changePrivacyMode } from "@/lib/sync";
import { setSharingPref }    from "@/lib/sharingPreference";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  profileId: string;
  handle:    string;
  /** "sm" renders a compact pill; "default" is full-size. */
  size?:     "sm" | "default";
  className?: string;
}

export function FollowButton({
  profileId,
  handle,
  size = "default",
  className,
}: FollowButtonProps) {
  const { user }            = useAuth();
  const { data: myProfile } = useMyProfile(user?.id);

  // Supabase-backed follow state with optimistic UI and revert on failure
  const { following, syncing, syncError, toggle, setFollowing } =
    useFollowState(profileId, handle, user?.id);

  const [showAuth,         setShowAuth]         = useState(false);
  const [showPrivGate,     setShowPrivGate]      = useState(false);
  // Set to true when the user opens AuthSheet from the Follow tap.
  // Completed by a useEffect once user becomes defined after sign-in.
  const [pendingAfterAuth, setPendingAfterAuth]  = useState(false);

  // Complete a pending follow once the user finishes signing in
  useEffect(() => {
    if (user && pendingAfterAuth) {
      setPendingAfterAuth(false);
      if (!following) {
        setFollowing(true); // optimistic
        toggle(user.id).catch(() => setFollowing(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, pendingAfterAuth]);

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user)                                 { setShowAuth(true);     return; }
    if (myProfile?.privacy_mode === "private") { setShowPrivGate(true); return; }
    toggle(user.id);
  };

  const isSm = size === "sm";

  return (
    <>
      <button
        onClick={handleTap}
        disabled={syncing}
        className={cn(
          "flex items-center gap-1.5 border-2 border-black rounded-full font-bold transition-all",
          "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:shadow-none active:translate-x-0.5 active:translate-y-0.5",
          isSm ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-sm",
          following ? "bg-white text-black" : "bg-primary text-black",
          syncing && "opacity-60 cursor-default",
          className,
        )}
      >
        {following ? (
          <>
            <UserCheck className={isSm ? "w-3 h-3" : "w-4 h-4"} />
            Following
          </>
        ) : (
          <>
            <UserPlus className={isSm ? "w-3 h-3" : "w-4 h-4"} />
            Follow
          </>
        )}
      </button>

      {syncError && (
        <p className="text-[10px] text-red-600 font-medium mt-1">{syncError}</p>
      )}

      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={() => {
              setShowAuth(false);
              setPendingAfterAuth(true); // useEffect completes the follow
            }}
            defaultTab="signup"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPrivGate && (
          <PrivateGateSheet
            action="follow"
            onClose={() => setShowPrivGate(false)}
            onConfirm={async (mode) => {
              setShowPrivGate(false);
              if (!user) return;
              await changePrivacyMode(user.id, mode);
              setSharingPref(mode);
              toggle(user.id);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
