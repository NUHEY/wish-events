"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { useDict } from "@/lib/i18n/locale-provider";
import type { EventOptionActionResult } from "@/actions/event-options";

type OptionRow = { id: string; label_ja: string; label_en: string | null };

function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <><PendingFeedback active={pending} label="選択肢を保存しています…" /><Button type="submit" size="sm" disabled={pending}>{pending ? "保存中…" : label}</Button></>
  );
}

export function EventOptionManager({
  title,
  subtitle,
  options,
  addAction,
  removeAction,
  labelJaPlaceholder,
  labelEnPlaceholder,
  addButtonLabel,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  options: OptionRow[];
  addAction: (prev: EventOptionActionResult, formData: FormData) => Promise<EventOptionActionResult>;
  removeAction: (id: string) => Promise<EventOptionActionResult>;
  labelJaPlaceholder: string;
  labelEnPlaceholder: string;
  addButtonLabel: string;
  emptyLabel: string;
}) {
  const dict = useDict();
  const router = useRouter();
  const [state, formAction] = useFormState<EventOptionActionResult, FormData>(addAction, {});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (state?.success) {
      toast.success(dict.toast.saved);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeAction(id);
      if (!result?.error) {
        toast.success(dict.toast.deleted);
        router.refresh();
      }
    });
  }

  return (
    <Card className="rounded-2xl">
      <PendingFeedback active={pending} label="選択肢を更新しています…" />
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <Badge key={opt.id} variant="secondary" className="gap-1.5 py-1 pl-2.5 pr-1.5 text-sm">
              <span>
                {opt.label_ja}
                {opt.label_en ? ` / ${opt.label_en}` : ""}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleRemove(opt.id)}
                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-destructive"
                aria-label={dict.common.delete}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {options.length === 0 && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}
        </div>

        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Input name="label_ja" placeholder={labelJaPlaceholder} required className="w-40 sm:w-48" />
          </div>
          <div className="grid gap-1.5">
            <Input name="label_en" placeholder={labelEnPlaceholder} className="w-40 sm:w-48" />
          </div>
          <AddButton label={addButtonLabel} />
        </form>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}
