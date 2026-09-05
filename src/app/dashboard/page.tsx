import Link from "next/link";
import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEventDateTime } from "@/lib/utils";
import { EventActionsMenu } from "@/components/dashboard/event-actions-menu";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventCategory } from "@/types/database";

export default async function DashboardPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(searchParams.page ?? "1", 10) || 1));
  const pageSize = 20;
  const access = await getManagementAccess();
  const managesEvents = canManage(access, "events");
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date().toISOString();

  const [eventResult, residentResult, upcomingResult] = await Promise.all([
    managesEvents ? supabase.from("events").select("*, registrations(count)", { count: "exact" }).order("event_date", { ascending: false }).order("id").range((page - 1) * pageSize, page * pageSize - 1) : Promise.resolve({data: [], error: null, count: 0}),
    canManage(access, "residents") ? supabase.from("users").select("*", { count: "exact", head: true }).not("floor_number", "is", null) : Promise.resolve({count: null, error: null}),
    managesEvents ? supabase.from("events").select("*", { count: "exact", head: true }).gte("event_date", now) : Promise.resolve({count: null, error: null}),
  ]);

  if (eventResult.error || residentResult.error || upcomingResult.error) throw new Error(locale === "en" ? "Could not load the management board. Please try again." : "管理ボードを読み込めませんでした。もう一度お試しください。");
  const events = eventResult.data;
  const residentCount = residentResult.count;
  const upcomingCount = upcomingResult.count;
  const totalEvents = eventResult.count ?? 0;
  return (
    <div className="flex flex-col gap-6">
        {!managesEvents && <p className="rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">{locale === "en" ? "Your available management features are in the menu above." : "上の管理メニューに、利用できる機能が表示されています。"}</p>}
        {managesEvents && <>
        <div className={`grid grid-cols-2 gap-3 ${residentCount !== null ? "sm:grid-cols-3" : ""}`}>
          {residentCount !== null && <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{residentCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{dict.dashboard.statsResidents}</p>
            </CardContent>
          </Card>}
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{totalEvents}</p>
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

        <div id="managed-events" className="scroll-mt-24 flex flex-col gap-3">
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
                    <div className="mb-2 flex flex-wrap items-center gap-2">
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
                    <p className="break-words font-medium leading-relaxed">{title}</p>
                    <p className="text-sm text-muted-foreground">{formatEventDateTime(event.event_date, locale)}</p>
                  </div>
                  <EventActionsMenu eventId={event.id} title={title} hasRegistrationQuestions={!!event.registration_requires_answers} />
                </CardContent>
              </Card>
            );
          })}
          {totalEvents > pageSize && <nav aria-label={locale === "en" ? "Event pages" : "イベント一覧のページ"} className="flex flex-wrap items-center justify-between gap-2">
            {page > 1 ? <Link className={buttonVariants({variant:"outline",size:"sm"})} href={`/dashboard?page=${page - 1}#managed-events`}>{locale === "en" ? "Previous" : "前へ"}</Link> : <span />}
            <span className="text-sm text-muted-foreground">{page} / {Math.ceil(totalEvents / pageSize)}</span>
            {page * pageSize < totalEvents ? <Link className={buttonVariants({variant:"outline",size:"sm"})} href={`/dashboard?page=${page + 1}#managed-events`}>{locale === "en" ? "Next" : "次へ"}</Link> : <span />}
          </nav>}
          {events?.length === 0 && (
            <p className="text-sm text-muted-foreground">{dict.dashboard.noEvents}</p>
          )}
        </div>
        </>}
    </div>
  );
}
