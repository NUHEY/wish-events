import { FeatureFlagManager } from "@/components/dashboard/feature-flag-manager";
import { getFeatureFlagState } from "@/lib/feature-flags";

export default async function FeatureSettingsPage() {
  const state = await getFeatureFlagState("friend_dm");
  return <div className="mx-auto flex max-w-4xl flex-col gap-4"><div><h2 className="text-xl font-bold">機能の公開設定</h2><p className="mt-1 text-sm text-muted-foreground">ベータ機能の見せ方を、コード変更なしで切り替えます。</p></div><FeatureFlagManager initialState={state} /></div>;
}
