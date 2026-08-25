import countries from "i18n-iso-countries";
import jaCountries from "i18n-iso-countries/langs/ja.json";
import enCountries from "i18n-iso-countries/langs/en.json";
import ISO6391 from "iso-639-1";

export type Locale = "ja" | "en";
export const LOCALES: Locale[] = ["ja", "en"];
export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "ja" || value === "en";
}

export type CodeLabel = { code: string; ja: string; en: string };

countries.registerLocale(jaCountries);
countries.registerLocale(enCountries);

const japaneseLanguageNames = new Intl.DisplayNames(["ja"], { type: "language" });

/** ISO 639-1の全言語。プロフィール編集画面でのみ読み込まれる。 */
export const LANGUAGES: CodeLabel[] = ISO6391.getAllCodes()
  .map((code) => ({
    code,
    ja: japaneseLanguageNames.of(code) ?? ISO6391.getNativeName(code) ?? ISO6391.getName(code),
    en: ISO6391.getName(code),
  }))
  .sort((a, b) => a.ja.localeCompare(b.ja, "ja"));

const countryNamesJa = countries.getNames("ja", { select: "official" });
const countryNamesEn = countries.getNames("en", { select: "official" });

/** ISO 3166-1 alpha-2の全ての国・地域。 */
export const COUNTRIES: CodeLabel[] = Object.keys(countries.getAlpha2Codes())
  .map((code) => ({ code, ja: countryNamesJa[code] ?? code, en: countryNamesEn[code] ?? code }))
  .sort((a, b) => a.ja.localeCompare(b.ja, "ja"));

export function findLabel(list: CodeLabel[], code: string, locale: Locale): string {
  return list.find((item) => item.code === code)?.[locale] ?? code;
}
