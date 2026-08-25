import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MoveOutConfirm } from "@/components/move-out/move-out-confirm";
import { MoveOutCelebration } from "@/components/move-out/move-out-cards";

export default async function MoveOutPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("registered_at, events(id, title, title_en, category, event_date, poster_url)")
    .eq("user_id", profile.id)
    .order("registered_at", { ascending: true });

  const events = (registrations ?? [])
    .map((r: any) => r.events)
    .filter(Boolean);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {profile.moved_out_at ? (
        <MoveOutCelebration fullName={profile.full_name} events={events} />
      ) : (
        <MoveOutConfirm fullName={profile.full_name} events={events} />
      )}
    </div>
  );
}
