"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import type { BadgeCriteriaType } from "@/types/database";

export type BadgeActionResult = { error?: string; success?: boolean } | void;

function parseBadgeForm(formData: FormData) {
  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const labelEn = String(formData.get("label_en") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const descriptionEn = String(formData.get("description_en") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim() || "🏅";
  const color = String(formData.get("color") ?? "").trim() || "#C79A3B";
  const criteriaType = String(formData.get("criteria_type") ?? "event_count") as BadgeCriteriaType;
  const criteriaValue = Number(formData.get("criteria_value"));
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  if (!key || !/^[a-z0-9_]{1,40}$/.test(key)) {
    return { error: "キーは半角英数字とアンダースコアのみ（例: first_step）で入力してください" as const };
  }
  if (!label) return { error: "バッジ名を入力してください" as const };
  if (!["event_count", "survey_count"].includes(criteriaType)) {
    return { error: "条件の種類が不正です" as const };
  }
  if (!Number.isInteger(criteriaValue) || criteriaValue <= 0) {
    return { error: "条件の数は1以上の整数で入力してください" as const };
  }

  return {
    values: {
      key,
      label,
      label_en: labelEn || null,
      description: description || null,
      description_en: descriptionEn || null,
      icon,
      color,
      criteria_type: criteriaType,
      criteria_value: criteriaValue,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  };
}

export async function createBadge(_prev: BadgeActionResult, formData: FormData): Promise<BadgeActionResult> {
  const profile = await requireRa();
  const parsed = parseBadgeForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("badges").insert({ ...parsed.values, created_by: profile.id });
  if (error) {
    return { error: error.code === "23505" ? "そのキーは既に使われています" : `作成に失敗しました: ${error.message}` };
  }
  revalidatePath("/dashboard/badges");
  return { success: true };
}

export async function updateBadge(badgeId: string, _prev: BadgeActionResult, formData: FormData): Promise<BadgeActionResult> {
  await requireRa();
  const parsed = parseBadgeForm(formData);
  if (parsed.error) return { error: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase.from("badges").update(parsed.values).eq("id", badgeId);
  if (error) {
    return { error: error.code === "23505" ? "そのキーは既に使われています" : `更新に失敗しました: ${error.message}` };
  }
  revalidatePath("/dashboard/badges");
  return { success: true };
}

export async function deleteBadge(badgeId: string) {
  await requireRa();
  const supabase = await createClient();
  const { error } = await supabase.from("badges").delete().eq("id", badgeId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/badges");
  return { success: true };
}
