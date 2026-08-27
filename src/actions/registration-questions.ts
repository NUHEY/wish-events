"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { registrationQuestionsSchema } from "@/lib/validations/registration-questions";

export type ActionResult = { error?: string } | void;

/**
 * イベント申込前の事前質問（アレルギー等）を保存する。
 * 既存質問はIDを維持して更新し、画面から外した質問は非表示にする。
 * 物理削除しないため、過去の参加者が回答した内容も参加者管理に残る。
 */
export async function saveRegistrationQuestions(
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

  const parsed = registrationQuestionsSchema.safeParse({ questions: questionsParsed });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  // 既存の質問IDと過去回答を保持したまま、有効/非表示の切替までDB内で一括保存する。
  const { error } = await supabase.rpc("replace_registration_questions", {
    p_event_id: eventId,
    p_questions: parsed.data.questions,
  });
  if (error) return { error: `保存できませんでした: ${error.message}` };

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/questions`);
  revalidatePath(`/dashboard/${eventId}/participants`);
  redirect(`/events/${eventId}/questions?saved=1`);
}
