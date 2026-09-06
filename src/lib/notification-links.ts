/** Links accepted by notification forms and rendering. */
export function isSafeNotificationLink(value: string): boolean {
  if (!value || value.length > 500 || /[\s\\]/.test(value)) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  if (!/^https?:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?(?:[/?#][^\s\\]*)?$/i.test(value)) return false;
  try { const url = new URL(value); return !url.username && !url.password; } catch { return false; }
}
