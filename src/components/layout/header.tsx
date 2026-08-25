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
  const { data: hasUnreadTalk } = await supabase.rpc("has_unread_talks");

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
            <Nav role={profile.role} hasUnreadTalk={!!hasUnreadTalk} />
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
      <MobileTabBar hasUnreadTalk={!!hasUnreadTalk} />
    </>
  );
}
