import { notFound } from "next/navigation";
import { SurveyResultsDashboard, type SurveyQuestionResult } from "@/components/surveys/survey-results-dashboard";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SurveyAnswerRow, SurveyQuestionRow, SurveyResponseRow } from "@/types/database";

export default async function SurveyResultsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: survey }] = await Promise.all([
    supabase.from("events").select("id,title").eq("id", id).maybeSingle(),
    supabase.from("surveys").select("*").eq("event_id", id).maybeSingle(),
  ]);
  if (!event || !survey) notFound();
  const [{ data: questionRows }, { data: responseRows }] = await Promise.all([
    supabase.from("survey_questions").select("*").eq("survey_id", survey.id).order("position"),
    supabase.from("survey_responses").select("*").eq("survey_id", survey.id).order("submitted_at"),
  ]);
  const questions = (questionRows ?? []) as SurveyQuestionRow[];
  const responses = (responseRows ?? []) as SurveyResponseRow[];
  const { data: answerRows } = responses.length ? await supabase.from("survey_answers").select("*").in("response_id", responses.map((response) => response.id)) : { data: [] as SurveyAnswerRow[] };
  const answers = (answerRows ?? []) as SurveyAnswerRow[];
  const results: SurveyQuestionResult[] = questions.map((question) => {
    const relevant = answers.filter((answer) => answer.question_id === question.id);
    const labels = question.question_type === "rating" ? ["1", "2", "3", "4", "5"] : question.options ?? [];
    const values = relevant.flatMap((answer) => answer.answer_options?.length ? answer.answer_options : answer.answer_text ? [answer.answer_text] : []);
    const numeric = question.question_type === "rating" ? values.map(Number).filter(Number.isFinite) : [];
    return { id: question.id, question: question.question_text, type: question.question_type, answeredCount: relevant.length, counts: labels.map((label) => ({ label, count: values.filter((value) => value === label).length })), average: numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null, texts: question.question_type === "text" ? relevant.map((answer) => answer.answer_text?.trim()).filter((value): value is string => !!value) : [] };
  });
  return <SurveyResultsDashboard eventTitle={event.title} surveyTitle={survey.title} responseCount={responses.length} results={results} />;
}
