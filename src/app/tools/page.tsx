import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState, type FeatureFlagKey } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { BetaBadge } from "@/components/tools/beta-badge";
import { RESIDENT_TOOLS, ResidentToolGrid } from "@/components/tools/resident-tool-grid";
import type { ScheduleSession } from "@/lib/beta-tools";
import { getDictionary, getLocale } from "@/lib/i18n";

export default async function ToolsPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();
  const states = await Promise.all(RESIDENT_TOOLS.map((tool) => getFeatureFlagState(tool.key)));
  const stateByKey = Object.fromEntries(RESIDENT_TOOLS.map((tool, index) => [tool.key, states[index]])) as Partial<Record<FeatureFlagKey, "public" | "beta" | "hidden">>;
  const visibleKeys = RESIDENT_TOOLS.filter((tool) => profile.role === "ra" || stateByKey[tool.key] !== "hidden").map((tool) => tool.key);
  const supabase = await createClient();
  const { data, error: schedulesError } = await supabase.from("schedule_sessions").select("*").order("created_at", { ascending: false }).limit(12);
  const sessions = (data ?? []) as ScheduleSession[];

  const toolGroups: { title: string; keys: FeatureFlagKey[] }[] = [
    { title: locale === "ja" ? "日程調整・RAの予約" : "Scheduling & RA bookings", keys: ["availability_matching", "lets_chat_booking", "unit_room_sessions"] },
    { title: locale === "ja" ? "寮生活・相談" : "Dorm life & advice", keys: ["ra_question_box", "ra_link_hub", "wish_knowledge"] },
    { title: locale === "ja" ? "仲間を募集" : "Meet up with others", keys: ["resident_events"] },
  ];
  const showSchedules = sessions.length > 0 || visibleKeys.some((key) => ["availability_matching", "lets_chat_booking", "unit_room_sessions"].includes(key));

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">{dict.residentTools.eyebrow}</span></div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{dict.residentTools.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{dict.residentTools.subtitle}</p>
      </header>
      {visibleKeys.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="font-bold">{dict.residentTools.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{dict.residentTools.emptyHint}</p>
        </section>
      ) : toolGroups.map((group) => {
        const keys = group.keys.filter((key) => visibleKeys.includes(key));
        if (!keys.length) return null;
        return (
          <section key={group.title} className="space-y-3">
            <h2 className="text-lg font-bold">{group.title}</h2>
            <ResidentToolGrid stateByKey={stateByKey} profileRole={profile.role} includedKeys={keys} locale={locale} />
          </section>
        );
      })}
      {showSchedules && (
        <section id="active-schedules" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-bold">{dict.residentTools.activeSchedules}</h2>
          {schedulesError ? (
            <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
              {locale === "ja" ? "日程を読み込めませんでした。時間をおいて、再読み込みしてください。" : "Schedules could not be loaded. Please try reloading in a moment."}
            </p>
          ) : sessions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              {locale === "ja" ? "現在、公開されている日程はありません。RAの予約ページは、フロアRAが公開するとここに表示されます。" : "No schedules are available yet. Booking pages appear here after your floor RA publishes them."}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {sessions.map((session) => (
                <Link key={session.id} href={`/tools/schedule/${session.share_token}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99]">
                  <span className="min-w-0"><span className="block truncate font-bold">{session.title}</span><span className="mt-1 block text-xs text-muted-foreground">{session.start_date} 〜 {session.end_date}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
