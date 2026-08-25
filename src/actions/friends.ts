"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { FriendRequestRow } from "@/types/database";

export type FriendActionResult = { error?: string; success?: boolean };

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

/** viewerId から見た targetId との関係を取得する。 */
export async function getFriendRelation(targetId: string): Promise<FriendRelation> {
  const profile = await getCurrentProfile();
  if (!UUID_REGEX.test(targetId)) return { status: "none", requestId: null };
  if (profile.id === targetId) return { status: "none", requestId: null };

  const supabase = await createClient();
  const { data } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${profile.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${profile.id})`
    )
    .maybeSingle();

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

  const { data: existing } = await supabase
    .from("friend_requests")
    .select("id, requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${profile.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${profile.id})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === "accepted") return { success: true };
    if (existing.requester_id === targetId) {
      // 相手から既に届いている申請があるので、新規作成せず自動承認する。
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return { error: error.message };
      revalidatePath(`/directory/${targetId}`);
      revalidatePath(`/directory/${profile.id}`);
      return { success: true };
    }
    // 自分から既に申請済み
    return { success: true };
  }

  const { error } = await supabase.from("friend_requests").insert({
    requester_id: profile.id,
    addressee_id: targetId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/directory/${targetId}`);
  return { success: true };
}

/** 届いている申請を承認する（宛先本人のみ）。 */
export async function acceptFriendRequest(requestId: string): Promise<FriendActionResult> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("friend_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("addressee_id", profile.id)
    .select("requester_id, addressee_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (request) {
    revalidatePath(`/directory/${request.requester_id}`);
    revalidatePath(`/directory/${request.addressee_id}`);
  }
  return { success: true };
}

/** 届いている申請を拒否する、自分が送った申請を取り消す、または友達関係を解消する（共通: 行を削除するだけ）。 */
export async function removeFriendRequest(requestId: string): Promise<FriendActionResult> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("friend_requests")
    .delete()
    .eq("id", requestId)
    .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
    .select("requester_id, addressee_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (request) {
    revalidatePath(`/directory/${request.requester_id}`);
    revalidatePath(`/directory/${request.addressee_id}`);
  }
  return { success: true };
}

export type IncomingFriendRequest = {
  id: string;
  requester: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

/** 自分宛に届いている、未対応の友達申請一覧を取得する。 */
export async function getIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("friend_requests")
    .select("id, requester_id")
    .eq("addressee_id", profile.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<Pick<FriendRequestRow, "id" | "requester_id">[]>();

  const rows = data ?? [];
  if (rows.length === 0) return [];

  // 既存の event_community_profiles_v3（RA/寮生を問わず基本プロフィールを
  // 一括解決するSECURITY DEFINER関数）を再利用し、新規RPCを増やさない。
  const { data: requesters } = await supabase
    .rpc("event_community_profiles_v3", { profile_ids: rows.map((r) => r.requester_id) })
    .returns<{ id: string; full_name: string | null; avatar_url: string | null; role: string }[]>();
  const byId = new Map((requesters ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({ id: r.id, requester: byId.get(r.requester_id) ?? null }));
}
