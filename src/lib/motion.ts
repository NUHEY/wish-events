export const MOTION_STORAGE_KEY = "wish-events-reduced-motion";
export const MOTION_CHANGE_EVENT = "wish-motion-change";

export function shouldReduceMotion(): boolean {
  if (typeof document === "undefined") return false;
  const preference = document.documentElement.dataset.motion;
  if (preference) return preference === "reduce";
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const motionInitScript = `
(() => {
  let saved;
  try { saved = localStorage.getItem('${MOTION_STORAGE_KEY}'); } catch (_) {}
  const reduced = saved === 'true' || (saved !== 'false' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.dataset.motion = reduced ? 'reduce' : 'full';
})();`;
