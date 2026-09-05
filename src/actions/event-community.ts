"use server";

import { revalidatePath } from "next/cache";
import { messageCursorFilter, type MessageCursor } from "@/lib/message-cursor";
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
    .order("created_at").order("id");
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
  opts: { before?: MessageCursor; limit: number }
) {
  let q = supabase.from("event_messages").select("*").eq("event_id", eventId);
  if (opts.before) q = q.or(messageCursorFilter(opts.before));
  const { data: rows, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(opts.limit);
  if (error) throw new Error("メッセージを読み込めませんでした。再度お試しください。");
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
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: readState } = await supabase
    .from("event_chat_reads")
    .select("last_read_at")
    .eq("event_id", eventId)
    .eq("user_id", profile.id)
    .maybeSingle();

  let effectiveLimit = limit;
  if (readState?.last_read_at) {
    const { count } = await supabase
      .from("event_messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .gt("created_at", readState.last_read_at);
    // 通常は直近50件のまま。未読が多い時だけ最初の未読を含む件数まで広げる。
    effectiveLimit = Math.min(250, Math.max(limit, (count ?? 0) + 1));
  }

  const page = await fetchEventMessagesPage(supabase, eventId, { limit: effectiveLimit });
  return { ...page, lastReadAt: readState?.last_read_at ?? null };
}

/** トーク画面の「さらに読み込む」用に、指定時刻より前のメッセージをまとめて取得する。 */
export async function getOlderEventMessages(eventId: string, before: MessageCursor, limit = 40) {
  const supabase = await createClient();
  return fetchEventMessagesPage(supabase, eventId, { before, limit });
}

/**
 * イベントトークの参加者アイコン表示用に、参加登録者のプロフィールを取得する。
 * registrationsテーブルはRLSで本人+RA以外は直接SELECTできないため
 * （＝素朴に.from("registrations")すると自分の分しか返らない不具合があった）、
 * 参加者のuser_idだけを安全に返すSECURITY DEFINER関数event_registration_user_ids
 * 経由で取得し、プロフィール自体は既存のevent_community_profiles_v3で解決する。
 * 表示される最大7人は「最近登録した順（新しい順）」になるよう並べる。
 */
export async function getEventTalkParticipants(eventId: string) {
  const supabase = await createClient();
  const { data: registrations } = await supabase
    .rpc("event_registration_user_ids", { p_event_id: eventId })
    .returns<{ user_id: string; registered_at: string }[]>();
  const userIds = (registrations ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return { participants: [] as CommunityProfile[], total: 0 };
  const { data: profiles } = await supabase
    .rpc("event_community_profiles_v3", { profile_ids: userIds })
    .returns<CommunityProfile[]>();
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const ordered = userIds.map((id) => profilesById.get(id)).filter((p): p is CommunityProfile => !!p);
  return { participants: ordered, total: userIds.length };
}

/**
 * トーク一覧（/talks）で各イベント行にAvatarStackを出すためのバッチ版。
 * イベントごとに個別クエリを投げると一覧の行数分N+1になってしまうため、
 * event_registration_user_ids_batch（SECURITY DEFINER）で全イベント分を
 * 一括取得してJS側でイベントごとにグルーピングし、表示に必要な上位7人分の
 * プロフィールだけをまとめて1回のRPCで解決する。
 */
export async function getEventTalkParticipantsBatch(eventIds: string[], perEventLimit = 7) {
  const empty = new Map<string, { participants: CommunityProfile[]; total: number }>();
  if (eventIds.length === 0) return empty;

  const supabase = await createClient();
  const { data: registrations } = await supabase
    .rpc("event_registration_user_ids_batch", { p_event_ids: eventIds })
    .returns<{ event_id: string; user_id: string; registered_at: string }[]>();

  const userIdsByEvent = new Map<string, string[]>();
  for (const row of registrations ?? []) {
    const list = userIdsByEvent.get(row.event_id) ?? [];
    list.push(row.user_id);
    userIdsByEvent.set(row.event_id, list);
  }

  const neededIds = new Set<string>();
  for (const ids of userIdsByEvent.values()) {
    ids.slice(0, perEventLimit).forEach((id) => neededIds.add(id));
  }
  if (neededIds.size === 0) return empty;

  const { data: profiles } = await supabase
    .rpc("event_community_profiles_v3", { profile_ids: [...neededIds] })
    .returns<CommunityProfile[]>();
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const result = new Map<string, { participants: CommunityProfile[]; total: number }>();
  for (const [eventId, ids] of userIdsByEvent) {
    const participants = ids
      .slice(0, perEventLimit)
      .map((id) => profilesById.get(id))
      .filter((p): p is CommunityProfile => !!p);
    result.set(eventId, { participants, total: ids.length });
  }
  return result;
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

/** RAツール「会場案内」の下書き文面を作る。 */
export async function prepareEventLocationToolDraft(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("location, location_url").eq("id", eventId).maybeSingle();
  if (!event || (!event.location && !event.location_url)) {
    return { error: "このイベントには開催場所が設定されていません" };
  }

  const lines = ["開催場所のご案内です。"];
  if (event.location) lines.push(event.location);
  if (event.location_url) lines.push(event.location_url);
  return { body: lines.join("\n") };
}

/** RAツール「集金案内」の下書き文面を作る。 */
export async function prepareEventPaymentToolDraft(eventId: string) {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") return { error: "RAのみ操作できます" };

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("fee_amount, payment_info, payment_destination, payment_due_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || !event.fee_amount) return { error: "このイベントには参加費が設定されていません" };

  const lines = [`参加費: ${event.fee_amount.toLocaleString()}円`];
  if (event.payment_destination) lines.push(`集金場所: ${event.payment_destination}`);
  if (event.payment_info) lines.push(event.payment_info);
  if (event.payment_due_at) {
    lines.push(
      `集金期限: ${new Date(event.payment_due_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}`
    );
  }
  return { body: lines.join("\n") };
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
