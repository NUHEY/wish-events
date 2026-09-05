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
  const startOnboarding = formData.get("start_onboarding") === "1";

  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    student_id: formData.get("student_id"),
    wish_entry_month: formData.get("wish_entry_month"),
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
      wish_entry_month: parsed.data.wish_entry_month,
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

  // 自己申告の部屋変更ではRAへ昇格させない。既存RAの維持・降格だけを同期し、
  // 新しいRAの承認は管理者によるRA管理操作で行う。
  await supabase.rpc("sync_own_role");

  revalidatePath("/", "layout");
  revalidatePath("/directory");
  revalidatePath(`/directory/${profile.id}`);
  if (startOnboarding) redirect("/onboarding?saved=1");
  redirect(`/directory/${profile.id}?saved=1`);
}
