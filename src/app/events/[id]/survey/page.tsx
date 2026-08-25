import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SurveyResponseForm } from "@/components/surveys/survey-response-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // event と survey は id のみで取得できるため並列取得する。
  const [{ data: event }, { data: survey }] = await Promise.all([
    supabase.from("events").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("surveys").select("*").eq("event_id", id).maybeSingle(),
  ]);
  if (!event) notFound();

  if (!survey || !survey.is_active) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <BackButton fallbackHref={`/events/${id}`} className="-ml-2" />
        <p className="text-sm text-muted-foreground">{dict.event.surveyNoneOpen}</p>
      </div>
    );
  }

  // existingResponse と questions は survey.id が確定してから並列取得する。
  const [{ data: existingResponse }, { data: questions }] = await Promise.all([
    supabase.from("survey_responses").select("id").eq("survey_id", survey.id).eq("user_id", profile.id).maybeSingle(),
    supabase.from("survey_questions").select("*").eq("survey_id", survey.id).order("position", { ascending: true }),
  ]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      <BackButton fallbackHref={`/events/${id}`} className="-ml-2" />
      <Card className="overflow-hidden rounded-2xl shadow-elevated">
        <CardHeader className="border-b border-border bg-secondary/30">
          <CardTitle>{survey.title}</CardTitle>
          <CardDescription>{event.title}</CardDescription>
        </CardHeader>
        <CardContent>
          {existingResponse ? (
            <p className="rounded-md border border-border bg-secondary p-4 text-sm">
              {dict.event.surveyAlreadyAnswered}
            </p>
          ) : (
            <SurveyResponseForm surveyId={survey.id} questions={questions ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
