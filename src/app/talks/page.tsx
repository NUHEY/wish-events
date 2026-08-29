import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Building2, MessageCircle, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFriendDmThreads } from "@/actions/direct-messages";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { TalksTabBar, type TalksTab } from "@/components/community/talks-tab-bar";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { getDictionary, getLocale } from "@/lib/i18n";

type EventThread = {
  event_id: string; title: string; title_en: string | null; event_date: string; poster_url: string | null;
  last_message_body: string | null; last_message_type: string | null; last_message_at: string | null; unread: boolean;
};

type FloorThread = {
  floor_number: number;
  last_message_body: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  unread: boolean;
  member_count: number;
};

function compactTime(value: string | null, locale: "ja" | "en") {
  if (!value) return "";
  const date = new Date(value); const now = new Date();
  const formatLocale = locale === "en" ? "en-US" : "ja-JP";
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(formatLocale, { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString(formatLocale, { month: "numeric", day: "numeric" });
}

export default async function TalksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [supabase, friendDmState, floorGroupState] = await Promise.all([
    createClient(),
    getFeatureFlagState("friend_dm"),
    getFeatureFlagState("floor_group_chat"),
  ]);
  const tab: TalksTab = tabParam === "friends" && friendDmState !== "hidden"
    ? "friends"
    : tabParam === "floor" && floorGroupState !== "hidden"
      ? "floor"
      : "events";
  const [{ data: eventRows }, friendResult, { data: floorRows }] = await Promise.all([
    tab === "events" ? supabase.rpc("event_talk_threads") : Promise.resolve({ data: [] as EventThread[] }),
    tab === "friends" ? getFriendDmThreads() : friendDmState === "hidden" ? Promise.resolve({ data: false }) : supabase.rpc("has_unread_direct_messages"),
    floorGroupState === "hidden" ? Promise.resolve({ data: [] as FloorThread[] }) : supabase.rpc("floor_group_thread"),
  ]);
  const rooms = (eventRows ?? []) as EventThread[];
  const floorThread = ((floorRows ?? []) as FloorThread[])[0] ?? null;
  const friendThreads = tab === "friends" ? friendResult as Awaited<ReturnType<typeof getFriendDmThreads>> : [];
  const hasUnreadFriends = tab === "friends" ? friendThreads.some((thread) => thread.unread) : !!(friendResult as { data: boolean | null }).data;
  const hasUnreadFloor = !!floorThread?.unread;

  return (
    <div data-chat-theme="aurora" className="mx-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--chat-border-strong)] bg-[var(--chat-bg-main)] shadow-[var(--chat-shadow-lg)]">
      <header className="border-b border-[var(--chat-border)] bg-[var(--chat-bg-header)] px-4 pb-3 pt-5 backdrop-blur-xl sm:px-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">WISH community</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--chat-text-primary)]">{dict.talks.title}</h1>
            <p className="mt-1 text-sm text-[var(--chat-text-secondary)]">{dict.talks.subtitle}</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--chat-shadow-md)]">
            <MessageCircle className="h-5 w-5" />
          </span>
        </div>
        <TalksTabBar hasUnreadFloor={hasUnreadFloor} hasUnreadFriends={hasUnreadFriends} floorGroupState={floorGroupState} friendDmState={friendDmState} />
      </header>

      <div className="min-h-[22rem] space-y-1 bg-[linear-gradient(180deg,var(--chat-bg-sidebar),var(--chat-bg-main)_7rem)] p-2 sm:p-3">
        {tab === "events" && (
          <>
            {rooms.map((event) => {
              const preview = event.last_message_type === "image" ? dict.talks.imageReceived : event.last_message_body?.trim() || dict.talks.openEventTalk;
              return (
                <Link key={event.event_id} href={`/talks/${event.event_id}`} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors active:bg-[var(--chat-accent-soft)] sm:hover:border-[var(--chat-border)] sm:hover:bg-[var(--chat-bg-main)]">
                  <span className="relative shrink-0">
                    {event.poster_url ? <Image src={event.poster_url} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover shadow-[var(--chat-shadow-sm)]" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-6 w-6" /></span>}
                    {event.unread && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--chat-bg-main)] bg-destructive" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className={`truncate text-[15px] text-[var(--chat-text-primary)] ${event.unread ? "font-bold" : "font-semibold"}`}>{locale === "en" && event.title_en ? event.title_en : event.title}</span>{event.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}</span>
                    <span className={`mt-1 block truncate text-[13px] ${event.unread ? "font-medium text-[var(--chat-text-primary)]" : "text-[var(--chat-text-secondary)]"}`}>{preview}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-2"><span className={`text-[11px] ${event.unread ? "font-semibold text-primary" : "text-[var(--chat-text-tertiary)]"}`}>{compactTime(event.last_message_at, locale)}</span><ArrowUpRight className="h-4 w-4 text-[var(--chat-text-tertiary)] transition-transform group-active:translate-x-0.5" /></span>
                </Link>
              );
            })}
            {rooms.length === 0 && <EmptyEvents label={dict.talks.noEventTalks} />}
          </>
        )}

        {tab === "floor" && (floorThread ? (
          <Link href="/talks/floor" className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors active:bg-[var(--chat-accent-soft)] sm:hover:border-[var(--chat-border)] sm:hover:bg-[var(--chat-bg-main)]">
            <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" />{floorThread.unread && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--chat-bg-main)] bg-destructive" />}</span>
            <span className="min-w-0 flex-1"><span className={`block truncate text-[15px] text-[var(--chat-text-primary)] ${floorThread.unread ? "font-bold" : "font-semibold"}`}>{dict.talks.floorGroup.replace("{floor}", String(floorThread.floor_number))}</span><span className="mt-1 block truncate text-[13px] text-[var(--chat-text-secondary)]">{floorThread.last_message_body?.trim() || dict.talks.floorInvitation}</span><span className="mt-1 flex items-center gap-1 text-[11px] text-[var(--chat-text-tertiary)]"><Users className="h-3 w-3" />{dict.talks.memberCount.replace("{count}", String(floorThread.member_count))}</span></span>
            <span className={`self-start pt-1 text-[11px] ${floorThread.unread ? "font-semibold text-primary" : "text-[var(--chat-text-tertiary)]"}`}>{compactTime(floorThread.last_message_at, locale)}</span>
          </Link>
        ) : <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-[var(--chat-text-secondary)]"><Building2 className="h-8 w-8" /><p>{dict.talks.floorProfileRequired}</p><Link href="/profile/edit" className="font-semibold text-primary">{dict.talks.checkProfile}</Link></div>)}

        {tab === "friends" && (
          <>
            {friendThreads.map((thread) => {
              const friend = thread.friend!;
              const preview = thread.last_message_type === "image" ? (thread.last_message_body?.trim() ? `📷 ${thread.last_message_body}` : dict.talks.imageReceived) : thread.last_message_body ?? dict.talks.startConversation;
              return (
                <Link key={thread.friend_id} href={`/talks/friends/${thread.friend_id}`} className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors active:bg-[var(--chat-accent-soft)] sm:hover:border-[var(--chat-border)] sm:hover:bg-[var(--chat-bg-main)]">
                  <span className="relative shrink-0"><AvatarRing role={friend.role} size={56}><Image src={friend.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" /></AvatarRing>{thread.unread && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-[var(--chat-bg-main)] bg-destructive" />}</span>
                  <span className="min-w-0 flex-1"><span className={`block truncate text-[15px] text-[var(--chat-text-primary)] ${thread.unread ? "font-bold" : "font-semibold"}`}>{friend.full_name ?? dict.talks.residentFallback}</span><span className={`mt-1 block truncate text-[13px] ${thread.unread ? "font-medium text-[var(--chat-text-primary)]" : "text-[var(--chat-text-secondary)]"}`}>{preview}</span></span>
                  <span className={`self-start pt-1 text-[11px] ${thread.unread ? "font-semibold text-primary" : "text-[var(--chat-text-tertiary)]"}`}>{compactTime(thread.last_message_at, locale)}</span>
                </Link>
              );
            })}
            {friendThreads.length === 0 && <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-[var(--chat-text-secondary)]"><UserPlus className="h-7 w-7" /><p>{dict.talks.noFriends}</p><Link href="/directory" className="font-semibold text-primary">{dict.talks.viewDirectory}</Link></div>}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyEvents({ label }: { label: string }) { return <div className="py-16 text-center text-sm text-[var(--chat-text-secondary)]">{label}</div>; }
