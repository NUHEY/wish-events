import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { EventCard } from "@/components/events/event-card";
import { buttonVariants } from "@/components/ui/button";
import { getLocale, getDictionary } from "@/lib/i18n";
import { endOfThisWeek } from "@/lib/utils";
import { HOME_ACCENT_HEX } from "@/lib/constants";
import type { HomeAccentKeyValue } from "@/lib/constants";
import type { AnnouncementRow, EventRow, HomeLayoutSectionRow, TeamMemberRow } from "@/types/database";

const FALLBACK_SECTIONS: HomeLayoutSectionRow[] = [
  { id: "week_events", section_key: "week_events", visible: true, position: 1, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "floor_events", section_key: "floor_events", visible: true, position: 2, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "announcements", section_key: "announcements", visible: true, position: 3, accent: null, title_ja: null, title_en: null, updated_at: "" },
];

/** モバイルは横スクロールのスナップ、sm以上はグリッドで表示するイベントカード列 */
function EventScroller({ events, membersById }: { events: EventRow[]; membersById: Map<string, TeamMemberRow> }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {events.map((event) => (
        <div key={event.id} className="w-40 shrink-0 snap-start sm:w-auto">
          <EventCard event={event} members={(event.member_ids ?? []).map((id) => membersById.get(id)).filter((member): member is TeamMemberRow => !!member)} />
        </div>
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const isRa = profile.role === "ra";
  const isEn = locale === "en";

  const now = new Date();
  const weekEnd = endOfThisWeek(now);

  const [{ data: layoutRows }, { data: weekEvents }, { data: announcements, error: announcementsError }] =
    await Promise.all([
      supabase.from("home_layout_sections").select("*").order("position", { ascending: true }),
      supabase
        .from("events")
        .select("*")
        .gte("event_date", now.toISOString())
        .lte("event_date", weekEnd.toISOString())
        .order("is_pinned", { ascending: false })
        .order("event_date", { ascending: true }),
      supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  let floorEvents: EventRow[] = [];
  if (profile.floor_number != null) {
    const { data } = await supabase
      .from("events")
      .select("*")
      .gte("event_date", now.toISOString())
      .contains("target_floors", [profile.floor_number])
      .order("is_pinned", { ascending: false })
      .order("event_date", { ascending: true });
    floorEvents = data ?? [];
  }

  const memberIds = [...new Set([...((weekEvents ?? []).flatMap((event) => event.member_ids ?? [])), ...floorEvents.flatMap((event) => event.member_ids ?? []), ...(announcements ?? []).flatMap((announcement) => announcement.member_ids ?? [])])];
  const { data: teamMembers } = memberIds.length
    ? await supabase.from("users").select("id, full_name, avatar_url").in("id", memberIds)
    : { data: [] as TeamMemberRow[] };
  const membersById = new Map((teamMembers ?? []).map((member) => [member.id, member]));

  const sections =
    layoutRows && layoutRows.length === FALLBACK_SECTIONS.length ? layoutRows : FALLBACK_SECTIONS;

  function sectionTitle(s: HomeLayoutSectionRow, fallback: string) {
    const override = isEn ? s.title_en : s.title_ja;
    return override || fallback;
  }

  function accentHex(s: HomeLayoutSectionRow): string | null {
    return s.accent ? HOME_ACCENT_HEX[s.accent as HomeAccentKeyValue] ?? null : null;
  }

  function SectionHeading({ s, title }: { s: HomeLayoutSectionRow; title: string }) {
    const accent = accentHex(s);
    return (
      <div className="flex items-center gap-2">
        <span
          className="h-6 w-1.5 rounded-full bg-primary"
          style={accent ? { backgroundColor: accent } : undefined}
        />
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64 bg-hero-radial" />

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">
            {dict.homePortal.greeting.replace("{name}", profile.full_name ?? "")}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.homePortal.subtitle}</p>
        </div>
        {isRa && (
          <Link
            href="/dashboard/home-layout"
            className={buttonVariants({ variant: "outline", size: "sm", className: "hidden sm:inline-flex" })}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            {dict.homePortal.customizeButton}
          </Link>
        )}
      </div>

      {sections
        .filter((s) => s.visible)
        .map((s) => {
          if (s.section_key === "week_events") {
            return (
              <section key={s.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <SectionHeading s={s} title={sectionTitle(s, dict.homePortal.weekEvents.title)} />
                </div>
                {weekEvents && weekEvents.length > 0 ? (
                  <EventScroller events={weekEvents} membersById={membersById} />
                ) : (
                  <EmptyNote>{dict.homePortal.weekEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          if (s.section_key === "floor_events") {
            const defaultTitle =
              profile.floor_number != null
                ? dict.homePortal.floorEvents.title.replace("{floor}", String(profile.floor_number))
                : dict.homePortal.floorEvents.titleNoFloor;
            return (
              <section key={s.id} className="flex flex-col gap-3">
                <SectionHeading s={s} title={sectionTitle(s, defaultTitle)} />
                {profile.floor_number == null ? (
                  <EmptyNote>{dict.homePortal.floorEvents.noFloorNote}</EmptyNote>
                ) : floorEvents.length > 0 ? (
                  <EventScroller events={floorEvents} membersById={membersById} />
                ) : (
                  <EmptyNote>{dict.homePortal.floorEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          // announcements
          return (
            <section key={s.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <SectionHeading s={s} title={sectionTitle(s, dict.homeFeed.title)} />
                {isRa && (
                  <Link
                    href="/announcements/new"
                    className={buttonVariants({ size: "sm", className: "hidden rounded-full shadow-glow sm:inline-flex" })}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {dict.homeFeed.newButton}
                  </Link>
                )}
              </div>

              {announcementsError && (
                <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {dict.home.loadError}: {announcementsError.message}
                </p>
              )}

              {announcements && announcements.length === 0 && (
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-secondary/40 py-16 text-center">
                  <p className="text-sm font-medium">{dict.homeFeed.empty}</p>
                  <p className="text-xs text-muted-foreground">{dict.homeFeed.emptyHint}</p>
                </div>
              )}

              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0">
                {(announcements as AnnouncementRow[] | null)?.map((a) => (
                  <div key={a.id} className="w-[17rem] shrink-0 snap-start sm:w-auto">
                    <AnnouncementCard announcement={a} isRa={isRa} members={(a.member_ids ?? []).map((id: string) => membersById.get(id)).filter((member): member is TeamMemberRow => !!member)} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
