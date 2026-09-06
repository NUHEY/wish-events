import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Native choice controls share the same size, border and focus treatment. */
export function SettingSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60", className)} />;
}
