import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RaRoomManager } from "@/components/dashboard/ra-room-manager";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function RaRoomsPage() {
  const profile = await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [{ data: rooms }, { data: raUsers }] = await Promise.all([
    supabase
      .from("ra_rooms")
      .select("*")
      .order("floor_number", { ascending: true })
      .order("room_number", { ascending: true }),
    supabase
      .from("users")
      .select("*")
      .eq("role", "ra")
      .order("floor_number", { ascending: true }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{dict.raRooms.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.raRooms.subtitle}</p>
      </div>
      <RaRoomManager rooms={rooms ?? []} raUsers={raUsers ?? []} currentUserId={profile.id} />
    </div>
  );
}
