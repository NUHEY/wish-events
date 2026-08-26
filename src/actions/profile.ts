"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getProfileSchema } from "@/lib/validations/profile";
import { getLocale, getDictionary } from "@/lib/i18n";

export type ActionResult = { error?: string } | void;

export async function submitProfile(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const schema = getProfileSchema(locale);

  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    student_id: formData.get("student_id"),
    room_number: formData.get("room_number"),
    faculty: formData.get("faculty"),
    grade_level: formData.get("grade_level"),
    languages: formData.getAll("languages"),
    nationalities: formData.getAll("nationalities"),
    lived_countries: formData.getAll("lived_countries"),
    instagram_handle: formData.get("instagram_handle"),
    self_intro: formData.get("self_intro"),
    line_id: formData.get("line_id"),
    x_handle: formData.get("x_handle"),
    profile_accents: formData.getAll("profile_accents"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? dict.validation.genericError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.full_name,
      student_id: parsed.data.student_id,
      floor_number: parsed.data.room_number.floorNumber,
      room_number: parsed.data.room_number.roomNumber,
      faculty: parsed.data.faculty,
      grade_level: parsed.data.grade_level,
      languages: parsed.data.languages.length ? parsed.data.languages : null,
      nationalities: parsed.data.nationalities.length ? parsed.data.nationalities : null,
      lived_countries: parsed.data.lived_countries.length ? parsed.data.lived_countries : null,
      instagram_handle: parsed.data.instagram_handle,
      self_intro: parsed.data.self_intro,
      line_id: parsed.data.line_id,
      x_handle: parsed.data.x_handle,
      profile_accents: parsed.data.profile_accents,
    })
    .eq("id", profile.id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? dict.profile.roomNumberDuplicate
          : `${dict.profile.saveFailed}: ${error.message}`,
    };
  }

  // ra_rooms（RA個室一覧）に登録されている部屋番号であれば自動的にRAへ昇格し、
  // そうでなければresidentのままになる。role列は自己申告では直接書き換えら
  // れないため、この同期はDB側のSECURITY DEFINER関数(sync_own_role)経由で
  // 行っている（詳細はschema.sql参照）。
  await supabase.rpc("sync_own_role");

  revalidatePath("/", "layout");
  revalidatePath("/directory");
  revalidatePath(`/directory/${profile.id}`);
  redirect(`/directory/${profile.id}?saved=1`);
}
