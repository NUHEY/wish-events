"use client";

import * as React from "react";
import { dictionaries, type Dictionary } from "./dictionaries";
import type { Locale } from "./locales";

const LocaleContext = React.createContext<Locale>("ja");

/**
 * サーバー側で読んだロケール(Cookie由来)をクライアントコンポーネント群に配る。
 * これによりクライアントコンポーネントも useLocale()/useDict() で
 * サーバーと同じロケールを即座に参照でき、ハイドレーション時のズレが起きない。
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

export function useDict(): Dictionary {
  const locale = useLocale();
  return dictionaries[locale];
}
