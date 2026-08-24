"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { eventSchema } from "@/lib/validations/event";

export type ActionResult = { error?: string } | void;

function parseEventFormData(formData: FormData) {
  const targetFloors = formData
    .getAll("target_floors")
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v));

  const capacityRaw = formData.get("capacity");

  return eventSchema.safeParse({
    title: formData.get("title"),
    title_en: formData.get("title_en") ?? "",
    category: formData.get("category"),
    description: formData.get("description") ?? "",
    description_en: formData.get("description_en") ?? "",
    poster_url: formData.get("poster_url") ?? "",
    location: formData.get("location") ?? "",
    location_en: formData.get("location_en") ?? "",
    target_audience: formData.get("target_audience") ?? "",
    target_audience_en: formData.get("target_audience_en") ?? "",
    event_date: formData.get("event_date"),
    requires_registration: formData.get("requires_registration") === "on",
    capacity: capacityRaw ? Number(capacityRaw) : undefined,
    target_floors: targetFloors,
    survey_type: formData.get("survey_type") ?? "none",
    survey_external_url: formData.get("survey_external_url") ?? "",
  });
}

export async function createEvent(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const profile = await requireRa();
  const parsed = parseEventFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: parsed.data.title,
      title_en: parsed.data.title_en || null,
      category: parsed.data.category,
      description: parsed.data.description || null,
      description_en: parsed.data.description_en || null,
      poster_url: parsed.data.poster_url || null,
      location: parsed.data.location || null,
      location_en: parsed.data.location_en || null,
      target_audience: parsed.data.target_audience || null,
      target_audience_en: parsed.data.target_audience_en || null,
      event_date: new Date(parsed.data.event_date).toISOString(),
      requires_registration: parsed.data.requires_registration,
      capacity: parsed.data.requires_registration ? parsed.data.capacity : null,
      target_floors: parsed.data.target_floors.length ? parsed.data.target_floors : null,
      survey_type: parsed.data.survey_type,
      survey_external_url:
        parsed.data.survey_type === "external" ? parsed.data.survey_external_url : null,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `作成に失敗しました: ${error?.message ?? ""}` };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect(`/events/${data.id}`);
}

export async function updateEvent(
  eventId: string,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  await requireRa();
  const parsed = parseEventFormData(formData);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      title: parsed.data.title,
      title_en: parsed.data.title_en || null,
      category: parsed.data.category,
      description: parsed.data.description || null,
      description_en: parsed.data.description_en || null,
      poster_url: parsed.data.poster_url || null,
      location: parsed.data.location || null,
      location_en: parsed.data.location_en || null,
      target_audience: parsed.data.target_audience || null,
      target_audience_en: parsed.data.target_audience_en || null,
      event_date: new Date(parsed.data.event_date).toISOString(),
      requires_registration: parsed.data.requires_registration,
      capacity: parsed.data.requires_registration ? parsed.data.capacity : null,
      target_floors: parsed.data.target_floors.length ? parsed.data.target_floors : null,
      survey_type: parsed.data.survey_type,
      survey_external_url:
        parsed.data.survey_type === "external" ? parsed.data.survey_external_url : null,
    })
    .eq("id", eventId);

  if (error) {
    return { error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(eventId: string) {
  await requireRa();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    throw new Error(`削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
