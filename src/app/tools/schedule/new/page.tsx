import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { notFound, redirect } from "next/navigation";
import { ScheduleCreator } from "@/components/tools/schedule-creator";
import { getCurrentProfile } from "@/lib/auth";
import { SCHEDULE_COPY, type ScheduleKind } from "@/lib/beta-tools";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";
import { getSiteSettings } from "@/lib/site-settings";

export default async function NewSchedulePage({ searchParams }: { searchParams: { mode?: string } }) {
  const kind = (searchParams.mode ?? "general") as ScheduleKind;
  if (!(kind in SCHEDULE_COPY)) notFound();
  const profile = await getCurrentProfile();
  const canManageModule = canManage(await getManagementAccess(), "schedules");
  if (profile.account_kind !== "resident" && !canManageModule) redirect("/tools");
  const state = await getFeatureFlagState(SCHEDULE_COPY[kind].flag);
  if (state === "hidden" && !canManageModule) redirect("/tools");
  if ((kind === "lets_chat" || kind === "urs") && !canManageModule) redirect("/tools");
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([supabase.rpc("directory_profiles"), getSiteSettings()]);
  return <ScheduleCreator kind={kind} profiles={(data ?? []) as DirectoryProfileRow[]} currentUserId={profile.id} currentFloor={profile.floor_number} isRa={canManageModule} defaults={{ startTime: settings.scheduleDefaultStartTime, endTime: settings.scheduleDefaultEndTime, slotMinutes: settings.scheduleDefaultSlotMinutes, maxDays: settings.scheduleMaxDays }} />;
}
