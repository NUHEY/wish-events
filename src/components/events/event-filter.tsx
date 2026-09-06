"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";
import { EMPTY_EVENT_FILTER, eventFilterError, eventFilterParams, readEventFilter, type EventFilterDraft } from "@/lib/event-filter-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function EventFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const dict = useDict();
  const en = useLocale() === "en";
  const applied = readEventFilter(new URLSearchParams(query));
  const [draft, setDraft] = useState(applied);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDraft(readEventFilter(new URLSearchParams(query))); setError(false); }, [query]);

  const categoryLabel = (category: string) => dict.categories[category as keyof typeof dict.categories] ?? category;
  const timingLabels = { all: en ? "Any time" : "すべて", upcoming: dict.home.statusUpcoming, past: dict.home.statusPast, custom: en ? "Choose dates" : "日付を指定" };
  const activeCount = Number(!!applied.category) + Number(applied.timing !== "all");
  const dateSummary = applied.dateMode === "single" ? applied.date : applied.dateMode === "month" ? applied.month : `${applied.from || (en ? "Any start" : "開始指定なし")} 〜 ${applied.to || (en ? "Any end" : "終了指定なし")}`;

  function close() { setExpanded(false); triggerRef.current?.focus(); }
  function navigate(next: EventFilterDraft) {
    if (pending) return;
    const params = eventFilterParams(new URLSearchParams(query), next).toString();
    if (params === query) { close(); return; }
    const href = params ? `${pathname}?${params}` : pathname;
    if (!signalNavigation(href)) return;
    close();
    startTransition(() => router.replace(href, { scroll: false }));
  }
  function update(values: Partial<EventFilterDraft>) { setDraft(current => ({ ...current, ...values })); setError(false); }
  const choiceClass = "min-h-11 min-w-14 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const issue = error ? eventFilterError(draft) : null;

  return (
    <div className={cn("min-w-0 space-y-3", pending && "opacity-60")} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <button ref={triggerRef} type="button" disabled={pending} aria-expanded={expanded} aria-controls={panelId}
          onClick={() => { if (!expanded) { setDraft(applied); setError(false); } setExpanded(!expanded); }}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />{en ? "Filter" : "フィルター"}
          {activeCount > 0 && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs tabular-nums text-primary">{activeCount}</span>}
          <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
        {activeCount > 0 && <button type="button" disabled={pending} onClick={() => navigate(EMPTY_EVENT_FILTER)} className="min-h-11 px-2 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">{en ? "Clear filters" : "条件をクリア"}</button>}
      </div>
      {!expanded && activeCount > 0 && <div className="flex flex-wrap gap-2">
        {[applied.category ? { key: "category", label: categoryLabel(applied.category), next: { ...applied, category: "" } } : null,
          applied.timing !== "all" ? { key: "timing", label: applied.timing === "custom" ? dateSummary : timingLabels[applied.timing], next: { ...applied, timing: "all" as const } } : null].map(chip => chip && (
          <button key={chip.key} type="button" disabled={pending} onClick={() => navigate(chip.next)} aria-label={`${chip.label}: ${en ? "Remove filter" : "条件を解除"}`} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg bg-secondary px-2.5 py-1.5 text-xs">
            <span className="min-w-0 break-words">{chip.label}</span><X aria-hidden="true" className="h-3 w-3 shrink-0" />
          </button>
        ))}
      </div>}
      {expanded && <form id={panelId} onSubmit={event => { event.preventDefault(); if (eventFilterError(draft)) { setError(true); return; } navigate(draft); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } }} className="max-w-xl overflow-hidden rounded-xl border border-border bg-card">
        <div className="space-y-5 p-4 sm:p-5">
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="mb-2 text-xs font-semibold text-muted-foreground">{dict.eventForm.categoryLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {["", ...EVENT_CATEGORIES].map(category => <button key={category} type="button" aria-pressed={draft.category === category} onClick={() => update({ category })} className={cn(choiceClass, draft.category === category ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary")}>
                {category ? categoryLabel(category) : dict.home.all}
              </button>)}
            </div>
          </fieldset>
          <div className="space-y-3 border-t border-border pt-4">
            <label htmlFor={`${panelId}-timing`} className="block text-xs font-semibold text-muted-foreground">{en ? "When" : "開催日"}</label>
            <Select id={`${panelId}-timing`} value={draft.timing} onChange={event => update({ timing: event.target.value as EventFilterDraft["timing"] })} className="rounded-lg shadow-none">
              {Object.entries(timingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            {draft.timing === "custom" && <div className="space-y-3">
              <div role="group" aria-label={en ? "Date selection" : "日付の指定方法"} className="grid grid-cols-3 border-b border-border">
                {(["single", "range", "month"] as const).map(mode => <button key={mode} type="button" aria-pressed={draft.dateMode === mode} onClick={() => update({ dateMode: mode })} className={cn("-mb-px min-h-11 border-b-2 px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", draft.dateMode === mode ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground")}>
                  {mode === "single" ? dict.home.dateModeSingle : mode === "range" ? dict.home.dateModeRange : dict.home.dateModeMonth}
                </button>)}
              </div>
              {draft.dateMode === "single" && <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">{en ? "Date" : "日付"}<Input type="date" value={draft.date} onChange={event => update({ date: event.target.value })} className="rounded-lg text-foreground sm:h-11" /></label>}
              {draft.dateMode === "range" && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">{dict.home.dateRangeFrom}<Input type="date" value={draft.from} max={draft.to || undefined} onChange={event => update({ from: event.target.value })} className="rounded-lg text-foreground sm:h-11" /></label>
                <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">{dict.home.dateRangeTo}<Input type="date" value={draft.to} min={draft.from || undefined} onChange={event => update({ to: event.target.value })} className="rounded-lg text-foreground sm:h-11" /></label>
              </div>}
              {draft.dateMode === "month" && <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground">{dict.home.dateModeMonth}<Input type="month" value={draft.month} onChange={event => update({ month: event.target.value })} className="rounded-lg text-foreground sm:h-11" /></label>}
              {issue && <p role="alert" className="text-xs text-destructive">{issue === "range" ? (en ? "Choose a start or end date, with the end on or after the start." : "開始日か終了日を入力し、終了日は開始日以降にしてください。") : (en ? "Choose a valid date or month." : "日付または月を入力してください。")}</p>}
            </div>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
          <button type="button" onClick={() => { setDraft(EMPTY_EVENT_FILTER); setError(false); }} className="min-h-11 px-1 text-sm text-muted-foreground hover:text-foreground">{en ? "Reset" : "リセット"}</button>
          <Button type="submit" disabled={pending} className="min-h-11 rounded-lg px-5">{en ? "Apply filters" : "この条件で表示"}</Button>
        </div>
      </form>}
    </div>
  );
}
