"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";

export async function setPaymentStatus(registrationId: string, eventId: string, status: "unpaid" | "paid" | "waived") {
  const profile = await requireRa();
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
