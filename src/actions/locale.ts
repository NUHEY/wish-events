"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, type Locale } from "@/lib/i18n/locales";

export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
