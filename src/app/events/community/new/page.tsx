import { redirect } from "next/navigation";
import { ResidentEventForm } from "@/components/events/resident-event-form";
import { BackButton } from "@/components/layout/back-button";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";

export default async function NewResidentEventPage() {
  const profile = await getCurrentProfile();
  const state = await getFeatureFlagState("resident_events");
  if (state === "hidden" && profile.role !== "ra") redirect("/events");
  return <div className="mx-auto max-w-2xl space-y-4"><BackButton fallbackHref="/events/community" /><header><h1 className="text-2xl font-extrabold tracking-tight">イベントを募集する</h1><p className="mt-1 text-sm text-muted-foreground">必要な情報だけで、すぐに参加者を募集できます。</p></header><ResidentEventForm userId={profile.id} /></div>;
}
