"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { homeLayoutSchema } from "@/lib/validations/home-layout";
import { HOME_SECTION_KEYS } from "@/lib/constants";
import { FEATURE_FLAG_KEYS, type FeatureFlagKey } from "@/lib/feature-flags";

export type HomeLayoutActionResult = { error?: string; success?: boolean };

/**
 * ホーム画面の各セクションの
 * 表示・非表示、並び順、アクセントカラー、タイトル上書きをRAが一括保存する。
 * セクションの追加・削除はできない（行はマイグレーションで固定シード済み）ため、
 * ここでは常にupdateのみを行う。
 */
export async function saveHomeLayout(
  _prev: HomeLayoutActionResult,
  formData: FormData
): Promise<HomeLayoutActionResult> {
  await requireRa();

  const orderedKeys = formData.getAll("section_key").map(String);
  const sections = orderedKeys.map((key, index) => ({
    section_key: key,
    visible: formData.get(`visible__${key}`) === "on",
    position: index + 1,
    accent: formData.get(`accent__${key}`) ?? "",
    title_ja: formData.get(`title_ja__${key}`) ?? "",
    title_en: formData.get(`title_en__${key}`) ?? "",
  }));

  const parsed = homeLayoutSchema.safeParse({ sections });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  // 念のため、フォームが3セクション全てを含んでいるか確認する
  const gotKeys = new Set(parsed.data.sections.map((s) => s.section_key));
  if (HOME_SECTION_KEYS.some((k) => !gotKeys.has(k))) {
    return { error: "セクション情報が不足しています" };
  }

  const supabase = await createClient();
  for (const s of parsed.data.sections) {
    const { error } = await supabase
      .from("home_layout_sections")
      .update({
        visible: s.visible,
        position: s.position,
        accent: s.accent || null,
        title_ja: s.title_ja || null,
        title_en: s.title_en || null,
      })
      .eq("section_key", s.section_key);

    if (error) {
      return { error: `保存に失敗しました: ${error.message}` };
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard/home-layout");
  return { success: true };
}

export async function saveHomeToolSettings(input: { key: FeatureFlagKey; showOnHome: boolean; position: number }[], density: "minimal" | "compact") {
  const profile = await requireRa();
  const allowed = new Set<FeatureFlagKey>([
    "availability_matching",
    "lets_chat_booking",
    "unit_room_sessions",
    "ra_question_box",
    "ra_link_hub",
  ]);
  if (input.length !== allowed.size || input.some((item) => !FEATURE_FLAG_KEYS.includes(item.key) || !allowed.has(item.key))) {
    return { error: "ツール設定が不足しています。" };
  }
  const keys = new Set(input.map((item) => item.key));
  if (keys.size !== allowed.size) return { error: "同じツールが重複しています。" };

  const supabase = await createClient();
  const results = await Promise.all(input.map((item, index) => supabase.from("feature_flags").update({
    show_on_home: item.showOnHome,
    home_position: index + 1,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }).eq("key", item.key)));
  if (results.some((result) => result.error)) return { error: "保存できませんでした。20260828のSQLを適用してください。" };
  const { error: densityError } = await supabase.from("site_settings").update({ home_tool_density: density === "compact" ? "compact" : "minimal", updated_by: profile.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (densityError) return { error: "大きさを保存できませんでした。最新のSQLを適用してください。" };
  revalidatePath("/");
  revalidatePath("/dashboard/home-layout");
  return { success: true };
}
