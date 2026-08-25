import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { EventCard, type EventCardFriend } from "@/components/events/event-card";
import { buttonVariants } from "@/components/ui/button";
import { getLocale, getDictionary } from "@/lib/i18n";
import { endOfThisWeek, EVENT_CARD_COLUMNS } from "@/lib/utils";
import { HOME_ACCENT_HEX } from "@/lib/constants";
import type { HomeAccentKeyValue } from "@/lib/constants";
import type { AnnouncementRow, EventCardData, HomeLayoutSectionRow } from "@/types/database";

const FALLBACK_SECTIONS: HomeLayoutSectionRow[] = [
  { id: "week_events", section_key: "week_events", visible: true, position: 1, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "floor_events", section_key: "floor_events", visible: true, position: 2, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "announcements", section_key: "announcements", visible: true, position: 3, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "featured_events", section_key: "featured_events", visible: true, position: 4, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "popular_events", section_key: "popular_events", visible: true, position: 5, accent: null, title_ja: null, title_en: null, updated_at: "" },
  { id: "friends_events", section_key: "friends_events", visible: true, position: 6, accent: null, title_ja: null, title_en: null, updated_at: "" },
];

/** モバイルは横スクロールのスナップ、sm以上はグリッドで表示するイベントカード列 */
function EventScroller({
  events,
  friendsByEventId,
}: {
  events: EventCardData[];
  /** 指定すると、該当イベントのカードに参加している友達のアイコンを重ねて表示する。 */
  friendsByEventId?: Map<string, EventCardFriend[]>;
}) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
      {events.map((event) => (
        <div key={event.id} className="w-40 shrink-0 snap-start sm:w-auto">
          <EventCard event={event} attendingFriends={friendsByEventId?.get(event.id)} />
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

  // ホームで使う読み取りは互いに独立しているため、まとめて並列取得する。
  // 「人気」「友達が参加する」の2つは、この時点ではevent_id（と登録数/友達id）しか
  // 分からないため、イベント本体の取得は次のステップで行う。
  const [
    { data: layoutRowsRaw },
    { data: weekEventsRaw },
    { data: announcements, error: announcementsError },
    { data: floorEventsDataRaw },
    { data: pinnedEventsDataRaw },
    { data: popularRowsDataRaw },
    { data: friendsRowsDataRaw },
  ] = await Promise.all([
    supabase.from("home_layout_sections").select("*").order("position", { ascending: true }),
    // EventCard に必要な列だけを取得し、ホーム画面の表示を高速化する。
    supabase
      .from("events")
      .select(EVENT_CARD_COLUMNS)
      .gte("event_date", now.toISOString())
      .lte("event_date", weekEnd.toISOString())
      .order("is_pinned", { ascending: false })
      .order("event_date", { ascending: true }),
    supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    profile.floor_number != null
      ? supabase
          .from("events")
          .select(EVENT_CARD_COLUMNS)
          .gte("event_date", now.toISOString())
          .contains("target_floors", [profile.floor_number])
          .order("is_pinned", { ascending: false })
          .order("event_date", { ascending: true })
      : Promise.resolve({ data: [] as EventCardData[] }),
    // 注目のイベント（RAがピン留めした開催予定イベント）
    supabase
      .from("events")
      .select(EVENT_CARD_COLUMNS)
      .eq("is_pinned", true)
      .gte("event_date", now.toISOString())
      .order("event_date", { ascending: true })
      .limit(10),
    // 人気のイベント: registrationsへの直接アクセスはRLSで自分の分しか見えないため、
    // 集計だけを安全に返すSECURITY DEFINER関数を使う（誰が申込んだかは含まない）。
    supabase.rpc("popular_upcoming_events", { p_limit: 6 }),
    // 友達が参加するイベント: 承認済みの友達の申込みだけをfriend_requests経由で解決する。
    supabase.rpc("friends_attending_events"),
  ]);
  const layoutRows = layoutRowsRaw as HomeLayoutSectionRow[] | null;
  const weekEvents = weekEventsRaw as EventCardData[] | null;
  const floorEvents = (floorEventsDataRaw as EventCardData[] | null) ?? [];
  const pinnedEvents = (pinnedEventsDataRaw as EventCardData[] | null) ?? [];
  const popularRows = (popularRowsDataRaw as { event_id: string; registration_count: number }[] | null) ?? [];
  const friendsRows = (friendsRowsDataRaw as { event_id: string; friend_id: string }[] | null) ?? [];

  // 上のfriends_attending_events / popular_upcoming_eventsはevent_id（と登録数/friend_id）
  // しか返さないため、必要なイベント本体・友達プロフィールをここでまとめて取得する。
  const friendIdsByEventId = new Map<string, string[]>();
  for (const row of friendsRows) {
    const list = friendIdsByEventId.get(row.event_id) ?? [];
    list.push(row.friend_id);
    friendIdsByEventId.set(row.event_id, list);
  }
  const popularEventIds = popularRows.map((r) => r.event_id);
  const friendsEventIds = [...friendIdsByEventId.keys()];
  const neededEventIds = [...new Set([...popularEventIds, ...friendsEventIds])];
  const allFriendIds = [...new Set(friendsRows.map((r) => r.friend_id))];

  const [{ data: neededEventsData }, { data: friendProfilesData }] = await Promise.all([
    neededEventIds.length > 0
      ? supabase.from("events").select(EVENT_CARD_COLUMNS).in("id", neededEventIds)
      : Promise.resolve({ data: [] as EventCardData[] }),
    allFriendIds.length > 0
      ? supabase
          .rpc("event_community_profiles_v3", { profile_ids: allFriendIds })
          .returns<{ id: string; full_name: string | null; avatar_url: string | null; role: string }[]>()
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null; role: string }[] }),
  ]);
  const eventsById = new Map((neededEventsData ?? []).map((e) => [e.id, e]));
  const friendProfilesById = new Map((friendProfilesData ?? []).map((p) => [p.id, p]));

  // 人気順（popular_upcoming_eventsの返り値の順序）を保って並べ直す。
  const popularEvents = popularEventIds.map((id) => eventsById.get(id)).filter((e): e is EventCardData => !!e);

  // 友達が参加するイベントは開催日が近い順に並べる。
  const friendsEvents = friendsEventIds
    .map((id) => eventsById.get(id))
    .filter((e): e is EventCardData => !!e)
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  const friendsByEventId = new Map<string, EventCardFriend[]>(
    friendsEventIds.map((eventId) => [
      eventId,
      (friendIdsByEventId.get(eventId) ?? [])
        .map((fid) => friendProfilesById.get(fid))
        .filter((p): p is { id: string; full_name: string | null; avatar_url: string | null; role: string } => !!p)
        .map((p) => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url })),
    ])
  );

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
                  <EventScroller events={weekEvents} />
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
                  <EventScroller events={floorEvents} />
                ) : (
                  <EmptyNote>{dict.homePortal.floorEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          if (s.section_key === "featured_events") {
            return (
              <section key={s.id} className="flex flex-col gap-3">
                <SectionHeading s={s} title={sectionTitle(s, dict.homePortal.featuredEvents.title)} />
                {pinnedEvents.length > 0 ? (
                  <EventScroller events={pinnedEvents} />
                ) : (
                  <EmptyNote>{dict.homePortal.featuredEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          if (s.section_key === "popular_events") {
            return (
              <section key={s.id} className="flex flex-col gap-3">
                <SectionHeading s={s} title={sectionTitle(s, dict.homePortal.popularEvents.title)} />
                {popularEvents.length > 0 ? (
                  <EventScroller events={popularEvents} />
                ) : (
                  <EmptyNote>{dict.homePortal.popularEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          if (s.section_key === "friends_events") {
            return (
              <section key={s.id} className="flex flex-col gap-3">
                <SectionHeading s={s} title={sectionTitle(s, dict.homePortal.friendsEvents.title)} />
                {friendsEvents.length > 0 ? (
                  <EventScroller events={friendsEvents} friendsByEventId={friendsByEventId} />
                ) : (
                  <EmptyNote>{dict.homePortal.friendsEvents.empty}</EmptyNote>
                )}
              </section>
            );
          }

          if (s.section_key !== "announcements") return null;

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

              {announcements && announcements.length > 0 && (
                <div className="divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-card">
                  {(announcements as AnnouncementRow[]).map((a) => (
                    <AnnouncementCard key={a.id} announcement={a} isRa={isRa} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
