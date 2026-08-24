import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SurveyBuilder } from "@/components/surveys/survey-builder";
import { SurveyActiveToggle } from "@/components/surveys/survey-active-toggle";
import { saveSurvey } from "@/actions/surveys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ManageSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();

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
      <h1 className="text-xl font-bold">アンケート管理: {event.title}</h1>

      {event.survey_type === "external" && (
        <p className="rounded-md border border-border bg-secondary p-3 text-sm">
          このイベントは外部アンケート（{event.survey_external_url}）に設定されています。
          サイト内蔵アンケートを使う場合はイベント編集画面で「サイト内蔵アンケート」に切り替えてください。
        </p>
      )}

      {survey && (
        <div className="flex items-center gap-2">
          <Badge variant={survey.is_active ? "default" : "secondary"}>
            {survey.is_active ? "回答受付中" : "回答受付停止中"}
          </Badge>
          <span className="text-sm text-muted-foreground">回答数: {responseCount}件</span>
          <SurveyActiveToggle surveyId={survey.id} isActive={survey.is_active} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {survey ? "質問を編集する" : "質問を作成する"}
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
