import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatEventDateTime } from "@/lib/utils";

type TalkRoomEvent = {
  id: string;
  title: string;
  title_en: string | null;
  event_date: string;
  poster_url: string | null;
};

export default async function TalksPage() {
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
  // 一覧の各行にも表示できるように）。
  const [{ data: reads }, { data: messages }] = eventIds.length
    ? await Promise.all([
        supabase.from("event_chat_reads").select("event_id, last_read_at").eq("user_id", profile.id),
        supabase.from("event_messages").select("event_id, sender_id, created_at").in("event_id", eventIds),
      ])
    : [{ data: [] }, { data: [] }];
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">トーク</h1>
        <p className="mt-1 text-sm text-muted-foreground">参加したイベントのお知らせと会話を確認できます。</p>
      </div>
      <div className="flex flex-col gap-2">
        {rooms.map((event) => {
          const unread = unreadEventIds.has(event.id);
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
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            </Link>
          );
        })}
        {rooms.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
            参加したイベントはまだありません。
          </div>
        )}
      </div>
    </div>
  );
}
