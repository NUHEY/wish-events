import { redirect } from "next/navigation";
import { Building2, Users } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { getInitialFloorMessages } from "@/actions/floor-messages";
import { BackButton } from "@/components/layout/back-button";
import { MobileChatViewport } from "@/components/community/mobile-chat-viewport";
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
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl">
        <BackButton fallbackHref="/talks?tab=floor" className="-ml-2 !p-2" />
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/15 ring-offset-2 ring-offset-background">
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{dict.talks.floorGroup.replace("{floor}", String(initial.floorNumber))}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{dict.talks.floorMembers.replace("{count}", String(initial.members.length))}</p>
        </div>
        {state === "beta" && <span className="rounded-full bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">BETA</span>}
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
