import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventTalk } from "@/components/community/event-talk";
import { BackButton } from "@/components/layout/back-button";

/** event_community_profiles_v3() の返り値（送信者の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

export default async function EventTalkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ joined?: string }>;
}) {
  const { id } = await params;
  const { joined } = await searchParams;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: event }, { data: registration }, { data: messages }] = await Promise.all([
    supabase.from("events").select("id, title, poster_url").eq("id", id).maybeSingle(),
    supabase.from("registrations").select("id").eq("event_id", id).eq("user_id", profile.id).maybeSingle(),
    supabase.from("event_messages").select("*").eq("event_id", id).order("created_at"),
  ]);
  if (!event) notFound();
  if (profile.role !== "ra" && !registration) redirect(`/events/${id}`);

  const senderIds = [...new Set((messages ?? []).map((message) => message.sender_id))];
  const mediaPaths = (messages ?? []).map((message) => message.media_path).filter((path): path is string => !!path);
  const pollIds = [...new Set((messages ?? []).map((message) => message.poll_id).filter((pollId): pollId is string => !!pollId))];
  const messageIds = (messages ?? []).map((message) => message.id);

  // 画像の署名URLはメッセージごとに個別リクエストせず、まとめて1回で取得する。
  const [{ data: users }, signedUrls, { data: polls }, { data: votes }, { data: reactions }] = await Promise.all([
    senderIds.length
      ? supabase.rpc("event_community_profiles_v3", { profile_ids: senderIds })
      : Promise.resolve({ data: null }),
    mediaPaths.length
      ? supabase.storage.from("event-chat-media").createSignedUrls(mediaPaths, 60 * 60)
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string }[] }),
    pollIds.length ? supabase.from("event_polls").select("*").in("id", pollIds) : Promise.resolve({ data: [] }),
    pollIds.length ? supabase.from("event_poll_votes").select("*").in("poll_id", pollIds) : Promise.resolve({ data: [] }),
    messageIds.length
      ? supabase.from("event_message_reactions").select("*").in("message_id", messageIds)
      : Promise.resolve({ data: [] }),
  ]);

  const usersById = new Map(((users ?? []) as CommunityProfile[]).map((user) => [user.id, user]));
  const signedUrlByPath = new Map((signedUrls.data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  const hydrated = (messages ?? []).map((message) => ({
    ...message,
    mediaUrl: message.media_path ? signedUrlByPath.get(message.media_path) ?? null : null,
    sender: usersById.get(message.sender_id) ?? null,
  }));

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background sm:static sm:mx-auto sm:max-w-2xl sm:gap-4">
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl">
        <BackButton fallbackHref="/talks" className="-ml-2 !p-2" />
        {event.poster_url && (
          <Image src={event.poster_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold">{event.title}</h1>
          <Link href={`/events/${id}`} className="text-xs text-primary hover:underline">
            イベント詳細
          </Link>
        </div>
      </div>
      {joined === "1" && (
        <div className="mx-3 mt-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          イベントへの参加ありがとうございます。最新情報はこのトークでお知らせします。
        </div>
      )}
      <EventTalk
        eventId={id}
        currentUserId={profile.id}
        messages={hydrated}
        polls={polls ?? []}
        votes={votes ?? []}
        reactions={reactions ?? []}
        isRa={profile.role === "ra"}
      />
    </div>
  );
}
