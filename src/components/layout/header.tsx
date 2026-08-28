import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { getFriendDmThreads } from "@/actions/direct-messages";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, account_kind, floor_number, room_number, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  const { data: registrations } = await supabase.from("registrations").select("event_id").eq("user_id", user.id);
  const eventIds = (registrations ?? []).map((registration) => registration.event_id);
  const [{ data: reads }, { data: messages }, friendThreads, { data: hasUnreadNotifications }] = await Promise.all([
    eventIds.length
      ? supabase.from("event_chat_reads").select("event_id, last_read_at").eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_messages").select("event_id, sender_id, created_at").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    getFriendDmThreads(),
    supabase.rpc("has_unread_notifications"),
  ]);
  const lastReadByEvent = new Map((reads ?? []).map((read) => [read.event_id, read.last_read_at]));
  const hasUnreadEventTalk = (messages ?? []).some((message) => message.sender_id !== user.id && message.created_at > (lastReadByEvent.get(message.event_id) ?? "1970-01-01T00:00:00Z"));
  const hasUnreadTalk = hasUnreadEventTalk || friendThreads.some((t) => t.unread);

  return (
    <>
      {/*
        sticky + backdrop-blur の組み合わせは、モバイルSafari等でスクロール中に
        コンポジットのシーム（継ぎ目）が生じ、固定部分の隙間から裏のコンテンツが
        一瞬見えてしまうことがある。isolate で独立したスタッキングコンテキストを作り、
        translateZ(0) で専用のコンポジットレイヤーを強制することでこれを防ぐ。
      */}
      <header className="sticky top-0 z-20 isolate border-b border-border bg-card/95 backdrop-blur-md [transform:translateZ(0)]">
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
          <div className="flex items-center gap-1">
            <NotificationBell hasUnread={!!hasUnreadNotifications} />
            <UserMenu
              userId={user.id}
              fullName={profile.full_name}
              role={profile.role}
              accountKind={profile.account_kind}
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
