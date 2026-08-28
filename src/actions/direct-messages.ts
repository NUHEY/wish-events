"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { DirectMessageRow } from "@/types/database";
import { getFeatureFlagState } from "@/lib/feature-flags";

/** event_community_profiles_v3() の返り値（最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

type HydratedDirectMessage = DirectMessageRow & { mediaUrl: string | null };

// DM画像バケットのフォルダ名(dmPairFolder)は @/lib/utils 側に定義した
// （"use server"ファイルはasync関数以外をexportできないため、この
// ファイルには置けない）。呼び出し側はそちらから直接importする。

/** 2人のuser_idのどちらの並びでも一致するようOR条件を組み立てる。 */
function pairFilter(meId: string, otherId: string) {
  return `and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`;
}

async function hydrateDirectMessages(supabase: Awaited<ReturnType<typeof createClient>>, rows: DirectMessageRow[]) {
  const mediaPaths = rows.map((m) => m.media_path).filter((p): p is string => !!p);
  const { data: signedUrls } = mediaPaths.length
    ? await supabase.storage.from("dm-media").createSignedUrls(mediaPaths, 60 * 60)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const signedUrlByPath = new Map((signedUrls ?? []).map((e) => [e.path, e.signedUrl]));
  return rows.map((m) => ({
    ...m,
    mediaUrl: m.media_path ? signedUrlByPath.get(m.media_path) ?? null : null,
  })) as HydratedDirectMessage[];
}

/**
 * トーク「友達」タブ用に、友達ごとの最新メッセージ・未読フラグとプロフィールをまとめて取得する。
 * friend_dm_threads（SECURITY DEFINER）で友達一覧+最新メッセージを1回で取得し、
 * プロフィールはevent_community_profiles_v3で一括解決する（行数分のN+1を避ける）。
 */
export async function getFriendDmThreads() {
  const supabase = await createClient();
  const { data: threads } = await supabase.rpc("friend_dm_threads").returns<
    {
      friend_id: string;
      last_message_body: string | null;
      last_message_type: string | null;
      last_message_at: string | null;
      last_sender_id: string | null;
      unread: boolean;
    }[]
  >();
  const rows = threads ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabase
    .rpc("event_community_profiles_v3", { profile_ids: rows.map((r) => r.friend_id) })
    .returns<CommunityProfile[]>();
  const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows
    .map((r) => ({ ...r, friend: profilesById.get(r.friend_id) ?? null }))
    .filter((r) => r.friend !== null);
}

/** DMスレッド初回表示用（直近limit件）。 */
export async function getInitialDirectMessages(friendId: string, limit = 50) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: readState } = await supabase
    .from("direct_message_reads")
    .select("last_read_at")
    .eq("user_id", profile.id)
    .eq("other_user_id", friendId)
    .maybeSingle();

  let effectiveLimit = limit;
  if (readState?.last_read_at) {
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .or(pairFilter(profile.id, friendId))
      .gt("created_at", readState.last_read_at);
    effectiveLimit = Math.min(250, Math.max(limit, (count ?? 0) + 1));
  }

  const { data: rows } = await supabase
    .from("direct_messages")
    .select("*")
    .or(pairFilter(profile.id, friendId))
    .order("created_at", { ascending: false })
    .limit(effectiveLimit);
  const ordered = (rows ?? []).slice().reverse();
  const hydrated = await hydrateDirectMessages(supabase, ordered);
  return {
    messages: hydrated,
    hasMore: (rows ?? []).length === effectiveLimit,
    lastReadAt: readState?.last_read_at ?? null,
  };
}

/** DMスレッドの「さらに読み込む」用。 */
export async function getOlderDirectMessages(friendId: string, beforeCreatedAt: string, limit = 40) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("direct_messages")
    .select("*")
    .or(pairFilter(profile.id, friendId))
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(limit);
  const ordered = (rows ?? []).slice().reverse();
  const hydrated = await hydrateDirectMessages(supabase, ordered);
  return { messages: hydrated, hasMore: (rows ?? []).length === limit };
}

/** リアルタイム購読で受け取った新着メッセージIDだけを、署名URL付きで取得する。 */
export async function getDirectMessagesByIds(friendId: string, ids: string[]) {
  if (ids.length === 0) return { messages: [] };
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("direct_messages")
    .select("*")
    .or(pairFilter(profile.id, friendId))
    .in("id", ids)
    .order("created_at");
  const hydrated = await hydrateDirectMessages(supabase, rows ?? []);
  return { messages: hydrated };
}

/**
 * DMを送信する。friend_requestsがaccepted状態でない相手には、
 * direct_messages_insert_friends（RLS）がINSERTを拒否するため、
 * ここでの事前チェックはUX向上（分かりやすいエラーメッセージ）のためのもの。
 */
export async function sendDirectMessage(friendId: string, body: string, mediaPaths: string[] = []) {
  if ((await getFeatureFlagState("friend_dm")) === "hidden") return { error: "友達とのトークは現在公開されていません。" };
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text && mediaPaths.length === 0) return { error: "メッセージを入力してください" };
  if (profile.id === friendId) return { error: "自分自身には送信できません" };

  const supabase = await createClient();
  const rows =
    mediaPaths.length > 0
      ? mediaPaths.map((path, index) => ({
          sender_id: profile.id,
          recipient_id: friendId,
          body: index === 0 ? text : "",
          message_type: "image" as const,
          media_path: path,
        }))
      : [{ sender_id: profile.id, recipient_id: friendId, body: text, message_type: "text" as const, media_path: null }];

  const { data, error } = await supabase.from("direct_messages").insert(rows).select();
  if (error) return { error: "送信に失敗しました。友達関係が解消されている可能性があります。" };

  revalidatePath(`/talks/friends/${friendId}`);
  revalidatePath("/talks");
  return { success: true, messages: data };
}

export async function markDirectMessageRead(friendId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  await supabase
    .from("direct_message_reads")
    .upsert({ user_id: profile.id, other_user_id: friendId, last_read_at: new Date().toISOString() });
}
