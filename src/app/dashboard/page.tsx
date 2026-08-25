import Link from "next/link";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventCategory } from "@/types/database";

export default async function DashboardPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: events } = await supabase
    .from("events")
    .select("*, registrations(count)")
    .order("event_date", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{dict.dashboard.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/ra-rooms" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {dict.nav.raRooms}
          </Link>
          <Link href="/dashboard/residents" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {dict.nav.residents}
          </Link>
          <Link href="/dashboard/home-layout" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {dict.homeLayout.navLabel}
          </Link>
          <Link href="/events/new" className={buttonVariants({ size: "sm" })}>
            {dict.dashboard.newEventButton}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {events?.map((event: any) => {
          const count = event.registrations?.[0]?.count ?? 0;
          const title = (locale === "en" && event.title_en) || event.title;
          const categoryLabel =
            dict.categories[event.category as EventCategory] ?? event.category;
          return (
            <Card key={event.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary">{categoryLabel}</Badge>
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
                <div className="flex flex-wrap gap-2">
                  <Link href={`/events/${event.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    {dict.dashboard.detailButton}
                  </Link>
                  <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {dict.dashboard.editButton}
                  </Link>
                  <Link
                    href={`/dashboard/${event.id}/participants`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {dict.dashboard.participantsButton}
                  </Link>
                  <Link
                    href={`/dashboard/${event.id}/survey`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    {dict.dashboard.surveyButton}
                  </Link>
                </div>
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
