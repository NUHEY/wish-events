"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { FLOORS } from "@/lib/constants";

export type BroadcastTarget =
  | { mode: "all" }
  | { mode: "floor"; floor: number }
  | { mode: "role"; role: "ra" | "resident" }
  | { mode: "individual"; userIds: string[] };

export type BroadcastSender =
  | { mode: "self" }
  | { mode: "system" | "front_desk" | "ra_team" }
  | { mode: "custom"; label: string };

export type BroadcastInput = {
  message: string;
  link?: string;
  target: BroadcastTarget;
  sender: BroadcastSender;
  broadcastId: string;
};

export async function sendRaBroadcastNotification(input: BroadcastInput) {
  await requireManagement("notifications");
  const message = input.message.trim();
  const link = input.link?.trim() || "/";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.broadcastId)) {
    return { error: "通知の送信IDが正しくありません" };
  }
  if (!message || message.length > 180) return { error: "本文は1〜180文字で入力してください" };
  if (!link.startsWith("/") || link.startsWith("//") || link.length > 500) {
    return { error: "リンクは / から始まるサイト内のパスで入力してください" };
  }
  const senderModes = ["self", "system", "front_desk", "ra_team", "custom"] as const;
  if (!senderModes.includes(input.sender.mode)) return { error: "送り主が正しくありません" };
  const senderLabel = input.sender.mode === "custom" ? input.sender.label.trim() : "";
  if (input.sender.mode === "custom" && (!senderLabel || senderLabel.length > 40)) {
    return { error: "任意の送り主名は1〜40文字で入力してください" };
  }

  const supabase = await createClient();
  let query = supabase.from("users").select("id").not("floor_number", "is", null);
  if (input.target.mode === "floor") {
    if (!FLOORS.includes(input.target.floor as (typeof FLOORS)[number])) return { error: "対象フロアが正しくありません" };
    query = query.eq("floor_number", input.target.floor);
  } else if (input.target.mode === "role") {
    if (input.target.role !== "ra" && input.target.role !== "resident") return { error: "対象の役割が正しくありません" };
    query = query.eq("role", input.target.role);
  } else if (input.target.mode === "individual") {
    const ids = [...new Set(input.target.userIds)].slice(0, 200);
    if (ids.length === 0) return { error: "送信する寮生を選択してください" };
    query = query.in("id", ids);
  }

  const { data: recipients, error: recipientError } = await query.limit(1000);
  if (recipientError) return { error: `送信対象を確認できませんでした: ${recipientError.message}` };
  const recipientIds = (recipients ?? []).map((recipient) => recipient.id);
  if (recipientIds.length === 0) return { error: "条件に一致する寮生がいません" };

  let sentCount = 0;
  for (let start = 0; start < recipientIds.length; start += 200) {
    const { data, error } = await supabase.rpc("send_ra_broadcast_notification", {
      p_target_ids: recipientIds.slice(start, start + 200),
      p_preview_text: message,
      p_link: link,
      p_broadcast_id: input.broadcastId,
      p_sender_mode: input.sender.mode,
      p_sender_label: senderLabel,
    });
    if (error) return { error: `通知の送信に失敗しました: ${error.message}`, count: sentCount };
    sentCount += data ?? 0;
  }

  revalidatePath("/notifications");
  return { success: true, count: sentCount };
}

/** 通知画面を開いたタイミングで、未読の通知をまとめて既読にする。 */
export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .is("read_at", null);
  if (error) return { error: `既読にできませんでした: ${error.message}` };

  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteNotification(notificationId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", profile.id);
  if (error) return { error: `削除に失敗しました: ${error.message}` };

  revalidatePath("/notifications");
  return { success: true };
}
