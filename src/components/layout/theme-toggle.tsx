"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/layout/theme-provider";
import { useDict } from "@/lib/i18n/locale-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, mounted } = useTheme();
  const dict = useDict();
  const isDark = mounted && theme === "dark";
  const nextLabel = isDark ? dict.common.switchToLight : dict.common.switchToDark;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-secondary-foreground transition-[background-color,transform] active:scale-95",
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
