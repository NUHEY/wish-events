import { notFound } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SurveyBuilder } from "@/components/surveys/survey-builder";
import { SurveyActiveToggle } from "@/components/surveys/survey-active-toggle";
import { saveSurvey } from "@/actions/surveys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default async function ManageSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // event と survey は id のみで取得できるため並列取得する。
  const [{ data: event }, { data: survey }] = await Promise.all([
    supabase.from("events").select("id, title, survey_type, survey_external_url").eq("id", id).maybeSingle(),
    supabase.from("surveys").select("*").eq("event_id", id).maybeSingle(),
  ]);
  if (!event) notFound();

  // questions と responseCount は survey.id が確定してから並列取得する。
  const [{ data: questions }, responseCount] = survey
    ? await Promise.all([
        supabase.from("survey_questions").select("*").eq("survey_id", survey.id).order("position", { ascending: true }),
        supabase
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .eq("survey_id", survey.id)
          .then(({ count }) => count ?? 0),
      ])
    : [{ data: [] as { id: string }[] }, 0];

  const saveWithEventId = saveSurvey.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <BackButton fallbackHref="/dashboard" className="-ml-2 self-start" />
      <h1 className="text-xl font-bold">
        {dict.surveys.manageTitle}: {event.title}
      </h1>

      {event.survey_type === "external" && (
        <p className="rounded-md border border-border bg-secondary p-3 text-sm">
          {dict.surveys.externalNotice}
          {event.survey_external_url ? ` (${event.survey_external_url})` : ""}
        </p>
      )}

      {survey && (
        <div className="flex items-center gap-2">
          <Badge variant={survey.is_active ? "default" : "secondary"}>
            {survey.is_active ? dict.surveys.activeBadge : dict.surveys.inactiveBadge}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {dict.surveys.responseCount}: {responseCount}
            {dict.surveys.responseCountUnit}
          </span>
          <SurveyActiveToggle surveyId={survey.id} isActive={survey.is_active} />
          <Button asChild size="sm" variant="outline">
            <Link href={`/dashboard/${id}/survey/results`}><BarChart3 className="h-4 w-4" />結果を見る</Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {survey ? dict.surveys.editQuestionsTitle : dict.surveys.createQuestionsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SurveyBuilder
            action={saveWithEventId}
            initialSurvey={survey ?? undefined}
            initialQuestions={questions ?? undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
