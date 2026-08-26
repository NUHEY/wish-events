import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventTalk } from "@/components/community/event-talk";
import { TalkParticipantsButton } from "@/components/community/talk-participants-button";
import { BackButton } from "@/components/layout/back-button";
import { getInitialEventMessages, getEventTalkParticipants, getRequestOrigin } from "@/actions/event-community";

const INITIAL_MESSAGE_LIMIT = 50;

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

  const [{ data: event }, { data: registration }, initial, { participants, total: participantTotal }, appOrigin] =
    await Promise.all([
      supabase.from("events").select("id, title, poster_url").eq("id", id).maybeSingle(),
      supabase.from("registrations").select("id").eq("event_id", id).eq("user_id", profile.id).maybeSingle(),
      getInitialEventMessages(id, INITIAL_MESSAGE_LIMIT),
      getEventTalkParticipants(id),
      getRequestOrigin(),
    ]);
  if (!event) notFound();
  if (profile.role !== "ra" && !registration) redirect(`/events/${id}`);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-background sm:static sm:mx-auto sm:flex sm:h-[calc(100dvh-8rem)] sm:max-w-2xl">
      <div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl">
        <BackButton fallbackHref="/talks" className="-ml-2 !p-2" />
        {event.poster_url && (
          <Image src={event.poster_url} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{event.title}</h1>
          <Link href={`/events/${id}`} className="text-xs text-primary hover:underline">
            イベント詳細
          </Link>
        </div>
        {participants.length > 0 && <TalkParticipantsButton participants={participants} total={participantTotal} />}
      </div>
      {joined === "1" && (
        <div className="mx-3 mt-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
          イベントへの参加ありがとうございます。最新情報はこのトークでお知らせします。
        </div>
      )}
      <EventTalk
        eventId={id}
        currentUserId={profile.id}
        messages={initial.messages}
        polls={initial.polls}
        votes={initial.votes}
        reactions={initial.reactions}
        hasMoreOlder={initial.hasMore}
        isRa={profile.role === "ra"}
        appOrigin={appOrigin}
      />
    </div>
  );
}
