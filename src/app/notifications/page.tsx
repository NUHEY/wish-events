import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BackButton } from "@/components/layout/back-button";
import { NotificationList } from "@/components/notifications/notification-list";
import { MarkAllReadOnView } from "@/components/notifications/mark-all-read-on-view";

/** event_community_profiles_v3() の返り値（通知の送り主の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: notificationRows } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const actorIds = [...new Set((notificationRows ?? []).map((n) => n.actor_id).filter((id): id is string => !!id))];
  const { data: actorProfiles } = actorIds.length
    ? await supabase.rpc("event_community_profiles_v3", { profile_ids: actorIds })
    : { data: null };
  const actorsById = new Map(((actorProfiles ?? []) as CommunityProfile[]).map((a) => [a.id, a]));

  const notifications = (notificationRows ?? []).map((n) => ({
    ...n,
    actor: n.actor_id ? (actorsById.get(n.actor_id) ?? null) : null,
  }));
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <MarkAllReadOnView hasUnread={hasUnread} />
      <div className="flex items-center gap-2">
        <BackButton fallbackHref="/" className="-ml-2" />
        <h1 className="text-xl font-bold">通知</h1>
      </div>
      <NotificationList notifications={notifications} />
    </div>
  );
}
