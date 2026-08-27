import Link from "next/link";
import { CalendarClock, ChevronRight, Link2, MessageCircleQuestion, MessagesSquare, UsersRound } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState, type FeatureFlagKey } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { BetaBadge } from "@/components/tools/beta-badge";
import { cn } from "@/lib/utils";
import type { ScheduleSession } from "@/lib/beta-tools";

const toolCards: { key: FeatureFlagKey; href: string; title: string; description: string; icon: typeof CalendarClock; accent: string }[] = [
  { key: "availability_matching", href: "/tools/schedule/new?mode=general", title: "みんなの日程調整", description: "2人以上の空き時間を重ねて確認", icon: CalendarClock, accent: "from-sky-500/15 to-cyan-400/5 text-sky-700 dark:text-sky-300" },
  { key: "lets_chat_booking", href: "/tools/schedule/new?mode=lets_chat", title: "Let's Chat!", description: "フロアRAの空き時間を予約", icon: MessagesSquare, accent: "from-rose-500/15 to-orange-400/5 text-rose-700 dark:text-rose-300" },
  { key: "unit_room_sessions", href: "/tools/schedule/new?mode=urs", title: "URS 日程調整", description: "ルームメイトとRAで時間を調整", icon: UsersRound, accent: "from-violet-500/15 to-fuchsia-400/5 text-violet-700 dark:text-violet-300" },
  { key: "ra_question_box", href: "/questions", title: "RAへの質問箱", description: "質問を送り、公開Q&Aを確認", icon: MessageCircleQuestion, accent: "from-amber-500/15 to-yellow-400/5 text-amber-700 dark:text-amber-300" },
  { key: "ra_link_hub", href: "/links", title: "RAリンクページ", description: "外泊届・SNS・よく使うページ", icon: Link2, accent: "from-emerald-500/15 to-teal-400/5 text-emerald-700 dark:text-emerald-300" },
];

export default async function ToolsPage() {
  const profile = await getCurrentProfile();
  const states = await Promise.all(toolCards.map((tool) => getFeatureFlagState(tool.key)));
  const stateByKey = new Map(toolCards.map((tool, index) => [tool.key, states[index]]));
  const visibleTools = toolCards.filter((tool) => profile.role === "ra" || stateByKey.get(tool.key) !== "hidden");
  const supabase = await createClient();
  const { data } = await supabase.from("schedule_sessions").select("*").order("created_at", { ascending: false }).limit(12);
  const sessions = (data ?? []) as ScheduleSession[];

  return <div className="space-y-6"><header><div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">Resident tools</span></div><h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">寮生活を、少し便利に。</h1><p className="mt-2 text-sm text-muted-foreground">日程調整やRAへの質問など、WISH内で完結する便利ツールです。</p></header>
    {visibleTools.length === 0 ? <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><p className="font-bold">現在公開中のツールはありません</p><p className="mt-1 text-sm text-muted-foreground">RAが公開すると、ここに表示されます。</p></section> : <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleTools.map((tool) => { const state = stateByKey.get(tool.key); const createOnlyRa = tool.key === "lets_chat_booking" && profile.role !== "ra"; const href = createOnlyRa ? "/tools" : tool.href; return <Link key={tool.key} href={href} className={cn("group rounded-2xl border border-border bg-gradient-to-br p-4 shadow-card transition-transform active:scale-[0.98]", tool.accent, createOnlyRa && "pointer-events-none opacity-70")}><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card/80 shadow-sm"><tool.icon className="h-5 w-5" /></span><div className="flex items-center gap-2">{state === "beta" && <BetaBadge />}{state === "hidden" && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">非公開プレビュー</span>}<ChevronRight className="h-4 w-4" /></div></div><h2 className="mt-4 font-extrabold text-foreground">{tool.title}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{createOnlyRa ? "共有された予約URLから利用できます" : tool.description}</p></Link>; })}</section>}
    {sessions.length > 0 && <section><h2 className="mb-3 text-lg font-bold">参加中の日程調整</h2><div className="grid gap-2 sm:grid-cols-2">{sessions.map((session) => <Link key={session.id} href={`/tools/schedule/${session.share_token}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm active:scale-[0.99]"><span className="min-w-0"><span className="block truncate font-bold">{session.title}</span><span className="mt-1 block text-xs text-muted-foreground">{session.start_date} 〜 {session.end_date}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div></section>}
  </div>;
}
