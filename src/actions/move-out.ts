"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/**
 * 寮生本人による退寮設定。DB側のSECURITY DEFINER関数 self_move_out() が
 * floor_number/room_number/roleをクリアしmoved_out_atを記録する
 * （auth.uid()に基づく自己スコープのみで動作。RA権限チェックは無い）。
 */
export async function moveOut(): Promise<{ error?: string }> {
  await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("self_move_out");
  if (error) return { error: error.message };

  revalidatePath("/move-out");
  revalidatePath("/", "layout");
  return {};
}
