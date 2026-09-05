import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Sparkles } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { Button } from "@/components/ui/button";
import { requireManagement } from "@/lib/management-access";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { EVENT_CARD_COLUMNS } from "@/lib/utils";
import type { EventCardData } from "@/types/database";
import { ResidentEventDeleteButton } from "@/components/events/resident-event-delete-button";

export default async function ResidentEventsHubPage() {
  const profile = await getCurrentProfile();
  if (profile.account_kind !== "resident") await requireManagement("events");
  const state = await getFeatureFlagState("resident_events");
  if (state === "hidden" && profile.role !== "ra") redirect("/events");
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_CARD_COLUMNS).eq("creator_type", "resident").eq("created_by", profile.id).order("event_date", { ascending: false }).limit(50);
  const events = (data ?? []) as EventCardData[];
  return <div className="space-y-6"><header className="rounded-3xl bg-gradient-to-br from-pink-400/15 via-card to-violet-300/10 p-5 sm:p-7"><div className="flex items-center gap-2 text-xs font-bold text-primary"><Sparkles className="h-4 w-4" />Resident events</div><h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">寮生イベントを募集</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">「今夜ご飯に行きたい」「週末に渋谷へ行きたい」など、小さな予定から仲間を募集できます。</p><Button asChild className="mt-4 rounded-xl"><Link href="/events/community/new"><CalendarPlus className="h-4 w-4" />新しい募集を作る</Link></Button></header>
    <section><h2 className="mb-3 font-bold">自分が作った募集（{events.length}）</h2>{events.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">作成した募集はまだありません</div> : <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{events.map((event) => <div key={event.id}><EventCard event={event} /><ResidentEventDeleteButton eventId={event.id} title={event.title} /></div>)}</div>}</section>
  </div>;
}
