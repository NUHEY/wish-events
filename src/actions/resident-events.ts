"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { DEFAULT_EVENT_PRESETS } from "@/lib/media-defaults";
import { jstWallClockToUtcIso } from "@/lib/utils";

export type ResidentEventActionResult = { error?: string } | void;

export async function createResidentEvent(_previous: ResidentEventActionResult, formData: FormData): Promise<ResidentEventActionResult> {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra" && (await getFeatureFlagState("resident_events")) === "hidden") return { error: "寮生イベント募集は現在公開されていません。" };
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || DEFAULT_EVENT_PRESETS[0].url;
  if (!title || title.length > 120) return { error: "タイトルは1〜120文字で入力してください。" };
  if (description.length > 1200) return { error: "説明は1200文字以内で入力してください。" };
  if (!eventDate) return { error: "開催日時を選択してください。" };
  if (capacity != null && (!Number.isInteger(capacity) || capacity < 2 || capacity > 100)) return { error: "定員は2〜100人で設定してください。" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_resident_event", { p_title: title, p_description: description, p_location: location, p_event_date: jstWallClockToUtcIso(eventDate), p_capacity: capacity, p_image_url: imageUrl });
  if (error || !data) return { error: `募集を作成できませんでした: ${error?.message ?? "不明なエラー"}` };
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/events/community");
  redirect(`/events/${data}?created=1`);
}

export async function deleteOwnResidentEvent(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId).eq("created_by", profile.id).eq("creator_type", "resident");
  if (error) return { error: `募集を削除できませんでした: ${error.message}` };
  revalidatePath("/"); revalidatePath("/events"); revalidatePath("/events/community");
  return { success: true };
}
