"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function EventFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("category");

  function setCategory(category: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setCategory(null)}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
          !active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-secondary text-secondary-foreground hover:bg-accent"
        )}
      >
        すべて
      </button>
      {EVENT_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCategory(c)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
            active === c
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-accent"
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
