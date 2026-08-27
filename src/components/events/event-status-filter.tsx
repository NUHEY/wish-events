"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";

const STATUSES = ["all", "upcoming", "past"] as const;
export type EventStatus = (typeof STATUSES)[number];

/**
 * 開催状況（すべて/開催予定/過去）を切り替えるセグメントボタン。
 * 以前は<select>のプルダウンだったが、選択肢が3つだけなのに毎回開閉が必要で
 * 分かりにくかったため、カテゴリpiと同じ見た目のボタン列に統一した。
 */
export function EventStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = (searchParams.get("status") as EventStatus | null) ?? "all";
  const dict = useDict();
  const [pending, startTransition] = useTransition();

  function setStatus(status: EventStatus) {
    if (pending || status === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (!signalNavigation(href)) return;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  const labels: Record<EventStatus, string> = {
    all: dict.home.statusAll,
    upcoming: dict.home.statusUpcoming,
    past: dict.home.statusPast,
  };

  return (
    <div
      role="tablist"
      aria-label="event status"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5 transition-opacity",
        pending && "opacity-60"
      )}
    >
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          role="tab"
          aria-selected={active === status}
          disabled={pending}
          onClick={() => setStatus(status)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === status
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {labels[status]}
        </button>
      ))}
    </div>
  );
}
