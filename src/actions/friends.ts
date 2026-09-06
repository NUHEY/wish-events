"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { FriendRequestRow } from "@/types/database";

export type FriendActionResult = { error?: string; success?: boolean; relation?: FriendRelation };

/**
 * 2人の関係を表すステータス。
 * - none: 申請なし
 * - pending_sent: 自分から相手に申請中
 * - pending_received: 相手から自分に申請が届いている
 * - friends: 承認済み（友達）
 */
export type FriendRelationStatus = "none" | "pending_sent" | "pending_received" | "friends";

export type FriendRelation = {
  status: FriendRelationStatus;
  requestId: string | null;
};

// .or() フィルタ文字列にIDを埋め込むため、想定外の文字列（PostgRESTのフィルタ構文を
// 含むものなど）が紛れ込まないよう、事前にUUID形式であることを確認する。
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PairRequest = Pick<FriendRequestRow, "id" | "requester_id" | "addressee_id" | "status">;

function pairFilter(viewerId: string, targetId: string) {
  return `and(requester_id.eq.${viewerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${viewerId})`;
}

// 逆方向の同時申請が2行あっても、成立済み→受信→送信の順で一つの関係として扱う。
function preferredRequest(rows: PairRequest[], viewerId: string) {
  return rows.find((row) => row.status === "accepted")
    ?? rows.find((row) => row.addressee_id === viewerId)
    ?? rows[0];
}

/** viewerId から見た targetId との関係を取得する。 */
export async function getFriendRelation(targetId: string): Promise<FriendRelation> {
  const profile = await getCurrentProfile();
  if (!UUID_REGEX.test(targetId)) return { status: "none", requestId: null };
  if (profile.id === targetId) return { status: "none", requestId: null };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(pairFilter(profile.id, targetId))
    .returns<PairRequest[]>();

  if (error) throw new Error("友達申請を読み込めませんでした。再読み込みしてください。");
  const data = preferredRequest(rows ?? [], profile.id);
  if (!data) return { status: "none", requestId: null };
  if (data.status === "accepted") return { status: "friends", requestId: data.id };
  if (data.requester_id === profile.id) return { status: "pending_sent", requestId: data.id };
  return { status: "pending_received", requestId: data.id };
}

/**
 * 友達申請を送る。相手からも既に自分宛に申請が届いている場合（すれ違い）は、
 * 新規作成せずその申請を自動承認してマッチさせる。
 */
export async function sendFriendRequest(targetId: string): Promise<FriendActionResult> {
  const profile = await getCurrentProfile();
  if (!UUID_REGEX.test(targetId)) return { error: "無効なユーザーです" };
  if (profile.id === targetId) return { error: "自分自身には申請できません" };

  const supabase = await createClient();

  const { data: existingRows, error: lookupError } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(pairFilter(profile.id, targetId))
    .returns<PairRequest[]>();

  if (lookupError) return { error: "友達申請を確認できませんでした。もう一度お試しください。" };

  const existing = preferredRequest(existingRows ?? [], profile.id);
  if (existing) {
    if (existing.status === "accepted") return { success: true, relation: { status: "friends", requestId: existing.id } };
    if (existing.requester_id === targetId) {
      // 相手から既に届いている申請があるので、新規作成せず自動承認する。
      return acceptFriendRequest(existing.id);
    }
    // 自分から既に申請済み
    return { success: true, relation: { status: "pending_sent", requestId: existing.id } };
  }

  const { data: created, error } = await supabase.from("friend_requests").insert({
    requester_id: profile.id,
    addressee_id: targetId,
  }).select("id").single();
  if (error?.code === "23505") {
    const relation = await getFriendRelation(targetId);
    if (relation.status !== "none") return { success: true, relation };
  }
  if (error || !created) return { error: "友達申請を送信できませんでした。もう一度お試しください。" };
  revalidatePath(`/directory/${targetId}`);
  revalidatePath(`/directory/${profile.id}`);
  return { success: true, relation: { status: "pending_sent", requestId: created.id } };
}

/** 届いている申請を承認する（宛先本人のみ）。 */
export async function acceptFriendRequest(requestId: string): Promise<FriendActionResult> {
  const profile = await getCurrentProfile();
  if (!UUID_REGEX.test(requestId)) return { error: "無効な友達申請です" };
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("addressee_id", profile.id)
    .eq("status", "pending")
    .select("requester_id, addressee_id")
    .maybeSingle();
  if (error || !request) return { error: "申請を更新できませんでした。再読み込みして確認してください。" };
  if (request) {
    revalidatePath(`/directory/${request.requester_id}`);
    revalidatePath(`/directory/${request.addressee_id}`);
  }
  revalidatePath("/");
  revalidatePath("/talks");
  return { success: true, relation: { status: "friends", requestId } };
}

/** 申請の取消・拒否・友達解除。確認できた当事者2人の申請だけを両方向まとめて削除する。 */
export async function removeFriendRequest(requestId: string): Promise<FriendActionResult> {
  const profile = await getCurrentProfile();
  if (!UUID_REGEX.test(requestId)) return { error: "無効な友達申請です" };
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("friend_requests")
    .select("requester_id, addressee_id")
    .eq("id", requestId)
    .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
    .maybeSingle();
  if (error || !request) return { error: "申請を更新できませんでした。再読み込みして確認してください。" };
  const targetId = request.requester_id === profile.id ? request.addressee_id : request.requester_id;
  const { data: removed, error: deleteError } = await supabase
    .from("friend_requests")
    .delete()
    .or(pairFilter(profile.id, targetId))
    .select("id");
  if (deleteError || !removed?.length) return { error: "申請を更新できませんでした。再読み込みして確認してください。" };
  revalidatePath(`/directory/${profile.id}`);
  revalidatePath(`/directory/${targetId}`);
  revalidatePath("/");
  revalidatePath("/talks");
  return { success: true, relation: { status: "none", requestId: null } };
}

export type IncomingFriendRequest = {
  id: string;
  requester: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

/** 自分宛に届いている、未対応の友達申請一覧を取得する。 */
export async function getIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .returns<PairRequest[]>();

  if (error) throw new Error("友達申請を読み込めませんでした。再読み込みしてください。");

  const acceptedPartners = new Set((data ?? [])
    .filter((row) => row.status === "accepted")
    .map((row) => row.requester_id === profile.id ? row.addressee_id : row.requester_id));
  const rows = (data ?? []).filter((row) => row.status === "pending" && row.addressee_id === profile.id && !acceptedPartners.has(row.requester_id));
  if (rows.length === 0) return [];

  // 既存の event_community_profiles_v3（RA/寮生を問わず基本プロフィールを
  // 一括解決するSECURITY DEFINER関数）を再利用し、新規RPCを増やさない。
  const { data: requesters, error: profileError } = await supabase
    .rpc("event_community_profiles_v3", { profile_ids: rows.map((r) => r.requester_id) })
    .returns<{ id: string; full_name: string | null; avatar_url: string | null; role: string }[]>();
  if (profileError) throw new Error("申請者のプロフィールを読み込めませんでした。再読み込みしてください。");
  const byId = new Map((requesters ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({ id: r.id, requester: byId.get(r.requester_id) ?? null }));
}
