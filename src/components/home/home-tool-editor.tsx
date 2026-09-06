"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { saveHomeToolSettings } from "@/actions/home-layout";
import { RESIDENT_TOOLS, type ToolKey } from "@/lib/resident-tools";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import type { FeatureFlagState } from "@/lib/feature-flags";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import { useLocale } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

type ToolSetting = { key: ToolKey; showOnHome: boolean; position: number; state: FeatureFlagState };

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
    <section id="home-tools" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
      <PendingFeedback active={pending} label={en ? "Saving home tools…" : "ホームのツール表示を保存しています…"} />
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-3"><h2 className="flex min-w-0 items-center gap-2 font-bold"><Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />{en ? "Tools on home" : "ホームに載せるツール"}</h2><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{tools.filter(tool => tool.showOnHome && tool.state !== "hidden").length}/{tools.length} {en ? "shown" : "表示"}</span></div>
        <p className="text-xs leading-relaxed text-muted-foreground">{en ? "Choose tools and their order. Tools set to private stay hidden from residents." : "載せるツールと並び順を選びます。公開設定が「非公開」のツールは寮生には表示されません。"}</p>
      </div>
      <fieldset disabled={pending} className="min-w-0">
      <legend className="sr-only">{en ? "Home tool settings" : "ホームのツール設定"}</legend>
      <ol aria-label={en ? "Home tools in display order" : "ホームに載せるツールの順番"} className="divide-y divide-border border-y border-border">
        {tools.map((tool, index) => {
          const copy = copyByKey.get(tool.key);
          if (!copy) return null;
          const title = en ? copy.titleEn : copy.title;
          return (
            <li key={tool.key} className={cn("flex min-w-0 items-center gap-2 px-3 py-2 sm:px-4", !tool.showOnHome && "bg-secondary/20")}>
              <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
                <Checkbox checked={tool.showOnHome} onCheckedChange={(checked) => setTools((current) => current.map((item) => item.key === tool.key ? { ...item, showOnHome: checked === true } : item))} aria-label={en ? `Show ${title} on home` : `${title}をホームに表示`} />
                <span className="min-w-0"><span className={cn("block break-words text-sm font-medium leading-snug", !tool.showOnHome && "text-muted-foreground")}>{title}</span>{tool.state !== "public" && <span className="mt-1 block text-[11px] text-muted-foreground">{tool.state === "hidden" ? (en ? "Currently private" : "公開設定で非公開中") : (en ? "Beta" : "ベータ公開中")}</span>}</span>
              </label>
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="sm" className="h-11 w-10 p-0" disabled={index === 0 || pending} onClick={() => move(index, -1)} aria-label={en ? `Move ${title} up` : `${title}を上へ`}><ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-11 w-10 p-0" disabled={index === tools.length - 1 || pending} onClick={() => move(index, 1)} aria-label={en ? `Move ${title} down` : `${title}を下へ`}><ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /></Button>
              </div>
            </li>
          );
        })}
      </ol>
      <details className="px-4">
        <summary className="min-h-11 w-fit cursor-pointer py-3 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{en ? "Tool appearance" : "ツールの見せ方"}</summary>
        <div className="grid gap-2 pb-4 sm:grid-cols-[1fr_12rem] sm:items-center">
          <p className="text-xs leading-relaxed text-muted-foreground">{en ? "On phones, both options show just the icon and name. Descriptions can appear on larger screens." : "スマホはどちらもアイコンと名前だけ。大きな画面では説明文も表示できます。"}</p>
          <Select aria-label={en ? "Home tool appearance" : "ホームのツールの見せ方"} value={density} onChange={(event) => setDensity(event.target.value as "minimal" | "compact")}><option value="minimal">{en ? "Icon and name" : "アイコンと名前"}</option><option value="compact">{en ? "Add descriptions on PC" : "PCでは説明文も表示"}</option></Select>
        </div>
      </details>
      </fieldset>
      <div className="flex flex-col gap-3 border-t border-border p-4">
      {feedback.error && <p role="alert" className="text-sm text-destructive">{feedback.error}</p>}
      {dirty ? <p role="status" className="text-sm text-primary">{en ? "You have unsaved changes." : "保存していない変更があります。"}</p> : feedback.success && <p role="status" className="text-sm text-primary">{feedback.success}</p>}
      <Button type="button" className="w-full sm:w-auto" disabled={pending || !dirty} onClick={save}><Save className="h-4 w-4" />{pending ? (en ? "Saving…" : "保存中…") : (en ? "Save home tools" : "ツールの設定を保存")}</Button>
      </div>
    </section>
  );
}
