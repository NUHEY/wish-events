"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { EventMessageRow } from "@/types/database";

/**
 * サーバーアクション実行中のリクエストヘッダーから絶対URLの起点を組み立てる。
 * トークルームのツール文面（アンケート・詳細案内）にURLをそのまま貼り込むために使う。
 */
export async function getRequestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocol = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** event_community_profiles_v3() の返り値（送信者の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

/**
 * event_messagesの生の行に、送信者プロフィールと画像の署名URLを付与する。
 * 初回ロード・過去メッセージの追加読み込み・リアルタイム新着メッセージの
 * いずれからも呼ばれる共通ヘルパー（クライアントからは直接呼べない非export関数）。
 */
async function hydrateEventMessages(supabase: Awaited<ReturnType<typeof createClient>>, rows: EventMessageRow[]) {
  const senderIds = [...new Set(rows.map((m) => m.sender_id))];
  const mediaPaths = rows.map((m) => m.media_path).filter((p): p is string => !!p);
  const [{ data: users }, signedUrls] = await Promise.all([
    senderIds.length
      ? supabase.rpc("event_community_profiles_v3", { profile_ids: senderIds })
      : Promise.resolve({ data: null }),
    mediaPaths.length
      ? supabase.storage.from("event-chat-media").createSignedUrls(mediaPaths, 60 * 60)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
  ]);
  const usersById = new Map(((users ?? []) as CommunityProfile[]).map((u) => [u.id, u]));
  const signedUrlByPath = new Map((signedUrls.data ?? []).map((e) => [e.path, e.signedUrl]));
  return rows.map((m) => ({
    ...m,
    mediaUrl: m.media_path ? signedUrlByPath.get(m.media_path) ?? null : null,
    sender: usersById.get(m.sender_id) ?? null,
  }));
}

/**
 * テキスト・複数画像（まとめ送信）どちらにも対応した送信アクション。
 * mediaPathsが複数ある場合は画像1枚につき1メッセージ行を作成し、
 * 本文（キャプション）は先頭の画像にのみ付与する
 * （グルーピング表示により1つの塊として自然に見える）。
 */
export async function sendEventMessage(eventId: string, body: string, mediaPaths: string[] = []) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text && mediaPaths.length === 0) return { error: "メッセージを入力してください" };

  const supabase = await createClient();
  const rows =
    mediaPaths.length > 0
      ? mediaPaths.map((path, index) => ({
          event_id: eventId,
          sender_id: profile.id,
          body: index === 0 ? text : "",
          message_type: "image" as const,
          media_path: path,
        }))
      : [{ event_id: eventId, sender_id: profile.id, body: text, message_type: "text" as const, media_path: null }];

  const { data, error } = await supabase.from("event_messages").insert(rows).select();
  if (error) return { error: `送信に失敗しました: ${error.message}` };

  revalidatePath(`/talks/${eventId}`);
  revalidatePath("/talks");
  return { success: true, messages: data };
}

/**
 * リアルタイム購読で他の人の新着メッセージIDを受け取った際、そのメッセージだけを
 * 送信者プロフィール・画像URL付きで取得する（ページ全体のrouter.refresh()を避けるため）。
 */
export async function getEventMessagesByIds(eventId: string, ids: string[]) {
  if (ids.length === 0) return { messages: [] };
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("event_messages")
    .select("*")
    .eq("event_id", eventId)
    .in("id", ids)
    .order("created_at");
  const hydrated = await hydrateEventMessages(supabase, rows ?? []);
  return { messages: hydrated };
}

/**
 * 直近limit件（または指定時刻より前のlimit件）のメッセージを、
 * 関連するpoll/vote/reactionとあわせてまとめて取得する共通ヘルパー。
 * 初回ロードと「さらに読み込む」の両方から使う。
 */
async function fetchEventMessagesPage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  opts: { before?: string; limit: number }
) {
  let q = supabase.from("event_messages").select("*").eq("event_id", eventId);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data: rows } = await q.order("created_at", { ascending: false }).limit(opts.limit);
  const ordered = (rows ?? []).slice().reverse();
  const hydrated = await hydrateEventMessages(supabase, ordered);

  const pollIds = [...new Set(ordered.map((m) => m.poll_id).filter((id): id is string => !!id))];
  const messageIds = ordered.map((m) => m.id);
  const [{ data: polls }, { data: votes }, { data: reactions }] = await Promise.all([
    pollIds.length ? supabase.from("event_polls").select("*").in("id", pollIds) : Promise.resolve({ data: [] }),
    pollIds.length ? supabase.from("event_poll_votes").select("*").in("poll_id", pollIds) : Promise.resolve({ data: [] }),
    messageIds.length
      ? supabase.from("event_message_reactions").select("*").in("message_id", messageIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    messages: hydrated,
    hasMore: (rows ?? []).length === opts.limit,
    polls: polls ?? [],
    votes: votes ?? [],
    reactions: reactions ?? [],
  };
}

/**
 * トーク画面の初回表示用。全履歴を毎回読み込むと会話が長いイベントほど重くなるため、
 * 直近limit件だけを返す（デフォルト50件）。
 */
export async function getInitialEventMessages(eventId: string, limit = 50) {
  const supabase = await createClient();
  return fetchEventMessagesPage(supabase, eventId, { limit });
}

/** トーク画面の「さらに読み込む」用に、指定時刻より前のメッセージをまとめて取得する。 */
export async function getOlderEventMessages(eventId: string, beforeCreatedAt: string, limit = 40) {
  const supabase = await createClient();
  return fetchEventMessagesPage(supabase, eventId, { before: beforeCreatedAt, limit });
}

/**
 * イベントトークの参加者アイコン表示用に、参加登録者のプロフィールを取得する。
 * registrations/users は本人+RA以外は直接SELECTできないため、
 * 既存の event_community_profiles_v3（SECURITY DEFINER）で件数分だけ解決する。
 */
export async function getEventTalkParticipants(eventId: string) {
  const supabase = await createClient();
  const { data: registrations } = await supabase.from("registrations").select("user_id").eq("event_id", eventId);
  const userIds = [...new Set((registrations ?? []).map((r) => r.user_id))];
  if (userIds.length === 0) return { participants: [] as CommunityProfile[], total: 0 };
  const { data: profiles } = await supabase.rpc("event_community_profiles_v3", { profile_ids: userIds });
  return { participants: (profiles ?? []) as CommunityProfile[], total: userIds.length };
}

/**
 * RAツール「アンケート」の下書き文面を作る。以前はボタンを押した瞬間に
 * 送信していたが、誤送信を防ぐため下書きをテキスト欄に入れるだけにして、
 * 実際の送信は他のメッセージと同じ送信ボタンから行うように変更した。
 * URLはプレーンテキストとして埋め込み、表示側の自動リンク化に任せる。
 */
export async function prepareEventSurveyToolDraft(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("survey_type, survey_external_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.survey_type === "none") return { error: "このイベントにはアンケートが設定されていません" };

  const origin = await getRequestOrigin();
  const url =
    event.survey_type === "external" && event.survey_external_url
      ? event.survey_external_url
      : `${origin}/events/${eventId}/survey`;
  return { body: `イベント後アンケートへのご協力をお願いします。\n${url}` };
}

/**
 * RAツール「詳細案内」の下書き文面を作る（送信自体はユーザーが手動で行う。上記参照）。
 */
export async function prepareEventDetailsToolDraft(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const origin = await getRequestOrigin();
  const url = `${origin}/events/${eventId}`;
  return { body: `イベントの日時・場所・持ち物などは、詳細ページで確認できます。\n${url}` };
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
