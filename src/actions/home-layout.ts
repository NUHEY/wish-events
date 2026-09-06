"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { homeLayoutSchema } from "@/lib/validations/home-layout";
import { HOME_SECTION_KEYS } from "@/lib/constants";
import { RESIDENT_TOOLS, type ToolKey } from "@/lib/resident-tools";

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
  await requireManagement("home");

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

  // 念のため、フォームが全セクションを含んでいるか確認する
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
      .eq("section_key", s.section_key).select("section_key").single();

    if (error) {
      return { error: `保存に失敗しました: ${error.message}` };
    }
  }

  revalidatePath("/");
  revalidatePath("/dashboard/home-layout");
  return { success: true };
}

export async function saveHomeToolSettings(input: { key: ToolKey; showOnHome: boolean; position: number }[], density: "minimal" | "compact") {
  const profile = await requireManagement("home");
  await requireManagement("settings");
  const allowed = new Set(RESIDENT_TOOLS.map(tool => tool.key));
  if (!Array.isArray(input) || input.length !== allowed.size || input.some(item => !item || !allowed.has(item.key) || typeof item.showOnHome !== "boolean")) {
    return { error: "ツール設定が不足しています。画面を再読み込みしてください。" };
  }
  if (new Set(input.map(item => item.key)).size !== allowed.size) return { error: "同じツールが重複しています。" };
  if (density !== "compact" && density !== "minimal") return { error: "表示の大きさを選び直してください。" };

  // Layout and density are one update. Public/hidden feature flags remain independent.
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update({
    home_tool_layout: input.map(item => ({ key: item.key, showOnHome: item.showOnHome })),
    home_tool_density: density,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }).eq("id", 1).select("id").single();
  if (error) return { error: "ホームのツール設定を保存できませんでした。時間をおいて再度お試しください。" };
  revalidatePath("/");
  revalidatePath("/dashboard/home-layout");
  return { success: true };
}
