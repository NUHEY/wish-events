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

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      og_title: ogTitle || null,
      og_description: ogDescription || null,
      ...(accentColorRaw ? { accent_color: accentColorRaw } : {}),
      colorful_status: colorfulStatus,
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
