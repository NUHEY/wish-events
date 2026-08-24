"use client";

import * as React from "react";
import { X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { code: string; label: string };

/**
 * チップ＋検索候補のシンプルな複数選択コンポーネント。
 * ネイティブ<select multiple>より使いやすく、国・言語のような選択肢が
 * 多いリストでも探しやすい。選択値はhidden inputとして描画するため、
 * 既存のServer Actions(FormData)にそのまま乗せられる
 * （formData.getAll(name)で配列として受け取れる）。
 */
export function MultiSelect({
  name,
  options,
  defaultValues = [],
  placeholder,
}: {
  name: string;
  options: MultiSelectOption[];
  defaultValues?: string[];
  placeholder?: string;
}) {
  const [selected, setSelected] = React.useState<string[]>(defaultValues);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const labelFor = React.useCallback(
    (code: string) => options.find((o) => o.code === code)?.label ?? code,
    [options]
  );

  const filtered = options
    .filter((o) => !selected.includes(o.code))
    .filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 30);

  function addOption(code: string) {
    setSelected((s) => (s.includes(code) ? s : [...s, code]));
    setQuery("");
  }

  function removeOption(code: string) {
    setSelected((s) => s.filter((c) => c !== code));
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
        className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setOpen(true)}
      >
        {selected.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {labelFor(code)}
            <button
              type="button"
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
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : undefined}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card p-1 shadow-card-hover">
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => addOption(o.code)}
              className={cn(
                "block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
