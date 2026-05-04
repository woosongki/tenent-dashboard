"use client";

import { useEffect, useState } from "react";
import type { SidebarTheme } from "@/lib/tokens";

const STORAGE_KEY = "lifestyle.sidebar.theme";

export function useSidebarTheme(): [SidebarTheme, (t: SidebarTheme) => void] {
  const [theme, setTheme] = useState<SidebarTheme>("light");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function update(t: SidebarTheme) {
    setTheme(t);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, t);
  }

  return [theme, update];
}
