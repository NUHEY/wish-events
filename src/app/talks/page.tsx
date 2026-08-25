import Link from "next/link";
import Image from "next/image";
import { MessageCircle, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getEventTalkParticipantsBatch } from "@/actions/event-community";
import { getFriendDmThreads } from "@/actions/direct-messages";
import { AvatarStack } from "@/components/community/avatar-stack";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { TalksTabBar, type TalksTab } from "@/components/community/talks-tab-bar";
import { formatEventDateTime } from "@/lib/utils";

type TalkRoomEvent = {
  id: string;
  title: string;
  title_en: string | null;
  event_date: string;
  poster_url: string | null;
};

export default async function TalksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: TalksTab = tabParam === "friends" ? "friends" : "events";
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: registrations } = await supabase
    .from("registrations")
    .select("event_id, events(id, title, title_en, event_date, poster_url)")
    .eq("user_id", profile.id)
    .order("registered_at", { ascending: false })
    .returns<{ event_id: string; events: TalkRoomEvent | null }[]>();
  const rooms = (registrations ?? []).map((registration) => registration.events).filter(Boolean) as TalkRoomEvent[];
  const eventIds = rooms.map((event) => event.id);

  // 各トークルームの未読状態を判定する（下のアイコンバッジだけでなく、
  // 一覧の各行にも表示できるように）。参加者アイコン(AvatarStack)もここでまとめて取得する。
  // 友達タブの未読バッジをタブ切替前から出せるよう、友達スレッドは常に取得する。
  const [{ data: reads }, { data: messages }, participantsByEvent, friendThreads] = await Promise.all([
    eventIds.length
      ? supabase.from("event_chat_reads").select("event_id, last_read_at").eq("user_id", profile.id)
      : Promise.resolve({ data: [] }),
    eventIds.length
      ? supabase.from("event_messages").select("event_id, sender_id, created_at").in("event_id", eventIds)
      : Promise.resolve({ data: [] }),
    eventIds.length ? getEventTalkParticipantsBatch(eventIds) : Promise.resolve(new Map()),
    getFriendDmThreads(),
  ]);
  const lastReadByEvent = new Map((reads ?? []).map((read) => [read.event_id, read.last_read_at]));
  const unreadEventIds = new Set(
    (messages ?? [])
      .filter(
        (message) =>
          message.sender_id !== profile.id &&
          message.created_at > (lastReadByEvent.get(message.event_id) ?? "1970-01-01T00:00:00Z")
      )
      .map((message) => message.event_id)
  );
  const hasUnreadFriends = friendThreads.some((t) => t.unread);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">トーク</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === "events" ? "参加したイベントのお知らせと会話を確認できます。" : "友達同士でメッセージを送り合えます。"}
          </p>
        </div>
        <TalksTabBar hasUnreadFriends={hasUnreadFriends} />
      </div>

      {tab === "events" ? (
        <div className="flex flex-col gap-2">
          {rooms.map((event) => {
            const unread = unreadEventIds.has(event.id);
            const participantInfo = participantsByEvent.get(event.id);
            return (
              <Link
                key={event.id}
                href={`/talks/${event.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
              >
                <span className="relative shrink-0">
                  {event.poster_url ? (
                    <Image src={event.poster_url} alt="" width={56} height={56} className="h-14 w-14 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <MessageCircle className="h-6 w-6" />
                    </span>
                  )}
                  {unread && (
                    <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-red-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 truncate font-semibold ${unread ? "text-foreground" : ""}`}>
                    <span className="truncate">{event.title}</span>
                    {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatEventDateTime(event.event_date, "ja")}
                  </span>
                </span>
                {participantInfo && participantInfo.participants.length > 0 && (
                  <AvatarStack participants={participantInfo.participants} total={participantInfo.total} />
                )}
                <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
          {rooms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              参加したイベントはまだありません。
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {friendThreads.map((thread) => {
            const friend = thread.friend!;
            const preview =
              thread.last_message_type === "image"
                ? thread.last_message_body?.trim()
                  ? `📷 ${thread.last_message_body}`
                  : "📷 画像"
                : thread.last_message_body ?? null;
            return (
              <Link
                key={thread.friend_id}
                href={`/talks/friends/${thread.friend_id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
              >
                <span className="relative shrink-0">
                  <AvatarRing role={friend.role} size={56}>
                    {friend.avatar_url ? (
                      <Image src={friend.avatar_url} alt="" width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                        {friend.full_name?.charAt(0) ?? "?"}
                      </span>
                    )}
                  </AvatarRing>
                  {thread.unread && (
                    <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-red-500" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 truncate font-semibold ${thread.unread ? "text-foreground" : ""}`}>
                    <span className="truncate">{friend.full_name ?? "寮生"}</span>
                    {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {preview ?? "まだメッセージはありません。タップして送ってみましょう。"}
                  </span>
                </span>
                <MessageCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
          {friendThreads.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
              <UserPlus className="h-6 w-6" />
              <p>
                まだ友達がいません。
                <br />
                寮生ディレクトリから友達申請してみましょう。
              </p>
              <Link href="/directory" className="mt-1 text-sm font-medium text-primary hover:underline">
                ディレクトリを見る
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
