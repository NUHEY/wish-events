import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { notFound } from "next/navigation";
import { ScheduleRoom } from "@/components/tools/schedule-room";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";
import type { ScheduleAvailability, ScheduleBooking, ScheduleParticipant, ScheduleSession } from "@/lib/beta-tools";

export default async function ScheduleRoomPage({ params }: { params: { token: string } }) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: sessionData, error: sessionError } = await supabase.from("schedule_sessions").select("*").eq("share_token", params.token).maybeSingle();
  if (sessionError) throw new Error("日程を読み込めませんでした。再読み込みしてください。");
  if (!sessionData) notFound();
  const session = sessionData as ScheduleSession;
  const isBookingResident = session.kind === "lets_chat" && session.status === "open" && profile.account_kind === "resident" && profile.role === "resident" && profile.floor_number === session.floor_number;
  const [{ data: participantRows, error: participantError }, { data: availabilityRows, error: availabilityError }, { data: bookingRows, error: bookingError }, { data: profiles, error: profilesError }, openResult, eligibilityResult] = await Promise.all([
    supabase.from("schedule_participants").select("*").eq("session_id", session.id),
    supabase.from("schedule_availability").select("*").eq("session_id", session.id).order("start_at"),
    supabase.from("schedule_bookings").select("*").eq("session_id", session.id).eq("status", "confirmed").order("start_at"),
    supabase.rpc("directory_profiles"),
    session.kind === "lets_chat" ? supabase.rpc("available_lets_chat_slots", { p_session_id: session.id }) : Promise.resolve({ data: [], error: null }),
    isBookingResident ? supabase.rpc("is_current_new_resident", { p_user_id: profile.id }) : Promise.resolve({ data: false, error: null }),
  ]);
  if (participantError || availabilityError || bookingError || profilesError || openResult.error || eligibilityResult.error) throw new Error("日程の情報をすべて読み込めませんでした。保存せず再読み込みしてください。");
  const directory = (profiles ?? []) as DirectoryProfileRow[];
  const personById = new Map(directory.map((person) => [person.id, person]));
  const participants = ((participantRows ?? []) as ScheduleParticipant[]).map((participant) => ({ ...participant, full_name: personById.get(participant.user_id)?.full_name, avatar_url: personById.get(participant.user_id)?.avatar_url, floor_number: personById.get(participant.user_id)?.floor_number, room_number: personById.get(participant.user_id)?.room_number, faculty: personById.get(participant.user_id)?.faculty, languages: personById.get(participant.user_id)?.languages, self_intro: personById.get(participant.user_id)?.self_intro }));
  const bookings = ((bookingRows ?? []) as ScheduleBooking[]).map((booking) => ({ ...booking, resident_name: personById.get(booking.resident_id)?.full_name, ra_name: personById.get(booking.ra_id)?.full_name }));
  return <ScheduleRoom session={session} participants={participants} availability={(availabilityRows ?? []) as ScheduleAvailability[]} openLetsChatSlots={(openResult.data ?? []) as { ra_id: string; start_at: string; end_at: string }[]} bookings={bookings} currentUserId={profile.id} canBook={isBookingResident && eligibilityResult.data === true} canManageBookings={canManage(await getManagementAccess(), "schedules")} />;
}
