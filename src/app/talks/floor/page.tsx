import { redirect } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { getInitialFloorMessages } from "@/actions/floor-messages";
import { BackButton } from "@/components/layout/back-button";
import { MobileChatViewport } from "@/components/community/mobile-chat-viewport";
import { TalkParticipantsButton } from "@/components/community/talk-participants-button";
import { FloorGroupChat } from "@/components/community/floor-group-chat";
import { getDictionary, getLocale } from "@/lib/i18n";

export default async function FloorGroupPage() {
  const state = await getFeatureFlagState("floor_group_chat");
  if (state === "hidden") redirect("/talks");
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  if (!profile.floor_number || profile.moved_out_at) redirect("/talks?tab=floor");
  const initial = await getInitialFloorMessages();
  if (initial.error || !initial.floorNumber) redirect("/talks?tab=floor");

  return (
    <MobileChatViewport>
      <div data-chat-theme="aurora" className="flex shrink-0 items-center gap-3 border-b border-[var(--chat-border)] bg-[var(--chat-bg-header)] px-3 py-3 backdrop-blur-xl sm:rounded-t-2xl sm:border-x sm:border-t sm:border-[var(--chat-border)]">
        <BackButton fallbackHref="/talks?tab=floor" className="-ml-1 !h-11 !w-11 !rounded-full !p-2 active:bg-[var(--chat-accent-soft)]" />
        <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-[var(--chat-text-primary)]">{dict.talks.floorGroup.replace("{floor}", String(initial.floorNumber))}</h1>
          <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--chat-text-secondary)]"><Users className="h-3 w-3" />{dict.talks.memberCount.replace("{count}", String(initial.members.length))}</p>
        </div>
        <TalkParticipantsButton participants={initial.members} total={initial.members.length} />
      </div>
      <FloorGroupChat
        floorNumber={initial.floorNumber}
        currentUserId={profile.id}
        messages={initial.messages}
        members={initial.members}
        hasMoreOlder={initial.hasMore}
        initialLastReadAt={initial.lastReadAt}
      />
    </MobileChatViewport>
  );
}
