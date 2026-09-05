import { requireManagement } from "@/lib/management-access";
import { FeatureFlagManager } from "@/components/dashboard/feature-flag-manager";
import { FEATURE_FLAG_KEYS, getFeatureFlagState, type FeatureFlagKey } from "@/lib/feature-flags";

const groups: { id: string; title: string; keys: FeatureFlagKey[] }[] = [
  { id: "talks", title: "トーク", keys: ["friend_dm", "floor_group_chat"] },
  { id: "schedules", title: "日程調整・予約", keys: ["availability_matching", "lets_chat_booking", "unit_room_sessions"] },
  { id: "dorm-life", title: "寮生活・相談", keys: ["ra_question_box", "ra_link_hub", "wish_knowledge"] },
  { id: "events", title: "イベント", keys: ["resident_events", "event_calendar_export"] },
];

export default async function FeatureSettingsPage() {
  await requireManagement("features");
  const states = await Promise.all(FEATURE_FLAG_KEYS.map((key) => getFeatureFlagState(key)));
  const stateByKey = Object.fromEntries(FEATURE_FLAG_KEYS.map((key, index) => [key, states[index]]));
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold">機能の公開設定</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">寮生に表示する機能を選びます。選択すると、その機能の設定がすぐに保存されます。</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">新しい機能は「公開しない」から始まります。関係者が操作できる範囲は「関係者の権限」で別に設定します。</p>
      </header>
      <nav aria-label="機能の分類" className="flex flex-wrap gap-2">
        {groups.map((group) => <a key={group.id} href={`#feature-${group.id}`} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{group.title}</a>)}
      </nav>
      {groups.map((group) => (
        <section key={group.id} id={`feature-${group.id}`} aria-labelledby={`feature-${group.id}-title`} className="scroll-mt-28 space-y-3">
          <h2 id={`feature-${group.id}-title`} className="text-base font-bold">{group.title}</h2>
          {group.keys.map((key) => <FeatureFlagManager key={key} featureKey={key} initialState={stateByKey[key]} />)}
        </section>
      ))}
    </div>
  );
}
