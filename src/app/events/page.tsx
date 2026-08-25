import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventCard } from "@/components/events/event-card";
import { EventFilter } from "@/components/events/event-filter";
import { PendingSurveyBanner } from "@/components/surveys/pending-survey-banner";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventCategory } from "@/types/database";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const profile = await getCurrentProfile();
  const { category } = await searchParams;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date().toISOString();

  let upcomingQuery = supabase
    .from("events")
    .select("*")
    .gte("event_date", now)
    .order("event_date", { ascending: true });
  let pastQuery = supabase
    .from("events")
    .select("*")
    .lt("event_date", now)
    .order("event_date", { ascending: false });

  if (category) {
    upcomingQuery = upcomingQuery.eq("category", category as EventCategory);
    pastQuery = pastQuery.eq("category", category as EventCategory);
  }

  const [{ data: upcomingEvents, error }, { data: pastEvents }] = await Promise.all([
    upcomingQuery,
    pastQuery,
  ]);

  const hasUpcoming = !!upcomingEvents && upcomingEvents.length > 0;
  const hasPast = !!pastEvents && pastEvents.length > 0;

  return (
    <div className="relative flex flex-col gap-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64 bg-hero-radial" />

      <PendingSurveyBanner userId={profile.id} />

      <div className="flex flex-col gap-3.5 border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">{dict.home.title}</h1>
          <p className="text-sm text-muted-foreground">{dict.home.subtitle}</p>
        </div>
        <EventFilter />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {dict.home.loadError}: {error.message}
        </p>
      )}

      {!hasUpcoming && !hasPast && (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-secondary/40 py-20 text-center">
          <p className="text-sm font-medium">{dict.home.empty}</p>
          <p className="text-xs text-muted-foreground">{dict.home.emptyHint}</p>
        </div>
      )}

      {!hasUpcoming && hasPast && (
        <p className="text-sm text-muted-foreground">{dict.home.noUpcoming}</p>
      )}

      {hasUpcoming && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcomingEvents!.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {hasPast && (
        <details className="group border-t border-border pt-5">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90" />
            {dict.home.pastEventsToggle}（{pastEvents!.length}）
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pastEvents!.map((event) => (
              <EventCard key={event.id} event={event} variant="muted" />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
