import React, { createContext, useContext } from "react";
import { useIsTablet } from "@/hooks/useIsTablet";

interface LayoutContextValue {
  isTablet: boolean;
  /** Height in px consumed by the bottom nav (0 on tablet — sidebar takes no vertical space). */
  navH: number;
}

const LayoutContext = createContext<LayoutContextValue>({ isTablet: false, navH: 90 });

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const isTablet = useIsTablet();
  return (
    <LayoutContext.Provider value={{ isTablet, navH: isTablet ? 0 : 90 }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}
