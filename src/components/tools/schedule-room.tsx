"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Clock3, Save, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { bookLetsChatSlot, saveScheduleAvailability } from "@/actions/beta-tools";
import { BetaBadge } from "@/components/tools/beta-badge";
import { ShareLinkButton } from "@/components/tools/share-link-button";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { SCHEDULE_COPY, type ScheduleAvailability, type ScheduleBooking, type ScheduleParticipant, type ScheduleSession } from "@/lib/beta-tools";
import { cn, formatRoomNumber } from "@/lib/utils";

type Slot = { key: string; startAt: string; endAt: string; date: string; time: string };
type OpenLetsChatSlot = { ra_id: string; start_at: string; end_at: string };
type NamedBooking = ScheduleBooking & { resident_name?: string | null; ra_name?: string | null };

function createSlots(session: ScheduleSession): Slot[] {
  const slots: Slot[] = [];
  const firstDay = Date.parse(`${session.start_date}T00:00:00Z`);
  const lastDay = Date.parse(`${session.end_date}T00:00:00Z`);
  for (let day = firstDay; day <= lastDay; day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    const [startHour, startMinute] = session.daily_start_time.slice(0, 5).split(":").map(Number);
    const [endHour, endMinute] = session.daily_end_time.slice(0, 5).split(":").map(Number);
    let minute = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    while (minute + session.slot_minutes <= end) {
      const hourText = String(Math.floor(minute / 60)).padStart(2, "0");
      const minuteText = String(minute % 60).padStart(2, "0");
      const startAt = new Date(`${date}T${hourText}:${minuteText}:00+09:00`);
      const endAt = new Date(startAt.getTime() + session.slot_minutes * 60_000);
      slots.push({ key: startAt.toISOString(), startAt: startAt.toISOString(), endAt: endAt.toISOString(), date, time: `${hourText}:${minuteText}` });
      minute += session.slot_minutes;
    }
  }
  return slots;
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" }).format(new Date(`${date}T00:00:00+09:00`));
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function tokyoDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function groupBy<T>(items: T[], keyFor: (item: T) => string) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keyFor(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return groups;
}

export function ScheduleRoom({ session, participants, availability, openLetsChatSlots, bookings, currentUserId, currentUserRole }: { session: ScheduleSession; participants: ScheduleParticipant[]; availability: ScheduleAvailability[]; openLetsChatSlots: OpenLetsChatSlot[]; bookings: NamedBooking[]; currentUserId: string; currentUserRole: "resident" | "ra" }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(availability.filter((item) => item.user_id === currentUserId).map((item) => item.start_at)));
  const [pending, startTransition] = useTransition();
  const slots = useMemo(() => createSlots(session), [session]);
  const grouped = useMemo(() => groupBy(slots, (slot) => slot.date), [slots]);
  const profileById = useMemo(() => new Map(participants.map((person) => [person.user_id, person])), [participants]);
  const currentParticipant = profileById.get(currentUserId);
  const canEnterAvailability = session.status === "open" && !!currentParticipant && (session.kind !== "lets_chat" || currentParticipant.participant_role === "ra");
  const currentBooking = bookings.find((booking) => booking.resident_id === currentUserId && booking.status === "confirmed");

  const availabilityCount = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    availability.forEach((item) => {
      if (!counts.has(item.start_at)) counts.set(item.start_at, new Set());
      counts.get(item.start_at)?.add(item.user_id);
    });
    return counts;
  }, [availability]);

  const bestSlots = useMemo(() => slots.map((slot) => ({ slot, count: availabilityCount.get(slot.startAt)?.size ?? 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.slot.startAt.localeCompare(b.slot.startAt)).slice(0, 6), [availabilityCount, slots]);

  function toggleSlot(startAt: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(startAt)) next.delete(startAt); else next.add(startAt);
      return next;
    });
  }

  function save() {
    const chosen = slots.filter((slot) => selected.has(slot.startAt)).map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt }));
    startTransition(async () => {
      const result = await saveScheduleAvailability(session.id, chosen);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.count ?? 0}枠の空き時間を保存しました`);
      router.refresh();
    });
  }

  function book(raId: string, startAt: string) {
    if (!window.confirm(`${dateTimeLabel(startAt)}で予約しますか？`)) return;
    startTransition(async () => {
      const result = await bookLetsChatSlot(session.id, raId, startAt);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Let's Chat!を予約しました");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PendingFeedback active={pending} label={session.kind === "lets_chat" && !canEnterAvailability ? "予約しています…" : "空き時間を保存しています…"} />
      <header className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/[0.13] via-card to-accent/35 p-5 shadow-card sm:p-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">{SCHEDULE_COPY[session.kind].shortTitle}</span></div><ShareLinkButton title={session.title} path={`/tools/schedule/${session.share_token}`} /></div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{session.title}</h1>
        {session.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{session.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5"><CalendarCheck className="h-3.5 w-3.5 text-primary" />{dateLabel(session.start_date)}〜{dateLabel(session.end_date)}</span><span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" />{session.daily_start_time.slice(0, 5)}〜{session.daily_end_time.slice(0, 5)}・{session.slot_minutes}分枠</span></div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-primary" />参加メンバー</div>
        <div className="mt-3 flex flex-wrap gap-2">{participants.map((person) => <span key={person.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{person.full_name ?? "名前未登録"}{person.participant_role === "ra" && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] text-primary-foreground">RA</span>}<span className="font-normal text-muted-foreground">{formatRoomNumber(person.floor_number ?? null, person.room_number ?? null)}</span></span>)}</div>
      </section>

      {session.kind === "lets_chat" && !canEnterAvailability ? (
        <LetsChatBookingPanel slots={openLetsChatSlots} profileById={profileById} currentBooking={currentBooking} pending={pending} onBook={book} />
      ) : (
        <>
          {session.kind !== "lets_chat" && bestSlots.length > 0 && <section className="rounded-2xl border border-primary/15 bg-primary/[0.055] p-4 sm:p-5"><div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" />集まりやすい時間</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{bestSlots.map(({ slot, count }) => <div key={slot.key} className="flex items-center justify-between rounded-xl bg-card px-3 py-3 shadow-sm"><span className="text-sm font-semibold">{dateTimeLabel(slot.startAt)}</span><span className={cn("rounded-full px-2 py-1 text-xs font-bold", count === participants.length ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-secondary text-muted-foreground")}>{count}/{participants.length}人</span></div>)}</div></section>}
          {canEnterAvailability && <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div><div className="flex items-center justify-between gap-3"><h2 className="font-bold">空いている時間を選択</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{selected.size}枠</span></div><p className="mt-1 text-xs text-muted-foreground">空いている時間をすべてタップしてください。もう一度押すと解除できます。</p></div><div className="space-y-5">{Array.from(grouped.entries()).map(([date, dateSlots]) => <div key={date}><h3 className="mb-2 text-sm font-bold">{dateLabel(date)}</h3><div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">{dateSlots.map((slot) => { const active = selected.has(slot.startAt); const count = availabilityCount.get(slot.startAt)?.size ?? 0; return <button key={slot.key} type="button" disabled={pending} onClick={() => toggleSlot(slot.startAt)} className={cn("relative rounded-xl border px-2 py-2.5 text-sm font-semibold transition-[background-color,border-color,transform] active:scale-95", active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background active:bg-secondary")}><span>{slot.time}</span>{session.kind !== "lets_chat" && count > 0 && <span className={cn("absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold", active ? "bg-primary-foreground text-primary" : "bg-secondary text-muted-foreground")}>{count}</span>}</button>; })}</div></div>)}</div><Button type="button" className="sticky bottom-[calc(var(--mobile-tab-bar-total-height)+0.75rem)] w-full rounded-xl sm:static" disabled={pending} onClick={save}><Save className="h-4 w-4" />{pending ? "保存中…" : "選択した空き時間を保存"}</Button></section>}
        </>
      )}

      {currentUserRole === "ra" && session.kind === "lets_chat" && bookings.length > 0 && <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><h2 className="font-bold">確定した予約</h2><div className="mt-3 space-y-2">{bookings.filter((booking) => booking.status === "confirmed").map((booking) => <div key={booking.id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-3"><span><span className="block text-sm font-semibold">{booking.resident_name ?? "寮生"}</span><span className="text-xs text-muted-foreground">担当: {booking.ra_name ?? "RA"}</span></span><span className="text-xs font-bold text-primary">{dateTimeLabel(booking.start_at)}</span></div>)}</div></section>}
    </div>
  );
}

function LetsChatBookingPanel({ slots, profileById, currentBooking, pending, onBook }: { slots: OpenLetsChatSlot[]; profileById: Map<string, ScheduleParticipant>; currentBooking?: NamedBooking; pending: boolean; onBook: (raId: string, startAt: string) => void }) {
  if (currentBooking) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><div className="flex items-center gap-2 font-bold"><Check className="h-5 w-5" />予約済みです</div><p className="mt-2 text-lg font-extrabold">{dateTimeLabel(currentBooking.start_at)}</p><p className="mt-1 text-sm">担当: {currentBooking.ra_name ?? profileById.get(currentBooking.ra_id)?.full_name ?? "RA"}</p></section>;
  const byDate = groupBy(slots, (slot) => tokyoDateKey(slot.start_at));
  return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div><h2 className="font-bold">RAと時間を選んで予約</h2><p className="mt-1 text-xs text-muted-foreground">予約できる枠だけが表示されています。予約は1人1枠です。</p></div>{slots.length === 0 ? <div className="rounded-xl bg-secondary/60 p-6 text-center text-sm text-muted-foreground">現在予約できる時間はありません。RAが空き時間を追加するまでお待ちください。</div> : <div className="space-y-5">{Array.from(byDate.entries()).map(([date, items]) => <div key={date}><h3 className="mb-2 text-sm font-bold">{dateLabel(date)}</h3><div className="grid gap-2 sm:grid-cols-2">{items.map((slot) => <button key={`${slot.ra_id}-${slot.start_at}`} type="button" disabled={pending} onClick={() => onBook(slot.ra_id, slot.start_at)} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-left transition-transform active:scale-[0.98]"><span><span className="block text-sm font-bold">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(new Date(slot.start_at))}</span><span className="text-xs text-muted-foreground">{profileById.get(slot.ra_id)?.full_name ?? "RA"}</span></span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">予約</span></button>)}</div></div>)}</div>}</section>;
}
