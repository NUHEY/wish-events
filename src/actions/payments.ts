"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setPaymentStatus(registrationId: string, eventId: string, status: "unpaid" | "paid" | "waived") {
  const profile = await requireManagement("events");
  const supabase = await createClient();
  const { error } = await supabase.from("registration_payments").upsert({
    registration_id: registrationId,
    status,
    confirmed_at: status === "unpaid" ? null : new Date().toISOString(),
    confirmed_by: status === "unpaid" ? null : profile.id,
  });
  if (error) return { error: `支払い状況の更新に失敗しました: ${error.message}` };
  revalidatePath(`/dashboard/${eventId}/participants`);
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
