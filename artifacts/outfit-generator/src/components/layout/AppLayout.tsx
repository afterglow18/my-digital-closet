import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Link, useLocation } from "wouter";
import { Shirt, Sparkles, Bookmark, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "@/lib/local-api";
import { useUnreadNotifCount } from "@/hooks/useNotifications";
import { getDiscoverFavorites } from "@/lib/discoverFavorites";

const BADGE_SEEN_KEY = "discover-badge-seen-count";

function getSeenCount() {
  return parseInt(localStorage.getItem(BADGE_SEEN_KEY) ?? "0", 10);
}

function useDiscoverFavoritesCount() {
  const [count,    setCount]    = useState(() => getDiscoverFavorites().length);
  const [seenCount, setSeenCount] = useState(() => getSeenCount());

  useEffect(() => {
    const update = () => setCount(getDiscoverFavorites().length);
    window.addEventListener("discoverFavoritesChanged", update);
    return () => window.removeEventListener("discoverFavoritesChanged", update);
  }, []);

  const resetBadge = () => {
    const current = getDiscoverFavorites().length;
    localStorage.setItem(BADGE_SEEN_KEY, String(current));
    setSeenCount(current);
  };

  return { badgeCount: Math.max(0, count - seenCount), resetBadge };
}

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * Pages can inject a thin bar directly above the nav bar by calling the setter
 * from this context. Always clear it in the useEffect cleanup:
 *
 *   useEffect(() => {
 *     setAboveNav(<MyBar />);
 *     return () => setAboveNav(null);
 *   }, [deps]);
 */
export const AboveNavSlotContext = createContext<(node: React.ReactNode) => void>(() => {});

export function AppLayout({ children }: AppLayoutProps) {
  const [location]  = useLocation();
  const navGroupRef = useRef<HTMLDivElement>(null);
  const frameRef    = useRef<HTMLDivElement>(null);
  const [navH, setNavH] = useState(90);

  // Keep --nav-h CSS variable in sync with the actual rendered nav height so
  // wardrobe / generate can use calc(100dvh - var(--nav-h)) instead of a
  // hard-coded constant that drifts when safe-area insets change.
  useEffect(() => {
    const el = navGroupRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) {
        setNavH(h);
        frameRef.current?.style.setProperty("--nav-h", `${h}px`);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { data: stats } = useGetWardrobeStats();
  const [aboveNavSlot, setAboveNavSlot] = useState<React.ReactNode>(null);

  const wardrobeCount = stats?.byCategory
    ? stats.byCategory
        .filter((c: { category: string }) => ["tops", "bottoms", "shoes"].includes(c.category))
        .reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    : undefined;

  const unreadNotifCount                        = useUnreadNotifCount();
  const { badgeCount: heartBadge, resetBadge }  = useDiscoverFavoritesCount();

  // Reset the heart badge when the user navigates AWAY from Discover
  const prevLocation = useRef(location);
  useEffect(() => {
    if (prevLocation.current === "/community" && location !== "/community") {
      resetBadge();
    }
    prevLocation.current = location;
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = [
    { href: "/", label: "Wardrobe", icon: Shirt, badge: wardrobeCount, badgeClass: "bg-secondary text-black" },
    { href: "/generate", label: "Generate", icon: Sparkles },
    { href: "/saved", label: "Saved", icon: Bookmark },
    { href: "/community", label: "Discover", icon: Globe, badge: unreadNotifCount || heartBadge || undefined, badgeClass: unreadNotifCount ? "bg-red-500 text-black" : "bg-pink-400 text-black" },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-[#f8f9fa] flex justify-center lg:py-8 lg:px-4">
      {/* Phone Frame Constraint for Desktop */}
      <div ref={frameRef} className="w-full max-w-md bg-background h-[100dvh] lg:min-h-[850px] lg:h-[850px] lg:border-[6px] lg:border-black lg:rounded-[3rem] lg:shadow-2xl relative overflow-hidden flex flex-col lg:overflow-y-auto">

        {/* Main Content Area — bottom padding matches actual nav group height */}
        <main
          className="flex-1 overflow-y-auto relative"
          style={{ paddingBottom: navH }}
        >
          <AboveNavSlotContext.Provider value={setAboveNavSlot}>
            {children}
          </AboveNavSlotContext.Provider>
        </main>

        {/*
          Above-nav bar + nav stacked in a single absolute column at the bottom.
          The bar (if any) renders above the nav, both inside the phone frame.
        */}
        <div ref={navGroupRef} className="absolute bottom-0 left-0 right-0 z-[40] flex flex-col">
          {aboveNavSlot}
          <nav className="bg-white border-t-[3px] border-black p-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
            <ul className="flex items-center justify-around">
              {navItems.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href} className="relative">
                    <Link href={item.href} className="flex flex-col items-center gap-1 group">
                      <div
                        className={cn(
                          "p-2.5 rounded-full border-2 transition-all duration-200 ease-spring relative",
                          isActive
                            ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                            : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95",
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-6 h-6",
                            isActive ? "text-black" : "text-muted-foreground",
                            item.href === "/generate" && isActive ? "animate-pulse" : "",
                          )}
                          strokeWidth={isActive ? 2.5 : 2}
                        />

                        {/* Badge */}
                        {item.badge !== undefined && item.badge > 0 && (
                          <div className={cn("absolute -top-2 -right-2 text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]", item.badgeClass ?? "bg-secondary text-black")}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider transition-colors",
                          isActive ? "text-black" : "text-muted-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
