"use client";

import { useState } from "react";
import { Clock3, Save } from "lucide-react";
import { toast } from "sonner";
import { updateScheduleToolSettings } from "@/actions/beta-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScheduleOperation } from "@/components/tools/use-schedule-operation";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";

export function ScheduleToolSettings({ initial }: { initial: { startTime: string; endTime: string; slotMinutes: 15 | 30 | 60; maxDays: number } }) {
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(initial.slotMinutes);
  const [maxDays, setMaxDays] = useState(initial.maxDays);
  const { pending, run } = useScheduleOperation();
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <PendingFeedback active={pending} label="日程ツール設定を保存しています…" />
      <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Clock3 className="h-4 w-4" /></span><div><h2 className="font-bold">新規作成時の初期値</h2><p className="text-xs text-muted-foreground">RAが毎回入力し直さなくて済むよう、寮内でよく使う条件を設定します。</p></div></div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid min-w-0 gap-1.5"><Label htmlFor="schedule-default-start">開始時刻</Label><Input id="schedule-default-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
        <div className="grid min-w-0 gap-1.5"><Label htmlFor="schedule-default-end">終了時刻</Label><Input id="schedule-default-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div>
        <div className="grid min-w-0 gap-1.5"><Label htmlFor="schedule-default-slot">1枠の長さ</Label><Select id="schedule-default-slot" value={slotMinutes} onChange={(event) => setSlotMinutes(Number(event.target.value) as 15 | 30 | 60)}><option value={15}>15分</option><option value={30}>30分</option><option value={60}>60分</option></Select></div>
        <div className="grid min-w-0 gap-1.5"><Label htmlFor="schedule-default-days">期間の上限</Label><Input id="schedule-default-days" type="number" min={3} max={31} value={maxDays} onChange={(event) => setMaxDays(Number(event.target.value))} /><p className="text-[10px] text-muted-foreground">3〜31日</p></div>
      </div>
      <Button type="button" disabled={pending} onClick={() => void run(async () => { if (!Number.isInteger(maxDays) || maxDays < 3 || maxDays > 31) { toast.error("期間の上限は3〜31の整数で入力してください"); return; } const result = await updateScheduleToolSettings({ startTime, endTime, slotMinutes, maxDays }); if (result.error) toast.error(result.error); else toast.success("日程ツール設定を保存しました"); })}><Save className="h-4 w-4" />設定を保存</Button>
    </section>
  );
}
