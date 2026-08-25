"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function sendEventMessage(eventId: string, body: string, mediaPath?: string) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text && !mediaPath) return { error: "メッセージを入力してください" };
  const supabase = await createClient();
  const { error } = await supabase.from("event_messages").insert({ event_id: eventId, sender_id: profile.id, body: text, message_type: mediaPath ? "image" : "text", media_path: mediaPath ?? null });
  if (error) return { error: `送信に失敗しました: ${error.message}` };
  revalidatePath(`/talks/${eventId}`);
  revalidatePath("/talks");
  return { success: true };
}

export async function sendEventSurveyTool(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("survey_type, survey_external_url").eq("id", eventId).maybeSingle();
  if (!event || event.survey_type === "none") return { error: "このイベントにはアンケートが設定されていません" };
  const actionUrl = event.survey_type === "external" ? event.survey_external_url : `/events/${eventId}/survey`;
  const { error } = await supabase.from("event_messages").insert({ event_id: eventId, sender_id: profile.id, body: "イベント後アンケートへのご協力をお願いします。", message_type: "tool", action_url: actionUrl, action_label: "アンケートに回答する" });
  if (error) return { error: `アンケート案内の送信に失敗しました: ${error.message}` };
  revalidatePath(`/talks/${eventId}`); return { success: true };
}

export async function addEventComment(eventId: string, body: string) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text) return { error: "コメントを入力してください" };
  const supabase = await createClient();
  const { error } = await supabase.from("event_comments").insert({ event_id: eventId, user_id: profile.id, body: text });
  if (error) return { error: `コメントの投稿に失敗しました: ${error.message}` };
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function toggleEventCommentLike(commentId: string, eventId: string, liked: boolean) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("event_comment_likes").delete().eq("comment_id", commentId).eq("user_id", profile.id)
    : await supabase.from("event_comment_likes").insert({ comment_id: commentId, user_id: profile.id });
  if (error) return { error: `いいねの更新に失敗しました: ${error.message}` };
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function toggleEventLike(eventId: string, liked: boolean) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("event_likes").delete().eq("event_id", eventId).eq("user_id", profile.id)
    : await supabase.from("event_likes").insert({ event_id: eventId, user_id: profile.id });
  if (error) return { error: `いいねの更新に失敗しました: ${error.message}` };
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
