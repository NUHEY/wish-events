"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { announcementSchema } from "@/lib/validations/announcement";

export type ActionResult = { error?: string } | void;

function parseAnnouncementFormData(formData: FormData) {
  return announcementSchema.safeParse({
    title: formData.get("title"),
    category_label: formData.get("category_label") ?? "",
    body: formData.get("body"),
    cover_image_url: formData.get("cover_image_url") ?? "",
    pinned: formData.get("pinned") === "on",
    member_ids: formData.getAll("member_ids").map(String),
    all_ra_members: formData.get("all_ra_members") === "on",
  });
}

export async function createAnnouncement(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireRa();
  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: parsed.data.title,
    category_label: parsed.data.category_label || null,
    body: parsed.data.body,
    cover_image_url: parsed.data.cover_image_url || null,
    pinned: parsed.data.pinned,
    member_ids: parsed.data.all_ra_members ? [] : parsed.data.member_ids,
    all_ra_members: parsed.data.all_ra_members,
    created_by: profile.id,
  });

  if (error) {
    return { error: `作成に失敗しました: ${error.message}` };
  }

  revalidatePath("/");
  redirect("/?created=1");
}

export async function updateAnnouncement(
  announcementId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireRa();
  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      title: parsed.data.title,
      category_label: parsed.data.category_label || null,
      body: parsed.data.body,
      cover_image_url: parsed.data.cover_image_url || null,
      pinned: parsed.data.pinned,
      member_ids: parsed.data.all_ra_members ? [] : parsed.data.member_ids,
      all_ra_members: parsed.data.all_ra_members,
    })
    .eq("id", announcementId);

  if (error) {
    return { error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/");
  redirect("/?updated=1");
}

export async function deleteAnnouncement(announcementId: string) {
  await requireRa();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", announcementId);

  if (error) {
    throw new Error(`削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/");
}
