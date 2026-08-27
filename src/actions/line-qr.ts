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

export async function uploadLineQr(formData: FormData): Promise<{ error?: string; url?: string }> {
  const profile = await getCurrentProfile();
  const file = formData.get("line_qr");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "画像を選択してください / Please choose an image" };
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { error: "png / jpeg / webp形式の画像を選択してください / Please use a png, jpeg, or webp image" };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { error: "画像サイズは5MB以下にしてください / Image must be 5MB or smaller" };
  }

  const supabase = await createClient();
  const path = `${profile.id}/qr.${ext}`;

  const { error: uploadError } = await supabase.storage.from("line-qr").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({ line_qr_path: path })
    .eq("id", profile.id);
  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/profile/edit");
  revalidatePath("/profile/setup");
  const { data: signed } = await supabase.storage.from("line-qr").createSignedUrl(path, 60 * 10);
  return { url: signed?.signedUrl };
}

export async function removeLineQr(): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  if (profile.line_qr_path) {
    await supabase.storage.from("line-qr").remove([profile.line_qr_path]);
  }

  const { error } = await supabase
    .from("users")
    .update({ line_qr_path: null })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/profile/edit");
  revalidatePath("/profile/setup");
  return {};
}

/** 非公開バケットのため、表示用に短命の署名付きURLを発行する（本人 or RAのみRLSで許可）。 */
export async function getLineQrSignedUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("line-qr").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
