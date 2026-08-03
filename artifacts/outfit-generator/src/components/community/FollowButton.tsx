/**
 * FollowButton — Follow / Following toggle for a public profile.
 *
 * Local-only: no account required, nothing synced to Supabase in V1.
 * Manages its own state seeded from localStorage so it reflects the
 * correct initial value without a hook or context query.
 */

import React, { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { isFollowing, toggleFollow } from "@/lib/localFollows";
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
  const [following, setFollowing] = useState(() => isFollowing(profileId));

  const handleTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowing(toggleFollow(profileId, handle));
  };

  const isSm = size === "sm";

  return (
    <button
      onClick={handleTap}
      className={cn(
        "flex items-center gap-1.5 border-2 border-black rounded-full font-bold transition-all",
        "shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
        "active:shadow-none active:translate-x-0.5 active:translate-y-0.5",
        isSm ? "px-3 py-1 text-[11px]" : "px-4 py-2 text-sm",
        following
          ? "bg-white text-black"
          : "bg-primary text-black",
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
  );
}
