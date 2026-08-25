import Link from "next/link";
import {
  Award,
  CalendarPlus,
  LayoutDashboard,
  MapPinHouse,
  Megaphone,
  Settings2,
  Users,
} from "lucide-react";
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
  const now = new Date().toISOString();

  const [{ data: events }, { count: residentCount }, { count: upcomingCount }] = await Promise.all([
    supabase.from("events").select("*, registrations(count)").order("event_date", { ascending: false }),
    supabase.from("users").select("*", { count: "exact", head: true }).not("floor_number", "is", null),
    supabase.from("events").select("*", { count: "exact", head: true }).gte("event_date", now),
  ]);

  const tiles = [
    { href: "/events/new", icon: CalendarPlus, title: dict.dashboard.newEventTile, desc: dict.dashboard.newEventTileDesc, primary: true },
    { href: "/announcements/new", icon: Megaphone, title: dict.dashboard.announcementTile, desc: dict.dashboard.announcementTileDesc },
    { href: "/dashboard/ra-rooms", icon: MapPinHouse, title: dict.nav.raRooms, desc: dict.dashboard.raRoomsTileDesc },
    { href: "/dashboard/residents", icon: Users, title: dict.nav.residents, desc: dict.dashboard.residentsTileDesc },
    { href: "/dashboard/badges", icon: Award, title: dict.dashboard.badgesTile, desc: dict.dashboard.badgesTileDesc },
    { href: "/dashboard/home-layout", icon: LayoutDashboard, title: dict.homeLayout.navLabel, desc: dict.dashboard.homeLayoutTileDesc },
    { href: "/dashboard/event-options", icon: Settings2, title: dict.eventOptions.navLabel, desc: dict.dashboard.eventOptionsTileDesc },
  ];

  return (
    <>
      <div className="rounded-2xl border border-border bg-secondary/30 p-6 text-center sm:hidden">
        <h1 className="text-lg font-bold">管理機能はパソコンでご利用ください</h1>
        <p className="mt-2 text-sm text-muted-foreground">イベントの作成・編集や参加者管理は、画面の広いパソコンで行うと安全でスムーズです。</p>
      </div>
      <div className="hidden flex-col gap-6 sm:flex">
        <h1 className="text-2xl font-bold">{dict.dashboard.title}</h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group flex flex-col gap-2.5 rounded-2xl border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover ${
                tile.primary ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  tile.primary ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                }`}
              >
                <tile.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{tile.title}</p>
                <p className="text-xs text-muted-foreground">{tile.desc}</p>
              </div>
            </Link>
          ))}
        </div>

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
    </>
  );
}
