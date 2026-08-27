"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Check, Search, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { createScheduleSession } from "@/actions/beta-tools";
import { BetaBadge } from "@/components/tools/beta-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FLOORS } from "@/lib/constants";
import { SCHEDULE_COPY, type ScheduleKind } from "@/lib/beta-tools";
import { cn, formatRoomNumber } from "@/lib/utils";
import type { DirectoryProfileRow } from "@/types/database";

export function ScheduleCreator({ kind, profiles, currentUserId, currentFloor, isRa }: { kind: ScheduleKind; profiles: DirectoryProfileRow[]; currentUserId: string; currentFloor: number | null; isRa: boolean }) {
  const router = useRouter();
  const copy = SCHEDULE_COPY[kind];
  const [title, setTitle] = useState(kind === "lets_chat" ? "Let's Chat! 予約" : kind === "urs" ? "Unit Room Session" : "");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyStartTime, setDailyStartTime] = useState("09:00");
  const [dailyEndTime, setDailyEndTime] = useState("21:00");
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30);
  const [floorNumber, setFloorNumber] = useState(currentFloor ?? 3);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [raIds, setRaIds] = useState<string[]>(kind === "lets_chat" && isRa ? [currentUserId] : []);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const residents = useMemo(() => profiles.filter((profile) => profile.id !== currentUserId && (kind === "general" || profile.role === "resident") && `${profile.full_name ?? ""} ${profile.room_number ?? ""}`.toLowerCase().includes(query.toLowerCase())), [currentUserId, kind, profiles, query]);
  const ras = useMemo(() => profiles.filter((profile) => profile.role === "ra" && (kind !== "lets_chat" || profile.floor_number === floorNumber) && `${profile.full_name ?? ""} ${profile.room_number ?? ""}`.toLowerCase().includes(query.toLowerCase())), [floorNumber, kind, profiles, query]);

  function toggleParticipant(id: string) {
    setParticipantIds((current) => current.includes(id) ? current.filter((value) => value !== id) : kind === "urs" && current.length >= 4 ? current : [...current, id]);
  }

  function toggleRa(id: string) {
    setRaIds((current) => kind === "urs" ? (current.includes(id) ? [] : [id]) : current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function submit() {
    if (!startDate || !endDate) return toast.error("期間を入力してください");
    startTransition(async () => {
      const result = await createScheduleSession({ kind, title, description, startDate, endDate, dailyStartTime, dailyEndTime, slotMinutes, floorNumber, participantIds, raIds });
      if (result.error || !result.token) {
        toast.error(result.error ?? "作成できませんでした");
        return;
      }
      toast.success("日程調整ページを作成しました");
      router.replace(`/tools/schedule/${result.token}`);
    });
  }

  const selectedCount = kind === "lets_chat" ? raIds.length : participantIds.length + (kind === "general" ? 1 : raIds.length);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PendingFeedback active={pending} label="日程調整ページを作成しています…" />
      <header className="rounded-3xl bg-gradient-to-br from-primary/[0.12] via-card to-accent/40 p-5 sm:p-7">
        <div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">新しい調整を作成</span></div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{copy.title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      </header>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" />基本情報</div>
        <div className="grid gap-2"><Label htmlFor="schedule-title">タイトル</Label><Input id="schedule-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="例: 夏休み旅行の打ち合わせ" /></div>
        <div className="grid gap-2"><Label htmlFor="schedule-description">説明（任意）</Label><Textarea id="schedule-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} placeholder="集合場所や、入力してほしい期限など" /></div>
        {kind === "lets_chat" && <div className="grid gap-2"><Label htmlFor="schedule-floor">対象フロア</Label><Select id="schedule-floor" value={floorNumber} onChange={(event) => { setFloorNumber(Number(event.target.value)); setRaIds([]); }}>{FLOORS.map((floor) => <option key={floor} value={floor}>{floor}階</option>)}</Select></div>}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-2 font-bold"><CalendarRange className="h-4 w-4 text-primary" />候補期間</div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="schedule-start-date">開始日</Label><Input id="schedule-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="schedule-end-date">終了日</Label><Input id="schedule-end-date" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></div></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3"><div className="grid gap-2"><Label htmlFor="daily-start">開始時刻</Label><Input id="daily-start" type="time" value={dailyStartTime} onChange={(event) => setDailyStartTime(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="daily-end">終了時刻</Label><Input id="daily-end" type="time" value={dailyEndTime} onChange={(event) => setDailyEndTime(event.target.value)} /></div><div className="col-span-2 grid gap-2 sm:col-span-1"><Label htmlFor="slot-minutes">1枠</Label><Select id="slot-minutes" value={slotMinutes} onChange={(event) => setSlotMinutes(Number(event.target.value) as 15 | 30 | 60)}><option value={15}>15分</option><option value={30}>30分</option><option value={60}>60分</option></Select></div></div>
        <p className="text-xs text-muted-foreground">期間は最大31日。表示する時間帯を絞ると、スマホでも入力しやすくなります。</p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-primary" />{kind === "lets_chat" ? "担当RA" : kind === "urs" ? "ルームメイトと担当RA" : "参加する寮生"}</div><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{selectedCount}人</span></div>
        <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="名前・部屋番号で検索" /></div>
        {kind !== "lets_chat" && <div><p className="mb-2 text-xs font-semibold text-muted-foreground">{kind === "urs" ? "参加するルームメイト（2〜4人）" : "寮生を選択"}</p><div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{residents.map((person) => <PersonRow key={person.id} person={person} checked={participantIds.includes(person.id)} onToggle={() => toggleParticipant(person.id)} />)}{residents.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">該当する寮生がいません</p>}</div></div>}
        {(kind === "lets_chat" || kind === "urs") && <div><p className="mb-2 text-xs font-semibold text-muted-foreground">担当RA {kind === "urs" && "（1人）"}</p><div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{ras.map((person) => <PersonRow key={person.id} person={person} checked={raIds.includes(person.id)} onToggle={() => toggleRa(person.id)} />)}{ras.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">対象のRAがいません</p>}</div></div>}
      </section>

      <Button type="button" size="lg" className="w-full rounded-xl" disabled={pending || !title.trim() || !startDate || !endDate} onClick={submit}><Check className="h-4 w-4" />{pending ? "作成中…" : "日程調整ページを作成"}</Button>
    </div>
  );
}

function PersonRow({ person, checked, onToggle }: { person: DirectoryProfileRow; checked: boolean; onToggle: () => void }) {
  return <label className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors active:scale-[0.99]", checked ? "bg-primary/[0.09]" : "active:bg-secondary")}><Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`${person.full_name ?? "名前未登録"}を選択`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.full_name ?? "名前未登録"}</span><span className="block text-xs text-muted-foreground">{formatRoomNumber(person.floor_number, person.room_number)}</span></span>{person.role === "ra" && <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">RA</span>}</label>;
}
