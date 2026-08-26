"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/**
 * プロフィールの学部・学年専用セレクト。値はhidden inputへ入れるため、
 * 見た目を完全にカスタムしても既存のServer Action + FormData送信を保てる。
 */
export function ProfileSingleSelect({
  id,
  name,
  options,
  defaultValue = "",
  placeholder,
  onValueChange,
}: {
  id: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  placeholder: string;
  onValueChange?: () => void;
}) {
  const listboxId = `${id}-listbox`;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(defaultValue);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const optionCount = options.length + 1;
  const [activeIndex, setActiveIndex] = React.useState(Math.max(0, selectedIndex));
  const selectedLabel = options.find((option) => option.value === value)?.label;

  React.useEffect(() => {
    function closeFromOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeFromOutside);
    return () => document.removeEventListener("mousedown", closeFromOutside);
  }, []);

  React.useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  function choose(nextValue: string) {
    setValue(nextValue);
    setOpen(false);
    onValueChange?.();
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function openAt(index: number) {
    setActiveIndex(Math.max(0, Math.min(optionCount - 1, index)));
    setOpen(true);
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt(selectedIndex >= 0 ? selectedIndex + 1 : optionCount - 1);
    }
  }

  function onOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index + 1) % optionCount);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index - 1 + optionCount) % optionCount);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(optionCount - 1);
    } else if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      if (event.key === "Escape") {
        event.preventDefault();
        buttonRef.current?.focus();
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        id={id}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={placeholder}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex + 1 : 0))}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-input bg-background px-3 py-2 text-left text-[16px] shadow-sm transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>{selectedLabel ?? placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-1.5 shadow-elevated"
        >
          <button
            ref={(node) => { optionRefs.current[0] = node; }}
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => choose("")}
            onKeyDown={(event) => onOptionKeyDown(event, 0)}
            onFocus={() => setActiveIndex(0)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent focus:bg-accent"
          >
            {placeholder}
            {value === "" && <Check className="h-4 w-4 text-primary" />}
          </button>
          {options.map((option, index) => {
            const optionIndex = index + 1;
            return (
              <button
                key={option.value}
                ref={(node) => { optionRefs.current[optionIndex] = node; }}
                type="button"
                role="option"
                aria-selected={value === option.value}
                onClick={() => choose(option.value)}
                onKeyDown={(event) => onOptionKeyDown(event, optionIndex)}
                onFocus={() => setActiveIndex(optionIndex)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm outline-none hover:bg-accent focus:bg-accent",
                  value === option.value && "bg-primary/[0.08] font-semibold text-primary"
                )}
              >
                <span>{option.label}</span>
                {value === option.value && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
