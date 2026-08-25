import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SurveyBuilder } from "@/components/surveys/survey-builder";
import { SurveyActiveToggle } from "@/components/surveys/survey-active-toggle";
import { saveSurvey } from "@/actions/surveys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

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

  const { data: event } = await supabase
    .from("events")
    .select("id, title, survey_type, survey_external_url")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: survey } = await supabase
    .from("surveys")
    .select("*")
    .eq("event_id", id)
    .maybeSingle();

  const { data: questions } = survey
    ? await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", survey.id)
        .order("position", { ascending: true })
    : { data: [] };

  let responseCount = 0;
  if (survey) {
    const { count } = await supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", survey.id);
    responseCount = count ?? 0;
  }

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
