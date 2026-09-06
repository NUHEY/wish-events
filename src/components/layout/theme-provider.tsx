"use client";

import * as React from "react";
import { MOTION_STORAGE_KEY, MOTION_CHANGE_EVENT, shouldReduceMotion } from "@/lib/motion";
import { THEME_STORAGE_KEY, TEXT_SIZE_STORAGE_KEY, parseThemePreference, parseTextSize, resolveTheme, type Theme, type ThemePreference, type TextSize } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  themePreference: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  mounted: boolean;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
};
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}
function readSaved(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light");
  const [themePreference, setThemePreference] = React.useState<ThemePreference>("system");
  const themePreferenceRef = React.useRef<ThemePreference>("system");
  const [textSize, setTextSizeState] = React.useState<TextSize>("standard");
  const [mounted, setMounted] = React.useState(false);
  const [reducedMotion, setReducedMotionState] = React.useState(false);

  React.useEffect(() => {
    const colorMedia = window.matchMedia("(prefers-color-scheme: dark)");
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncTheme = () => {
      const next = resolveTheme(themePreferenceRef.current, colorMedia.matches);
      applyTheme(next);
      setThemeState(next);
    };
    const loadTheme = () => {
      const preference = parseThemePreference(readSaved(THEME_STORAGE_KEY));
      themePreferenceRef.current = preference;
      setThemePreference(preference);
      syncTheme();
    };
    const loadTextSize = () => {
      const next = parseTextSize(readSaved(TEXT_SIZE_STORAGE_KEY));
      document.documentElement.dataset.textSize = next;
      setTextSizeState(next);
    };
    const syncMotion = () => {
      const saved = readSaved(MOTION_STORAGE_KEY);
      const next = saved === "true" || (saved !== "false" && motionMedia.matches);
      document.documentElement.dataset.motion = next ? "reduce" : "full";
      setReducedMotionState(next);
      window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === THEME_STORAGE_KEY) loadTheme();
      if (!event.key || event.key === TEXT_SIZE_STORAGE_KEY) loadTextSize();
      if (!event.key || event.key === MOTION_STORAGE_KEY) syncMotion();
    };
    loadTheme();
    loadTextSize();
    setReducedMotionState(shouldReduceMotion());
    setMounted(true);
    colorMedia.addEventListener("change", syncTheme);
    motionMedia.addEventListener("change", syncMotion);
    window.addEventListener("storage", onStorage);
    return () => {
      colorMedia.removeEventListener("change", syncTheme);
      motionMedia.removeEventListener("change", syncMotion);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = React.useCallback((preference: ThemePreference) => {
    themePreferenceRef.current = preference;
    setThemePreference(preference);
    const next = resolveTheme(preference, window.matchMedia("(prefers-color-scheme: dark)").matches);
    setThemeState(next);
    applyTheme(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* Keep the choice for this visit. */ }
  }, []);

  const setTextSize = React.useCallback((next: TextSize) => {
    document.documentElement.dataset.textSize = next;
    setTextSizeState(next);
    try { localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next); } catch { /* Keep the choice for this visit. */ }
  }, []);

  const setReducedMotion = React.useCallback((next: boolean) => {
    document.documentElement.dataset.motion = next ? "reduce" : "full";
    setReducedMotionState(next);
    try { localStorage.setItem(MOTION_STORAGE_KEY, String(next)); } catch { /* Apply for this visit even if storage is disabled. */ }
    window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
    if (next) document.getAnimations?.().forEach((animation) => animation.cancel());
  }, []);

  return <ThemeContext.Provider value={{ theme, themePreference, setTheme, textSize, setTextSize, mounted, reducedMotion, setReducedMotion }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
