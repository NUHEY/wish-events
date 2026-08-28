import { FeatureFlagManager } from "@/components/dashboard/feature-flag-manager";
import { FEATURE_FLAG_KEYS, getFeatureFlagState } from "@/lib/feature-flags";

export default async function FeatureSettingsPage() {
  const keys = FEATURE_FLAG_KEYS;
  const states = await Promise.all(keys.map((key) => getFeatureFlagState(key)));
  return <div className="mx-auto flex max-w-4xl flex-col gap-4"><div><h2 className="text-xl font-bold">機能の公開設定</h2><p className="mt-1 text-sm text-muted-foreground">ベータ機能の見せ方を、コード変更なしで個別に切り替えます。新機能はすべて「公開しない」から始まります。</p></div>{keys.map((key, index) => <FeatureFlagManager key={key} featureKey={key} initialState={states[index]} />)}</div>;
}
