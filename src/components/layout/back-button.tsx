"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { signalNavigation } from "@/lib/navigation-signal";

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

  function handleClick() {
    // 戻り先の実URLは戻る直前にはわからないため、fallbackHref（論理的な親ページ）を
    // 目安にして先にローディング表示（プログレスバー＋スケルトン）を開始する。
    // 実際の遷移先が違っても、NavigationFeedbackはpathname変化を検知した時点で
    // 自動的にローディング表示を終了するため、体感上の不整合は生じない。
    signalNavigation(fallbackHref);
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
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className
      )}
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="sr-only">戻る</span>
    </button>
  );
}
