/**
 * FollowButton — Follow / Following toggle for a public profile.
 *
 * Auth-gated: tapping Follow while logged out opens AuthSheet first.
 * After sign-in the follow is toggled automatically.
 *
 * Follow state is local-only (localStorage); nothing is synced to Supabase in V1.
 */

import React, { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { isFollowing, toggleFollow } from "@/lib/localFollows";
import { useAuth } from "@/hooks/useAuth";
import { useMyProfile } from "@/hooks/useCommunity";
import { AuthSheet } from "@/components/auth/AuthSheet";
import { PrivateGateSheet } from "@/components/community/PrivateGateSheet";
import { changePrivacyMode } from "@/lib/sync";
import { setSharingPref } from "@/lib/sharingPreference";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  profileId: string;
  handle: string;
  /** "sm" renders a compact pill; "default" is full-size. */
  size?: "sm" | "default";
  className?: string;
}

export function FollowButton({
  profileId,
  handle,
  size = "default",
  className,
}: FollowButtonProps) {
  const { user }                    = useAuth();
  const { data: myProfile }         = useMyProfile(user?.id);
  const [following,    setFollowing]    = useState(() => isFollowing(profileId));
  const [showAuth,     setShowAuth]     = useState(false);
  const [showPrivGate, setShowPrivGate] = useState(false);

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user)                                 { setShowAuth(true);     return; }
    if (myProfile?.privacy_mode === "private") { setShowPrivGate(true); return; }
    setFollowing(toggleFollow(profileId, handle));
  };

  /** After sign-in, complete the follow action. */
  const handleAuthSuccess = () => {
    setShowAuth(false);
    setFollowing(toggleFollow(profileId, handle));
  };

  const isSm = size === "sm";

  return (
    <>
      <button
        onClick={handleTap}
        className={cn(
          "flex items-center gap-1.5 border-2 border-black rounded-full font-bold transition-all",
          "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          "active:shadow-none active:translate-x-0.5 active:translate-y-0.5",
          isSm ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-sm",
          following ? "bg-white text-black" : "bg-primary text-black",
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

      <AnimatePresence>
        {showAuth && (
          <AuthSheet
            onClose={() => setShowAuth(false)}
            onSuccess={handleAuthSuccess}
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
              setFollowing(toggleFollow(profileId, handle));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
