"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { finishNavigation } from "@/lib/navigation-signal";
import { useLocale } from "@/lib/i18n/locale-provider";

/** Recover rendering failures and release any pending navigation lock. */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const en = useLocale() === "en";

  useEffect(() => {
    console.error(error);
    finishNavigation();
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <RefreshCw className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold">{en ? "This page could not be displayed" : "表示中に問題が発生しました"}</h1>
        <p className="text-sm text-muted-foreground">
          {en ? "Please retry. If the problem continues, reload the page or return home." : "もう一度お試しください。改善しない場合は、ページを読み込み直すか、ホームからやり直してください。"}
        </p>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">{en ? "Error reference" : "エラー番号"}: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button className="min-h-11" onClick={() => { router.refresh(); reset(); }}>{en ? "Retry" : "もう一度試す"}</Button>
        <Button className="min-h-11" variant="outline" onClick={() => window.location.reload()}>{en ? "Reload page" : "読み込み直す"}</Button>
        <Button className="min-h-11" variant="outline" onClick={() => router.push("/")}>
          {en ? "Return home" : "ホームに戻る"}
        </Button>
      </div>
    </div>
  );
}
