"use client";

import { CalendarPlus, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { FeatureFlagState } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

function calendarTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function EventCalendarActions({
  eventId,
  title,
  eventDate,
  location,
  description,
  featureState,
}: {
  eventId: string;
  title: string;
  eventDate: string;
  location: string | null;
  description: string | null;
  featureState: Exclude<FeatureFlagState, "hidden">;
}) {
  const start = new Date(eventDate);
  // 終了時刻を持たない既存データでも扱えるよう、カレンダー上は標準2時間枠にする。
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  function downloadIcs() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WISH Events//JA",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${eventId}@wish-events`,
      `DTSTAMP:${calendarTimestamp(new Date())}`,
      `DTSTART:${calendarTimestamp(start)}`,
      `DTEND:${calendarTimestamp(end)}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description || "WISH Eventsのイベント")}`,
      `LOCATION:${escapeIcs(location || "")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title.replace(/[\\/:*?\"<>|]/g, "-").slice(0, 50) || "wish-event"}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("カレンダーファイルを保存しました");
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">カレンダーに追加</h2>
        {featureState === "beta" && <Badge variant="secondary" className="text-[10px]">BETA</Badge>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">イベント日時を端末の標準カレンダーへ保存できます。</p>
      <button type="button" onClick={downloadIcs} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3 w-full")}>
        <Download className="h-4 w-4" />カレンダーへ保存
      </button>
    </section>
  );
}
