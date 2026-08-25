"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * プロフィール画像（アバター）。line-qrと違い公開Storageバケットのため、
 * 署名付きURLは不要で、公開URLをそのままusers.avatar_urlに保存して使う。
 * 同じpath（{uid}/avatar.{ext}）を使い回す（upsert）ため、更新時はCDN/ブラウザ
 * キャッシュを避けるためにcrクエリを付与したURLをDBへ保存する。
 */
export async function uploadAvatar(
  formData: FormData
): Promise<{ error?: string; url?: string }> {
  const profile = await getCurrentProfile();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "画像を選択してください / Please choose an image" };
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return {
      error: "png / jpeg / webp形式の画像を選択してください / Please use a png, jpeg, or webp image",
    };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "画像サイズは5MB以下にしてください / Image must be 5MB or smaller" };
  }

  const supabase = await createClient();
  const path = `${profile.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("users")
    .update({ avatar_url: url })
    .eq("id", profile.id);
  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/directory");
  return { url };
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // 拡張子がpng/jpg/webpのいずれで保存されているか分からないため3つとも消しておく
  // （存在しないpathの削除はエラーにならない）。
  await supabase.storage
    .from("avatars")
    .remove([`${profile.id}/avatar.png`, `${profile.id}/avatar.jpg`, `${profile.id}/avatar.webp`]);

  const { error } = await supabase.from("users").update({ avatar_url: null }).eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/directory");
  return {};
}
