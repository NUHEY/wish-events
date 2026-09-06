"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, LayoutList, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <Save aria-hidden="true" className="h-4 w-4" />
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
      ? ["latest_events", "week_events", "featured_events", "announcements", "floor_events", "resident_events", "tools", "popular_events", "friends_events"]
      : ["announcements", "tools", "floor_events", "resident_events", "latest_events", "week_events", "featured_events", "friends_events", "popular_events"];
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
      id="home-sections"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card"
    >
      <EditableFields>
      <div className="space-y-3 px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 font-bold"><LayoutList aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />{en ? "Home sections" : "ホームのセクション"}</h2>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{sections.filter(s => s.visible).length}/{sections.length} {en ? "shown" : "表示"}</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">{en ? "Check to show, use arrows to reorder. Empty event sections appear when events are available." : "チェックで表示、矢印で並べ替え。イベントがない欄は自動で省略されます。"}</p>
        <details className="text-sm">
          <summary className="w-fit cursor-pointer py-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{en ? "Use a suggested order" : "おすすめの並び順を使う"}</summary>
          <div className="flex flex-wrap gap-2 pb-2"><Button type="button" size="sm" variant="outline" onClick={() => applyOrder("events")}>{en ? "Events first" : "イベントを先に"}</Button><Button type="button" size="sm" variant="outline" onClick={() => applyOrder("life")}>{en ? "Dorm information first" : "生活情報を先に"}</Button></div>
        </details>
      </div>
      <ol aria-label={en ? "Home sections in display order" : "ホームの表示順"} className="divide-y divide-border border-t border-border">
      {sections.map((s, index) => (
        <li key={s.section_key} className={cn("min-w-0 px-3 py-2 sm:px-4", !s.visible && "bg-secondary/20")}>
            <input type="hidden" name="section_key" value={s.section_key} />
            <input type="hidden" name={`accent__${s.section_key}`} value={s.accent} />

            <div className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
                <Checkbox checked={s.visible} onCheckedChange={(checked) => updateSection(s.section_key, { visible: checked === true })} aria-label={`${dict.homeLayout.sectionNames[s.section_key]}: ${dict.homeLayout.visibleLabel}`} />
                <input type="hidden" name={`visible__${s.section_key}`} value={s.visible ? "on" : "off"} />
                <span className={cn("min-w-0 break-words text-sm font-medium leading-snug", !s.visible && "text-muted-foreground")}>
                  {(en ? s.title_en : s.title_ja) || dict.homeLayout.sectionNames[s.section_key]}
                  {(en ? s.title_en : s.title_ja) && <span className="mt-1 block text-[11px] font-normal text-muted-foreground">{dict.homeLayout.sectionNames[s.section_key]}</span>}
                </span>
              </label>
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="sm" className="h-11 w-10 p-0" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`${dict.homeLayout.sectionNames[s.section_key]}: ${dict.homeLayout.moveUp}`}><ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /></Button>
                <Button type="button" variant="ghost" size="sm" className="h-11 w-10 p-0" disabled={index === sections.length - 1} onClick={() => move(index, 1)} aria-label={`${dict.homeLayout.sectionNames[s.section_key]}: ${dict.homeLayout.moveDown}`}><ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /></Button>
              </div>
            </div>

            <details className="group/details min-w-0">
            <summary className="ml-6 flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden"><SlidersHorizontal aria-hidden="true" className="h-3 w-3" />{en ? "Title and color" : "見出し・色"}<span className="group-open/details:hidden" aria-hidden="true">＋</span><span className="hidden group-open/details:inline" aria-hidden="true">−</span></summary>
            <div className="space-y-4 rounded-lg bg-secondary/30 p-3">
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
        </li>
      ))}
      </ol>
      </EditableFields>
      <div className="flex flex-col gap-3 border-t border-border p-4">
      {isDirty && <p role="status" className="text-sm font-medium text-primary">{en ? "You have unsaved changes." : "保存していない変更があります。"}</p>}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.success && !isDirty && <p role="status" className="text-sm text-primary">{dict.homeLayout.saved}</p>}

      <div>
        <SubmitButton label={en ? "Save home sections" : "セクションの設定を保存"} savingLabel={dict.homeLayout.saving} />
      </div>
      </div>
    </form>
  );
}
