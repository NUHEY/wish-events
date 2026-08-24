"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";

/** 退寮処理: 指定ユーザーの住居情報（階・部屋番号）をクリアし、RAだった場合はresidentに戻す。
 *  次回ログイン時、そのユーザーは自動的にプロフィール再登録画面へ案内される。
 *  アカウント自体や過去の申込み・アンケート回答履歴は削除しない。 */
export async function releaseRoom(userId: string) {
  await requireRa();
  const supabase = await createClient();

  const { error } = await supabase.rpc("release_room", { p_user_id: userId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/residents");
  return { success: true };
}

/** 学期の変わり目用: 全寮生の住居情報を一括でクリアする（誤操作対策で確認文字列が必須）。 */
export async function resetAllRoomAssignments(confirmText: string) {
  await requireRa();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reset_all_room_assignments", {
    p_confirm: confirmText,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/residents");
  revalidatePath("/dashboard/ra-rooms");
  return { success: true, count: data as number };
}
