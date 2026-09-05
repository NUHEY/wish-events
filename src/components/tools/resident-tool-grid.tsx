import Link from "next/link";
import { CalendarClock, CalendarPlus, ChevronRight, Lightbulb, Link2, MessagesSquare, UsersRound } from "lucide-react";
import { ToolCard } from "@/components/tools/tool-card";
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
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3">
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
                "flex min-h-24 min-w-0 flex-col items-start justify-center gap-2 sm:flex-row sm:items-center rounded-xl border border-border bg-gradient-to-br p-3 shadow-sm transition-transform active:scale-[0.98] sm:gap-3 sm:p-3.5",
                tool.accent
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/85 shadow-sm sm:h-10 sm:w-10">
                <tool.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 w-full sm:w-auto sm:flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words text-xs font-bold sm:text-sm text-foreground">{title}</span>
                  {state === "beta" && <BetaBadge />}
                </span>
                {density === "compact" && <span className="mt-1 hidden text-[11px] leading-relaxed text-muted-foreground sm:line-clamp-2">{description}</span>}
              </span>
              <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
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
          <ToolCard key={tool.key} href={href} title={title} description={description} icon={tool.icon} accent={tool.accent}
            badges={<>{state === "beta" && <BetaBadge />}{state === "hidden" && profileRole === "ra" && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">{locale === "en" ? "Private preview" : "非公開プレビュー"}</span>}</>} />
        );
      })}
    </div>
  );
}
