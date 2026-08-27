import { notFound } from "next/navigation";
import { ScheduleRoom } from "@/components/tools/schedule-room";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";
import type { ScheduleAvailability, ScheduleBooking, ScheduleParticipant, ScheduleSession } from "@/lib/beta-tools";

export default async function ScheduleRoomPage({ params }: { params: { token: string } }) {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: sessionData } = await supabase.from("schedule_sessions").select("*").eq("share_token", params.token).maybeSingle();
  if (!sessionData) notFound();
  const session = sessionData as ScheduleSession;
  const [{ data: participantRows }, { data: availabilityRows }, { data: bookingRows }, { data: profiles }, openResult] = await Promise.all([
    supabase.from("schedule_participants").select("*").eq("session_id", session.id),
    supabase.from("schedule_availability").select("*").eq("session_id", session.id).order("start_at"),
    supabase.from("schedule_bookings").select("*").eq("session_id", session.id).eq("status", "confirmed").order("start_at"),
    supabase.rpc("directory_profiles"),
    session.kind === "lets_chat" ? supabase.rpc("available_lets_chat_slots", { p_session_id: session.id }) : Promise.resolve({ data: [] }),
  ]);
  const directory = (profiles ?? []) as DirectoryProfileRow[];
  const personById = new Map(directory.map((person) => [person.id, person]));
  const participants = ((participantRows ?? []) as ScheduleParticipant[]).map((participant) => ({ ...participant, full_name: personById.get(participant.user_id)?.full_name, avatar_url: personById.get(participant.user_id)?.avatar_url, floor_number: personById.get(participant.user_id)?.floor_number, room_number: personById.get(participant.user_id)?.room_number }));
  const bookings = ((bookingRows ?? []) as ScheduleBooking[]).map((booking) => ({ ...booking, resident_name: personById.get(booking.resident_id)?.full_name, ra_name: personById.get(booking.ra_id)?.full_name }));
  return <ScheduleRoom session={session} participants={participants} availability={(availabilityRows ?? []) as ScheduleAvailability[]} openLetsChatSlots={(openResult.data ?? []) as { ra_id: string; start_at: string; end_at: string }[]} bookings={bookings} currentUserId={profile.id} currentUserRole={profile.role} />;
}
