"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { defaultFeatureState } from "@/lib/feature-flag-keys";
import { FEATURE_FLAG_KEYS, type FeatureFlagKey, type FeatureFlagState } from "@/lib/feature-flags";

export async function updateFeatureFlag(key: FeatureFlagKey, state: FeatureFlagState) {
  const profile = await requireManagement("features");
  if (!FEATURE_FLAG_KEYS.includes(key) || !["public", "beta", "hidden"].includes(state)) return { error: "設定値が正しくありません。" };
  const supabase = await createClient();
  // Preserve home placement when an already-public utility gets its first saved flag.
  const { data: existing, error: readError } = await supabase.from("feature_flags").select("key").eq("key", key).maybeSingle();
  if (readError) return { error: "設定を読み込めませんでした。もう一度お試しください。" };
  const homeDefault = !existing && defaultFeatureState(key) === "public" ? { show_on_home: true } : {};
  const { error } = await supabase.from("feature_flags").upsert({ key, state, ...homeDefault, updated_by: profile.id, updated_at: new Date().toISOString() });
  if (error) return { error: "保存できませんでした。最新のSQLマイグレーションを確認してください。" };
  revalidatePath("/dashboard/features");
  revalidatePath("/talks");
  revalidatePath("/directory/[id]", "page");
  revalidatePath("/events/[id]", "page");
  revalidatePath("/tools", "layout");
  revalidatePath("/directory");
  revalidatePath("/questions");
  revalidatePath("/links");
  revalidatePath("/wisdom");
  revalidatePath("/events");
  revalidatePath("/events/community");
  revalidatePath("/");
  return { success: true };
}
