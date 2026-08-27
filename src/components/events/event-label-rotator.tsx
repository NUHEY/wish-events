"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EventCardLabel = {
  text: string;
  tone: "category" | "deadline" | "new";
};

/** 短いタグを落ち着いて読め、切り替えが遅すぎない標準値。呼び出し側で変更可能。 */
export const DEFAULT_EVENT_LABEL_ROTATION_MS = 3000;

/**
 * ポスターをラベルで覆い尽くさないよう、複数の状態を1件ずつ循環表示する。
 * 1件だけならタイマー自体を作らず、カード一覧での不要な再描画を避ける。
 */
export function EventLabelRotator({
  labels,
  intervalMs = DEFAULT_EVENT_LABEL_ROTATION_MS,
}: {
  labels: EventCardLabel[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  // 誤指定で読めない速さや極端に長い停止にならない範囲に収める。
  const rotationMs = Math.min(10000, Math.max(1800, intervalMs));

  useEffect(() => {
    if (labels.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % labels.length);
    }, rotationMs);
    return () => window.clearInterval(timer);
  }, [labels.length, rotationMs]);

  if (labels.length === 0) return null;
  const active = labels[index % labels.length];

  return (
    <div className="pointer-events-none absolute left-2 right-2 top-2 flex min-w-0 justify-start">
      <Badge
        key={`${index}-${active.text}`}
        variant={active.tone === "deadline" ? "destructive" : "secondary"}
        title={active.text}
        style={{ animationDuration: `${rotationMs}ms` }}
        className={cn(
          "max-w-full min-w-0 overflow-hidden border-0 shadow-sm motion-safe:animate-[event-label-cycle_3000ms_ease-in-out_both] motion-reduce:animate-none",
          active.tone === "category" && "bg-card text-card-foreground",
          active.tone === "new" && "bg-info text-info-foreground"
        )}
      >
        <span className="block min-w-0 truncate">{active.text}</span>
      </Badge>
    </div>
  );
}
