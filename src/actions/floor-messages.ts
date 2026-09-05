"use server";

import { revalidatePath } from "next/cache";
import { messageCursorFilter, type MessageCursor } from "@/lib/message-cursor";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import type { FloorMessageRow, UserRole } from "@/types/database";

export type FloorMember = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  room_number: string | null;
};

async function requireFloorChat() {
  const profile = await getCurrentProfile();
  if ((await getFeatureFlagState("floor_group_chat")) === "hidden") {
    return { profile, error: "フロアグループは現在公開されていません。" } as const;
  }
  if (!profile.floor_number || profile.moved_out_at) {
    return { profile, error: "フロア情報を登録すると利用できます。" } as const;
  }
  return { profile, error: null } as const;
}

/** 現在のフロアの直近メッセージ、初回未読位置、メンバーをまとめて取得する。 */
export async function getInitialFloorMessages(limit = 60) {
  const access = await requireFloorChat();
  if (access.error) return { error: access.error, messages: [], members: [], hasMore: false, lastReadAt: null };
  const floorNumber = access.profile.floor_number!;
  const supabase = await createClient();
  const [{ data: readState }, { data: members }] = await Promise.all([
    supabase
      .from("floor_message_reads")
      .select("last_read_at")
      .eq("user_id", access.profile.id)
      .eq("floor_number", floorNumber)
      .maybeSingle(),
    supabase.rpc("floor_group_profiles"),
  ]);

  let effectiveLimit = limit;
  if (readState?.last_read_at) {
    const { count } = await supabase
      .from("floor_messages")
      .select("id", { count: "exact", head: true })
      .eq("floor_number", floorNumber)
      .gt("created_at", readState.last_read_at);
    effectiveLimit = Math.min(250, Math.max(limit, (count ?? 0) + 1));
  }

  const { data: rows } = await supabase
    .from("floor_messages")
    .select("*")
    .eq("floor_number", floorNumber)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(effectiveLimit);

  return {
    floorNumber,
    messages: ((rows ?? []).slice().reverse()) as FloorMessageRow[],
    members: (members ?? []) as FloorMember[],
    hasMore: (rows ?? []).length === effectiveLimit,
    lastReadAt: readState?.last_read_at ?? null,
  };
}

export async function getOlderFloorMessages(before: MessageCursor, limit = 40) {
  const access = await requireFloorChat();
  if (access.error) return { error: access.error, messages: [], hasMore: false };
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("floor_messages")
    .select("*")
    .eq("floor_number", access.profile.floor_number!)
    .or(messageCursorFilter(before))
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error("メッセージを読み込めませんでした。再度お試しください。");
  return { messages: ((rows ?? []).slice().reverse()) as FloorMessageRow[], hasMore: (rows ?? []).length === limit };
}

export async function getFloorMessagesByIds(ids: string[]) {
  if (ids.length === 0) return { messages: [] as FloorMessageRow[] };
  const access = await requireFloorChat();
  if (access.error) return { error: access.error, messages: [] as FloorMessageRow[] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("floor_messages")
    .select("*")
    .eq("floor_number", access.profile.floor_number!)
    .in("id", ids)
    .order("created_at").order("id");
  return { messages: (data ?? []) as FloorMessageRow[] };
}

export async function sendFloorMessage(body: string) {
  const access = await requireFloorChat();
  if (access.error) return { error: access.error };
  const text = body.replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { error: "メッセージを入力してください。" };
  if (text.length > 2000) return { error: "メッセージは2000文字以内で入力してください。" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("floor_messages")
    .insert({ floor_number: access.profile.floor_number!, sender_id: access.profile.id, body: text })
    .select()
    .single();
  if (error) return { error: "送信できませんでした。フロア情報を確認してください。" };

  revalidatePath("/talks");
  revalidatePath("/talks/floor");
  return { success: true, message: data as FloorMessageRow };
}

export async function markFloorMessagesRead() {
  const access = await requireFloorChat();
  if (access.error) return;
  const supabase = await createClient();
  await supabase.from("floor_message_reads").upsert({
    user_id: access.profile.id,
    floor_number: access.profile.floor_number!,
    last_read_at: new Date().toISOString(),
  });
}
