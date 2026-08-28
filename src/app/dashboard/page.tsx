import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEventDateTime } from "@/lib/utils";
import { EventActionsMenu } from "@/components/dashboard/event-actions-menu";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventCategory } from "@/types/database";

export default async function DashboardPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date().toISOString();

  const [{ data: events }, { count: residentCount }, { count: upcomingCount }] = await Promise.all([
    supabase.from("events").select("*, registrations(count)").order("event_date", { ascending: false }),
    supabase.from("users").select("*", { count: "exact", head: true }).not("floor_number", "is", null),
    supabase.from("events").select("*", { count: "exact", head: true }).gte("event_date", now),
  ]);

  return (
    <div className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{residentCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{dict.dashboard.statsResidents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{events?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">{dict.dashboard.statsEvents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{upcomingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{dict.dashboard.statsUpcoming}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">{dict.dashboard.eventListTitle}</h2>
          {events?.map((event: any) => {
            const count = event.registrations?.[0]?.count ?? 0;
            const title = (locale === "en" && event.title_en) || event.title;
            const categoryLabel =
              dict.categories[event.category as EventCategory] ?? event.category;
            return (
              <Card key={event.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant="secondary">{categoryLabel}</Badge>
                      {event.creator_type === "resident" && <Badge variant="outline">寮生企画</Badge>}
                      {event.requires_registration && (
                        <span className="text-xs text-muted-foreground">
                          {dict.dashboard.registrationCount} {count}/{event.capacity}
                          {dict.event.peopleUnit}
                        </span>
                      )}
                      {event.survey_type !== "none" && (
                        <Badge variant="outline">
                          {dict.dashboard.surveyBadge}:{" "}
                          {event.survey_type === "external"
                            ? dict.dashboard.surveyExternalShort
                            : dict.dashboard.surveyInternalShort}
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted-foreground">{formatEventDateTime(event.event_date, locale)}</p>
                  </div>
                  <EventActionsMenu eventId={event.id} title={title} hasRegistrationQuestions={!!event.registration_requires_answers} />
                </CardContent>
              </Card>
            );
          })}
          {events?.length === 0 && (
            <p className="text-sm text-muted-foreground">{dict.dashboard.noEvents}</p>
          )}
        </div>
    </div>
  );
}
