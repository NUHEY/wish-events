"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";

const STATUSES = ["all", "upcoming", "past"] as const;
export type EventStatus = (typeof STATUSES)[number];

/** 開催状況（すべて/開催予定/過去）を切り替えるプルダウン。過去イベントも検索対象にする。 */
export function EventStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = (searchParams.get("status") as EventStatus | null) ?? "all";
  const dict = useDict();
  const [pending, startTransition] = useTransition();

  function setStatus(status: EventStatus) {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  const labels: Record<EventStatus, string> = {
    all: dict.home.statusAll,
    upcoming: dict.home.statusUpcoming,
    past: dict.home.statusPast,
  };

  return (
    <select
      value={active}
      onChange={(e) => setStatus(e.target.value as EventStatus)}
      disabled={pending}
      className={cn(
        "h-9 rounded-full border border-input bg-card px-3.5 text-sm font-medium shadow-sm transition-opacity",
        pending && "opacity-60"
      )}
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {labels[status]}
        </option>
      ))}
    </select>
  );
}
