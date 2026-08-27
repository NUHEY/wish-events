import Link from "next/link";
import { CalendarClock, MessagesSquare, Plus, UsersRound } from "lucide-react";
import { ScheduleManager } from "@/components/dashboard/schedule-manager";
import { Button } from "@/components/ui/button";
import { requireRa } from "@/lib/auth";
import type { ScheduleSession } from "@/lib/beta-tools";
import { createClient } from "@/lib/supabase/server";

const createOptions = [
  { mode: "lets_chat", title: "Let's Chat!", note: "RAの空き枠を公開して新寮生の予約を受け付ける", icon: MessagesSquare },
  { mode: "urs", title: "URS", note: "ルームメイトと担当RAの日程を合わせる", icon: UsersRound },
  { mode: "general", title: "一般の日程調整", note: "任意の寮生で空き時間を重ねる", icon: CalendarClock },
] as const;

export default async function DashboardSchedulesPage() {
  await requireRa();
  const supabase = await createClient();
  const { data } = await supabase.from("schedule_sessions").select("*").order("created_at", { ascending: false }).limit(100);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header><h1 className="text-2xl font-bold tracking-tight">日程・予約の管理</h1><p className="mt-1 text-sm text-muted-foreground">RAがページを作成し、寮生には入力・予約用URLを共有します。</p></header>
      <section className="grid gap-3 sm:grid-cols-3">
        {createOptions.map((option) => <Button key={option.mode} asChild variant="outline" className="h-auto justify-start rounded-2xl p-4 text-left"><Link href={`/tools/schedule/new?mode=${option.mode}`}><span className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><option.icon className="h-5 w-5" /></span><span><span className="flex items-center gap-1 font-bold"><Plus className="h-3.5 w-3.5" />{option.title}</span><span className="mt-1 block whitespace-normal text-xs font-normal text-muted-foreground">{option.note}</span></span></Link></Button>)}
      </section>
      <section><h2 className="mb-3 text-lg font-bold">作成済みの日程</h2><ScheduleManager sessions={(data ?? []) as ScheduleSession[]} /></section>
    </div>
  );
}
