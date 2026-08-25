"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useDict } from "@/lib/i18n/locale-provider";

/**
 * Markdown記法の簡単な説明を表示するヘルプボタン。
 * イベント説明文・お知らせ本文など、Markdown入力欄の近くに置く。
 */
export function MarkdownHelpButton() {
  const dict = useDict();
  const [open, setOpen] = useState(false);

  const rows: Array<[string, string]> = [
    ["# 見出し", dict.markdownHelp.heading],
    ["**太字**", dict.markdownHelp.bold],
    ["- 項目", dict.markdownHelp.list],
    ["[文字](URL)", dict.markdownHelp.link],
    ["> 引用", dict.markdownHelp.quote],
  ];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        aria-label={dict.markdownHelp.title}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {dict.markdownHelp.title}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-card p-3 text-xs shadow-elevated motion-safe:animate-pop-in">
            <table className="w-full border-collapse">
              <tbody>
                {rows.map(([syntax, label]) => (
                  <tr key={syntax} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-2 font-mono text-[11px] text-foreground">{syntax}</td>
                    <td className="py-1.5 text-muted-foreground">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
