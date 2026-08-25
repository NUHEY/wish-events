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
import { useDict } from "@/lib/i18n/locale-provider";
import type { HomeLayoutSectionRow } from "@/types/database";

type SectionState = {
  section_key: HomeLayoutSectionRow["section_key"];
  visible: boolean;
  accent: HomeAccentKeyValue | "";
  title_ja: string;
  title_en: string;
};

function SubmitButton({ label, savingLabel }: { label: string; savingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? savingLabel : label}
    </Button>
  );
}

export function HomeLayoutEditor({ initialSections }: { initialSections: HomeLayoutSectionRow[] }) {
  const dict = useDict();
  const [state, formAction] = useFormState<HomeLayoutActionResult, FormData>(saveHomeLayout, {});
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

  useEffect(() => {
    if (state?.success) toast.success(dict.homeLayout.saved);
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
  }

  function updateSection(key: string, patch: Partial<SectionState>) {
    setSections((prev) => prev.map((s) => (s.section_key === key ? { ...s, ...patch } : s)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {sections.map((s, index) => (
        <Card key={s.section_key} className={cn("rounded-2xl", !s.visible && "opacity-60")}>
          <CardContent className="flex flex-col gap-3.5 p-4">
            <input type="hidden" name="section_key" value={s.section_key} />
            <input type="hidden" name={`accent__${s.section_key}`} value={s.accent} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={dict.homeLayout.moveUp}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    disabled={index === sections.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={dict.homeLayout.moveDown}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="font-semibold">{dict.homeLayout.sectionNames[s.section_key]}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`title_ja__${s.section_key}`}>{dict.homeLayout.titleOverrideLabel}</Label>
                <Input
                  id={`title_ja__${s.section_key}`}
                  name={`title_ja__${s.section_key}`}
                  defaultValue={s.title_ja}
                  placeholder={dict.homeLayout.titleOverridePlaceholder}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`title_en__${s.section_key}`}>{dict.homeLayout.titleOverrideEnLabel}</Label>
                <Input
                  id={`title_en__${s.section_key}`}
                  name={`title_en__${s.section_key}`}
                  defaultValue={s.title_en}
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
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground transition-transform hover:scale-110",
                    s.accent === "" && "border-solid border-foreground text-foreground"
                  )}
                  aria-label={dict.homeLayout.accentDefault}
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
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 border-transparent transition-transform hover:scale-110",
                      s.accent === key && "border-foreground"
                    )}
                    style={{ backgroundColor: HOME_ACCENT_HEX[key] }}
                    aria-label={dict.homeLayout.accentNames[key]}
                    title={dict.homeLayout.accentNames[key]}
                  >
                    {s.accent === key && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary">{dict.homeLayout.saved}</p>}

      <div>
        <SubmitButton label={dict.homeLayout.saveButton} savingLabel={dict.homeLayout.saving} />
      </div>
    </form>
  );
}
