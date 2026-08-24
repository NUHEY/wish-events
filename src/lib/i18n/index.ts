import { cookies } from "next/headers";
import { dictionaries, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isLocale, type Locale } from "./locales";

export type { Locale, Dictionary };
export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, LANGUAGES, COUNTRIES, findLabel, isLocale } from "./locales";
export { dictionaries };

/** Server Component / Server Action から呼ぶ。Cookieに保存されたロケールを読む。 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE_NAME)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
