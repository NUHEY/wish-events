import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getFriendRelation } from "@/actions/friends";
import { getInitialDirectMessages } from "@/actions/direct-messages";
import { FriendDm } from "@/components/community/friend-dm";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { BackButton } from "@/components/layout/back-button";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { MobileChatViewport } from "@/components/community/mobile-chat-viewport";
import { getDictionary, getLocale } from "@/lib/i18n";

const INITIAL_MESSAGE_LIMIT = 50;

type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

export default async function FriendDmPage({ params }: { params: Promise<{ friendId: string }> }) {
  const friendDmState = await getFeatureFlagState("friend_dm");
  if (friendDmState === "hidden") redirect("/talks");
  const { friendId } = await params;
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  if (friendId === profile.id) notFound();

  const supabase = await createClient();
  // usersテーブルはRLSで本人+RAしか直接SELECTできないため、友達（他ユーザー）の
  // プロフィールは既存のevent_community_profiles_v3（SECURITY DEFINER）で解決する。
  const [relation, { data: friendProfiles }, initial] = await Promise.all([
    getFriendRelation(friendId),
    supabase.rpc("event_community_profiles_v3", { profile_ids: [friendId] }).returns<CommunityProfile[]>(),
    getInitialDirectMessages(friendId, INITIAL_MESSAGE_LIMIT),
  ]);
  const friend = (friendProfiles ?? [])[0] ?? null;
  if (!friend) notFound();
  // 友達関係が解消済み（or 元々友達でない）場合はDM画面へのアクセス自体を止める。
  // 過去のメッセージがあっても、友達でなくなった相手とは新規送信できない
  // （direct_messages_insert_friendsのRLSでも二重に強制される）。
  if (relation.status !== "friends") notFound();

  return (
    <MobileChatViewport>
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl">
        <BackButton fallbackHref="/talks?tab=friends" className="-ml-2 !p-2" />
        <AvatarRing role={friend.role} size={40}>
          <Image src={friend.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
        </AvatarRing>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold">{friend.full_name ?? dict.talks.residentFallback}</h1>
          <p className="text-xs text-muted-foreground">{dict.talks.friendLabel}</p>
        </div>
      </div>
      <FriendDm
        friendId={friendId}
        currentUserId={profile.id}
        friendName={friend.full_name ?? dict.talks.residentFallback}
        friendAvatarUrl={friend.avatar_url}
        friendRole={friend.role}
        messages={initial.messages}
        hasMoreOlder={initial.hasMore}
        initialLastReadAt={initial.lastReadAt}
      />
    </MobileChatViewport>
  );
}
