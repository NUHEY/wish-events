import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/nav";
import { UserMenu } from "@/components/layout/user-menu";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { getFriendDmThreads } from "@/actions/direct-messages";
import {
  institutionalAccountKindForEmail,
  institutionalAvatarUrl,
  institutionalDisplayName,
} from "@/lib/institutional-accounts";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, account_kind, floor_number, room_number, avatar_url, moved_out_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  // Keep sign-out available on the farewell page without querying community data.
  if (profile.account_kind === "resident" && profile.moved_out_at) {
    return <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3"><span className="font-bold">WISH Events</span><SignOutButton /></div></header>;
  }
  const configuredAccountKind = profile.account_kind === "service_desk" || profile.account_kind === "university_staff"
    ? profile.account_kind : institutionalAccountKindForEmail(user.email);
  const accountKind = configuredAccountKind ?? profile.account_kind;
  const fullName = configuredAccountKind ? institutionalDisplayName(configuredAccountKind) : profile.full_name;
  const avatarUrl = configuredAccountKind ? institutionalAvatarUrl(configuredAccountKind) : profile.avatar_url;
  const [{ data: hasUnreadEventTalk }, friendThreads, { data: hasUnreadNotifications }] = await Promise.all([
    supabase.rpc("has_unread_event_talk"),
    getFriendDmThreads(),
    supabase.rpc("has_unread_notifications"),
  ]);
  const hasUnreadTalk = !!hasUnreadEventTalk || friendThreads.some((t) => t.unread);

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
              fullName={fullName}
              role={profile.role}
              accountKind={accountKind}
              floorNumber={profile.floor_number}
              roomNumber={profile.room_number}
              avatarUrl={avatarUrl}
            />
          </div>
        </div>
      </header>
      <MobileTabBar hasUnreadTalk={hasUnreadTalk} />
    </>
  );
}
