"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

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
