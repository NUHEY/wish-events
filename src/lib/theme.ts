import { motionInitScript } from "@/lib/motion";

export const THEME_STORAGE_KEY = "wish-events-theme";

export const themeInitScript = `
(() => {
  try {
    const saved = localStorage.getItem('${THEME_STORAGE_KEY}');
    const dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();` + motionInitScript;
