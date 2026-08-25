"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function sendEventMessage(eventId: string, body: string) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text) return { error: "メッセージを入力してください" };
  const supabase = await createClient();
  const { error } = await supabase.from("event_messages").insert({ event_id: eventId, sender_id: profile.id, body: text });
  if (error) return { error: `送信に失敗しました: ${error.message}` };
  revalidatePath(`/talks/${eventId}`);
  revalidatePath("/talks");
  return { success: true };
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
