import { CalendarClock, CalendarDays, MessagesSquare, UsersRound, Wrench } from "lucide-react";
import { requireManagement } from "@/lib/management-access";
import { FeatureFlagManager } from "@/components/dashboard/feature-flag-manager";
import { FEATURE_FLAG_KEYS, getFeatureFlagState, type FeatureFlagKey } from "@/lib/feature-flags";

const groups = [
  { id: "dorm-life", title: "寮生活・つながり", icon: UsersRound, keys: ["resident_directory", "ra_link_hub", "wish_knowledge"] },
  { id: "events", title: "イベント", icon: CalendarDays, keys: ["resident_events", "event_calendar_export"] },
  { id: "schedules", title: "日程調整・予約", icon: CalendarClock, keys: ["availability_matching", "lets_chat_booking", "unit_room_sessions"] },
  { id: "talks", title: "トーク", icon: MessagesSquare, keys: ["friend_dm", "floor_group_chat"] },
  { id: "utilities", title: "便利な道具・共有", icon: Wrench, keys: ["share_qr", "split_bill", "group_shuffle", "world_clock"] },
] satisfies { id: string; title: string; icon: typeof UsersRound; keys: FeatureFlagKey[] }[];

export default async function FeatureSettingsPage() {
  await requireManagement("features");
  const states = await Promise.all(FEATURE_FLAG_KEYS.map((key) => getFeatureFlagState(key)));
  const stateByKey = Object.fromEntries(FEATURE_FLAG_KEYS.map((key, index) => [key, states[index]]));
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5">
      <header>
        <h2 className="text-xl font-bold">機能の公開設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">寮生が使える機能を選びます。変更はすぐに保存されます。</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">公開：通常表示 ／ 試験公開：BETA表示 ／ 非公開：寮生は利用できません。RAは確認用にアクセスできます。</p>
      </header>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`feature-${group.id}-title`} className="space-y-2">
          <h3 id={`feature-${group.id}-title`} className="flex items-center gap-2 text-sm font-bold"><group.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{group.title}</h3>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {group.keys.map((key) => <FeatureFlagManager key={key} featureKey={key} initialState={stateByKey[key]} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
