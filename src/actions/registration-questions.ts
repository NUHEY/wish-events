"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { registrationQuestionsSchema } from "@/lib/validations/registration-questions";

export type ActionResult = { error?: string } | void;

/**
 * イベント申込前の事前質問（アレルギー等）を保存する。
 * サーベイと同様、既存の質問は一旦全削除してから作り直すシンプルな方式。
 * 回答済みデータ(registration_answers)側にはquestion_id参照が残るのみで、
 * 質問文の変更履歴管理はスコープ外（サーベイと同じ割り切り）。
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

  await supabase.from("registration_questions").delete().eq("event_id", eventId);

  const questionsToInsert = parsed.data.questions.map((q, index) => ({
    event_id: eventId,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.question_type === "single_choice" || q.question_type === "multiple_choice" ? q.options : null,
    is_required: q.is_required,
    position: index,
  }));

  const { error } = await supabase.from("registration_questions").insert(questionsToInsert);
  if (error) return { error: error.message };

  // 事前質問を1つでも設定したら、そのイベントは回答必須に切り替える
  // （空にして保存した場合は逆に不要へ戻す）。
  await supabase
    .from("events")
    .update({ registration_requires_answers: questionsToInsert.length > 0 })
    .eq("id", eventId);

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/questions`);
  redirect(`/events/${eventId}/questions?saved=1`);
}
