"use client";

import { useDict } from "@/lib/i18n/locale-provider";

export function RouteLoading() {
  const dict = useDict();
  return (
    <div data-route-loading role="status" aria-live="polite" className="min-h-[55vh] space-y-5 py-5">
      <p className="text-sm text-muted-foreground">{dict.common.pageLoading}</p>
      <div aria-hidden="true" className="space-y-4 motion-safe:animate-pulse">
        <div className="h-8 w-2/3 rounded-lg bg-secondary" />
        <div className="h-11 rounded-xl bg-secondary" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((key) => <div key={key} className="h-32 rounded-2xl bg-secondary" />)}
        </div>
      </div>
    </div>
  );
}
