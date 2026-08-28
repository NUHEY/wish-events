import Link from "next/link";
import { CalendarClock, ChevronRight, Link2, MessageCircleQuestion, MessagesSquare, UsersRound } from "lucide-react";
import { BetaBadge } from "@/components/tools/beta-badge";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export const RESIDENT_TOOLS: {
  key: FeatureFlagKey;
  createHref: string;
  residentHref: string;
  title: string;
  description: string;
  residentDescription?: string;
  icon: typeof CalendarClock;
  accent: string;
  raCreates: boolean;
}[] = [
  { key: "availability_matching", createHref: "/tools/schedule/new?mode=general", residentHref: "/tools/schedule/new?mode=general", title: "みんなの日程調整", description: "2人以上の空き時間を重ねて確認", icon: CalendarClock, accent: "from-sky-500/15 to-cyan-400/5 text-sky-700 dark:text-sky-300", raCreates: false },
  { key: "lets_chat_booking", createHref: "/tools/schedule/new?mode=lets_chat", residentHref: "/tools#active-schedules", title: "Let's Chat!", description: "フロアRAの予約ページを作成", residentDescription: "フロアRAが公開した時間から予約", icon: MessagesSquare, accent: "from-rose-500/15 to-orange-400/5 text-rose-700 dark:text-rose-300", raCreates: true },
  { key: "unit_room_sessions", createHref: "/tools/schedule/new?mode=urs", residentHref: "/tools#active-schedules", title: "URS 日程調整", description: "ルームメイトとRAの日程ページを作成", residentDescription: "RAが公開したページに予定を入力", icon: UsersRound, accent: "from-violet-500/15 to-fuchsia-400/5 text-violet-700 dark:text-violet-300", raCreates: true },
  { key: "ra_question_box", createHref: "/questions", residentHref: "/questions", title: "RAへの質問箱", description: "質問を送り、公開Q&Aを確認", icon: MessageCircleQuestion, accent: "from-amber-500/15 to-yellow-400/5 text-amber-700 dark:text-amber-300", raCreates: false },
  { key: "ra_link_hub", createHref: "/links", residentHref: "/links", title: "RAリンクページ", description: "外泊届・SNS・よく使うページ", icon: Link2, accent: "from-emerald-500/15 to-teal-400/5 text-emerald-700 dark:text-emerald-300", raCreates: false },
];

export function ResidentToolGrid({
  stateByKey,
  profileRole,
  includedKeys,
  compact = false,
  density = "minimal",
}: {
  stateByKey: Partial<Record<FeatureFlagKey, FeatureFlagState>>;
  profileRole: "resident" | "ra";
  includedKeys?: FeatureFlagKey[];
  compact?: boolean;
  density?: "minimal" | "compact";
}) {
  const tools = RESIDENT_TOOLS.filter((tool) => !includedKeys || includedKeys.includes(tool.key));
  if (compact) {
    return (
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pr-0 lg:grid-cols-3">
        {tools.map((tool) => {
          const state = stateByKey[tool.key] ?? "hidden";
          const href = profileRole === "ra" ? tool.createHref : tool.residentHref;
          return (
            <Link
              key={tool.key}
              href={href}
              className={cn(
                "flex shrink-0 snap-start items-center gap-3 rounded-xl border border-border bg-gradient-to-br px-3 shadow-sm transition-transform active:scale-[0.98] sm:w-auto",
                density === "minimal" ? "h-14 w-44 py-2" : "h-[68px] w-52 py-2.5",
                tool.accent
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card/85 shadow-sm">
                <tool.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-extrabold text-foreground">{tool.title}</span>
                  {state === "beta" && <BetaBadge />}
                </span>
                {density === "compact" && <span className="block truncate text-[11px] text-muted-foreground">{profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description}</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" />
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
        return (
          <Link key={tool.key} href={href} className={cn("group rounded-2xl border border-border bg-gradient-to-br p-4 shadow-card transition-transform active:scale-[0.98]", tool.accent)}>
            <div className="flex items-start justify-between">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card/80 shadow-sm"><tool.icon className="h-5 w-5" /></span>
              <div className="flex items-center gap-2">
                {state === "beta" && <BetaBadge />}
                {state === "hidden" && profileRole === "ra" && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">非公開プレビュー</span>}
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
            <h3 className="mt-4 font-extrabold text-foreground">{tool.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
