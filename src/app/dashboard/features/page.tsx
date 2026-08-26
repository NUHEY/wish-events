import { FeatureFlagManager } from "@/components/dashboard/feature-flag-manager";
import { getFeatureFlagState } from "@/lib/feature-flags";

export default async function FeatureSettingsPage() {
  const [friendDmState, eventCalendarState] = await Promise.all([
    getFeatureFlagState("friend_dm"),
    getFeatureFlagState("event_calendar_export"),
  ]);
  return <div className="mx-auto flex max-w-4xl flex-col gap-4"><div><h2 className="text-xl font-bold">機能の公開設定</h2><p className="mt-1 text-sm text-muted-foreground">ベータ機能の見せ方を、コード変更なしで切り替えます。</p></div><FeatureFlagManager featureKey="friend_dm" initialState={friendDmState} /><FeatureFlagManager featureKey="event_calendar_export" initialState={eventCalendarState} /></div>;
}
