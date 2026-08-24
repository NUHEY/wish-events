"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, postLoginPath } from "@/lib/auth";
import { profileSchema, validateRoomNumberForRole } from "@/lib/validations/profile";

export type ActionResult = { error?: string } | void;

export async function submitProfile(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentProfile();

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    student_id: formData.get("student_id"),
    floor_number: formData.get("floor_number"),
    room_number: formData.get("room_number"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  if (!validateRoomNumberForRole(parsed.data.room_number, profile.role)) {
    return {
      error:
        profile.role === "ra"
          ? "RAの部屋番号は数字2桁で入力してください（例: 01）"
          : "部屋番号は数字2桁 + ユニット記号(A〜D)で入力してください（例: 01A）",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      student_id: parsed.data.student_id,
      floor_number: parsed.data.floor_number,
      room_number: parsed.data.room_number,
    })
    .eq("id", profile.id);

  if (error) {
    return { error: `保存に失敗しました: ${error.message}` };
  }

  revalidatePath("/", "layout");
  redirect(postLoginPath(profile.role));
}
