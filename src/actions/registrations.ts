"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function registerForEvent(eventId: string) {
  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_for_event", { p_event_id: eventId, p_answers: [] });

  if (error) {
    return { error: `申し込みに失敗しました: ${error.message}` };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/talks");
  return { success: true, talkHref: `/talks/${eventId}?joined=1` };
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
): Promise<{ error?: string; success?: boolean; talkHref?: string }> {
  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_for_event", { p_event_id: eventId, p_answers: answers });
  if (error) return { error: `申し込みに失敗しました: ${error.message}` };

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/talks");
  return { success: true, talkHref: `/talks/${eventId}?joined=1` };
}

export async function cancelRegistration(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("created_by, creator_type").eq("id", eventId).maybeSingle();
  if (event?.creator_type === "resident" && event.created_by === profile.id) {
    return { error: "主催者は参加をキャンセルできません。募集自体を取り下げる場合は「自分が作った募集」から削除してください。" };
  }

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
