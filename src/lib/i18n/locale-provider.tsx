"use client";

import * as React from "react";
import { dictionaries, type Dictionary } from "./dictionaries";
import type { Locale } from "./locales";

const LocaleContext = React.createContext<Locale>("ja");
const SetLocaleContext = React.createContext<(locale: Locale) => void>(() => {});

/**
 * サーバー側で読んだロケール(Cookie由来)をクライアントコンポーネント群に配る。
 * これによりクライアントコンポーネントも useLocale()/useDict() で
 * サーバーと同じロケールを即座に参照でき、ハイドレーション時のズレが起きない。
 *
 * 内部でstate化しているのは、LocaleToggle側でCookie書き換え直後に
 * router.refresh()の応答を待たず「即座に」切り替わった見た目にするため
 * （体感速度対策）。サーバーからの新しいlocale propが届いたら再同期する。
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = React.useState(locale);

  React.useEffect(() => {
    setCurrent(locale);
  }, [locale]);

  return (
    <LocaleContext.Provider value={current}>
      <SetLocaleContext.Provider value={setCurrent}>{children}</SetLocaleContext.Provider>
    </LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

export function useSetLocale(): (locale: Locale) => void {
  return React.useContext(SetLocaleContext);
}

export function useDict(): Dictionary {
  const locale = useLocale();
  return dictionaries[locale];
}
