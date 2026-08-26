import Link from "next/link";
import Image from "next/image";
import { MessageCircle, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFriendDmThreads } from "@/actions/direct-messages";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { TalksTabBar, type TalksTab } from "@/components/community/talks-tab-bar";
import { getFeatureFlagState } from "@/lib/feature-flags";

type EventThread = {
  event_id: string; title: string; title_en: string | null; event_date: string; poster_url: string | null;
  last_message_body: string | null; last_message_type: string | null; last_message_at: string | null; unread: boolean;
};

function compactTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value); const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

export default async function TalksPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const [supabase, friendDmState] = await Promise.all([createClient(), getFeatureFlagState("friend_dm")]);
  const tab: TalksTab = tabParam === "friends" && friendDmState !== "hidden" ? "friends" : "events";
  const [{ data: eventRows }, friendResult] = await Promise.all([
    tab === "events" ? supabase.rpc("event_talk_threads") : Promise.resolve({ data: [] as EventThread[] }),
    tab === "friends" ? getFriendDmThreads() : friendDmState === "hidden" ? Promise.resolve({ data: false }) : supabase.rpc("has_unread_direct_messages"),
  ]);
  const rooms = (eventRows ?? []) as EventThread[];
  const friendThreads = tab === "friends" ? friendResult as Awaited<ReturnType<typeof getFriendDmThreads>> : [];
  const hasUnreadFriends = tab === "friends" ? friendThreads.some((thread) => thread.unread) : !!(friendResult as { data: boolean | null }).data;

  return <div className="mx-auto flex max-w-2xl flex-col gap-4">
    <div className="flex flex-col items-stretch gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold">メッセージ</h1><p className="mt-0.5 text-sm text-muted-foreground">イベントと友達からの新着を確認できます。</p></div><TalksTabBar hasUnreadFriends={hasUnreadFriends} friendDmState={friendDmState} /></div>
    {tab === "events" ? <div className="divide-y divide-border/70">{rooms.map((event) => {
      const preview = event.last_message_type === "image" ? `写真が届きました` : event.last_message_body?.trim() || "イベントのトークを開く";
      return <Link key={event.event_id} href={`/talks/${event.event_id}`} className="group flex items-center gap-3 px-1 py-3 transition-colors active:bg-secondary/60 sm:hover:bg-secondary/35">
        <span className="relative shrink-0">{event.poster_url ? <Image src={event.poster_url} alt="" width={58} height={58} className="h-[58px] w-[58px] rounded-full object-cover ring-2 ring-primary/15 ring-offset-2 ring-offset-background" /> : <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/15 ring-offset-2"><MessageCircle className="h-6 w-6" /></span>}{event.unread && <span className="absolute -right-0.5 top-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive" />}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className={`truncate text-[15px] ${event.unread ? "font-bold" : "font-semibold"}`}>{event.title}</span>{event.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />}</span><span className={`mt-1 block truncate text-sm ${event.unread ? "font-medium text-foreground/75" : "text-muted-foreground"}`}>{preview}</span></span>
        <span className={`self-start pt-1 text-[11px] ${event.unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>{compactTime(event.last_message_at)}</span>
      </Link>;
    })}{rooms.length === 0 && <EmptyEvents />}</div> : <div className="divide-y divide-border/70">{friendThreads.map((thread) => {
      const friend = thread.friend!; const preview = thread.last_message_type === "image" ? (thread.last_message_body?.trim() ? `📷 ${thread.last_message_body}` : "写真が届きました") : thread.last_message_body ?? "メッセージを送ってみましょう";
      return <Link key={thread.friend_id} href={`/talks/friends/${thread.friend_id}`} className="group flex items-center gap-3 px-1 py-3 transition-colors active:bg-secondary/60 sm:hover:bg-secondary/35"><span className="relative shrink-0"><AvatarRing role={friend.role} size={58}><Image src={friend.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={58} height={58} className="h-[58px] w-[58px] rounded-full object-cover" /></AvatarRing>{thread.unread && <span className="absolute -right-0.5 top-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-destructive" />}</span><span className="min-w-0 flex-1"><span className={`block truncate text-[15px] ${thread.unread ? "font-bold" : "font-semibold"}`}>{friend.full_name ?? "寮生"}</span><span className={`mt-1 block truncate text-sm ${thread.unread ? "font-medium text-foreground/75" : "text-muted-foreground"}`}>{preview}</span></span><span className={`self-start pt-1 text-[11px] ${thread.unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>{compactTime(thread.last_message_at)}</span></Link>;
    })}{friendThreads.length === 0 && <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground"><UserPlus className="h-6 w-6" /><p>まだ友達がいません。<br />寮生ディレクトリから友達申請してみましょう。</p><Link href="/directory" className="text-sm font-medium text-primary hover:underline">ディレクトリを見る</Link></div>}</div>}
  </div>;
}

function EmptyEvents() { return <div className="py-14 text-center text-sm text-muted-foreground">参加したイベントはまだありません。</div>; }
