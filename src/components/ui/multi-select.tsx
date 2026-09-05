"use client";

import * as React from "react";
import { Check, Search, X, ChevronDown } from "lucide-react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";

export type MultiSelectOption = { code: string; label: string };

/**
 * チップ＋検索候補のシンプルな複数選択コンポーネント。
 * ネイティブ<select multiple>より使いやすく、国・言語のような選択肢が
 * 多いリストでも探しやすい。選択値はhidden inputとして描画するため、
 * 既存のServer Actions(FormData)にそのまま乗せられる
 * （formData.getAll(name)で配列として受け取れる）。
 */
export function MultiSelect({
  id,
  name,
  options,
  defaultValues = [],
  placeholder,
  onValueChange,
}: {
  id?: string;
  name: string;
  options: MultiSelectOption[];
  defaultValues?: string[];
  placeholder?: string;
  onValueChange?: (values: string[]) => void;
}) {
  const dict = useDict();
  const [selected, setSelected] = React.useState<string[]>(defaultValues);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [chipsRef] = useAutoAnimate({ duration: 140 });
  const [resultsRef] = useAutoAnimate({ duration: 120 });

  const labelFor = React.useCallback(
    (code: string) => options.find((o) => o.code === code)?.label ?? code,
    [options]
  );

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = options
    .filter((o) => !selected.includes(o.code))
    .filter((o) => `${o.label} ${o.code}`.toLocaleLowerCase().includes(normalizedQuery));

  function addOption(code: string) {
    if (selected.includes(code)) return;
    const next = [...selected, code];
    setSelected(next);
    onValueChange?.(next);
    setQuery("");
  }

  function removeOption(code: string) {
    const next = selected.filter((c) => c !== code);
    setSelected(next);
    onValueChange?.(next);
  }

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {selected.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}

      <div
        ref={chipsRef}
        className="flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background px-2.5 py-1.5 text-sm shadow-sm transition-colors hover:border-foreground/30 focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setOpen(true)}
      >
        {selected.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
          >
            {labelFor(code)}
            <button
              type="button"
              aria-label={`${dict.common.remove}: ${labelFor(code)}`}
              onClick={(e) => {
                e.stopPropagation();
                removeOption(code);
              }}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : undefined}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-[16px] outline-none placeholder:text-muted-foreground sm:text-sm"
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs">{query ? `${filtered.length}件の候補` : "候補を検索"}</span>
          </div>
          <div ref={resultsRef} className="max-h-64 overflow-y-auto overscroll-contain p-1.5">
            {filtered.map((o) => (
              <button
                key={o.code}
                type="button"
                onClick={() => addOption(o.code)}
                className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none")}
              >
                <span>{o.label}</span>
                <span className="ml-3 shrink-0 text-[10px] font-medium uppercase text-muted-foreground">{o.code}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground"><Check className="h-4 w-4" />該当する候補はありません</div>}
          </div>
        </div>
      )}
    </div>
  );
}
