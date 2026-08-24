import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/utils";

type PendingItem = {
  eventId: string;
  title: string;
  eventDate: string;
  href: string;
  external: boolean;
};

/**
 * 「参加したイベントのうち、開催が終わっていてアンケート未回答のもの」を
 * ホーム画面上部にバナー表示し、寮生に回答を促す。
 * 外部フォーム（Googleフォーム等）は回答済みかをサイト側で判定できないため、
 * 常に「回答する」リンクを表示する（回答済みでもリンクは残る点はご了承ください）。
 */
export async function PendingSurveyBanner({ userId }: { userId: string }) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: regs } = await supabase
    .from("registrations")
    .select("event_id, events(id, title, event_date, survey_type, survey_external_url)")
    .eq("user_id", userId);

  const pastRegistered = (regs ?? []).filter((r: any) => {
    const ev = r.events;
    return ev && ev.event_date < now && ev.survey_type !== "none";
  });

  if (pastRegistered.length === 0) return null;

  const internalEventIds = pastRegistered
    .filter((r: any) => r.events.survey_type === "internal")
    .map((r: any) => r.events.id);

  let respondedSurveyIds = new Set<string>();
  let eventIdToSurveyId = new Map<string, string>();

  if (internalEventIds.length > 0) {
    const { data: surveys } = await supabase
      .from("surveys")
      .select("id, event_id")
      .in("event_id", internalEventIds);

    (surveys ?? []).forEach((s) => eventIdToSurveyId.set(s.event_id, s.id));

    const surveyIds = (surveys ?? []).map((s) => s.id);
    if (surveyIds.length > 0) {
      const { data: responses } = await supabase
        .from("survey_responses")
        .select("survey_id")
        .eq("user_id", userId)
        .in("survey_id", surveyIds);
      respondedSurveyIds = new Set((responses ?? []).map((r) => r.survey_id));
    }
  }

  const items: PendingItem[] = [];

  for (const r of pastRegistered as any[]) {
    const ev = r.events;
    if (ev.survey_type === "external") {
      items.push({
        eventId: ev.id,
        title: ev.title,
        eventDate: ev.event_date,
        href: ev.survey_external_url,
        external: true,
      });
    } else if (ev.survey_type === "internal") {
      const surveyId = eventIdToSurveyId.get(ev.id);
      if (surveyId && !respondedSurveyIds.has(surveyId)) {
        items.push({
          eventId: ev.id,
          title: ev.title,
          eventDate: ev.event_date,
          href: `/events/${ev.id}/survey`,
          external: false,
        });
      }
    }
  }

  if (items.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-secondary/60">
      <CardContent className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold">
          参加したイベントのアンケートにご協力ください（{items.length}件）
        </p>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.eventId + item.href}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2"
            >
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatEventDateTime(item.eventDate)} 開催
                </p>
              </div>
              {item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  アンケートに回答する
                </a>
              ) : (
                <Link
                  href={item.href}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  アンケートに回答する
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
