"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HOME_ACCENT_HEX, HOME_ACCENT_KEYS, type HomeAccentKeyValue } from "@/lib/constants";
import { saveHomeLayout, type HomeLayoutActionResult } from "@/actions/home-layout";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { useDirtyForm } from "@/lib/hooks/use-dirty-form";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import type { HomeLayoutSectionRow } from "@/types/database";

type SectionState = {
  section_key: HomeLayoutSectionRow["section_key"];
  visible: boolean;
  accent: HomeAccentKeyValue | "";
  title_ja: string;
  title_en: string;
};

function EditableFields({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className="grid min-w-0 gap-3">{children}</fieldset>;
}

function SubmitButton({ label, savingLabel }: { label: string; savingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? savingLabel : label}
    </Button>
  );
}

export function HomeLayoutEditor({ initialSections }: { initialSections: HomeLayoutSectionRow[] }) {
  const dict = useDict();
  const en = useLocale() === "en";
  const [state, formAction] = useFormState<HomeLayoutActionResult, FormData>(
    saveHomeLayout,
    {}
  );
  const [sections, setSections] = useState<SectionState[]>(() =>
    [...initialSections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        section_key: s.section_key,
        visible: s.visible,
        accent: (s.accent as HomeAccentKeyValue | null) ?? "",
        title_ja: s.title_ja ?? "",
        title_en: s.title_en ?? "",
      }))
  );

  const { formRef, isDirty, markDirty, reset } = useDirtyForm();
  useUnsavedChangesGuard(isDirty, dict.common.unsavedChangesConfirm);

  useEffect(() => {
    if (state?.success) {
      toast.success(dict.homeLayout.saved);
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function move(index: number, dir: -1 | 1) {
    setSections((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  }

  function applyOrder(preset: "events" | "life") {
    const order = preset === "events"
      ? ["week_events", "featured_events", "announcements", "floor_events", "resident_events", "tools", "popular_events", "friends_events"]
      : ["announcements", "tools", "floor_events", "resident_events", "week_events", "featured_events", "friends_events", "popular_events"];
    setSections(current => [...current].sort((a, b) => order.indexOf(a.section_key) - order.indexOf(b.section_key)));
    markDirty();
  }

  function updateSection(key: string, patch: Partial<SectionState>) {
    setSections((prev) => prev.map((s) => (s.section_key === key ? { ...s, ...patch } : s)));
    markDirty();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={markDirty}
      onChange={markDirty}
      className="flex flex-col gap-4"
    >
      <EditableFields>
      <section className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
        <div><h2 className="font-bold">{en ? "1. Choose the order" : "1. ホームの並び順"}</h2><p className="mt-1 text-sm text-muted-foreground">{en ? "Start with a suggested order, or use the arrows below. Changes apply when saved." : "おすすめの並び順から選ぶか、下の矢印で調整できます。変更は保存後に反映されます。"}</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => applyOrder("events")}>{en ? "Events first" : "イベントを先に"}</Button><Button type="button" variant="outline" onClick={() => applyOrder("life")}>{en ? "Dorm information first" : "生活情報を先に"}</Button></div>
        <p className="text-xs text-muted-foreground">{en ? "Suggested orders keep your visibility, titles and colors." : "おすすめを選んでも、表示・非表示や見出し・色は変わりません。"}</p>
        <ol aria-label={en ? "Visible sections in order" : "表示するセクションの順番"} className="flex flex-wrap gap-2">{sections.filter(s => s.visible).map((s, index) => <li key={s.section_key} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed"><span className="mr-1.5 text-muted-foreground">{index + 1}</span>{(en ? s.title_en : s.title_ja) || dict.homeLayout.sectionNames[s.section_key]}</li>)}</ol>
        <p className="text-xs text-muted-foreground">{en ? "Sections without content may not appear on the actual home page." : "実際のホームでは、表示する内容がないセクションは省略される場合があります。"}</p>
      </section>
      {sections.map((s, index) => (
        <Card key={s.section_key} className={cn("rounded-2xl", !s.visible && "opacity-60")}>
          <CardContent className="flex flex-col gap-3.5 p-4">
            <input type="hidden" name="section_key" value={s.section_key} />
            <input type="hidden" name={`accent__${s.section_key}`} value={s.accent} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="w-5 shrink-0 text-center text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 p-0"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`${dict.homeLayout.sectionNames[s.section_key]}: ${dict.homeLayout.moveUp}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-11 w-11 p-0"
                    disabled={index === sections.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`${dict.homeLayout.sectionNames[s.section_key]}: ${dict.homeLayout.moveDown}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="min-w-0 break-words text-sm font-semibold leading-relaxed">{dict.homeLayout.sectionNames[s.section_key]}</p>
              </div>
              <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
                <Checkbox
                  checked={s.visible}
                  onCheckedChange={(checked) => updateSection(s.section_key, { visible: checked === true })}
                />
                <input
                  type="hidden"
                  name={`visible__${s.section_key}`}
                  value={s.visible ? "on" : "off"}
                />
                {dict.homeLayout.visibleLabel}
              </label>
            </div>

            <details className="rounded-xl border border-border/70">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{en ? "Title and color" : "見出し・色を調整"}</summary>
            <div className="space-y-4 px-3 pb-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`title_ja__${s.section_key}`}>{dict.homeLayout.titleOverrideLabel}</Label>
                <Input
                  id={`title_ja__${s.section_key}`}
                  name={`title_ja__${s.section_key}`}
                  value={s.title_ja}
                  onChange={event => updateSection(s.section_key, { title_ja: event.target.value })}
                  maxLength={60}
                  placeholder={dict.homeLayout.titleOverridePlaceholder}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`title_en__${s.section_key}`}>{dict.homeLayout.titleOverrideEnLabel}</Label>
                <Input
                  id={`title_en__${s.section_key}`}
                  name={`title_en__${s.section_key}`}
                  value={s.title_en}
                  onChange={event => updateSection(s.section_key, { title_en: event.target.value })}
                  maxLength={60}
                  placeholder={dict.homeLayout.titleOverridePlaceholder}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">{dict.homeLayout.accentLabel}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateSection(s.section_key, { accent: "" })}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground transition-transform hover:scale-110",
                    s.accent === "" && "border-solid border-foreground text-foreground"
                  )}
                  aria-label={dict.homeLayout.accentDefault}
                  aria-pressed={s.accent === ""}
                  title={dict.homeLayout.accentDefault}
                >
                  {s.accent === "" && <Check className="h-4 w-4" />}
                </button>
                {HOME_ACCENT_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateSection(s.section_key, { accent: key })}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full border-2 border-transparent transition-transform hover:scale-110",
                      s.accent === key && "border-foreground"
                    )}
                    style={{ backgroundColor: HOME_ACCENT_HEX[key] }}
                    aria-label={dict.homeLayout.accentNames[key]}
                    aria-pressed={s.accent === key}
                    title={dict.homeLayout.accentNames[key]}
                  >
                    {s.accent === key && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
            </div></details>
          </CardContent>
        </Card>
      ))}

      </EditableFields>
      {isDirty && <p role="status" className="text-sm font-medium text-primary">{en ? "You have unsaved changes." : "保存していない変更があります。"}</p>}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.success && !isDirty && <p role="status" className="text-sm text-primary">{dict.homeLayout.saved}</p>}

      <div>
        <SubmitButton label={dict.homeLayout.saveButton} savingLabel={dict.homeLayout.saving} />
      </div>
    </form>
  );
}
