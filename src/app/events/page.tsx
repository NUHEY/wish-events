import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventCard } from "@/components/events/event-card";
import { EventFilter } from "@/components/events/event-filter";
import { EventStatusFilter } from "@/components/events/event-status-filter";
import { EventCalendar } from "@/components/events/event-calendar";
import { PendingSurveyBanner } from "@/components/surveys/pending-survey-banner";
import { Input } from "@/components/ui/input";
import { getLocale, getDictionary } from "@/lib/i18n";
import { EVENT_CARD_COLUMNS } from "@/lib/utils";
import type { EventCategory, EventCardData } from "@/types/database";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { Button, buttonVariants } from "@/components/ui/button";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    status?: string;
    date?: string;
    from?: string;
    to?: string;
    month?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  const { category, q, status, date, from, to, month } = await searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const now = new Date().toISOString();
  const residentEventState = await getFeatureFlagState("resident_events");

  const isDateKey = (v: string | undefined): v is string => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const parsed = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
  };
  const isMonthKey = (v: string | undefined): v is string => !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

  // 日付系の絞り込みは「単日」「期間（いつからいつ）」「月指定（何月中）」の
  // いずれか1つが有効という前提でURLが組み立てられる（event-calendar.tsx側で排他制御）。
  // ここでは優先順位: 単日 > 期間 > 月 の順で解決し、開催状況に関わらずその範囲だけに絞り込む。
  let dateRange: { start: string | null; end: string | null } | null = null;
  if (isDateKey(date)) {
    dateRange = { start: `${date}T00:00:00+09:00`, end: `${date}T23:59:59.999+09:00` };
  } else if (isDateKey(from) || isDateKey(to)) {
    dateRange = {
      start: isDateKey(from) ? `${from}T00:00:00+09:00` : null,
      end: isDateKey(to) ? `${to}T23:59:59.999+09:00` : null,
    };
  } else if (isMonthKey(month)) {
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    dateRange = {
      start: `${month}-01T00:00:00+09:00`,
      end: `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999+09:00`,
    };
  }

  const eventCardQuery = () => supabase.from("events").select(EVENT_CARD_COLUMNS);
  function applyCommonFilters(q: ReturnType<typeof eventCardQuery>) {
    let query_ = q;
    if (category) query_ = query_.eq("category", category as EventCategory);
    if (query) {
      const escaped = query.replace(/[%,]/g, "");
      query_ = query_.or(`title.ilike.%${escaped}%,title_en.ilike.%${escaped}%`);
    }
    return query_;
  }

  const showUpcoming = !dateRange && status !== "past";
  const showPast = !dateRange && status !== "upcoming";
  const showDateOnly = !!dateRange;

  // 一覧では EventCard に必要な列だけを取得し、転送量を減らして表示を高速化する。
  const upcomingQuery = applyCommonFilters(
    supabase.from("events").select(EVENT_CARD_COLUMNS).gte("event_date", now).order("event_date", { ascending: true })
  );
  const pastQuery = applyCommonFilters(
    supabase.from("events").select(EVENT_CARD_COLUMNS).lt("event_date", now).order("event_date", { ascending: false })
  );
  const dateQuery = dateRange
    ? applyCommonFilters(
        (() => {
          let q_ = supabase.from("events").select(EVENT_CARD_COLUMNS);
          if (dateRange.start) q_ = q_.gte("event_date", dateRange.start);
          if (dateRange.end) q_ = q_.lte("event_date", dateRange.end);
          return q_.order("event_date", { ascending: true });
        })()
      )
    : null;

  const [
    { data: upcomingEventsRaw, error: upcomingError },
    { data: pastEventsRaw, error: pastError },
    { data: dateEventsRaw, error: dateError },
  ] = await Promise.all([
    showUpcoming ? upcomingQuery : Promise.resolve({ data: [] as EventCardData[], error: null }),
    showPast ? pastQuery : Promise.resolve({ data: [] as EventCardData[], error: null }),
    dateQuery ?? Promise.resolve({ data: [] as EventCardData[], error: null }),
  ]);
  // 日付・過去イベントの取得失敗も「0件」として隠さず、再試行できるようにする。
  const error = upcomingError || pastError || dateError;
  const allUpcomingEvents = (upcomingEventsRaw as EventCardData[] | null) ?? [];
  const allPastEvents = (pastEventsRaw as EventCardData[] | null) ?? [];
  const allDateEvents = (dateEventsRaw as EventCardData[] | null) ?? [];
  const mayCreateEvents = profile.account_kind === "resident" || canManage(await getManagementAccess(), "events");
  const canShowResidentEvents = profile.role === "ra" || residentEventState !== "hidden";
  const canShowEvent = (event: EventCardData) =>
    event.creator_type === "ra" || canShowResidentEvents;
  // 一覧では公式・寮生イベントを同じ検索結果にまとめる。ホームのみ別セクションを維持する。
  const upcomingEvents = allUpcomingEvents.filter(canShowEvent);
  const pastEvents = allPastEvents.filter(canShowEvent);
  const dateEvents = allDateEvents.filter(canShowEvent);
  const calendarDates = [...upcomingEvents, ...pastEvents, ...dateEvents].map((event) => event.event_date);

  const hasUpcoming = !!upcomingEvents && upcomingEvents.length > 0;
  const hasPast = !!pastEvents && pastEvents.length > 0;
  const hasDateResults = !!dateEvents && dateEvents.length > 0;
  const hasFilters = !!(query || category || (status && status !== "all") || date || from || to || month);

  return (
    <div className="relative flex flex-col gap-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 -z-10 h-64 bg-hero-radial" />

      <PendingSurveyBanner userId={profile.id} />

      <div className="flex flex-col gap-3.5 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5"><h1 className="text-3xl font-bold tracking-tight">{dict.home.title}</h1><p className="text-sm text-muted-foreground">{dict.home.subtitle}</p></div>
          {mayCreateEvents && (profile.role === "ra" || residentEventState !== "hidden") && <Link href="/events/community" className={buttonVariants({ size: "sm", variant: "outline", className: "shrink-0 rounded-full" })}><CalendarPlus className="h-4 w-4" /><span className="hidden sm:inline">{dict.home.createCommunityEvent}</span><span className="sm:hidden">{dict.home.createCommunityEventShort}</span></Link>}
        </div>
        <form action="/events" method="get" role="search" aria-label={dict.home.searchPlaceholder} className="flex max-w-md items-center gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          {status && <input type="hidden" name="status" value={status} />}
          {date && <input type="hidden" name="date" value={date} />}
          {from && <input type="hidden" name="from" value={from} />}
          {to && <input type="hidden" name="to" value={to} />}
          {month && <input type="hidden" name="month" value={month} />}
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={query}
              type="search"
              name="q"
              aria-label={dict.home.searchPlaceholder}
              enterKeyHint="search"
              defaultValue={query}
              placeholder={dict.home.searchPlaceholder}
              className="h-11 rounded-full pl-10 shadow-sm"
            />
          </div>
          <Button type="submit" className="h-11 shrink-0 rounded-full">{dict.common.search}</Button>
        </form>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">{dict.eventForm.categoryLabel}</legend>
          <EventFilter />
        </fieldset>
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-xs font-semibold text-muted-foreground">{locale === "ja" ? "開催状況" : "Event status"}</legend>
          <EventStatusFilter />
          {showDateOnly && <p className="text-xs text-muted-foreground">{locale === "ja" ? "指定した日付のイベントを表示しています。開催状況を選ぶと日付指定が解除されます。" : "Showing events for your selected dates. Choosing a status clears the date filter."}</p>}
        </fieldset>
        <EventCalendar eventDates={calendarDates} />
        {hasFilters && (
          <Link href="/events" className={buttonVariants({ variant: "outline", className: "min-h-11 w-fit rounded-full" })}>
            {dict.home.clearFilters}
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {dict.home.loadError}{locale === "ja" ? "。時間をおいて、ページを再読み込みしてください。" : ". Please wait a moment and reload the page."}
        </p>
      )}

      {showDateOnly ? (
        <>
          {!dateError && !hasDateResults && (
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-secondary/40 py-20 text-center">
              <p className="text-sm font-medium">{dict.home.empty}</p>
              <p className="text-xs text-muted-foreground">{dict.home.emptyHint}</p>
            </div>
          )}
          {hasDateResults && (
            <>
              <p className="text-sm text-muted-foreground">
                {dict.home.dateResultsCount.replace("{count}", String(dateEvents.length))}
              </p>
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {dateEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {!error && !hasUpcoming && !hasPast && (
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-secondary/40 py-20 text-center">
              <p className="text-sm font-medium">
                {query ? dict.home.noSearchResults.replace("{query}", query) : dict.home.empty}
              </p>
              <p className="text-xs text-muted-foreground">{dict.home.emptyHint}</p>
            </div>
          )}

          {showUpcoming && !upcomingError && !hasUpcoming && hasPast && (
            <p className="text-sm text-muted-foreground">{dict.home.noUpcoming}</p>
          )}

          {hasUpcoming && (
            <section className="flex flex-col gap-3">
              <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          )}

          {hasPast && status === "past" && (
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} variant="muted" />
              ))}
            </div>
          )}

          {hasPast && status !== "past" && (
            <details className="group border-t border-border pt-5">
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90" />
                {dict.home.pastEventsToggle}（{pastEvents!.length}）
              </summary>
              <div className="mt-4 grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} variant="muted" />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
