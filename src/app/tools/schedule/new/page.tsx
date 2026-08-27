import { notFound, redirect } from "next/navigation";
import { ScheduleCreator } from "@/components/tools/schedule-creator";
import { getCurrentProfile } from "@/lib/auth";
import { SCHEDULE_COPY, type ScheduleKind } from "@/lib/beta-tools";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";

export default async function NewSchedulePage({ searchParams }: { searchParams: { mode?: string } }) {
  const kind = (searchParams.mode ?? "general") as ScheduleKind;
  if (!(kind in SCHEDULE_COPY)) notFound();
  const profile = await getCurrentProfile();
  const state = await getFeatureFlagState(SCHEDULE_COPY[kind].flag);
  if (state === "hidden" && profile.role !== "ra") redirect("/tools");
  if (kind === "lets_chat" && profile.role !== "ra") redirect("/tools");
  const supabase = await createClient();
  const { data } = await supabase.rpc("directory_profiles");
  return <ScheduleCreator kind={kind} profiles={(data ?? []) as DirectoryProfileRow[]} currentUserId={profile.id} currentFloor={profile.floor_number} isRa={profile.role === "ra"} />;
}
