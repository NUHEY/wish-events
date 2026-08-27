"use server";

import { revalidatePath } from "next/cache";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type SiteSettingsActionResult = { error?: string; success?: boolean };

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function intFromForm(formData: FormData, name: string, min: number, max: number, fallback: number) {
  const parsed = Number(formData.get(name));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export async function updateSiteSettings(
  _prev: SiteSettingsActionResult,
  formData: FormData
): Promise<SiteSettingsActionResult> {
  const profile = await requireRa();
  const ogTitle = String(formData.get("og_title") ?? "").trim();
  const ogDescription = String(formData.get("og_description") ?? "").trim();
  const accentColorRaw = String(formData.get("accent_color") ?? "").trim();
  if (accentColorRaw && !HEX_COLOR_PATTERN.test(accentColorRaw)) {
    return { error: "アクセントカラーの形式が正しくありません。" };
  }
  const colorfulStatus = formData.get("colorful_status") === "on";
  const motionLevelRaw = String(formData.get("motion_level") ?? "standard");
  const motionLevel = motionLevelRaw === "subtle" || motionLevelRaw === "lively" ? motionLevelRaw : "standard";

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      og_title: ogTitle || null,
      og_description: ogDescription || null,
      ...(accentColorRaw ? { accent_color: accentColorRaw } : {}),
      colorful_status: colorfulStatus,
      navigation_lock_enabled: formData.get("navigation_lock_enabled") === "on",
      navigation_stall_seconds: intFromForm(formData, "navigation_stall_seconds", 3, 30, 8),
      mobile_touch_feedback_enabled: formData.get("mobile_touch_feedback_enabled") === "on",
      mobile_touch_feedback_ms: intFromForm(formData, "mobile_touch_feedback_ms", 80, 500, 180),
      motion_level: motionLevel,
      cta_blur_px: intFromForm(formData, "cta_blur_px", 0, 32, 16),
      cta_fade_height_px: intFromForm(formData, "cta_fade_height_px", 32, 128, 64),
      cta_transition_ms: intFromForm(formData, "cta_transition_ms", 100, 600, 200),
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) {
    return { error: "保存できませんでした。最新のSQLマイグレーションを適用済みか確認してください。" };
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateEventDisplaySettings(
  _prev: SiteSettingsActionResult,
  formData: FormData
): Promise<SiteSettingsActionResult> {
  const profile = await requireRa();
  const positionRaw = String(formData.get("event_label_position") ?? "top-left");
  const densityRaw = String(formData.get("event_card_density") ?? "compact");

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      event_label_rotation_enabled: formData.get("event_label_rotation_enabled") === "on",
      event_label_duration_ms: intFromForm(formData, "event_label_duration_ms", 1800, 12000, 3600),
      event_label_jitter_percent: intFromForm(formData, "event_label_jitter_percent", 0, 45, 18),
      event_label_shuffle_enabled: formData.get("event_label_shuffle_enabled") === "on",
      event_label_limit: intFromForm(formData, "event_label_limit", 0, 50, 0),
      event_label_position: positionRaw === "top-right" ? "top-right" : "top-left",
      event_show_category_label: formData.get("event_show_category_label") === "on",
      event_show_new_label: formData.get("event_show_new_label") === "on",
      event_show_deadline_label: formData.get("event_show_deadline_label") === "on",
      event_show_fee_label: formData.get("event_show_fee_label") === "on",
      event_show_free_label: formData.get("event_show_free_label") === "on",
      event_new_days: intFromForm(formData, "event_new_days", 1, 30, 7),
      event_deadline_hours: intFromForm(formData, "event_deadline_hours", 1, 168, 48),
      event_title_lines: intFromForm(formData, "event_title_lines", 1, 3, 2) as 1 | 2 | 3,
      event_card_density: densityRaw === "comfortable" ? "comfortable" : "compact",
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return { error: "保存できませんでした。追加のサイト表示設定SQLを適用済みか確認してください。" };
  }
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/dashboard/event-options");
  return { success: true };
}

/** OGP用のプレビュー画像（未設定時は自動生成デザインが使われる）。 */
export async function uploadOgImage(formData: FormData): Promise<{ error?: string; url?: string }> {
  const profile = await requireRa();
  const file = formData.get("og_image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "画像を選択してください" };
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { error: "png / jpeg / webp形式の画像を選択してください" };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "画像サイズは5MB以下にしてください" };
  }

  const supabase = await createClient();
  // 拡張子違いのファイルが残らないよう、まず3種類とも消してから固定pathでアップロードする。
  await supabase.storage.from("site-assets").remove(["og/cover.png", "og/cover.jpg", "og/cover.webp"]);
  const path = `og/cover.${ext}`;
  const { error: uploadError } = await supabase.storage.from("site-assets").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("site_settings")
    .update({ og_image_url: url, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (updateError) return { error: updateError.message };

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  return { url };
}

export async function removeOgImage(): Promise<{ error?: string }> {
  const profile = await requireRa();
  const supabase = await createClient();
  await supabase.storage.from("site-assets").remove(["og/cover.png", "og/cover.jpg", "og/cover.webp"]);

  const { error } = await supabase
    .from("site_settings")
    .update({ og_image_url: null, updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/settings");
  return {};
}
