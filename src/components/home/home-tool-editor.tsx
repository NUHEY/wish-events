"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import { saveHomeToolSettings } from "@/actions/home-layout";
import { RESIDENT_TOOLS } from "@/components/tools/resident-tool-grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type ToolSetting = { key: FeatureFlagKey; showOnHome: boolean; position: number; state: FeatureFlagState };

export function HomeToolEditor({ initialTools, initialDensity }: { initialTools: ToolSetting[]; initialDensity: "minimal" | "compact" }) {
  const [tools, setTools] = useState(() => [...initialTools].sort((a, b) => a.position - b.position));
  const [pending, startTransition] = useTransition();
  const [density, setDensity] = useState<"minimal" | "compact">(initialDensity);
  const copyByKey = new Map(RESIDENT_TOOLS.map((tool) => [tool.key, tool]));

  function move(index: number, direction: -1 | 1) {
    setTools((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveHomeToolSettings(tools.map((tool, index) => ({ key: tool.key, showOnHome: tool.showOnHome, position: index + 1 })), density);
      if (result.error) toast.error(result.error);
      else toast.success("ホームのツール表示を保存しました");
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <PendingFeedback active={pending} label="ホームのツール表示を保存しています…" />
      <div>
        <h2 className="font-bold">ホームに表示するツール</h2>
        <p className="mt-1 text-sm text-muted-foreground">公開中のツールだけがホームに表示されます。ここでは掲載する種類とツール同士の順番を選べます。ホーム全体での「便利ツール」欄の位置は、上のセクション設定から変更できます。</p>
      </div>
      <div className="space-y-2">
        {tools.map((tool, index) => {
          const copy = copyByKey.get(tool.key);
          if (!copy) return null;
          return (
            <div key={tool.key} className={cn("flex items-center gap-2 rounded-xl border border-border p-3", !tool.showOnHome && "opacity-60")}>
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Checkbox checked={tool.showOnHome} onCheckedChange={(checked) => setTools((current) => current.map((item) => item.key === tool.key ? { ...item, showOnHome: checked === true } : item))} aria-label={`${copy.title}をホームに表示`} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{copy.title}</p><p className="text-[11px] text-muted-foreground">{tool.state === "hidden" ? "現在は非公開" : tool.state === "beta" ? "ベータ公開中" : "公開中"}</p></div>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={index === 0 || pending} onClick={() => move(index, -1)} aria-label="上へ"><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={index === tools.length - 1 || pending} onClick={() => move(index, 1)} aria-label="下へ"><ArrowDown className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </div>
      <div className="grid gap-1.5 border-t border-border pt-4 sm:grid-cols-[1fr_12rem] sm:items-center">
        <div><p className="text-sm font-semibold">ホームでの大きさ</p><p className="text-xs text-muted-foreground">最小はタイトルだけ、コンパクトは短い説明も表示します。</p></div>
        <Select value={density} onChange={(event) => setDensity(event.target.value as "minimal" | "compact")}><option value="minimal">最小（推奨）</option><option value="compact">コンパクト</option></Select>
      </div>
      <Button type="button" disabled={pending} onClick={save}><Save className="h-4 w-4" />{pending ? "保存中…" : "ツール表示を保存"}</Button>
    </section>
  );
}
