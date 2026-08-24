"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRa } from "@/lib/auth";
import { surveySchema } from "@/lib/validations/survey";

export type ActionResult = { error?: string } | void;

/**
 * イベントに紐づくアンケートを作成 or 更新する。
 * 既存の質問は一旦削除して作り直す（シンプルさ優先。回答済みデータは
 * survey_answers 側に question_id 参照が残るが、質問文の変更履歴管理はスコープ外）。
 */
export async function saveSurvey(
  eventId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireRa();

  const questionsRaw = formData.get("questions_json");
  let questionsParsed: unknown;
  try {
    questionsParsed = JSON.parse(String(questionsRaw ?? "[]"));
  } catch {
    return { error: "質問データの形式が不正です" };
  }

  const parsed = surveySchema.safeParse({
    title: formData.get("title"),
    questions: questionsParsed,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("surveys")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  let surveyId = existing?.id as string | undefined;

  if (surveyId) {
    const { error } = await supabase
      .from("surveys")
      .update({ title: parsed.data.title })
      .eq("id", surveyId);
    if (error) return { error: error.message };

    await supabase.from("survey_questions").delete().eq("survey_id", surveyId);
  } else {
    const { data, error } = await supabase
      .from("surveys")
      .insert({ event_id: eventId, title: parsed.data.title, created_by: profile.id })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "作成に失敗しました" };
    surveyId = data.id;
  }

  const questionsToInsert = parsed.data.questions.map((q, index) => ({
    survey_id: surveyId!,
    question_text: q.question_text,
    question_type: q.question_type,
    options: ["single_choice", "multiple_choice", "rating"].includes(q.question_type)
      ? q.options
      : null,
    is_required: q.is_required,
    position: index,
  }));

  const { error: qError } = await supabase
    .from("survey_questions")
    .insert(questionsToInsert);

  if (qError) return { error: qError.message };

  // イベント側の survey_type を internal に更新
  await supabase.from("events").update({ survey_type: "internal" }).eq("id", eventId);

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/survey`);
  redirect(`/dashboard/${eventId}/survey`);
}

export async function toggleSurveyActive(surveyId: string, isActive: boolean) {
  await requireRa();
  const supabase = await createClient();
  const { error } = await supabase
    .from("surveys")
    .update({ is_active: isActive })
    .eq("id", surveyId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { success: true };
}

export type AnswerInput = {
  question_id: string;
  answer_text?: string;
  answer_options?: string[];
};

export async function submitSurveyResponse(
  surveyId: string,
  answers: AnswerInput[]
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: response, error } = await supabase
    .from("survey_responses")
    .insert({ survey_id: surveyId, user_id: profile.id })
    .select("id")
    .single();

  if (error || !response) {
    return {
      error: error?.message.includes("duplicate")
        ? "このアンケートには既に回答済みです"
        : `回答の送信に失敗しました: ${error?.message ?? ""}`,
    };
  }

  const rows = answers
    .filter((a) => a.answer_text || (a.answer_options && a.answer_options.length))
    .map((a) => ({
      response_id: response.id,
      question_id: a.question_id,
      answer_text: a.answer_text ?? null,
      answer_options: a.answer_options ?? null,
    }));

  if (rows.length) {
    const { error: aError } = await supabase.from("survey_answers").insert(rows);
    if (aError) return { error: aError.message };
  }

  revalidatePath("/");
  return { success: true };
}
