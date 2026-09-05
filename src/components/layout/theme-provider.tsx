"use client";

import * as React from "react";
import { MOTION_STORAGE_KEY, MOTION_CHANGE_EVENT, shouldReduceMotion } from "@/lib/motion";
import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void; mounted: boolean; reducedMotion: boolean; setReducedMotion: (reduced: boolean) => void };

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [mounted, setMounted] = React.useState(false);
  const [reducedMotion, setReducedMotionState] = React.useState(false);

  React.useEffect(() => {
    const current: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setThemeState(current);
    setMounted(true);
    setReducedMotionState(shouldReduceMotion());
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(MOTION_STORAGE_KEY); } catch { /* Keep OS defaults when storage is unavailable. */ }
      const next = saved === "true" || (saved !== "false" && media.matches);
      document.documentElement.dataset.motion = next ? "reduce" : "full";
      setReducedMotionState(next);
      window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    };
    const onStorage = (event: StorageEvent) => { if (!event.key || event.key === MOTION_STORAGE_KEY) syncMotion(); };
    media.addEventListener("change", syncMotion);
    window.addEventListener("storage", onStorage);
    return () => { media.removeEventListener("change", syncMotion); window.removeEventListener("storage", onStorage); };
  }, []);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Apply for this visit even if storage is disabled. */ }
  }, []);

  const setReducedMotion = React.useCallback((next: boolean) => {
    document.documentElement.dataset.motion = next ? "reduce" : "full";
    setReducedMotionState(next);
    try { localStorage.setItem(MOTION_STORAGE_KEY, String(next)); } catch { /* Apply for this visit even if storage is disabled. */ }
    window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    if (next) document.getAnimations?.().forEach((animation) => animation.cancel());
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, mounted, reducedMotion, setReducedMotion }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
