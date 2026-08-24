import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventCard } from "@/components/events/event-card";
import { EventFilter } from "@/components/events/event-filter";
import { PendingSurveyBanner } from "@/components/surveys/pending-survey-banner";
import type { EventCategory } from "@/types/database";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await getCurrentProfile();
  const { category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (category) {
    query = query.eq("category", category as EventCategory);
  }

  const { data: events, error } = await query;

  return (
    <div className="flex flex-col gap-6">
      <PendingSurveyBanner userId={profile.id} />

      <div className="flex flex-col gap-3 border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">イベント一覧</h1>
          <p className="text-sm text-muted-foreground">WISHで開催予定・開催中のイベントをチェックしよう</p>
        </div>
        <EventFilter />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          読み込みに失敗しました: {error.message}
        </p>
      )}

      {events && events.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium">該当するイベントはありません</p>
          <p className="text-xs text-muted-foreground">条件を変えて再度お試しください</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events?.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
