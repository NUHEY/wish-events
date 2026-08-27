"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EventCardLabel = {
  text: string;
  tone: "category" | "deadline" | "new";
};

/**
 * ポスターをラベルで覆い尽くさないよう、複数の状態を1件ずつ循環表示する。
 * 1件だけならタイマー自体を作らず、カード一覧での不要な再描画を避ける。
 */
export function EventLabelRotator({ labels }: { labels: EventCardLabel[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (labels.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % labels.length);
    }, 1100);
    return () => window.clearInterval(timer);
  }, [labels.length]);

  if (labels.length === 0) return null;
  const active = labels[index % labels.length];

  return (
    <div className="pointer-events-none absolute left-2 right-2 top-2 flex min-w-0 justify-start">
      <Badge
        key={`${index}-${active.text}`}
        variant={active.tone === "deadline" ? "destructive" : "secondary"}
        title={active.text}
        className={cn(
          "max-w-full min-w-0 overflow-hidden border-0 shadow-sm backdrop-blur-md motion-safe:animate-[event-label-cycle_1100ms_ease-in-out_both] motion-reduce:animate-none",
          active.tone === "category" && "bg-card/92 text-card-foreground",
          active.tone === "new" && "bg-info/90 text-info-foreground"
        )}
      >
        <span className="block min-w-0 truncate">{active.text}</span>
      </Badge>
    </div>
  );
}
