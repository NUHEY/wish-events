"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { toast } from "sonner";
import { saveHomeToolSettings } from "@/actions/home-layout";
import { RESIDENT_TOOLS } from "@/components/tools/resident-tool-grid";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

type ToolSetting = { key: FeatureFlagKey; showOnHome: boolean; position: number; state: FeatureFlagState };

export function HomeToolEditor({ initialTools, initialDensity }: { initialTools: ToolSetting[]; initialDensity: "minimal" | "compact" }) {
  const [tools, setTools] = useState(() => [...initialTools].sort((a, b) => a.position - b.position));
  const en = useLocale() === "en";
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [density, setDensity] = useState<"minimal" | "compact">(initialDensity);
  const snapshot = JSON.stringify({ tools: tools.map(tool => ({ key: tool.key, showOnHome: tool.showOnHome })), density });
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useUnsavedChangesGuard(dirty, en ? "Discard unsaved home tool changes?" : "保存していないツール表示の変更を破棄しますか？");
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

  async function save() {
    if (inFlight.current || !dirty) return;
    inFlight.current = true; setPending(true); setFeedback({});
    try {
      const result = await saveHomeToolSettings(tools.map((tool, index) => ({ key: tool.key, showOnHome: tool.showOnHome, position: index + 1 })), density);
      if (result.error) { setFeedback({ error: result.error }); toast.error(result.error); }
      else { const message = en ? "Home tools saved." : "ホームのツール表示を保存しました"; setSavedSnapshot(snapshot); setFeedback({ success: message }); toast.success(message); }
    } catch { setFeedback({ error: en ? "Could not save. Your changes are kept. Please retry." : "保存できませんでした。変更内容は保持されています。もう一度お試しください。" }); }
    finally { inFlight.current = false; setPending(false); }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <PendingFeedback active={pending} label="ホームのツール表示を保存しています…" />
      <div>
        <h2 className="font-bold">{en ? "2. Tools shown on home" : "2. 便利ツール欄の内容"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">公開中のツールだけがホームに表示されます。ここでは掲載する種類とツール同士の順番を選べます。ホーム全体での「便利ツール」欄の位置は、上のセクション設定から変更できます。</p>
      </div>
      <fieldset disabled={pending} className="space-y-4">
      <legend className="sr-only">{en ? "Home tool settings" : "ホームのツール設定"}</legend>
      <div className="space-y-2">
        {tools.map((tool, index) => {
          const copy = copyByKey.get(tool.key);
          if (!copy) return null;
          return (
            <div key={tool.key} className={cn("flex items-center gap-2 rounded-xl border border-border p-3", !tool.showOnHome && "opacity-60")}>
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <Checkbox checked={tool.showOnHome} onCheckedChange={(checked) => setTools((current) => current.map((item) => item.key === tool.key ? { ...item, showOnHome: checked === true } : item))} aria-label={`${copy.title}をホームに表示`} />
              <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold leading-relaxed">{copy.title}</p><p className="text-[11px] text-muted-foreground">{tool.state === "hidden" ? "現在は非公開" : tool.state === "beta" ? "ベータ公開中" : "公開中"}</p></div>
              <Button type="button" variant="ghost" size="sm" className="h-11 w-11 shrink-0 p-0" disabled={index === 0 || pending} onClick={() => move(index, -1)} aria-label={`${copy.title}を上へ`}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="sm" className="h-11 w-11 shrink-0 p-0" disabled={index === tools.length - 1 || pending} onClick={() => move(index, 1)} aria-label={`${copy.title}を下へ`}><ArrowDown className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </div>
      <div className="grid gap-1.5 border-t border-border pt-4 sm:grid-cols-[1fr_12rem] sm:items-center">
        <div><p className="text-sm font-semibold">ホームでの大きさ</p><p className="text-xs text-muted-foreground">最小はタイトルだけ、コンパクトは短い説明も表示します。</p></div>
        <Select aria-label={en ? "Home tool size" : "ホームでのツールの大きさ"} value={density} onChange={(event) => setDensity(event.target.value as "minimal" | "compact")}><option value="minimal">最小（推奨）</option><option value="compact">コンパクト</option></Select>
      </div>
      </fieldset>
      {feedback.error && <p role="alert" className="text-sm text-destructive">{feedback.error}</p>}
      {dirty ? <p role="status" className="text-sm text-primary">{en ? "You have unsaved changes." : "保存していない変更があります。"}</p> : feedback.success && <p role="status" className="text-sm text-primary">{feedback.success}</p>}
      <Button type="button" className="w-full sm:w-auto" disabled={pending || !dirty} onClick={save}><Save className="h-4 w-4" />{pending ? "保存中…" : "ツール表示を保存"}</Button>
    </section>
  );
}
