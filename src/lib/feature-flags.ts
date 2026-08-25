import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type FeatureFlagState = "public" | "beta" | "hidden";
export type FeatureFlagKey = "friend_dm";

/** 設定行が未作成・移行未実行・取得失敗なら、安全側の「非公開」に倒す。 */
export const getFeatureFlagState = cache(async (key: FeatureFlagKey): Promise<FeatureFlagState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("feature_flags").select("state").eq("key", key).maybeSingle();
  if (error || !data || !["public", "beta", "hidden"].includes(data.state)) return "hidden";
  return data.state as FeatureFlagState;
});
