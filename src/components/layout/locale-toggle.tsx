"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocale, useSetLocale } from "@/lib/i18n/locale-provider";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/locales";
import type { Locale } from "@/lib/i18n/locales";

export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Cookie自体はhttpOnlyではないため、Server Actionを経由せずクライアントで
    // 直接書き換える（サーバーへの往復を1回省略できる）。同時にReact contextも
    // 即座に更新するので、ボタンやクライアントコンポーネントの表示は
    // ネットワークを待たず一瞬で切り替わる。サーバーコンポーネント側の表示は
    // 裏側で走らせるrouter.refresh()の完了を待って追従する。
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocale(next);

    // フォーム入力中にrouter.refresh()を実行すると、そのページに読み込み中表示
    // (loading.tsx)のSuspense境界がある場合、入力途中の内容ごとフォームが
    // 再マウントされて消えてしまう不具合があった。表示中のテキスト自体は
    // useDict()経由のReact Contextで即座に切り替わるため、入力中（テキスト入力・
    // テキストエリア・contentEditable）はサーバー側の再取得をスキップして安全側に倒す。
    const active = document.activeElement;
    const isEditingForm =
      active instanceof HTMLElement &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
    if (isEditingForm) return;

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-secondary p-0.5 text-xs font-medium transition-opacity",
        pending && "opacity-70",
        className
      )}
    >
      {(["ja", "en"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            locale === l
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {l === "ja" ? "日本語" : "EN"}
        </button>
      ))}
    </div>
  );
}
