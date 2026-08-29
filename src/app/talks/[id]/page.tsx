import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventTalk } from "@/components/community/event-talk";
import { TalkParticipantsButton } from "@/components/community/talk-participants-button";
import { BackButton } from "@/components/layout/back-button";
import { getInitialEventMessages, getEventTalkParticipants, getRequestOrigin } from "@/actions/event-community";
import { MobileChatViewport } from "@/components/community/mobile-chat-viewport";
import { getDictionary, getLocale } from "@/lib/i18n";

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
  const locale = await getLocale();
  const dict = getDictionary(locale);
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
    <MobileChatViewport>
      <div data-chat-theme="aurora" className="flex shrink-0 items-center gap-3 border-b border-[var(--chat-border)] bg-[var(--chat-bg-header)] px-3 py-3 backdrop-blur-xl sm:rounded-t-2xl sm:border-x sm:border-t sm:border-[var(--chat-border)]">
        <BackButton fallbackHref="/talks" className="-ml-1 !h-9 !w-9 !rounded-full !p-2 active:bg-[var(--chat-accent-soft)]" />
        {event.poster_url && (
          <Image src={event.poster_url} alt="" width={42} height={42} className="h-[42px] w-[42px] rounded-lg object-cover shadow-[var(--chat-shadow-sm)]" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-[var(--chat-text-primary)]">{event.title}</h1>
          <Link href={`/events/${id}`} className="text-[11px] font-semibold text-primary active:opacity-60">
            {dict.talks.eventDetails}
          </Link>
        </div>
        {participants.length > 0 && <TalkParticipantsButton participants={participants} total={participantTotal} />}
      </div>
      {joined === "1" && (
        <div className="mx-3 mt-3 shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary shadow-[var(--chat-shadow-sm)]">
          {dict.talks.joinedMessage}
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
        initialLastReadAt={initial.lastReadAt}
      />
    </MobileChatViewport>
  );
}
