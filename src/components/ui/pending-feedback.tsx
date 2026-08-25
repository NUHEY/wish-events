"use client";

import { Loader2 } from "lucide-react";

/** 保存・送信など、画面遷移を伴わない待ち時間を全画面で一貫して伝える。 */
export function PendingFeedback({ active, label = "処理しています…" }: { active: boolean; label?: string }) {
  if (!active) return null;
  return <div className="pointer-events-none" role="status" aria-live="polite" aria-label={label}><div className="fixed inset-x-0 top-0 z-[110] h-1 overflow-hidden bg-primary/15"><div className="h-full w-1/2 animate-[navigation-progress_900ms_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))] motion-reduce:animate-pulse" /></div><div className="fixed left-1/2 top-3 z-[109] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/95 px-3 py-2 text-xs font-semibold text-foreground shadow-elevated backdrop-blur"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" /><span>{label}</span></div></div>;
}
