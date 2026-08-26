"use server";

import { revalidatePath } from "next/cache";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";

export async function updateFeatureFlag(key: FeatureFlagKey, state: FeatureFlagState) {
  const profile = await requireRa();
  if (!["friend_dm", "event_calendar_export"].includes(key) || !["public", "beta", "hidden"].includes(state)) return { error: "設定値が正しくありません。" };
  const supabase = await createClient();
  const { error } = await supabase.from("feature_flags").upsert({ key, state, updated_by: profile.id, updated_at: new Date().toISOString() });
  if (error) return { error: "保存できませんでした。最新のSQLマイグレーションを確認してください。" };
  revalidatePath("/dashboard/features");
  revalidatePath("/talks");
  revalidatePath("/directory/[id]", "page");
  revalidatePath("/events/[id]", "page");
  return { success: true };
}
