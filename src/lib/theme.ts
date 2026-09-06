import { motionInitScript } from "@/lib/motion";

export const THEME_STORAGE_KEY = "wish-events-theme";
export const TEXT_SIZE_STORAGE_KEY = "wish-events-text-size";
export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";
export type TextSize = "standard" | "large";

export function parseThemePreference(saved: string | null): ThemePreference {
  return saved === "light" || saved === "dark" ? saved : "system";
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function parseTextSize(saved: string | null): TextSize {
  return saved === "large" ? "large" : "standard";
}

export const themeInitScript = `
(() => {
  let saved, textSize;
  try {
    saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    textSize = localStorage.getItem('${TEXT_SIZE_STORAGE_KEY}');
  } catch (_) {}
  const dark = saved === 'dark' || (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.dataset.textSize = textSize === 'large' ? 'large' : 'standard';
})();` + motionInitScript;
