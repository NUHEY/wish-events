import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ParticipantTable } from "@/components/participants/participant-table";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("id, title").eq("id", id).maybeSingle();
  if (!event) notFound();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("user_id, registered_at, users(full_name, student_id, floor_number, room_number)")
    .eq("event_id", id)
    .order("registered_at", { ascending: true });

  const participants = (registrations ?? []).map((r: any) => ({
    user_id: r.user_id,
    registered_at: r.registered_at,
    full_name: r.users?.full_name ?? null,
    student_id: r.users?.student_id ?? null,
    floor_number: r.users?.floor_number ?? null,
    room_number: r.users?.room_number ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">参加者一覧: {event.title}</h1>
      <ParticipantTable eventId={id} eventTitle={event.title} participants={participants} />
    </div>
  );
}
