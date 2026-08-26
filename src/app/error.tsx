"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 画面の描画中にエラーが起きた際、真っ白のまま固まって見えるのを防ぐための
 * 全体エラーバウンダリー。「更新されたのか何か知らないが真っ白のまま
 * フリーズすることがある」という報告への対策として追加。
 *
 * 「もう一度試す」（reset）と「再読み込み」が同じ意味に見えるという指摘を受け、
 * 2つ目のボタンは意味の異なる「ホームに戻る」に変更した。resetはこのセグメントの
 * 再描画だけを試みる軽量な操作、ホームに戻るはページ遷移によって状態そのものを
 * リセットする、明確に異なる代替手段にしている。
 */
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <RefreshCw className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold">表示中に問題が発生しました</h1>
        <p className="text-sm text-muted-foreground">
          一時的な問題が発生した可能性があります。もう一度お試しください。改善しない場合はホームからやり直してください。
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>もう一度試す</Button>
        <Button variant="outline" onClick={() => router.push("/")}>
          ホームに戻る
        </Button>
      </div>
    </div>
  );
}
