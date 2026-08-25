"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";
import { eventSchema } from "@/lib/validations/event";
import { jstWallClockToUtcIso } from "@/lib/utils";

export type ActionResult = { error?: string } | void;

function parseEventFormData(formData: FormData) {
  const targetFloors = formData
    .getAll("target_floors")
    .map((v) => Number(v))
    .filter((v) => !Number.isNaN(v));

  const capacityRaw = formData.get("capacity");
  const feeAmountRaw = formData.get("fee_amount");

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
    requires_registration: true,
    capacity: capacityRaw ? Number(capacityRaw) : undefined,
    fee_amount: feeAmountRaw ? Number(feeAmountRaw) : undefined,
    payment_info: formData.get("payment_info") ?? "",
    publish_at: formData.get("publish_at") ?? "",
    registration_opens_at: formData.get("registration_opens_at") ?? "",
    registration_closes_at: formData.get("registration_closes_at") ?? "",
    target_floors: targetFloors,
    survey_type: formData.get("survey_type") ?? "none",
    survey_external_url: formData.get("survey_external_url") ?? "",
    location_url: formData.get("location_url") ?? "",
    contact_info: formData.get("contact_info") ?? "",
    notes: formData.get("notes") ?? "",
    is_pinned: formData.get("is_pinned") === "on",
    member_ids: formData.getAll("member_ids").map(String),
    all_ra_members: formData.get("all_ra_members") === "on",
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
      event_date: jstWallClockToUtcIso(parsed.data.event_date),
      requires_registration: true,
      capacity: parsed.data.capacity ?? null,
      fee_amount: parsed.data.fee_amount ?? null,
      payment_info: parsed.data.payment_info || null,
      publish_at: parsed.data.publish_at ? jstWallClockToUtcIso(parsed.data.publish_at) : null,
      registration_opens_at:
        parsed.data.registration_opens_at
          ? jstWallClockToUtcIso(parsed.data.registration_opens_at)
          : null,
      registration_closes_at:
        parsed.data.registration_closes_at
          ? jstWallClockToUtcIso(parsed.data.registration_closes_at)
          : null,
      target_floors: parsed.data.target_floors.length ? parsed.data.target_floors : null,
      survey_type: parsed.data.survey_type,
      survey_external_url:
        parsed.data.survey_type === "external" ? parsed.data.survey_external_url : null,
      location_url: parsed.data.location_url || null,
      contact_info: parsed.data.contact_info || null,
      notes: parsed.data.notes || null,
      is_pinned: parsed.data.is_pinned,
      member_ids: parsed.data.all_ra_members ? [] : parsed.data.member_ids,
      all_ra_members: parsed.data.all_ra_members,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: `作成に失敗しました: ${error?.message ?? ""}` };
  }

  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect(`/events/${data.id}?created=1`);
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
      event_date: jstWallClockToUtcIso(parsed.data.event_date),
      requires_registration: true,
      capacity: parsed.data.capacity ?? null,
      fee_amount: parsed.data.fee_amount ?? null,
      payment_info: parsed.data.payment_info || null,
      publish_at: parsed.data.publish_at ? jstWallClockToUtcIso(parsed.data.publish_at) : null,
      registration_opens_at:
        parsed.data.registration_opens_at
          ? jstWallClockToUtcIso(parsed.data.registration_opens_at)
          : null,
      registration_closes_at:
        parsed.data.registration_closes_at
          ? jstWallClockToUtcIso(parsed.data.registration_closes_at)
          : null,
      target_floors: parsed.data.target_floors.length ? parsed.data.target_floors : null,
      survey_type: parsed.data.survey_type,
      survey_external_url:
        parsed.data.survey_type === "external" ? parsed.data.survey_external_url : null,
      location_url: parsed.data.location_url || null,
      contact_info: parsed.data.contact_info || null,
      notes: parsed.data.notes || null,
      is_pinned: parsed.data.is_pinned,
      member_ids: parsed.data.all_ra_members ? [] : parsed.data.member_ids,
      all_ra_members: parsed.data.all_ra_members,
    })
    .eq("id", eventId);

  if (error) {
    return { error: `更新に失敗しました: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");
  redirect(`/events/${eventId}?updated=1`);
}

export async function deleteEvent(eventId: string) {
  await requireRa();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    throw new Error(`削除に失敗しました: ${error.message}`);
  }

  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
