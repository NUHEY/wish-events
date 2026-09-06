import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState, type FeatureFlagKey } from "@/lib/feature-flags";

export async function requirePublishedTool(key: FeatureFlagKey) {
  const [profile, state] = await Promise.all([getCurrentProfile(), getFeatureFlagState(key)]);
  if (state === "hidden" && profile.role !== "ra") notFound();
  return profile;
}
