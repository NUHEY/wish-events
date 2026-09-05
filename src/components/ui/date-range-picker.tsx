"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ja, enUS } from "date-fns/locale";
import { CalendarRange, ChevronDown } from "lucide-react";
import "react-day-picker/dist/style.css";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

function serializeDate(date: Date | undefined) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** イベント日時と同じDayPickerを使う、便利ツール共通の日付範囲入力。 */
export function DateRangePicker({
  startValue,
  endValue,
  onChange,
  maxDays = 31,
}: {
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  maxDays?: number;
}) {
  const locale = useLocale();
  const isJa = locale === "ja";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const range: DateRange | undefined = startValue
    ? { from: parseDate(startValue), to: parseDate(endValue) }
    : undefined;

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const label = range?.from
    ? `${range.from.toLocaleDateString(isJa ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}${range.to ? ` 〜 ${range.to.toLocaleDateString(isJa ? "ja-JP" : "en-US", { month: "short", day: "numeric" })}` : ""}`
    : isJa ? "候補期間を選択" : "Select a date range";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-input bg-background px-3.5 text-left text-sm shadow-sm transition-colors active:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarRange className="h-4 w-4" /></span>
        <span className={cn("min-w-0 flex-1 truncate font-medium", !range?.from && "text-muted-foreground")}>{label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="relative z-30 mt-2 w-fit max-w-full sm:absolute sm:left-0 rounded-2xl border border-border bg-card p-3 shadow-card-hover">
          <DayPicker
            className="wish-calendar"
            mode="range"
            selected={range}
            onSelect={(next) => {
              if (!next?.from) return onChange("", "");
              const maximum = new Date(next.from);
              maximum.setDate(maximum.getDate() + Math.max(1, maxDays) - 1);
              const end = next.to && next.to <= maximum ? next.to : next.to ? maximum : undefined;
              onChange(serializeDate(next.from), serializeDate(end));
            }}
            locale={isJa ? ja : enUS}
            weekStartsOn={0}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            style={{
              "--rdp-cell-size": "clamp(1.75rem, calc((100vw - 7rem) / 7), 2.5rem)",
              "--rdp-accent-color": "hsl(var(--primary))",
              "--rdp-background-color": "hsl(var(--primary) / 0.08)",
              "--rdp-outline": "2px solid hsl(var(--primary))",
              "--rdp-outline-selected": "3px solid hsl(var(--primary))",
            } as React.CSSProperties}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">{isJa ? `最大${maxDays}日` : `Up to ${maxDays} days`}</span>
            <button type="button" disabled={!range?.from || !range?.to} onClick={() => setOpen(false)} className="min-h-11 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40">{isJa ? "決定" : "Done"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
