"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";

/**
 * サブページ上部に置く共通の「戻る」ボタン。
 * 基本はブラウザ履歴を1つ戻る(router.back())ことで「実際に元いたページ」に
 * 戻す。ただし直接URLを開いた／新規タブで開いた等、アプリ内の履歴が無い
 * ケースでは戻り先が無くなってしまうため、その場合だけ論理的な親ページ
 * (fallbackHref)へ遷移する。
 */
export function BackButton({
  fallbackHref,
  className,
}: {
  fallbackHref: string;
  className?: string;
}) {
  const router = useRouter();
  const dict = useDict();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {dict.common.back}
    </button>
  );
}
