import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, floor_number, room_number, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const { data: registrations } = await supabase.from("registrations").select("event_id").eq("user_id", user.id);
  const eventIds = (registrations ?? []).map((registration) => registration.event_id);
  const [{ data: reads }, { data: messages }] = eventIds.length
    ? await Promise.all([
        supabase.from("event_chat_reads").select("event_id, last_read_at").eq("user_id", user.id),
        supabase.from("event_messages").select("event_id, sender_id, created_at").in("event_id", eventIds),
      ])
    : [{ data: [] }, { data: [] }];
  const lastReadByEvent = new Map((reads ?? []).map((read) => [read.event_id, read.last_read_at]));
  const hasUnreadTalk = (messages ?? []).some((message) => message.sender_id !== user.id && message.created_at > (lastReadByEvent.get(message.event_id) ?? "1970-01-01T00:00:00Z"));

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-5">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                W
              </span>
              <span className="text-lg font-bold tracking-tight">WISH Events</span>
            </Link>
            <Nav role={profile.role} hasUnreadTalk={hasUnreadTalk} />
          </div>
          <div className="flex items-center gap-2.5">
            <UserMenu
              userId={user.id}
              fullName={profile.full_name}
              role={profile.role}
              floorNumber={profile.floor_number}
              roomNumber={profile.room_number}
              avatarUrl={profile.avatar_url}
            />
          </div>
        </div>
      </header>
      <MobileTabBar hasUnreadTalk={hasUnreadTalk} />
    </>
  );
}
