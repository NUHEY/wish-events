"use client";

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createBadge, deleteBadge, updateBadge, type BadgeActionResult } from "@/actions/badges";
import { useDict } from "@/lib/i18n/locale-provider";
import type { BadgeRow } from "@/types/database";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "..." : label}
    </Button>
  );
}

function BadgeForm({
  badge,
  action,
  submitLabel,
  onDone,
}: {
  badge?: BadgeRow;
  action: (prev: BadgeActionResult, formData: FormData) => Promise<BadgeActionResult>;
  submitLabel: string;
  onDone?: () => void;
}) {
  const dict = useDict();
  const router = useRouter();
  const [state, formAction] = useFormState(async (prev: BadgeActionResult, formData: FormData) => {
    const result = await action(prev, formData);
    if (!result?.error) {
      router.refresh();
      onDone?.();
    }
    return result;
  }, undefined);

  return (
    <form action={formAction} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`key-${badge?.id ?? "new"}`}>{dict.badgeAdmin.keyLabel}</Label>
          <Input id={`key-${badge?.id ?? "new"}`} name="key" required defaultValue={badge?.key} disabled={!!badge} placeholder={dict.badgeAdmin.keyHint} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`icon-${badge?.id ?? "new"}`}>{dict.badgeAdmin.iconLabel}</Label>
          <Input id={`icon-${badge?.id ?? "new"}`} name="icon" defaultValue={badge?.icon ?? "🏅"} maxLength={4} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`color-${badge?.id ?? "new"}`}>{dict.badgeAdmin.colorLabel}</Label>
          <Input id={`color-${badge?.id ?? "new"}`} name="color" type="color" defaultValue={badge?.color ?? "#C79A3B"} className="h-9 px-1" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`sort-${badge?.id ?? "new"}`}>{dict.badgeAdmin.sortOrderLabel}</Label>
          <Input id={`sort-${badge?.id ?? "new"}`} name="sort_order" type="number" defaultValue={badge?.sort_order ?? 0} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`label-${badge?.id ?? "new"}`}>{dict.badgeAdmin.labelLabel}</Label>
          <Input id={`label-${badge?.id ?? "new"}`} name="label" required defaultValue={badge?.label} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`labelEn-${badge?.id ?? "new"}`}>{dict.badgeAdmin.labelEnLabel}</Label>
          <Input id={`labelEn-${badge?.id ?? "new"}`} name="label_en" defaultValue={badge?.label_en ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`desc-${badge?.id ?? "new"}`}>{dict.badgeAdmin.descriptionLabel}</Label>
          <Input id={`desc-${badge?.id ?? "new"}`} name="description" defaultValue={badge?.description ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`descEn-${badge?.id ?? "new"}`}>{dict.badgeAdmin.descriptionEnLabel}</Label>
          <Input id={`descEn-${badge?.id ?? "new"}`} name="description_en" defaultValue={badge?.description_en ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:w-1/2">
        <div className="grid gap-1.5">
          <Label htmlFor={`criteriaType-${badge?.id ?? "new"}`}>{dict.badgeAdmin.criteriaTypeLabel}</Label>
          <Select id={`criteriaType-${badge?.id ?? "new"}`} name="criteria_type" defaultValue={badge?.criteria_type ?? "event_count"}>
            <option value="event_count">{dict.badgeAdmin.criteriaEventCount}</option>
            <option value="survey_count">{dict.badgeAdmin.criteriaSurveyCount}</option>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`criteriaValue-${badge?.id ?? "new"}`}>{dict.badgeAdmin.criteriaValueLabel}</Label>
          <Input id={`criteriaValue-${badge?.id ?? "new"}`} name="criteria_value" type="number" min={1} required defaultValue={badge?.criteria_value ?? 1} />
        </div>
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton label={submitLabel} />
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone}>
            {dict.badgeAdmin.cancelButton}
          </Button>
        )}
      </div>
    </form>
  );
}

function BadgeItem({ badge }: { badge: BadgeRow }) {
  const dict = useDict();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(dict.badgeAdmin.deleteConfirm)) return;
    startTransition(async () => {
      await deleteBadge(badge.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border p-3">
        <BadgeForm badge={badge} action={updateBadge.bind(null, badge.id)} submitLabel={dict.badgeAdmin.saveButton} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl" style={{ backgroundColor: `${badge.color}22` }}>
        {badge.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{badge.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {badge.criteria_type === "event_count" ? dict.badgeAdmin.criteriaEventCount : dict.badgeAdmin.criteriaSurveyCount} ≥ {badge.criteria_value}
        </p>
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label={dict.badgeAdmin.editButton}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" disabled={pending} onClick={handleDelete} aria-label={dict.badgeAdmin.deleteButton}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function BadgeManager({ badges }: { badges: BadgeRow[] }) {
  const dict = useDict();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.badgeAdmin.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <BadgeForm action={createBadge} submitLabel={dict.badgeAdmin.addButton} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {badges.map((badge) => (
          <BadgeItem key={badge.id} badge={badge} />
        ))}
        {badges.length === 0 && <p className="text-sm text-muted-foreground">{dict.badgeAdmin.noBadges}</p>}
      </div>
    </div>
  );
}
