"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRa } from "@/lib/auth";
import { surveySchema } from "@/lib/validations/survey";

export type ActionResult = { error?: string } | void;

/**
 * イベントに紐づくアンケートを作成 or 更新する。
 * 未回答のアンケートだけ質問を作り直す。回答開始後は既存回答を守るため
 * 構造変更を拒否し、結果を消さない。
 */
export async function saveSurvey(
  eventId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireRa();

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

  const { error } = await supabase.rpc("save_event_survey", {
    p_event_id: eventId,
    p_title: parsed.data.title,
    p_questions: parsed.data.questions,
  });
  if (error) return { error: error.message };

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/survey`);
  redirect(`/dashboard/${eventId}/survey?saved=1`);
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
  await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_survey_response", {
    p_survey_id: surveyId,
    p_answers: answers,
  });
  if (error) {
    return {
      error: error.message.includes("既に回答済み") || error.message.includes("duplicate")
        ? "このアンケートには既に回答済みです"
        : `回答の送信に失敗しました: ${error.message}`,
    };
  }
  revalidatePath("/events/[id]/survey", "page");
  revalidatePath("/", "page");
  return { success: true };
}
