import { cn } from "@/lib/utils";

/**
 * ローディング中のプレースホルダー表示に使う共通コンポーネント。
 * 各画面のloading.tsxでサイズ違いの animate-pulse + bg-secondary の div を
 * 都度書いていたため、表記ゆれや実際のカードとのサイズのズレが生じやすかった。
 * 今後 loading.tsx を書く・直す際はこのコンポーネントを使うこと。
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary motion-reduce:animate-none", className)} />;
}
