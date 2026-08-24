"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function registerForEvent(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .insert({ event_id: eventId, user_id: profile.id });

  if (error) {
    return { error: error.message.includes("duplicate")
      ? "既に申し込み済みです"
      : `申し込みに失敗しました: ${error.message}` };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function cancelRegistration(eventId: string) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", profile.id);

  if (error) {
    return { error: `キャンセルに失敗しました: ${error.message}` };
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

/** RA用: 参加者を強制的にキャンセルさせる（定員調整など） */
export async function removeRegistrationAsRa(eventId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/${eventId}/participants`);
  return { success: true };
}
