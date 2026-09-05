import Link from "next/link";
import { CalendarClock, CalendarPlus, ChevronRight, Lightbulb, Link2, MessagesSquare, UsersRound } from "lucide-react";
import { BetaBadge } from "@/components/tools/beta-badge";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export const RESIDENT_TOOLS: {
  key: FeatureFlagKey;
  createHref: string;
  residentHref: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  residentDescription?: string;
  residentDescriptionEn?: string;
  icon: typeof CalendarClock;
  accent: string;
  raCreates: boolean;
}[] = [
  { key: "resident_events", createHref: "/events/community", residentHref: "/events/community", title: "イベントを募集", titleEn: "Create a meetup", description: "ご飯や外出の仲間を気軽に募集", descriptionEn: "Invite others to dinner, outings, and more", icon: CalendarPlus, accent: "from-pink-400/15 to-violet-300/5 text-pink-700 dark:text-pink-300", raCreates: false },
  { key: "availability_matching", createHref: "/tools/schedule/new?mode=general", residentHref: "/tools/schedule/new?mode=general", title: "みんなの日程調整", titleEn: "Find a time together", description: "2人以上の空き時間を重ねて確認", descriptionEn: "Compare availability for two or more people", icon: CalendarClock, accent: "from-sky-500/15 to-cyan-400/5 text-sky-700 dark:text-sky-300", raCreates: false },
  { key: "lets_chat_booking", createHref: "/tools/schedule/new?mode=lets_chat", residentHref: "/tools#active-schedules", title: "Let's Chat!", titleEn: "Let's Chat!", description: "フロアRAの予約ページを作成", descriptionEn: "Create booking slots for your floor", residentDescription: "フロアRAが公開した時間から予約", residentDescriptionEn: "Book a time published by your floor RA", icon: MessagesSquare, accent: "from-rose-500/15 to-orange-400/5 text-rose-700 dark:text-rose-300", raCreates: true },
  { key: "unit_room_sessions", createHref: "/tools/schedule/new?mode=urs", residentHref: "/tools#active-schedules", title: "URS 日程調整", titleEn: "Schedule a URS", description: "ルームメイトとRAの日程ページを作成", descriptionEn: "Coordinate a room session with roommates and an RA", residentDescription: "RAが公開したページに予定を入力", residentDescriptionEn: "Enter your availability on the RA's page", icon: UsersRound, accent: "from-violet-500/15 to-fuchsia-400/5 text-violet-700 dark:text-violet-300", raCreates: true },
  { key: "ra_link_hub", createHref: "/links", residentHref: "/links", title: "RAリンクページ", titleEn: "RA links", description: "外泊届・SNS・よく使うページ", descriptionEn: "Overnight forms, social accounts, and useful pages", icon: Link2, accent: "from-emerald-500/15 to-teal-400/5 text-emerald-700 dark:text-emerald-300", raCreates: false },
  { key: "wish_knowledge", createHref: "/wisdom", residentHref: "/wisdom", title: "WISH知恵袋", titleEn: "WISH Knowledge", description: "寮生活の疑問を共有・RAだけへの相談も", descriptionEn: "Share dorm questions or ask RAs privately", icon: Lightbulb, accent: "from-amber-400/15 to-lime-300/5 text-amber-700 dark:text-amber-300", raCreates: false },
];

export function ResidentToolGrid({
  stateByKey,
  profileRole,
  includedKeys,
  compact = false,
  density = "minimal",
  locale = "ja",
}: {
  stateByKey: Partial<Record<FeatureFlagKey, FeatureFlagState>>;
  profileRole: "resident" | "ra";
  includedKeys?: FeatureFlagKey[];
  compact?: boolean;
  density?: "minimal" | "compact";
  locale?: Locale;
}) {
  const tools = RESIDENT_TOOLS.filter((tool) => !includedKeys || includedKeys.includes(tool.key));
  if (compact) {
    return (
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-3">
        {tools.map((tool) => {
          const state = stateByKey[tool.key] ?? "hidden";
          const href = profileRole === "ra" ? tool.createHref : tool.residentHref;
          const title = locale === "en" ? tool.titleEn : tool.title;
          const description = locale === "en"
            ? profileRole === "resident" && tool.residentDescriptionEn ? tool.residentDescriptionEn : tool.descriptionEn
            : profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description;
          return (
            <Link
              key={tool.key}
              href={href}
              className={cn(
                "flex shrink-0 snap-start flex-col items-start justify-between gap-3 rounded-xl border border-border bg-gradient-to-br p-3.5 shadow-sm transition-transform active:scale-[0.98] sm:min-h-24 sm:w-auto sm:flex-row sm:items-center",
                density === "minimal" ? "min-h-44 w-40" : "min-h-48 w-44",
                tool.accent
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card/85 shadow-sm">
                <tool.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-balance break-words text-sm font-extrabold text-foreground">{title}</span>
                  {state === "beta" && <BetaBadge />}
                </span>
                <span className={cn("mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground", density === "minimal" && "sm:hidden")}>{description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 self-end sm:self-auto" />
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => {
        const state = stateByKey[tool.key] ?? "hidden";
        const href = profileRole === "ra" ? tool.createHref : tool.residentHref;
        const title = locale === "en" ? tool.titleEn : tool.title;
        const description = locale === "en"
          ? profileRole === "resident" && tool.residentDescriptionEn ? tool.residentDescriptionEn : tool.descriptionEn
          : profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description;
        return (
          <Link key={tool.key} href={href} className={cn("group rounded-2xl border border-border bg-gradient-to-br p-4 shadow-card transition-transform active:scale-[0.98]", tool.accent)}>
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-card/80 shadow-sm"><tool.icon className="h-5 w-5" /></span>
              <div className="flex items-center gap-2">
                {state === "beta" && <BetaBadge />}
                {state === "hidden" && profileRole === "ra" && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">{locale === "en" ? "Private preview" : "非公開プレビュー"}</span>}
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
            <h3 className="mt-4 font-extrabold text-foreground">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </Link>
        );
      })}
    </div>
  );
}
