"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toJstDateKey } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/**
 * イベント検索用の月カレンダー。開催日がある日にドットを表示し、
 * 日付をタップするとその日のイベントに絞り込む（?date=YYYY-MM-DD）。
 */
export function EventCalendar({ eventDates }: { eventDates: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dict = useDict();
  const locale = useLocale();
  const selectedDate = searchParams.get("date");

  const [expanded, setExpanded] = useState(!!selectedDate);
  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00+09:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const datesWithEvents = useMemo(() => new Set(eventDates.map(toJstDateKey)), [eventDates]);

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function selectDate(dateKey: string) {
    if (selectedDate === dateKey) {
      navigateWithParams((params) => params.delete("date"));
      return;
    }
    navigateWithParams((params) => params.set("date", dateKey));
  }

  function clearDate() {
    navigateWithParams((params) => params.delete("date"));
  }

  const { year, month } = viewDate;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, dateKey };
    }),
  ];
  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_JA;
  const monthLabel =
    locale === "en"
      ? new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${year}年${month + 1}月`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
          <CalendarDays className="mr-1 h-3.5 w-3.5" />
          {expanded ? dict.home.calendarHide : dict.home.calendarShow}
        </Button>
        {selectedDate && (
          <button
            type="button"
            onClick={clearDate}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            {dict.home.dateFilterPrefix} {selectedDate}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="prev month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewDate((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
            {weekdays.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} />;
              const hasEvent = datesWithEvents.has(cell.dateKey);
              const isSelected = selectedDate === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => selectDate(cell.dateKey)}
                  className={cn(
                    "relative flex h-8 flex-col items-center justify-center rounded-lg text-xs transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {cell.day}
                  {hasEvent && !isSelected && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
