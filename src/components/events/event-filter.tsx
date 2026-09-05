"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";

export function EventFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");
  const dict = useDict();
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
    const href = buildHref(category);
    if (!signalNavigation(href)) return;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div className={cn("flex flex-wrap gap-2 transition-opacity", pending && "opacity-60")}>
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
  );
}
