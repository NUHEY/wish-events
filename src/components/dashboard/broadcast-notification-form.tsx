"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Building2, Send, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { sendRaBroadcastNotification, type BroadcastSender, type BroadcastTarget } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { FLOORS } from "@/lib/constants";
import { cn, formatRoomNumber } from "@/lib/utils";
import type { UserRole } from "@/types/database";

export type BroadcastResident = { id: string; full_name: string | null; role: UserRole; floor_number: number | null; room_number: string | null };
type Mode = "all" | "floor" | "role" | "individual";
type SenderMode = BroadcastSender["mode"];

export function BroadcastNotificationForm({ residents }: { residents: BroadcastResident[] }) {
  const [mode, setMode] = useState<Mode>("all");
  const [floor, setFloor] = useState<number>(3);
  const [role, setRole] = useState<UserRole>("resident");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("/");
  const [senderMode, setSenderMode] = useState<SenderMode>("self");
  const [customSenderLabel, setCustomSenderLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const broadcastIdRef = useRef<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    broadcastIdRef.current = null;
  }, [customSenderLabel, floor, link, message, mode, role, selectedIds, senderMode]);

  const recipients = useMemo(() => {
    if (mode === "floor") return residents.filter((resident) => resident.floor_number === floor);
    if (mode === "role") return residents.filter((resident) => resident.role === role);
    if (mode === "individual") return residents.filter((resident) => selectedIds.includes(resident.id));
    return residents;
  }, [floor, mode, residents, role, selectedIds]);

  const filteredResidents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return residents;
    return residents.filter((resident) => `${resident.full_name ?? ""} ${formatRoomNumber(resident.floor_number, resident.room_number)}`.toLocaleLowerCase().includes(normalized));
  }, [query, residents]);

  function buildTarget(): BroadcastTarget {
    if (mode === "floor") return { mode, floor };
    if (mode === "role") return { mode, role };
    if (mode === "individual") return { mode, userIds: selectedIds };
    return { mode: "all" };
  }

  function buildSender(): BroadcastSender {
    if (senderMode === "custom") return { mode: "custom", label: customSenderLabel };
    return { mode: senderMode };
  }

  async function handleSend() {
    if (!message.trim() || recipients.length === 0) return;
    const accepted = await confirm({ message: `${recipients.length}人に通知を送信します。よろしいですか？` });
    if (!accepted) return;
    const broadcastId = broadcastIdRef.current ?? crypto.randomUUID();
    broadcastIdRef.current = broadcastId;
    startTransition(async () => {
      const result = await sendRaBroadcastNotification({ message, link, target: buildTarget(), sender: buildSender(), broadcastId });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.count ?? 0}人に通知を送信しました`);
        setMessage("");
        broadcastIdRef.current = null;
      }
    });
  }

  return <div className="space-y-6"><PendingFeedback active={pending} label="通知を送信しています…" /><section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="mb-4 grid gap-2"><Label htmlFor="broadcast-sender">通知の送り主</Label><Select id="broadcast-sender" value={senderMode} onChange={(event) => setSenderMode(event.target.value as SenderMode)}><option value="self">自分（RA個人）</option><option value="system">WISH Events システム</option><option value="front_desk">2F窓口</option><option value="ra_team">RAチーム</option><option value="custom">任意の送り主名</option></Select>{senderMode === "custom" && <Input value={customSenderLabel} onChange={(event) => setCustomSenderLabel(event.target.value)} maxLength={40} placeholder="例: 国際交流センター" aria-label="任意の送り主名" />}<div className="flex items-center gap-2 rounded-xl bg-secondary/45 px-3 py-2 text-xs text-muted-foreground">{senderMode === "self" ? <UserRound className="h-4 w-4 text-primary" /> : senderMode === "front_desk" ? <Building2 className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-primary" />}受信者には、この名前が通知の送り主として表示されます。</div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{([ ["all", "全寮生"], ["floor", "フロア"], ["role", "役割"], ["individual", "個別"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setMode(value)} className={cn("rounded-xl border px-3 py-2.5 text-sm font-semibold active:scale-[0.98]", mode === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>{label}</button>)}</div>

  {mode === "floor" && <div className="mt-4 grid gap-2"><Label htmlFor="broadcast-floor">対象フロア</Label><Select id="broadcast-floor" value={floor} onChange={(event) => setFloor(Number(event.target.value))}>{FLOORS.map((value) => <option key={value} value={value}>{value}階</option>)}</Select></div>}
  {mode === "role" && <div className="mt-4 grid gap-2"><Label htmlFor="broadcast-role">対象の役割</Label><Select id="broadcast-role" value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="resident">一般寮生</option><option value="ra">RA</option></Select></div>}
  {mode === "individual" && <div className="mt-4 space-y-3"><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名前・部屋番号で検索" /><div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border p-2">{filteredResidents.map((resident) => <label key={resident.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary"><Checkbox checked={selectedIds.includes(resident.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, resident.id])] : current.filter((id) => id !== resident.id))} /><span className="min-w-0 flex-1 truncate">{resident.full_name ?? "名前未登録"}</span><span className="text-xs text-muted-foreground">{formatRoomNumber(resident.floor_number, resident.room_number)}</span></label>)}</div></div>}

  <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/[0.08] px-3 py-2.5 text-sm font-semibold text-primary"><Users className="h-4 w-4" />送信対象: {recipients.length}人</div></section>

  <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="grid gap-2"><div className="flex items-center justify-between"><Label htmlFor="broadcast-message">通知本文</Label><span className={cn("text-xs", message.length > 180 ? "text-destructive" : "text-muted-foreground")}>{message.length}/180</span></div><Textarea id="broadcast-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={180} rows={5} placeholder="寮生へ伝える短い案内を入力してください" /></div><div className="grid gap-2"><Label htmlFor="broadcast-link">タップ後に開くサイト内ページ</Label><Input id="broadcast-link" value={link} onChange={(event) => setLink(event.target.value)} placeholder="例: /events/イベントID" /><p className="text-xs text-muted-foreground">`/`から始まるWISH Events内のパスを指定します。</p></div><Button type="button" onClick={handleSend} disabled={pending || !message.trim() || recipients.length === 0 || (senderMode === "custom" && !customSenderLabel.trim())} className="w-full"><Send className="h-4 w-4" />{pending ? "送信中…" : `${recipients.length}人に通知を送信`}</Button></section></div>;
}
