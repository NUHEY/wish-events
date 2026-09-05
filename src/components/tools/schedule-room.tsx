"use client";

import Image from "next/image";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Clock3, Save, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { bookLetsChatSlot, saveScheduleAvailability, setLetsChatCompleted } from "@/actions/beta-tools";
import { BetaBadge } from "@/components/tools/beta-badge";
import { ShareLinkButton } from "@/components/tools/share-link-button";
import { Button } from "@/components/ui/button";
import { useScheduleOperation } from "@/components/tools/use-schedule-operation";
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

export function ScheduleRoom({ session, participants, availability, openLetsChatSlots, bookings, currentUserId, canManageBookings, canBook = false }: { session: ScheduleSession; participants: ScheduleParticipant[]; availability: ScheduleAvailability[]; openLetsChatSlots: OpenLetsChatSlot[]; bookings: NamedBooking[]; currentUserId: string; canManageBookings: boolean; canBook?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set(availability.filter((item) => item.user_id === currentUserId).map((item) => new Date(item.start_at).toISOString())));
  const { pending, run } = useScheduleOperation();
  const slots = useMemo(() => createSlots(session), [session]);
  const grouped = useMemo(() => groupBy(slots, (slot) => slot.date), [slots]);
  const profileById = useMemo(() => new Map(participants.map((person) => [person.user_id, person])), [participants]);
  const currentParticipant = profileById.get(currentUserId);
  const isAssignedRa = session.kind === "lets_chat" && currentParticipant?.participant_role === "ra";
  const canEnterAvailability = session.status === "open" && !!currentParticipant && (session.kind !== "lets_chat" || currentParticipant.participant_role === "ra");
  const currentBooking = bookings.find((booking) => booking.resident_id === currentUserId && booking.status === "confirmed");

  const availabilityCount = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    availability.forEach((item) => {
      const startAt = new Date(item.start_at).toISOString();
      if (!counts.has(startAt)) counts.set(startAt, new Set());
      counts.get(startAt)?.add(item.user_id);
    });
    return counts;
  }, [availability]);

  const bestSlots = useMemo(() => slots.map((slot) => ({ slot, count: availabilityCount.get(slot.startAt)?.size ?? 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.slot.startAt.localeCompare(b.slot.startAt)).slice(0, 6), [availabilityCount, slots]);

  function toggleSlot(startAt: string) {
    if (pending) return;
    if (!selected.has(startAt) && selected.size >= 1000) {
      toast.error("選択できる空き時間は1000枠までです。候補を絞ってください。");
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(startAt)) next.delete(startAt); else next.add(startAt);
      return next;
    });
  }

  function save() {
    if (!canEnterAvailability) return;
    const chosen = slots.filter((slot) => selected.has(slot.startAt)).map((slot) => ({ startAt: slot.startAt, endAt: slot.endAt }));
    void run(async () => {
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
    if (!canBook || pending || session.status !== "open" || currentBooking) return;
    if (!window.confirm(`${dateTimeLabel(startAt)}で予約しますか？`)) return;
    void run(async () => {
      const result = await bookLetsChatSlot(session.id, raId, startAt);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Let's Chat!を予約しました");
      router.refresh();
    });
  }

  function toggleCompleted(booking: NamedBooking) {
    void run(async () => {
      const result = await setLetsChatCompleted(booking.id, !booking.completed_at);
      if (result.error) toast.error(result.error); else toast.success(booking.completed_at ? "未実施に戻しました" : "実施済みにしました");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PendingFeedback active={pending} label={session.kind === "lets_chat" && canBook ? "予約しています…" : "日程を更新しています…"} />
      <header className="overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.13] via-card to-accent/35 p-5 shadow-card sm:p-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">{SCHEDULE_COPY[session.kind].shortTitle}</span></div><ShareLinkButton title={session.title} path={`/tools/schedule/${session.share_token}`} /></div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">{session.title}</h1>
        {session.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{session.description}</p>}
        <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5"><CalendarCheck className="h-3.5 w-3.5 text-primary" />{dateLabel(session.start_date)}〜{dateLabel(session.end_date)}</span>{(session.kind !== "lets_chat" || isAssignedRa || canManageBookings) && <span className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" />{session.daily_start_time.slice(0, 5)}〜{session.daily_end_time.slice(0, 5)}・{session.slot_minutes}分枠</span>}</div>
      </header>

      {(session.kind !== "lets_chat" || isAssignedRa || canManageBookings) && <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-primary" />参加メンバー</div>
        <div className="mt-3 flex flex-wrap gap-2">{participants.map((person) => <span key={person.user_id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{person.full_name ?? "名前未登録"}{person.participant_role === "ra" && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[8px] text-primary-foreground">RA</span>}<span className="font-normal text-muted-foreground">{formatRoomNumber(person.floor_number ?? null, person.room_number ?? null)}</span></span>)}</div>
      </section>}

      {session.status === "closed" && <p role="status" className="rounded-xl border border-border bg-secondary/40 p-4 text-sm">この日程の受付は終了しました。空き時間の保存や新しい予約はできません。</p>}
      {session.kind === "lets_chat" && session.status === "open" && !isAssignedRa && !canBook && !currentBooking && <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed">{canManageBookings ? "管理用の閲覧画面です。空き時間は担当RAが登録し、対象フロアの新寮生が予約します。" : "この予約は対象フロアの新寮生向けです。"}</p>}
      {session.kind === "lets_chat" && ((canBook && session.status === "open") || currentBooking) ? (
        <LetsChatBookingPanel slots={openLetsChatSlots} profileById={profileById} currentBooking={currentBooking} pending={pending || !canBook || session.status !== "open"} onBook={book} />
      ) : (
        <>
          {session.kind !== "lets_chat" && bestSlots.length > 0 && <section className="rounded-2xl border border-primary/15 bg-primary/[0.055] p-4 sm:p-5"><div className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" />集まりやすい時間</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{bestSlots.map(({ slot, count }) => <div key={slot.key} className="flex items-center justify-between rounded-xl bg-card px-3 py-3 shadow-sm"><span className="text-sm font-semibold">{dateTimeLabel(slot.startAt)}</span><span className={cn("rounded-full px-2 py-1 text-xs font-bold", count === participants.length ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-secondary text-muted-foreground")}>{count}/{participants.length}人</span></div>)}</div></section>}
          {canEnterAvailability && <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div><div className="flex items-center justify-between gap-3"><h2 className="font-bold">空いている時間を選択</h2><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{selected.size}枠</span></div><p className="mt-1 text-xs text-muted-foreground">空いている時間をすべてタップしてください。もう一度押すと解除できます。</p></div><div className="space-y-5">{Array.from(grouped.entries()).map(([date, dateSlots]) => <div key={date}><h3 className="mb-2 text-sm font-bold">{dateLabel(date)}</h3><div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4 sm:grid-cols-6">{dateSlots.map((slot) => { const active = selected.has(slot.startAt); const count = availabilityCount.get(slot.startAt)?.size ?? 0; return <button key={slot.key} type="button" disabled={pending} aria-pressed={active} aria-label={`${dateLabel(slot.date)} ${slot.time}`} onClick={() => toggleSlot(slot.startAt)} className={cn("relative min-h-11 rounded-xl border px-2 py-2.5 text-sm font-semibold transition-[background-color,border-color,transform] active:scale-95", active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background active:bg-secondary")}><span>{slot.time}</span>{session.kind !== "lets_chat" && count > 0 && <span className={cn("absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold", active ? "bg-primary-foreground text-primary" : "bg-secondary text-muted-foreground")}>{count}</span>}</button>; })}</div></div>)}</div><Button type="button" className="sticky bottom-[calc(var(--mobile-tab-bar-total-height)+0.75rem)] w-full rounded-xl sm:static" disabled={pending} onClick={save}><Save className="h-4 w-4" />{pending ? "保存中…" : "選択した空き時間を保存"}</Button></section>}
        </>
      )}

      {canManageBookings && session.kind === "lets_chat" && bookings.length > 0 && <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><h2 className="font-bold">予約・実施状況</h2><div className="mt-3 space-y-2">{bookings.filter((booking) => booking.status === "confirmed").map((booking) => <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-3"><span><span className="block text-sm font-semibold">{booking.resident_name ?? "寮生"}</span><span className="text-xs text-muted-foreground">担当: {booking.ra_name ?? "RA"}・{dateTimeLabel(booking.start_at)}</span></span><Button type="button" size="sm" variant={booking.completed_at ? "secondary" : "outline"} disabled={pending} onClick={() => toggleCompleted(booking)}><Check className="h-4 w-4" />{booking.completed_at ? "実施済み" : "実施済みにする"}</Button></div>)}</div></section>}
    </div>
  );
}

function LetsChatBookingPanel({ slots, profileById, currentBooking, pending, onBook }: { slots: OpenLetsChatSlot[]; profileById: Map<string, ScheduleParticipant>; currentBooking?: NamedBooking; pending: boolean; onBook: (raId: string, startAt: string) => void }) {
  if (currentBooking) return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"><div className="flex items-center gap-2 font-bold"><Check className="h-5 w-5" />予約済みです</div><p className="mt-2 text-lg font-extrabold">{dateTimeLabel(currentBooking.start_at)}</p><p className="mt-1 text-sm">担当: {currentBooking.ra_name ?? profileById.get(currentBooking.ra_id)?.full_name ?? "RA"}</p></section>;
  const byRa = groupBy(slots, (slot) => slot.ra_id);
  return <section className="space-y-4"><div><h2 className="font-bold">RAと時間を選んで予約</h2><p className="mt-1 text-xs text-muted-foreground">話したいRAのカードから、空いている時間を1つ選んでください。</p></div>{slots.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">現在予約できる時間はありません</div> : <div className="grid gap-4 lg:grid-cols-2">{Array.from(byRa.entries()).map(([raId, raSlots]) => { const ra = profileById.get(raId); const byDate = groupBy(raSlots, (slot) => tokyoDateKey(slot.start_at)); return <article key={raId} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"><header className="flex items-start gap-3 border-b border-border bg-gradient-to-br from-primary/[0.09] to-card p-4"><AvatarRing role="ra" size={52}><Image src={ra?.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={52} height={52} className="object-cover" /></AvatarRing><div className="min-w-0"><h3 className="font-extrabold">{ra?.full_name ?? "RA"}</h3><p className="mt-0.5 text-xs text-muted-foreground">{[ra?.faculty, ra?.languages?.slice(0, 2).join("・")].filter(Boolean).join("・") || "フロアRA"}</p>{ra?.self_intro && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{ra.self_intro}</p>}</div></header><div className="space-y-4 p-4">{Array.from(byDate.entries()).map(([date, items]) => <div key={date}><h4 className="mb-2 text-xs font-bold text-muted-foreground">{dateLabel(date)}</h4><div className="grid grid-cols-3 gap-2">{items.map((slot) => <button key={slot.start_at} type="button" disabled={pending} onClick={() => onBook(slot.ra_id, slot.start_at)} className="min-h-11 rounded-xl border border-border bg-background px-2 py-2.5 text-sm font-bold transition-[transform,background-color,border-color] active:scale-95 active:border-primary active:bg-primary/10">{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" }).format(new Date(slot.start_at))}</button>)}</div></div>)}</div></article>; })}</div>}</section>;
}
