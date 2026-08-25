import countries from "i18n-iso-countries";
import jaCountries from "i18n-iso-countries/langs/ja.json";
import enCountries from "i18n-iso-countries/langs/en.json";
import ISO6391 from "iso-639-1";
import type { Locale } from "./locales";

export type CodeLabel = { code: string; ja: string; en: string };

countries.registerLocale(jaCountries);
countries.registerLocale(enCountries);

const japaneseLanguageNames = new Intl.DisplayNames(["ja"], { type: "language" });

/** プロフィール画面だけで読み込むISO 639-1の全言語。コードしか返らない環境では正式名称へ戻す。 */
export const LANGUAGES: CodeLabel[] = ISO6391.getAllCodes()
  .map((code) => {
    const localized = japaneseLanguageNames.of(code);
    const english = ISO6391.getName(code) || code.toUpperCase();
    const native = ISO6391.getNativeName(code);
    return {
      code,
      ja: localized && localized.toLowerCase() !== code.toLowerCase() ? localized : native || english,
      en: english,
    };
  })
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
