"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { announcementSchema } from "@/lib/validations/announcement";

export type ActionResult = { error?: string } | void;

function parseAnnouncementFormData(formData: FormData) {
  const tagsRaw = String(formData.get("tags") ?? "");
  return announcementSchema.safeParse({
    title: formData.get("title"),
    category_label: formData.get("category_label") ?? "",
    body: formData.get("body"),
    cover_image_url: formData.get("cover_image_url") ?? "",
    pinned: formData.get("pinned") === "on",
    tags: tagsRaw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  });
}

export async function createAnnouncement(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireManagement("announcements");
  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      title: parsed.data.title,
      category_label: parsed.data.category_label,
      body: parsed.data.body,
      cover_image_url: parsed.data.cover_image_url || null,
      pinned: parsed.data.pinned,
      tags: parsed.data.tags,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `作成に失敗しました: ${error?.message ?? "作成結果を確認できませんでした"}` };
  }

  revalidatePath("/");
  revalidatePath("/announcements");
  redirect(`/announcements/${data.id}?created=1`);
}

export async function updateAnnouncement(
  announcementId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireManagement("announcements");
  const parsed = parseAnnouncementFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({
      title: parsed.data.title,
      category_label: parsed.data.category_label,
      body: parsed.data.body,
      cover_image_url: parsed.data.cover_image_url || null,
      pinned: parsed.data.pinned,
      tags: parsed.data.tags,
    })
    .eq("id", announcementId);

  if (error) {
    return { error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${announcementId}`);
  redirect(`/announcements/${announcementId}?updated=1`);
}

export async function deleteAnnouncement(announcementId: string) {
  await requireManagement("announcements");
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", announcementId);

  if (error) {
    throw new Error(`削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/");
}

// ---------------------------------------------------------------------
// お知らせ詳細のコメント機能。event_comments系（src/actions/event-community.ts）
// と同じ設計・挙動を announcement_comments 側に対して行うだけのミラー実装。
// ---------------------------------------------------------------------

export async function addAnnouncementComment(announcementId: string, body: string, parentId?: string | null) {
  const profile = await getCurrentProfile();
  const text = body.trim();
  if (!text) return { error: "コメントを入力してください" };

  const supabase = await createClient();
  if (parentId) {
    const { data: parent } = await supabase
      .from("announcement_comments")
      .select("id, announcement_id, parent_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.announcement_id !== announcementId || parent.parent_id) {
      return { error: "返信先のコメントを確認できませんでした" };
    }
  }

  const { error } = await supabase
    .from("announcement_comments")
    .insert({ announcement_id: announcementId, user_id: profile.id, body: text, parent_id: parentId ?? null });
  if (error) return { error: `コメントの投稿に失敗しました: ${error.message}` };

  revalidatePath(`/announcements/${announcementId}`);
  return { success: true };
}

export async function deleteAnnouncementComment(commentId: string, announcementId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: comment } = await supabase
    .from("announcement_comments")
    .select("id, user_id, announcement_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment || comment.announcement_id !== announcementId) return { error: "コメントが見つかりませんでした" };
  if (comment.user_id !== profile.id && !canManage(await getManagementAccess(), "announcements")) {
    return { error: "このコメントを削除する権限がありません" };
  }

  // parent_id / comment_id はon delete cascadeのため、返信といいねも合わせて削除される。
  const { error } = await supabase.from("announcement_comments").delete().eq("id", commentId);
  if (error) return { error: `コメントの削除に失敗しました: ${error.message}` };

  revalidatePath(`/announcements/${announcementId}`);
  return { success: true };
}

export async function toggleAnnouncementCommentLike(commentId: string, announcementId: string, liked: boolean) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = liked
    ? await supabase.from("announcement_comment_likes").delete().eq("comment_id", commentId).eq("user_id", profile.id)
    : await supabase.from("announcement_comment_likes").insert({ comment_id: commentId, user_id: profile.id });
  if (error) return { error: `いいねの更新に失敗しました: ${error.message}` };

  revalidatePath(`/announcements/${announcementId}`);
  return { success: true };
}
