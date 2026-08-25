"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, toJstDateKey } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type DateMode = "single" | "range" | "month";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function thisMonthKey(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/**
 * イベント検索の日付絞り込みUI。
 * 「単日」「期間（いつからいつ）」「月指定（何月中）」の3モードをタブで切り替える
 * 1つのパネルにまとめ、以前の「カレンダーを開いて日付をタップするだけ」から
 * 柔軟な検索ができるように拡張した。現在の絞り込み内容は常にチップで表示し、
 * ワンタップで解除できるようにしている。
 */
export function EventCalendar({ eventDates }: { eventDates: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dict = useDict();
  const locale = useLocale();

  const selectedDate = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const month = searchParams.get("month");
  const hasActiveDateFilter = !!(selectedDate || from || to || month);

  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState<DateMode>(() => {
    if (from || to) return "range";
    if (month) return "month";
    return "single";
  });

  const [viewDate, setViewDate] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00+09:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [rangeDraft, setRangeDraft] = useState({ from: from ?? "", to: to ?? "" });
  const [monthDraft, setMonthDraft] = useState(month ?? thisMonthKey());

  const datesWithEvents = useMemo(() => new Set(eventDates.map(toJstDateKey)), [eventDates]);

  function navigateWithParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    // 日付系の絞り込みは常に排他（同時に有効なのは1種類だけ）にする。
    params.delete("date");
    params.delete("from");
    params.delete("to");
    params.delete("month");
    mutate(params);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function selectSingleDate(dateKey: string) {
    if (selectedDate === dateKey) {
      navigateWithParams(() => {});
      return;
    }
    navigateWithParams((params) => params.set("date", dateKey));
  }

  function applyRange() {
    if (!rangeDraft.from && !rangeDraft.to) return;
    navigateWithParams((params) => {
      if (rangeDraft.from) params.set("from", rangeDraft.from);
      if (rangeDraft.to) params.set("to", rangeDraft.to);
    });
  }

  function applyMonth(value: string) {
    if (!value) return;
    setMonthDraft(value);
    navigateWithParams((params) => params.set("month", value));
  }

  function clearDateFilter() {
    navigateWithParams(() => {});
  }

  const { year, month: viewMonth } = viewDate;
  const firstOfMonth = new Date(year, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, viewMonth + 1, 0).getDate();
  const cells: Array<{ day: number; dateKey: string } | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateKey = `${year}-${pad2(viewMonth + 1)}-${pad2(day)}`;
      return { day, dateKey };
    }),
  ];
  const weekdays = locale === "en" ? WEEKDAYS_EN : WEEKDAYS_JA;
  const monthLabel =
    locale === "en"
      ? new Date(year, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${year}年${viewMonth + 1}月`;

  function monthKeyLabel(value: string) {
    const [y, m] = value.split("-").map(Number);
    if (!y || !m) return value;
    return locale === "en"
      ? new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : `${y}年${m}月`;
  }

  const activeChipLabel = selectedDate
    ? `${dict.home.dateFilterPrefix} ${selectedDate}`
    : from && to
      ? `${dict.home.dateRangePrefix} ${from} 〜 ${to}`
      : from
        ? `${dict.home.dateRangeFromOnlyPrefix} ${from}`
        : to
          ? `${dict.home.dateRangeToOnlyPrefix} ${to}`
          : month
            ? `${dict.home.monthFilterPrefix} ${monthKeyLabel(month)}`
            : null;

  const modeTabs: { key: DateMode; label: string }[] = [
    { key: "single", label: dict.home.dateModeSingle },
    { key: "range", label: dict.home.dateModeRange },
    { key: "month", label: dict.home.dateModeMonth },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={hasActiveDateFilter ? "default" : "outline"}
          size="sm"
          onClick={() => setPanelOpen((v) => !v)}
        >
          <CalendarDays className="mr-1 h-3.5 w-3.5" />
          {hasActiveDateFilter ? dict.home.dateFilterButtonActive : dict.home.dateFilterButton}
        </Button>
        {activeChipLabel && (
          <button
            type="button"
            onClick={clearDateFilter}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
          >
            {activeChipLabel}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {panelOpen && (
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-1 rounded-full bg-secondary/50 p-0.5">
            {modeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMode(tab.key)}
                className={cn(
                  "flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors",
                  mode === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === "single" && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() =>
                    setViewDate((v) => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))
                  }
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label="prev month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() =>
                    setViewDate((v) => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))
                  }
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
                      onClick={() => selectSingleDate(cell.dateKey)}
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

          {mode === "range" && (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {dict.home.dateRangeFrom}
                <input
                  type="date"
                  value={rangeDraft.from}
                  max={rangeDraft.to || undefined}
                  onChange={(e) => setRangeDraft((v) => ({ ...v, from: e.target.value }))}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {dict.home.dateRangeTo}
                <input
                  type="date"
                  value={rangeDraft.to}
                  min={rangeDraft.from || undefined}
                  onChange={(e) => setRangeDraft((v) => ({ ...v, to: e.target.value }))}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                />
              </label>
              <Button type="button" size="sm" onClick={applyRange} disabled={!rangeDraft.from && !rangeDraft.to}>
                {dict.home.dateFilterApply}
              </Button>
            </div>
          )}

          {mode === "month" && (
            <div className="flex flex-col gap-2.5">
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                {dict.home.dateModeMonth}
                <input
                  type="month"
                  value={monthDraft}
                  onChange={(e) => setMonthDraft(e.target.value)}
                  className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => applyMonth(thisMonthKey())}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
                >
                  {dict.home.monthThisMonth}
                </button>
                <button
                  type="button"
                  onClick={() => applyMonth(thisMonthKey(1))}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
                >
                  {dict.home.monthNextMonth}
                </button>
              </div>
              <Button type="button" size="sm" onClick={() => applyMonth(monthDraft)} disabled={!monthDraft}>
                {dict.home.dateFilterApply}
              </Button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="mt-3 w-full rounded-lg py-1.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {dict.home.dateFilterCloseButton}
          </button>
        </div>
      )}
    </div>
  );
}
