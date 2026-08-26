"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ja, enUS } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import "react-day-picker/dist/style.css";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";

/**
 * イベント作成/編集フォーム用の日時ピッカー。
 * ネイティブの<input type="datetime-local">はOS/ブラウザによって見た目が
 * 大きく異なり洗練された印象にならないため、カレンダーのポップオーバー +
 * 時刻入力の組み合わせで自前実装している。
 * フォーム送信自体は、他のフィールド（poster_urlなど）と同じく
 * hidden inputに"YYYY-MM-DDTHH:mm"形式の文字列を詰める方式なので、
 * サーバー側(actions/events.ts)の処理は変更不要。
 */
function parseValue(value?: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: "18:00" };
  const [datePart, timePart] = value.split("T");
  const parts = datePart?.split("-").map(Number) ?? [];
  const [y, m, d] = parts;
  if (!y || !m || !d) return { date: undefined, time: "18:00" };
  return { date: new Date(y, m - 1, d), time: timePart?.slice(0, 5) || "18:00" };
}

function formatValue(date: Date | undefined, time: string): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}T${time}`;
}

export function DateTimePicker({
  name,
  required,
  defaultValue,
}: {
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const locale = useLocale();
  const isJa = locale === "ja";
  const init = parseValue(defaultValue);
  const [date, setDate] = useState<Date | undefined>(init.date);
  const [time, setTime] = useState(init.time);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const value = formatValue(date, time);
  const displayLabel = date
    ? date.toLocaleDateString(isJa ? "ja-JP" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : null;

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isJa ? "開催日時を選択" : "Select date and time"}
        className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm ring-offset-background transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className={cn(!displayLabel && "text-muted-foreground")}>
          {displayLabel ?? (isJa ? "日付を選択" : "Select a date")}
        </span>
        <span className="ml-auto tabular-nums text-muted-foreground">{time}</span>
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 flex flex-col gap-1 rounded-lg border border-border bg-card p-3 shadow-card-hover"
          style={
            {
              // react-day-pickerのデフォルトは青系(#0000ff等)。サイトのワインレッドに
              // 合わせて選択日・ホバー背景ともに青みが一切残らないよう明示的に上書きする。
              // --accentはhueが220(青寄り)のため、ホバー背景には使わずワイン色を薄めた
              // 独自のトーンを用いる。
              "--rdp-cell-size": "2.25rem",
              "--rdp-accent-color": "hsl(var(--primary))",
              "--rdp-background-color": "hsl(340 45% 96%)",
              "--rdp-outline": "2px solid hsl(var(--primary))",
              "--rdp-outline-selected": "3px solid hsl(var(--primary))",
            } as React.CSSProperties
          }
        >
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => d && setDate(d)}
            locale={isJa ? ja : enUS}
            weekStartsOn={0}
          />
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <label htmlFor={`${name}_time`} className="text-sm text-muted-foreground">
              {isJa ? "時刻" : "Time"}
            </label>
            <input
              id={`${name}_time`}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="ml-auto rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={!date}
              className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
            >
              {isJa ? "決定" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
