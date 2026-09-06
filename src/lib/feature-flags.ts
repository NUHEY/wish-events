import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { defaultFeatureState, type FeatureFlagKey, type FeatureFlagState } from "@/lib/feature-flag-keys";
export { FEATURE_FLAG_KEYS } from "@/lib/feature-flag-keys";
export type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flag-keys";

// One read per render, shared by every flag consumer in the request.
const readFeatureFlags = cache(async () => {
  const supabase = await createClient();
  return supabase.from("feature_flags").select("key,state");
});

export const getFeatureFlagState = cache(async (key: FeatureFlagKey): Promise<FeatureFlagState> => {
  const { data, error } = await readFeatureFlags();
  if (error || !data) return "hidden";
  const row = data.find(row => row.key === key);
  if (!row) return defaultFeatureState(key);
  return ["public", "beta", "hidden"].includes(row.state) ? row.state as FeatureFlagState : "hidden";
});
