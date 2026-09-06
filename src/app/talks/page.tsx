import Link from "next/link";
import Image from "next/image";
import { Building2, MessageCircle, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFriendDmThreads } from "@/actions/direct-messages";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
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

type TalkItem = {
  href: string;
  title: string;
  image: string | null;
  floor?: boolean;
  preview: string;
  lastMessageAt: string | null;
  unread: boolean;
};

export default async function TalksPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [supabase, friendDmState, floorGroupState] = await Promise.all([
    createClient(),
    getFeatureFlagState("friend_dm"),
    getFeatureFlagState("floor_group_chat"),
  ]);
  const [{ data: eventRows }, friendThreads, { data: floorRows }] = await Promise.all([
    supabase.rpc("event_talk_threads"),
    friendDmState === "hidden" ? Promise.resolve([]) : getFriendDmThreads(),
    floorGroupState === "hidden" ? Promise.resolve({ data: [] as FloorThread[] }) : supabase.rpc("floor_group_thread"),
  ]);
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
        {friendDmState !== "hidden" && <Link href="/directory" aria-label={dict.talks.viewDirectory} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"><UserPlus aria-hidden="true" className="h-5 w-5" /></Link>}
      </header>
      <ul aria-label={dict.talks.title}>
        {threads.map(thread => (
          <li key={thread.href}>
            <Link href={thread.href} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-secondary/50 active:bg-secondary sm:px-3">
              {thread.image ? <Image src={thread.image} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">{thread.floor ? <Building2 aria-hidden="true" className="h-6 w-6" /> : <MessageCircle aria-hidden="true" className="h-6 w-6" />}</span>}
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] ${thread.unread ? "font-bold" : "font-medium"}`}>{thread.title}</span>
                <span className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
                  <span className={`min-w-0 flex-1 truncate ${thread.unread ? "font-medium text-foreground" : ""}`}>{thread.preview}</span>
                  {thread.lastMessageAt && <time dateTime={thread.lastMessageAt} className="shrink-0 text-xs">{compactTime(thread.lastMessageAt, locale)}</time>}
                </span>
              </span>
              {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary"><span className="sr-only">{locale === "en" ? "Unread" : "未読"}</span></span>}
            </Link>
          </li>
        ))}
      </ul>
      {threads.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">{locale === "en" ? "No conversations yet." : "まだトークはありません。"}</p>}
    </div>
  );
}
