"use client";

import Link from "next/link";
import { CalendarDays, ExternalLink, Lock, LockOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteScheduleSession, setScheduleStatus } from "@/actions/beta-tools";
import { ShareLinkButton } from "@/components/tools/share-link-button";
import { Button } from "@/components/ui/button";
import { useScheduleOperation } from "@/components/tools/use-schedule-operation";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { SCHEDULE_COPY, type ScheduleSession } from "@/lib/beta-tools";

export function ScheduleManager({ sessions }: { sessions: ScheduleSession[] }) {
  const { pending, run } = useScheduleOperation();

  function toggle(session: ScheduleSession) {
    const next = session.status === "open" ? "closed" : "open";
    void run(async () => {
      const result = await setScheduleStatus(session.id, next);
      if (result.error) toast.error(result.error); else toast.success(next === "open" ? "受付を再開しました" : "受付を終了しました");
    });
  }

  function remove(session: ScheduleSession) {
    if (pending) return;
    if (!window.confirm(`「${session.title}」を削除しますか？予約や入力済みの予定も削除されます。`)) return;
    void run(async () => {
      const result = await deleteScheduleSession(session.id);
      if (result.error) toast.error(result.error); else toast.success("日程を削除しました");
    });
  }

  return (
    <div className="space-y-3">
      <PendingFeedback active={pending} label="日程を更新しています…" />
      {sessions.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">作成済みの日程はありません</div>}
      {sessions.map((session) => (
        <article key={session.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{SCHEDULE_COPY[session.kind].shortTitle}</span><span className={session.status === "open" ? "text-xs font-semibold text-success" : "text-xs font-semibold text-muted-foreground"}>{session.status === "open" ? "受付中" : "終了"}</span></div><h2 className="mt-2 truncate font-bold">{session.title}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />{session.start_date} 〜 {session.end_date}{session.floor_number ? `・${session.floor_number}階` : ""}</p></div>
            <ShareLinkButton title={session.title} path={`/tools/schedule/${session.share_token}`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            <Button asChild size="sm" variant="outline"><Link href={`/tools/schedule/${session.share_token}`}><ExternalLink className="h-4 w-4" />管理・入力画面</Link></Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => toggle(session)}>{session.status === "open" ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}{session.status === "open" ? "受付を終了" : "受付を再開"}</Button>
            <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => remove(session)}><Trash2 className="h-4 w-4" />削除</Button>
          </div>
        </article>
      ))}
    </div>
  );
}
