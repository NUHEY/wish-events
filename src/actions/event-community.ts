"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function sendEventMessage(eventId: string, body: string, mediaPath?: string) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text && !mediaPath) return { error: "メッセージを入力してください" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_messages")
    .insert({
      event_id: eventId,
      sender_id: profile.id,
      body: text,
      message_type: mediaPath ? "image" : "text",
      media_path: mediaPath ?? null,
    })
    .select()
    .single();
  if (error) return { error: `送信に失敗しました: ${error.message}` };

  revalidatePath(`/talks/${eventId}`);
  revalidatePath("/talks");
  return { success: true, message: data };
}

export async function sendEventSurveyTool(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("survey_type, survey_external_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.survey_type === "none") return { error: "このイベントにはアンケートが設定されていません" };

  const actionUrl = event.survey_type === "external" ? event.survey_external_url : `/events/${eventId}/survey`;
  const { error } = await supabase.from("event_messages").insert({
    event_id: eventId,
    sender_id: profile.id,
    body: "イベント後アンケートへのご協力をお願いします。",
    message_type: "tool",
    action_url: actionUrl,
    action_label: "アンケートに回答する",
  });
  if (error) return { error: `アンケート案内の送信に失敗しました: ${error.message}` };

  revalidatePath(`/talks/${eventId}`);
  return { success: true };
}

export async function sendEventDetailsTool(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const supabase = await createClient();
  const { error } = await supabase.from("event_messages").insert({
    event_id: eventId,
    sender_id: profile.id,
    body: "イベントの日時・場所・持ち物などは、詳細ページで確認できます。",
    message_type: "tool",
    action_url: `/events/${eventId}`,
    action_label: "イベント詳細を確認する",
  });
  if (error) return { error: `案内を送信できませんでした: ${error.message}` };

  revalidatePath(`/talks/${eventId}`);
  return { success: true };
}

export async function markEventTalkRead(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase
    .from("event_chat_reads")
    .upsert({ event_id: eventId, user_id: profile.id, last_read_at: new Date().toISOString() });
}

export async function toggleEventMessageReaction(
  messageId: string,
  emoji: "❤️" | "👍" | "🎉" | "😂" | "👀",
  active: boolean
) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = active
    ? await supabase
        .from("event_message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", profile.id)
        .eq("emoji", emoji)
    : await supabase.from("event_message_reactions").insert({ message_id: messageId, user_id: profile.id, emoji });
  if (error) return { error: `リアクションを更新できませんでした: ${error.message}` };
  return { success: true };
}

export async function createEventPoll(eventId: string, question: string, rawOptions: string[]) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "投票を作成できるのはRAのみです" };

  const options = rawOptions.map((option) => option.trim()).filter(Boolean).slice(0, 4);
  if (!question.trim() || options.length < 2) return { error: "質問と2つ以上の選択肢を入力してください" };

  const supabase = await createClient();
  const { data: poll, error: pollError } = await supabase
    .from("event_polls")
    .insert({ event_id: eventId, question: question.trim(), options, created_by: profile.id })
    .select()
    .single();
  if (pollError || !poll) return { error: `投票を作成できませんでした: ${pollError?.message ?? "不明なエラー"}` };

  const { error: messageError } = await supabase.from("event_messages").insert({
    event_id: eventId,
    sender_id: profile.id,
    body: "新しい投票が届きました。",
    message_type: "poll",
    poll_id: poll.id,
  });
  if (messageError) return { error: `投票を送信できませんでした: ${messageError.message}` };

  revalidatePath(`/talks/${eventId}`);
  return { success: true };
}

export async function voteEventPoll(pollId: string, optionIndex: number) {
  const profile = await getCurrentProfile();
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    return { error: "投票内容が正しくありません" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_poll_votes")
    .upsert({ poll_id: pollId, user_id: profile.id, option_index: optionIndex });
  if (error) return { error: `投票できませんでした: ${error.message}` };
  return { success: true };
}

export async function addEventComment(eventId: string, body: string, parentId?: string | null) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text) return { error: "コメントを入力してください" };

  const supabase = await createClient();
  if (parentId) {
    const { data: parent } = await supabase
      .from("event_comments")
      .select("id, event_id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.event_id !== eventId || parent.parent_id) {
      return { error: "返信先のコメントを確認できませんでした" };
    }
  }

  const { error } = await supabase
    .from("event_comments")
    .insert({ event_id: eventId, user_id: profile.id, body: text, parent_id: parentId ?? null });
  if (error) return { error: `コメントの投稿に失敗しました: ${error.message}` };

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function deleteEventComment(commentId: string, eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: comment } = await supabase
    .from("event_comments")
    .select("id, user_id, event_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.event_id !== eventId) return { error: "コメントが見つかりませんでした" };
  if (comment.user_id !== profile.id && profile.role !== "ra") {
    return { error: "このコメントを削除する権限がありません" };
  }

  // parent_id / comment_id はon delete cascadeのため、返信といいねも合わせて削除される。
  const { error } = await supabase.from("event_comments").delete().eq("id", commentId);
  if (error) return { error: `コメントの削除に失敗しました: ${error.message}` };

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
