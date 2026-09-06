"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";

const STATUSES = ["all", "upcoming", "past"] as const;
export type EventStatus = (typeof STATUSES)[number];

/** Compact status choices with a thin underline; touch targets remain 44px high. */
export function EventStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasDateFilter = ["date", "from", "to", "month"].some((key) => searchParams.has(key));
  const requestedStatus = searchParams.get("status");
  const active: EventStatus = !hasDateFilter && (requestedStatus === "upcoming" || requestedStatus === "past") ? requestedStatus : "all";
  const dict = useDict();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  function setStatus(status: EventStatus) {
    if (pending || (status === active && !hasDateFilter)) return;
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["date", "from", "to", "month"]) params.delete(key);
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
      role="group"
      aria-label={locale === "ja" ? "開催状況" : "Event status"}
      className={cn(
        "inline-flex max-w-full items-center gap-3 border-b border-border transition-opacity",
        pending && "opacity-60"
      )}
    >
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={active === status}
          disabled={pending}
          onClick={() => setStatus(status)}
          className={cn(
            "min-h-11 min-w-0 border-b-2 px-1 py-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active === status
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[status]}
        </button>
      ))}
    </div>
  );
}
