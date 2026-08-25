"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartyPopper, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { moveOut } from "@/actions/move-out";
import { formatEventDateTime } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { EventCategory } from "@/types/database";

export type MoveOutEvent = {
  id: string;
  title: string;
  title_en: string | null;
  category: EventCategory;
  event_date: string;
  poster_url: string | null;
};

export function MoveOutConfirm({
  fullName,
  events,
}: {
  fullName: string | null;
  events: MoveOutEvent[];
}) {
  const dict = useDict();
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<"intro" | "confirm">("intro");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMoveOut() {
    setError(null);
    startTransition(async () => {
      const result = await moveOut();
      if (result?.error) setError(result.error);
      else {
        toast.success(dict.toast.saved);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{dict.moveOut.title}</h1>
        <p className="text-sm text-muted-foreground">
          {dict.moveOut.subtitle.replace("{name}", fullName ?? "")}
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="flex-row items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">
              {dict.moveOut.eventsCountLabel.replace("{count}", String(events.length))}
            </CardTitle>
            <CardDescription>{dict.moveOut.eventsCountHint}</CardDescription>
          </div>
        </CardHeader>
        {events.length > 0 && (
          <CardContent className="flex flex-col gap-2 border-t border-border pt-4">
            {events.map((e) => {
              const title = (locale === "en" && e.title_en) || e.title;
              return (
                <div key={e.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{dict.categories[e.category] ?? e.category}</Badge>
                  <span className="truncate font-medium">{title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatEventDateTime(e.event_date, locale)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {step === "intro" && (
        <Button
          variant="outline"
          className="w-fit self-center"
          onClick={() => setStep("confirm")}
        >
          {dict.moveOut.startButton}
        </Button>
      )}

      {step === "confirm" && (
        <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-sm font-semibold">{dict.moveOut.warningTitle}</p>
            </div>
            <p className="text-sm text-foreground/90">{dict.moveOut.warningBody}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="destructive" disabled={pending} onClick={handleMoveOut}>
                {pending ? dict.event.processing : dict.moveOut.confirmButton}
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setStep("intro")}>
                {dict.common.cancel}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
