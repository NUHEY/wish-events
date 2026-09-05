"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";

export function EventFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");
  const dict = useDict();
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();

  function buildHref(category: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function setCategory(category: string | null) {
    if (pending) return;
    if (category === active) {
      setExpanded(false);
      triggerRef.current?.focus();
      return;
    }
    const href = buildHref(category);
    if (!signalNavigation(href)) return;
    setExpanded(false);
    triggerRef.current?.focus();
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className={cn("space-y-2 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <button ref={triggerRef} type="button" disabled={pending} aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(!expanded)} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          {locale === "ja" ? "フィルター" : "Filter"}
          <ChevronDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
        {active && <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">{dict.categories[active as keyof typeof dict.categories] ?? active}</span>}
      </div>
      <div id={panelId} hidden={!expanded} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setExpanded(false); triggerRef.current?.focus(); } }}>
        <div role="group" aria-label={dict.eventForm.categoryLabel} className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
      <button
        type="button"
        disabled={pending}
        aria-pressed={!active}
        onClick={() => setCategory(null)}
        className={cn(
          "min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
          !active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-secondary-foreground hover:bg-accent"
        )}
      >
        {dict.home.all}
      </button>
      {EVENT_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          disabled={pending}
          aria-pressed={active === c}
          onClick={() => setCategory(c)}
          className={cn(
            "min-h-11 shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === c
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          )}
        >
          {dict.categories[c] ?? c}
        </button>
      ))}
        </div>
      </div>
    </div>
  );
}
