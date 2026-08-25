export type Locale = "ja" | "en";
export const LOCALES: Locale[] = ["ja", "en"];
export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "ja" || value === "en";
}
