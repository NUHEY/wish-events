"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function registerForEvent(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, user_id: profile.id });

  if (error) {
    return { error: error.message.includes("duplicate")
      ? "既に申し込み済みです"
      : `申し込みに失敗しました: ${error.message}` };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export type RegistrationAnswerInput = {
  question_id: string;
  answer_text?: string;
  answer_options?: string[];
};

/**
 * 事前質問への回答付きで申込む。まず registrations に1行作り、続けて
 * registration_answers に回答をまとめて挿入する。Supabase JSクライアントは
 * クロステーブルのトランザクションを提供しないため、回答の挿入に失敗した
 * 場合は作成済みのregistrations行を削除して整合性を保つ（申込だけ成立して
 * 回答が欠落する、という状態を避ける）。
 */
export async function registerForEventWithAnswers(
  eventId: string,
  answers: RegistrationAnswerInput[]
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: registration, error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, user_id: profile.id })
    .select("id")
    .single();

  if (error || !registration) {
    return {
      error: error?.message.includes("duplicate")
        ? "既に申し込み済みです"
        : `申し込みに失敗しました: ${error?.message ?? ""}`,
    };
  }

  const rows = answers
    .filter((a) => a.answer_text || (a.answer_options && a.answer_options.length))
    .map((a) => ({
      registration_id: registration.id,
      question_id: a.question_id,
      answer_text: a.answer_text ?? null,
      answer_options: a.answer_options ?? null,
    }));

  if (rows.length) {
    const { error: aError } = await supabase.from("registration_answers").insert(rows);
    if (aError) {
      // 回答の保存に失敗した場合は申込自体も取り消す（不整合な状態を残さないため）
      await supabase.from("registrations").delete().eq("id", registration.id);
      return { error: `回答の保存に失敗しました: ${aError.message}` };
    }
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function cancelRegistration(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", profile.id);

  if (error) {
    return { error: `キャンセルに失敗しました: ${error.message}` };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

/** RA用: 参加者を強制的にキャンセルさせる（定員調整など） */
export async function removeRegistrationAsRa(eventId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/${eventId}/participants`);
  return { success: true };
}
