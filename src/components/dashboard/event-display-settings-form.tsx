"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { SlidersHorizontal, Tags } from "lucide-react";
import { updateEventDisplaySettings, type SiteSettingsActionResult } from "@/actions/site-settings";
import { useDirtyForm } from "@/lib/hooks/use-dirty-form";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { SiteSettings } from "@/lib/site-settings";

function CheckSetting({ name, label, note, checked }: { name: string; label: string; note?: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-background/55 p-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[hsl(var(--primary))]" />
      <span><span className="font-medium">{label}</span>{note && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{note}</span>}</span>
    </label>
  );
}

function NumberSetting({ name, label, note, value, min, max, step = 1, suffix }: { name: string; label: string; note: string; value: number; min: number; max: number; step?: number; suffix: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2"><Input id={name} name={name} type="number" defaultValue={value} min={min} max={max} step={step} className="h-11" /><span className="w-12 shrink-0 text-sm text-muted-foreground">{suffix}</span></div>
      <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

function PendingFields({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className="grid min-w-0 gap-6">{children}</fieldset>;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full sm:w-auto">{pending ? "表示設定を保存中…" : "イベント表示を保存"}</Button>;
}

export function EventDisplaySettingsForm({ settings }: { settings: SiteSettings }) {
  const { formRef, isDirty, markDirty, reset } = useDirtyForm();
  useUnsavedChangesGuard(isDirty, "保存していないイベント表示の変更を破棄しますか？");
  function applyPreset(kind: "readable" | "compact") {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string | boolean> = {
      event_label_rotation_enabled: kind === "compact", event_label_shuffle_enabled: false,
      event_label_duration_ms: "5000", event_label_jitter_percent: "0", event_label_limit: "3", event_label_position: "top-left",
      event_show_category_label: true, event_show_new_label: true, event_show_deadline_label: true,
      event_show_fee_label: true, event_show_free_label: true, event_deadline_hours: "24",
      event_title_lines: kind === "readable" ? "3" : "2", event_card_density: kind === "readable" ? "comfortable" : "compact",
    };
    // These are intentionally uncontrolled form fields: update their live values,
    // leaving every input mounted so collapsed settings are included on submit.
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement && typeof value === "boolean") field.checked = value;
      else if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement) && typeof value === "string") field.value = value;
    }
    markDirty();
  }
  const [state, action] = useFormState<SiteSettingsActionResult, FormData>(updateEventDisplaySettings, {});
  useEffect(() => {
    if (state.success) { toast.success("イベント表示を更新しました"); reset(); }
    if (state.error) toast.error(state.error);
  }, [state, reset]);

  return (
    <form ref={formRef} action={action} onInput={markDirty} onChange={markDirty} id="event-appearance" className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-3 border-b border-border bg-secondary/30 p-4 sm:p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tags className="h-5 w-5" /></span>
        <div><h2 className="font-bold">イベント一覧の見え方</h2><p className="mt-1 text-sm text-muted-foreground">一覧カードに表示する情報を選び、最後に「イベント表示を保存」を押してください。</p></div>
      </div>

      <div className="grid gap-6 p-4 sm:p-5">
        <PendingFields>
        <section className="space-y-3"><h3 className="text-sm font-bold">おすすめから選ぶ</h3><div className="grid gap-2 sm:grid-cols-2"><Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-3" onClick={() => applyPreset("readable")}>読みやすさ重視</Button><Button type="button" variant="outline" className="h-auto min-h-11 whitespace-normal py-3" onClick={() => applyPreset("compact")}>一覧性重視</Button></div><p className="text-xs leading-relaxed text-muted-foreground">読みやすさ重視は3行のタイトルと動かないラベル。一覧性重視は2行のタイトルと5秒ごとのラベル切り替えです。選んだ後も調整でき、保存まではサイトに反映されません。</p></section>
        <section className="grid gap-3 border-t border-border pt-5">
          <h3 className="text-sm font-bold">表示する情報</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckSetting name="event_show_category_label" label="カテゴリ" checked={settings.eventShowCategoryLabel} />
            <CheckSetting name="event_show_new_label" label="NEWラベル" note="公開開始から24時間以内のイベントに表示します。" checked={settings.eventShowNewLabel} />
            <CheckSetting name="event_show_deadline_label" label="締切間近ラベル" checked={settings.eventShowDeadlineLabel} />
            <CheckSetting name="event_show_fee_label" label="参加費" checked={settings.eventShowFeeLabel} />
            <CheckSetting name="event_show_free_label" label="無料ラベル" checked={settings.eventShowFreeLabel} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting name="event_deadline_hours" label="締切間近とみなす時間" note="申込締切までの残り時間です。" value={settings.eventDeadlineHours} min={1} max={168} suffix="時間" />
          </div>
        </section>

        <section className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="event_title_lines">タイトルの行数</Label><Select id="event_title_lines" name="event_title_lines" defaultValue={String(settings.eventTitleLines)}><option value="1">1行</option><option value="2">2行（標準）</option><option value="3">3行</option></Select><p className="text-xs text-muted-foreground">長いタイトルは末尾を省略し、一覧の見た目をそろえます。</p></div>
          <div className="grid gap-1.5"><Label htmlFor="event_card_density">カード内の余白</Label><Select id="event_card_density" name="event_card_density" defaultValue={settings.eventCardDensity}><option value="compact">コンパクト</option><option value="comfortable">ゆったり</option></Select><p className="text-xs text-muted-foreground">日時は省略せず、必要に応じて折り返します。</p></div>
        </section>

        <details className="rounded-xl border border-border">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ラベルの切り替えを細かく調整</summary>
          <div className="grid gap-3 px-4 pb-4">
          <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">ラベルの切り替え</h3></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CheckSetting name="event_label_rotation_enabled" label="複数ラベルを切り替える" note="オフでは先頭の1件だけ表示します。" checked={settings.eventLabelRotationEnabled} />
            <CheckSetting name="event_label_shuffle_enabled" label="イベントごとに順番を変える" note="毎回変わるのではなく、イベントごとに安定した順番です。" checked={settings.eventLabelShuffleEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberSetting name="event_label_duration_ms" label="1件を表示する時間（ミリ秒）" note="1800ミリ秒＝1.8秒。短い切り替えを避けるための下限です。" value={settings.eventLabelDurationMs} min={1800} max={12000} step={100} suffix="ms" />
            <NumberSetting name="event_label_jitter_percent" label="切り替え時間のばらつき" note="カードがすべて同時に切り替わらないように調整します。" value={settings.eventLabelJitterPercent} min={0} max={45} suffix="%" />
            <NumberSetting name="event_label_limit" label="切り替えて表示する件数" note="0にするとすべてのラベルを順番に表示します。" value={settings.eventLabelLimit} min={0} max={50} suffix="件" />
            <div className="grid gap-1.5"><Label htmlFor="event_label_position">表示位置</Label><Select id="event_label_position" name="event_label_position" defaultValue={settings.eventLabelPosition}><option value="top-left">画像の左上</option><option value="top-right">画像の右上</option></Select><p className="text-xs text-muted-foreground">参加費タグは右下のままです。</p></div>
          </div>
          </div>
        </details>

        </PendingFields>
        {isDirty && <p role="status" className="text-sm font-medium text-primary">保存していない変更があります。</p>}
        {state.success && !isDirty && <p role="status" className="text-sm text-primary">イベント表示を保存しました。</p>}
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        <div><SaveButton /></div>
      </div>
    </form>
  );
}
