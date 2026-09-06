import Link from "next/link";
import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFriendDmThreads } from "@/actions/direct-messages";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { TalkList, type TalkItem } from "@/components/community/talk-list";
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

export default async function TalksPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [supabase, friendDmState, floorGroupState, directoryState] = await Promise.all([
    createClient(),
    getFeatureFlagState("friend_dm"),
    getFeatureFlagState("floor_group_chat"),
    getFeatureFlagState("resident_directory"),
  ]);
  const [{ data: eventRows, error: eventError }, friendThreads, { data: floorRows, error: floorError }] = await Promise.all([
    supabase.rpc("event_talk_threads"),
    friendDmState === "hidden" ? Promise.resolve([]) : getFriendDmThreads(),
    floorGroupState === "hidden" ? Promise.resolve({ data: [] as FloorThread[], error: null }) : supabase.rpc("floor_group_thread"),
  ]);
  if (eventError || floorError) throw new Error(locale === "en" ? "Could not load conversations. Please retry." : "トークを読み込めませんでした。再読み込みしてください。");
  const threads: TalkItem[] = ((eventRows ?? []) as EventThread[]).map(event => ({
    href: `/talks/${event.event_id}`,
    title: locale === "en" && event.title_en ? event.title_en : event.title,
    image: event.poster_url,
    preview: event.last_message_type === "image" ? dict.talks.imageReceived : event.last_message_body?.trim() || dict.talks.openEventTalk,
    lastMessageAt: event.last_message_at,
    unread: event.unread,
  }));
  for (const floor of (floorRows ?? []) as FloorThread[]) {
    threads.push({
      href: "/talks/floor",
      title: dict.talks.floorGroup.replace("{floor}", String(floor.floor_number)),
      image: null,
      floor: true,
      preview: floor.last_message_body?.trim() || dict.talks.floorInvitation,
      lastMessageAt: floor.last_message_at,
      unread: floor.unread,
    });
  }
  for (const thread of friendThreads) {
    const friend = thread.friend;
    if (!friend) continue;
    threads.push({
      href: `/talks/friends/${thread.friend_id}`,
      title: friend.full_name ?? dict.talks.residentFallback,
      image: friend.avatar_url || DEFAULT_AVATAR_IMAGE_URL,
      preview: thread.last_message_type === "image"
        ? (thread.last_message_body?.trim() ? `📷 ${thread.last_message_body}` : dict.talks.imageReceived)
        : thread.last_message_body?.trim() || dict.talks.startConversation,
      lastMessageAt: thread.last_message_at,
      unread: thread.unread,
    });
  }
  threads.sort((a, b) => (b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0) - (a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-3 flex items-center justify-between gap-3 px-1">
        <h1 className="text-2xl font-bold tracking-tight">{dict.talks.title}</h1>
        {friendDmState !== "hidden" && directoryState !== "hidden" && <Link href="/directory" aria-label={dict.talks.viewDirectory} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><UserPlus aria-hidden="true" className="h-5 w-5" /></Link>}
      </header>
      <TalkList threads={threads.map(thread => ({ ...thread, timeLabel: compactTime(thread.lastMessageAt, locale) }))} locale={locale} />
    </div>
  );
}
