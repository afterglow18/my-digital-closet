import React from "react";
import { Link, useLocation } from "wouter";
import { Sparkles, Bookmark, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetWardrobeStats } from "../../hooks/useLocalWardrobe";

interface ModuleLayoutProps {
  children: React.ReactNode;
}

export function ModuleLayout({ children }: ModuleLayoutProps) {
  const [location] = useLocation();
  const { data: stats } = useGetWardrobeStats();
  const wardrobeCount = stats?.total ?? undefined;
  const BASE_URL = import.meta.env.BASE_URL || '/';

  // nav items — Jewelry module nav
  const navItems = [
    { href: "/",         label: "Jewelry",  icon: null,        badge: wardrobeCount, emoji: "💍" },
    { href: "/generate", label: "Generate",      icon: Sparkles },
    { href: "/saved",    label: "Saved",          icon: Bookmark },
    { href: "/account",  label: "Account",        icon: UserCircle },
  ];

  return (
    <div className="min-h-[100dvh] w-full bg-[#f8f9fa] flex justify-center lg:py-8 lg:px-4">
      <div className="w-full max-w-md bg-background h-[100dvh] lg:min-h-[850px] lg:h-[850px] lg:border-[6px] lg:border-black lg:rounded-[3rem] lg:shadow-2xl relative overflow-hidden flex flex-col lg:overflow-y-auto">

        {/* ← Collections — returns to the main hub */}
        <a
          href={BASE_URL}
          className="absolute top-3 left-3 z-50 flex items-center gap-1 bg-white/90 backdrop-blur border-2 border-black rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-transform"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          ← Collections
        </a>

        <main className="flex-1 overflow-y-auto pb-[90px] relative">
          {children}
        </main>

        <nav className="absolute bottom-0 left-0 right-0 bg-white border-t-[3px] border-black p-3 pb-safe z-[40]">
          <ul className="flex items-center justify-around">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href} className="relative">
                  <Link href={item.href} className="flex flex-col items-center gap-1 group">
                    <div className={cn(
                      "p-2.5 rounded-full border-2 transition-all duration-200 ease-spring relative",
                      isActive
                        ? "bg-primary border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] -translate-y-1"
                        : "bg-transparent border-transparent group-hover:bg-muted group-active:scale-95"
                    )}>
                      {Icon ? (
                        <Icon
                          className={cn(
                            "w-6 h-6",
                            isActive ? "text-black" : "text-muted-foreground",
                            item.href === "/generate" && isActive ? "animate-pulse" : ""
                          )}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                      ) : (
                        <span className="text-xl leading-none select-none">{item.emoji}</span>
                      )}
                      {item.badge !== undefined && item.badge > 0 && (
                        <div className="absolute -top-2 -right-2 bg-secondary text-black text-[10px] font-bold border-2 border-black w-5 h-5 flex items-center justify-center rounded-full shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {item.badge > 99 ? '99+' : item.badge}
                        </div>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider transition-colors",
                      isActive ? "text-black" : "text-muted-foreground"
                    )}>
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
  );
}
